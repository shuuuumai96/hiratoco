import {AppError, DEFAULT_LANGUAGE, LANGUAGES} from "./i18n.js";

export const VERSION = 1;
export const STORAGE_KEY = "appdock";
export const MAX_APPS = 100;
export const MAX_NAME = 50;
export const MAX_URL = 2048;
export const MAX_ICON_LENGTH = 32768;
export const ICON_SIZE = 64;
export const DEFAULT_ICON = "icons/site.svg";
export const THEMES = ["auto", "light", "dark"];

export const DEFAULT_APPS = Object.freeze([
  ["account", "アカウント", "https://myaccount.google.com/"],
  ["search", "検索", "https://www.google.com/"],
  ["maps", "マップ", "https://maps.google.com/"],
  ["youtube", "YouTube", "https://www.youtube.com/"],
  ["play", "Play", "https://play.google.com/"],
  ["gmail", "Gmail", "https://mail.google.com/"],
  ["drive", "ドライブ", "https://drive.google.com/"],
  ["calendar", "カレンダー", "https://calendar.google.com/"],
  ["translate", "翻訳", "https://translate.google.com/"],
  ["gemini", "Gemini", "https://gemini.google.com/"],
  ["news", "ニュース", "https://news.google.com/"],
  ["photos", "フォト", "https://photos.google.com/"],
  ["keep", "Keep", "https://keep.google.com/"],
  ["meet", "Meet", "https://meet.google.com/"]
].map(([id, name, url]) => Object.freeze({id, name, url, icon: `icons/${id}.svg`})));

const BUILTIN_ICONS = new Set([DEFAULT_ICON, ...DEFAULT_APPS.map(app => app.icon)]);
const ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;

export function validateUrl(value) {
  if (typeof value !== "string" || value.length > MAX_URL || /[\u0000-\u0020\u007f]/u.test(value.trim())) {
    throw new AppError("urlWhitespace");
  }
  let url;
  try { url = new URL(value.trim()); } catch { throw new AppError("urlInvalid"); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.href.length > MAX_URL) {
    throw new AppError("urlHttpsOnly");
  }
  return url.href;
}

/**
 * Stored custom icons use the bounded PNG format produced by readIconFile.
 * This checks the envelope, not the integrity of the entire image payload.
 */
export function validIcon(value) {
  if (BUILTIN_ICONS.has(value)) return true;
  if (typeof value !== "string" || value.length > MAX_ICON_LENGTH || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    const bytes = atob(value.slice("data:image/png;base64,".length));
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    const read32 = offset => [...bytes.slice(offset, offset + 4)].reduce((n, c) => n * 256 + c.charCodeAt(0), 0);
    return signature.every((byte, i) => bytes.charCodeAt(i) === byte) &&
      bytes.slice(12, 16) === "IHDR" && read32(16) === ICON_SIZE && read32(20) === ICON_SIZE;
  } catch { return false; }
}

export function validateApp(app) {
  if (!app || typeof app !== "object" || typeof app.id !== "string" || !ID_PATTERN.test(app.id) || typeof app.name !== "string") {
    throw new AppError("appInvalid");
  }
  const name = app.name.trim();
  if (!name || name.length > MAX_NAME || /[\u0000-\u001f\u007f]/u.test(name)) {
    throw new AppError("nameInvalid", {max: MAX_NAME});
  }
  if (!validIcon(app.icon)) throw new AppError("iconInvalid");
  return {id: app.id, name, url: validateUrl(app.url), icon: app.icon};
}

/**
 * Compare the saved app with the dialog's opening snapshot inside the update.
 * Other apps, settings, and ordering may change without invalidating this edit.
 */
export function assertAppUnchanged(apps, expected) {
  const current = apps.find(app => app.id === expected.id);
  if (!current) throw new AppError("editMissing");
  if (current.name !== expected.name || current.url !== expected.url || current.icon !== expected.icon) {
    throw new AppError("editConflict");
  }
}

export function defaults(language = DEFAULT_LANGUAGE) {
  const selectedLanguage = LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  return {version: VERSION, apps: DEFAULT_APPS.map(app => ({...app})), settings: {theme: "auto", language: selectedLanguage}};
}

/**
 * Reject invalid edits rather than applying read-time recovery.
 * Earlier version 1 data may omit language; normalization never mutates input.
 */
export function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state) || state.version !== VERSION ||
      !Array.isArray(state.apps) || !state.settings || typeof state.settings !== "object" || Array.isArray(state.settings)) {
    throw new AppError("stateInvalid");
  }
  const language = state.settings.language === undefined ? DEFAULT_LANGUAGE : state.settings.language;
  if (state.apps.length > MAX_APPS || !THEMES.includes(state.settings.theme) || !LANGUAGES.includes(language)) {
    throw new AppError("stateLimits");
  }
  const apps = Array.from(state.apps, validateApp);
  if (new Set(apps.map(app => app.id)).size !== apps.length) throw new AppError("duplicateId");
  return {version: VERSION, apps, settings: {theme: state.settings.theme, language}};
}

/**
 * Recover safe entries for display without writing back to storage.
 * Preserve intentional empty lists and keep unknown future formats read-only
 * to avoid replacing data this version cannot understand.
 */
export function decodeState(raw, initialLanguage = DEFAULT_LANGUAGE) {
  if (raw === undefined) return {state: defaults(initialLanguage), notice: "", readOnly: false};
  if (raw && Number.isInteger(raw.version) && raw.version > VERSION) {
    return {state: defaults(raw.settings?.language), notice: "noticeFuture", readOnly: true};
  }
  if (!raw || raw.version !== VERSION || !Array.isArray(raw.apps)) {
    return {state: defaults(raw?.settings?.language), notice: "noticeInvalid", readOnly: true};
  }
  const apps = [];
  const ids = new Set();
  let repaired = raw.apps.length > MAX_APPS;
  for (const entry of raw.apps.slice(0, MAX_APPS)) {
    try {
      const app = validateApp({...entry, icon: validIcon(entry?.icon) ? entry.icon : DEFAULT_ICON});
      if (ids.has(app.id)) throw new AppError("duplicateId");
      ids.add(app.id);
      apps.push(app);
      if (app.icon !== entry.icon) repaired = true;
    } catch { repaired = true; }
  }
  const theme = THEMES.includes(raw.settings?.theme) ? raw.settings.theme : "auto";
  if (theme !== raw.settings?.theme) repaired = true;
  const storedLanguage = raw.settings?.language;
  const language = LANGUAGES.includes(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
  if (storedLanguage !== undefined && storedLanguage !== language) repaired = true;
  const state = {version: VERSION, apps: raw.apps.length && !apps.length ? defaults().apps : apps, settings: {theme, language}};
  return {state, notice: repaired ? "noticeRepaired" : "", readOnly: repaired};
}

export function moveApp(apps, id, targetIndex) {
  const result = [...apps];
  const from = result.findIndex(app => app.id === id);
  if (from < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= result.length) return result;
  result.splice(targetIndex, 0, result.splice(from, 1)[0]);
  return result;
}
