import {loadState} from "./storage.js";
import {STORAGE_KEY} from "./model.js";
import {applyTheme, appImage, appDisplayName} from "./ui.js";
import {applyTranslations, t} from "./i18n.js";
import {extensionApi} from "./browser-api.js";

const browser = extensionApi();

async function render() {
  const {state, notice} = await loadState();
  applyTheme(state);
  applyTranslations(state.settings.language);
  const message = document.querySelector("#notice");
  message.textContent = notice ? t(notice) : "";
  message.hidden = !notice;
  const list = document.querySelector("#apps");
  const focusedId = document.activeElement?.dataset.appId;
  list.replaceChildren(...state.apps.map(app => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = app.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "app-tile";
    link.dataset.appId = app.id;
    link.title = `${appDisplayName(app)}\n${app.url}`;
    const name = document.createElement("span");
    name.textContent = appDisplayName(app);
    link.append(appImage(app), name);
    item.append(link);
    return item;
  }));
  document.querySelector("#empty").hidden = state.apps.length > 0;
  if (focusedId) [...list.querySelectorAll("a")].find(link => link.dataset.appId === focusedId)?.focus();
}

document.querySelector("#edit").addEventListener("click", async () => {
  try { await browser.runtime.openOptionsPage(); window.close(); }
  catch { const message = document.querySelector("#notice"); message.hidden = false; message.textContent = t("openOptionsFailed"); }
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") window.close();
  const links = [...document.querySelectorAll(".app-tile")];
  const index = links.indexOf(document.activeElement);
  const offset = {ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3}[event.key];
  if (index >= 0 && offset !== undefined) {
    event.preventDefault();
    links[Math.max(0, Math.min(links.length - 1, index + offset))]?.focus();
  }
});
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && STORAGE_KEY in changes) void render();
});
void render();
