import {RECOVERY_PREFIX, deleteAppState, deleteRecoveryCopies, eraseAllData, loadDataSummary, loadState, repairState, updateState} from "./storage.js";
import {DEFAULT_ICON, MAX_APPS, STORAGE_KEY, assertAppUnchanged, moveApp, validateApp} from "./model.js";
import {readIconFile} from "./icons.js";
import {applyTheme, appImage, appDisplayName, button} from "./ui.js";
import {AppError, applyTranslations, errorText, t} from "./i18n.js";

const $ = selector => document.querySelector(selector);
let state;
let readOnly = true;
let busy = false;
let editingId = null;
let editingApp = null;
let editingDisplayName = "";
let deletingId = null;
let deletingApp = null;
let selectedIcon = DEFAULT_ICON;
let imageTask = 0;
let imagePending = false;
let dragId = null;
let returnFocus = null;
let repairSource;
let repairingSource;
let dataSummary = {backups: 0, canManage: false, notice: ""};
let dataAction;

function status(message) { $("#status").textContent = message; }

async function refresh() {
  const [loaded, summary] = await Promise.all([loadState(), loadDataSummary()]);
  dataSummary = summary;
  state = loaded.state;
  readOnly = loaded.readOnly;
  repairSource = loaded.repairSource;
  applySettings();
  $("#notice").textContent = loaded.notice ? t(loaded.notice) : "";
  $("#notice").hidden = !loaded.notice;
  if (readOnly && $("#editor").open) $("#form-error").textContent = t(loaded.notice);
  if (readOnly && $("#delete-dialog").open) $("#delete-message").textContent = t(loaded.notice);
  renderList();
}

function applySettings() {
  applyTheme(state);
  applyTranslations(state.settings.language);
  $("#theme").value = state.settings.theme;
  $("#language").value = state.settings.language;
  $("#editor-title").textContent = t(editingId ? "dialogEdit" : "dialogAdd");
}

function renderList(focusId, action) {
  $("#count").textContent = `(${state.apps.length} / ${MAX_APPS})`;
  $("#add").disabled = readOnly || busy || state.apps.length >= MAX_APPS;
  $("#theme").disabled = readOnly || busy;
  $("#language").disabled = readOnly || busy;
  $("#repair").hidden = repairSource === undefined;
  $("#repair").disabled = busy;
  $("#backup-count").textContent = t("backupCount", {count: dataSummary.backups});
  $("#data-notice").textContent = dataSummary.notice ? t(dataSummary.notice) : "";
  $("#delete-backups").disabled = busy || !dataSummary.canManage || !dataSummary.backups;
  $("#erase-data").disabled = busy || !dataSummary.canManage;
  $("#empty").hidden = state.apps.length > 0;
  $("#apps").replaceChildren(...state.apps.map(createAppRow));
  updateDialogControls();
  restoreListFocus(focusId, action);
}

function updateDialogControls() {
  $("#save").disabled = busy || readOnly || imagePending;
  $("#cancel").disabled = busy;
  $("#icon-file").disabled = busy || readOnly;
  $("#clear-icon").disabled = busy || readOnly;
  $("#delete-confirm").disabled = busy || readOnly;
  $("#delete-cancel").disabled = busy;
  $("#repair-confirm").disabled = busy;
  $("#repair-cancel").disabled = busy;
  $("#data-confirm").disabled = busy;
  $("#data-cancel").disabled = busy;
}

function createAppRow(app, index) {
  const row = document.createElement("li");
  row.className = "editor-row";
  row.dataset.appId = app.id;
  row.tabIndex = 0;
  row.draggable = !readOnly && !busy;
  row.setAttribute("aria-label", t("rowLabel", {name: appDisplayName(app), position: index + 1}));

  const grip = document.createElement("span");
  grip.className = "grip";
  grip.textContent = "⠿";
  grip.setAttribute("aria-hidden", "true");

  const text = document.createElement("div");
  text.className = "row-text";
  const title = document.createElement("strong");
  title.textContent = appDisplayName(app);
  const url = document.createElement("span");
  url.textContent = app.url;
  text.append(title, url);

  row.append(grip, appImage(app), text, createRowActions(app, index));
  bindRowEvents(row, app, index);
  return row;
}

function createRowActions(app, index) {
  const actions = document.createElement("div");
  actions.className = "row-actions";
  const controls = [
    {label: "moveUp", key: "up", description: "actionUp", run: () => reorder(app.id, index - 1, "up"), disabled: index === 0},
    {label: "moveDown", key: "down", description: "actionDown", run: () => reorder(app.id, index + 1, "down"), disabled: index === state.apps.length - 1},
    {label: "edit", key: "edit", description: "actionEdit", run: () => openEditor(app)},
    {label: "delete", key: "delete", description: "actionDelete", run: () => openDelete(app)}
  ];
  for (const {label, key, description, run, disabled} of controls) {
    const control = button(t(label), run);
    control.dataset.action = key;
    control.setAttribute("aria-label", t(description, {name: appDisplayName(app)}));
    control.disabled = Boolean(disabled || readOnly || busy);
    actions.append(control);
  }
  return actions;
}

function bindRowEvents(row, app, index) {
  row.addEventListener("keydown", event => {
    if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      void reorder(app.id, index + (event.key === "ArrowUp" ? -1 : 1));
    }
  });
  row.addEventListener("dragstart", event => {
    if (readOnly || busy || event.target.closest("button")) {
      event.preventDefault();
      return;
    }
    dragId = app.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", app.id);
    row.classList.add("dragging");
  });
  row.addEventListener("dragover", event => {
    if (!dragId || readOnly || busy) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    row.classList.add("drop-target");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
  row.addEventListener("drop", event => {
    event.preventDefault();
    if (dragId) void reorder(dragId, index);
    clearDragState();
  });
  row.addEventListener("dragend", clearDragState);
}

function clearDragState() {
  dragId = null;
  $("#apps").querySelectorAll(".dragging,.drop-target").forEach(row => row.classList.remove("dragging", "drop-target"));
}

function restoreListFocus(id, action) {
  const row = [...$("#apps").children].find(item => item.dataset.appId === id);
  const control = action ? row?.querySelector(`[data-action="${action}"]`) : null;
  if (row) (control && !control.disabled ? control : row).focus();
}

function commit(change, message, focusId, action) {
  return commitOperation(() => updateState(change), message, focusId, action);
}

async function commitOperation(operation, message, focusId, action) {
  if (busy || readOnly) return false;
  busy = true;
  renderList();
  try {
    state = await operation();
    applySettings();
    $("#notice").hidden = true;
    status(t(message));
    return true;
  } catch (error) {
    if (error instanceof AppError && ["editConflict", "editMissing"].includes(error.key)) await refresh();
    status(t("saveFailed", {reason: errorText(error)}));
    return false;
  } finally {
    busy = false;
    dataSummary = await loadDataSummary();
    renderList(focusId, action);
  }
}

async function reorder(id, target, action) {
  if (target < 0 || target >= state.apps.length) return;
  await commit(current => ({...current, apps: moveApp(current.apps, id, target)}), "savedOrder", id, action);
}

function openEditor(app) {
  if (busy || readOnly) return;
  editingId = app?.id ?? null;
  editingApp = app ? {...app} : null;
  editingDisplayName = app ? appDisplayName(app) : "";
  returnFocus = editingId;
  cancelImageRead();
  selectedIcon = app?.icon ?? DEFAULT_ICON;
  $("#app-form").reset();
  $("#editor-title").textContent = t(app ? "dialogEdit" : "dialogAdd");
  $("#name").value = editingDisplayName;
  $("#url").value = app?.url ?? "";
  $("#preview").src = selectedIcon;
  $("#form-error").textContent = "";
  updateDialogControls();
  $("#editor").showModal();
  $("#name").focus();
}

function openDelete(app) {
  if (busy || readOnly) return;
  deletingId = app.id;
  deletingApp = {...app};
  $("#delete-message").textContent = t("deleteMessage", {name: appDisplayName(app)});
  updateDialogControls();
  $("#delete-dialog").showModal();
}

async function changeTheme(event) {
  const theme = event.target.value;
  await commit(current => ({...current, settings: {...current.settings, theme}}), "savedTheme");
  $("#theme").value = state.settings.theme;
  $("#theme").focus();
}

async function changeLanguage(event) {
  const language = event.target.value;
  await commit(current => ({...current, settings: {...current.settings, language}}), "savedLanguage");
  $("#language").value = state.settings.language;
  $("#language").focus();
}

/**
 * Invalidate pending results without aborting browser decoding.
 * Late results must not affect another edit or a newer icon choice.
 */
function cancelImageRead() {
  imageTask++;
  imagePending = false;
}

function closeEditor() {
  cancelImageRead();
  editingApp = null;
  editingDisplayName = "";
  selectedIcon = DEFAULT_ICON;
  $("#app-form").reset();
  $("#preview").src = DEFAULT_ICON;
  renderList(returnFocus, "edit");
  if (!returnFocus) $("#add").focus();
}

function clearIcon() {
  cancelImageRead();
  selectedIcon = DEFAULT_ICON;
  $("#preview").src = selectedIcon;
  $("#icon-file").value = "";
  $("#form-error").textContent = "";
  updateDialogControls();
}

async function selectIcon(event) {
  const file = event.target.files[0];
  cancelImageRead();
  const task = imageTask;
  if (!file) {
    updateDialogControls();
    return;
  }
  imagePending = true;
  updateDialogControls();
  $("#form-error").textContent = "";
  try {
    const icon = await readIconFile(file);
    if (task !== imageTask) return;
    selectedIcon = icon;
    $("#preview").src = icon;
  } catch (error) {
    if (task === imageTask) $("#form-error").textContent = t("imageUnavailable", {reason: errorText(error)});
  } finally {
    if (task === imageTask) {
      imagePending = false;
      updateDialogControls();
    }
  }
}

/**
 * Keep an unchanged translated name in its original stored form so that
 * editing another field does not permanently rename a default app.
 */
async function saveApp(event) {
  event.preventDefault();
  if (busy || readOnly || imagePending) return;
  try {
    const inputName = $("#name").value;
    const name = editingApp && inputName.trim() === editingDisplayName ? editingApp.name : inputName;
    const app = validateApp({id: editingId ?? crypto.randomUUID(), name, url: $("#url").value, icon: selectedIcon});
    const saved = await commit(current => {
      if (editingApp) assertAppUnchanged(current.apps, editingApp);
      const apps = editingId ? current.apps.map(item => item.id === editingId ? app : item) : [...current.apps, app];
      return {...current, apps};
    }, "savedApp");
    if (saved) {
      returnFocus = app.id;
      $("#editor").close();
    } else {
      $("#form-error").textContent = $("#status").textContent;
    }
  } catch (error) {
    $("#form-error").textContent = errorText(error);
  }
}

async function deleteApp() {
  const index = state.apps.findIndex(app => app.id === deletingId);
  const saved = await commitOperation(() => deleteAppState(deletingApp), "deletedApp");
  if (saved) {
    deletingId = state.apps[Math.min(index, state.apps.length - 1)]?.id;
    $("#delete-dialog").close();
    if (!deletingId) $("#add").focus();
  } else {
    $("#delete-message").textContent = $("#status").textContent;
  }
}

function preventCancelWhileSaving(event) {
  if (busy) event.preventDefault();
}

function openRepair() {
  if (busy || repairSource === undefined) return;
  repairingSource = structuredClone(repairSource);
  $("#repair-error").textContent = "";
  $("#repair-dialog").showModal();
}

async function confirmRepair() {
  if (busy) return;
  busy = true;
  renderList();
  try {
    await repairState(repairingSource);
    await refresh();
    status(t("repairedData"));
    $("#repair-dialog").close();
  } catch (error) {
    await refresh();
    $("#repair-error").textContent = errorText(error);
  } finally {
    busy = false;
    renderList();
    if (!$("#repair-dialog").open) $("#add").focus();
  }
}

function openDataDialog(action) {
  if (busy || !dataSummary.canManage) return;
  dataAction = action;
  $("#data-title").textContent = t(action === "all" ? "eraseData" : "deleteBackups");
  $("#data-message").textContent = t(action === "all" ? "eraseDataMessage" : "deleteBackupsMessage");
  $("#data-confirm").textContent = t(action === "all" ? "eraseData" : "deleteBackups");
  $("#data-error").textContent = "";
  $("#data-dialog").showModal();
}

async function confirmDataDeletion() {
  if (busy) return;
  busy = true;
  renderList();
  try {
    if (dataAction === "all") await eraseAllData();
    else await deleteRecoveryCopies();
    await refresh();
    status(t(dataAction === "all" ? "erasedData" : "deletedBackups"));
    $("#data-dialog").close();
  } catch (error) {
    $("#data-error").textContent = errorText(error);
  } finally {
    busy = false;
    dataSummary = await loadDataSummary();
    renderList();
    if (!$("#data-dialog").open) $("#erase-data").focus();
  }
}

$("#add").addEventListener("click", () => openEditor());
$("#theme").addEventListener("change", changeTheme);
$("#language").addEventListener("change", changeLanguage);
$("#app-form").addEventListener("submit", saveApp);
$("#icon-file").addEventListener("change", selectIcon);
$("#clear-icon").addEventListener("click", clearIcon);
$("#cancel").addEventListener("click", () => $("#editor").close());
$("#editor").addEventListener("cancel", preventCancelWhileSaving);
$("#editor").addEventListener("close", closeEditor);
$("#delete-cancel").addEventListener("click", () => $("#delete-dialog").close());
$("#delete-confirm").addEventListener("click", deleteApp);
$("#delete-dialog").addEventListener("cancel", preventCancelWhileSaving);
$("#delete-dialog").addEventListener("close", () => { deletingApp = null; renderList(deletingId, "delete"); });
$("#repair").addEventListener("click", openRepair);
$("#repair-confirm").addEventListener("click", confirmRepair);
$("#repair-cancel").addEventListener("click", () => $("#repair-dialog").close());
$("#repair-dialog").addEventListener("cancel", preventCancelWhileSaving);
$("#repair-dialog").addEventListener("close", () => {
  repairingSource = undefined;
  if (!$("#repair").hidden) $("#repair").focus();
});
$("#delete-backups").addEventListener("click", () => openDataDialog("backups"));
$("#erase-data").addEventListener("click", () => openDataDialog("all"));
$("#data-confirm").addEventListener("click", confirmDataDeletion);
$("#data-cancel").addEventListener("click", () => $("#data-dialog").close());
$("#data-dialog").addEventListener("cancel", preventCancelWhileSaving);
$("#data-dialog").addEventListener("close", () => $("#erase-data").focus());
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && !busy && Object.keys(changes).some(key => key === STORAGE_KEY || key.startsWith(RECOVERY_PREFIX))) void refresh();
});
void refresh();
