import { STORAGE_KEY, assertAppUnchanged, decodeState, defaults, validateState } from "./model.js";
import { AppError, initialLanguage } from "./i18n.js";
import { extensionApi } from "./browser-api.js";

export const WRITE_LOCK = "appdock-storage-write";
export const RECOVERY_PREFIX = "appdock-recovery-";
const DEFAULT_COOKIE_STORE = "firefox-default";

async function writeRestriction(requireTab = false) {
  // Private windows and containers have separate Web Locks but share extension
  // storage. Only regular settings tabs (Firefox's default container) may write.
  const browser = extensionApi();
  if (browser.extension?.inIncognitoContext) return "noticePrivate";
  if (!globalThis.navigator?.locks?.request) return "noticeLockUnavailable";
  try {
    const tab = await browser.tabs.getCurrent();
    if (tab?.incognito) return "noticePrivate";
    if (!tab) return requireTab ? "noticeContainer" : "";
    // Chromium has no Firefox cookieStoreId. Detect the extension origin rather
    // than accepting missing container information in Firefox.
    const chromium = browser.runtime?.getURL?.("").startsWith("chrome-extension://");
    if (chromium ? tab.incognito !== false : tab.cookieStoreId !== DEFAULT_COOKIE_STORE) return "noticeContainer";
  } catch {
    return "noticeContainer";
  }
  return "";
}

export async function loadState() {
  const browser = extensionApi();
  try {
    const raw = await browser.storage.local.get(STORAGE_KEY);
    const source = raw[STORAGE_KEY];
    const loaded = decodeState(source, initialLanguage());
    const restriction = await writeRestriction();
    if (restriction) return { ...loaded, notice: restriction, readOnly: true };
    return ["noticeInvalid", "noticeRepaired"].includes(loaded.notice) ? { ...loaded, repairSource: source } : loaded;
  } catch {
    return { ...decodeState(undefined, initialLanguage()), notice: "noticeReadFailed", readOnly: true };
  }
}

/**
 * Hold one origin-wide lock across the entire read/validate/write operation.
 * Never fall back to page-local serialization if locking is unavailable.
 */
async function withWriteLock(operation) {
  const restriction = await writeRestriction(true);
  if (restriction) throw new AppError(restriction);
  return navigator.locks.request(WRITE_LOCK, { mode: "exclusive" }, operation);
}

export function updateState(change) {
  const browser = extensionApi();
  return withWriteLock(async () => {
    const loaded = await loadState();
    if (loaded.readOnly) throw new AppError(loaded.notice);
    const next = validateState(change(loaded.state));
    await browser.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  });
}

function sameStoredValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && left.length !== right.length) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameStoredValue(left[key], right[key]));
}

/**
 * Repair only the data confirmed by the user. Keep every original separately;
 * a failed backup must never replace the original.
 */
export function repairState(expectedSource) {
  const browser = extensionApi();
  const expected = structuredClone(expectedSource);
  return withWriteLock(async () => {
    const loaded = await loadState();
    if (!Object.hasOwn(loaded, "repairSource")) throw new AppError(loaded.notice || "repairChanged");
    if (!sameStoredValue(loaded.repairSource, expected)) throw new AppError("repairChanged");
    const next = validateState(loaded.state);
    const backupKey = `${RECOVERY_PREFIX}${crypto.randomUUID()}`;
    await browser.storage.local.set({ [backupKey]: { savedAt: new Date().toISOString(), source: expected } });
    await browser.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  });
}

function recoveryKeys(raw) {
  return Object.keys(raw).filter(key => key.startsWith(RECOVERY_PREFIX));
}

export async function loadDataSummary() {
  const browser = extensionApi();
  try {
    const raw = await browser.storage.local.get(null);
    const restriction = await writeRestriction(true);
    return {backups: recoveryKeys(raw).length, canManage: !restriction, notice: restriction};
  } catch {
    return {backups: 0, canManage: false, notice: "noticeReadFailed"};
  }
}

async function removeRecoveryCopies() {
  const browser = extensionApi();
  const raw = await browser.storage.local.get(null);
  const keys = recoveryKeys(raw);
  if (keys.length) await browser.storage.local.remove(keys);
}

export function deleteRecoveryCopies() {
  return withWriteLock(removeRecoveryCopies);
}

/**
 * A confirmed deletion also discards every recovery copy, so an old original
 * cannot retain the deleted item. Remove copies first: on failure keep the app.
 */
export function deleteAppState(expectedApp) {
  const browser = extensionApi();
  const expected = {...expectedApp};
  return withWriteLock(async () => {
    const loaded = await loadState();
    if (loaded.readOnly) throw new AppError(loaded.notice);
    assertAppUnchanged(loaded.state.apps, expected);
    const next = validateState({...loaded.state, apps: loaded.state.apps.filter(app => app.id !== expected.id)});
    await removeRecoveryCopies();
    await browser.storage.local.set({[STORAGE_KEY]: next});
    return next;
  });
}

/** Explicit reset also removes unknown/old keys, without persisting defaults. */
export function eraseAllData() {
  const browser = extensionApi();
  return withWriteLock(async () => {
    await browser.storage.local.clear();
    return defaults(initialLanguage());
  });
}
