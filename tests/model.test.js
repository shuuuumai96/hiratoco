import test from "node:test";
import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import {installLocks} from "./helpers/locks.js";
import {DEFAULT_APPS, DEFAULT_ICON, MAX_APPS, VERSION, defaults, validateUrl, validateApp, validateState, validIcon, decodeState, moveApp, STORAGE_KEY} from "../extension/model.js";

test("14 initial services have unique IDs, HTTPS URLs, and bundled icons", async () => {
  assert.equal(DEFAULT_APPS.length, 14);
  assert.equal(new Set(DEFAULT_APPS.map(app => app.id)).size, 14);
  for (const app of DEFAULT_APPS) {
    assert.deepEqual(validateApp(app), app);
    assert.match(await readFile(new URL(`../extension/${app.icon}`, import.meta.url), "utf8"), /^<svg/);
  }
  const copy = defaults(); copy.apps.pop();
  assert.equal(defaults().apps.length, 14);
});

test("URLs reject dangerous schemes, credentials, whitespace, and excessive size", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,hi", "file:///C:/x", "http://example.com", "ftp://example.com", "https://user:pass@example.com", "https://example.com/a\nb", "https://exa mple.com", "", null, "https://example.com/" + "a".repeat(2048)]) {
    assert.throws(() => validateUrl(url), String(url));
  }
  assert.equal(validateUrl(" https://EXAMPLE.com "), "https://example.com/");
  assert.equal(validateUrl("https://example.com/a?q=日本語#test"), new URL("https://example.com/a?q=日本語#test").href);
});

test("app names and icon allowlist reject malicious values", () => {
  for (const name of ["", " ", "a".repeat(51), "a\u0000b"]) assert.throws(() => validateApp({...DEFAULT_APPS[0], name}));
  for (const icon of ["https://evil.test/icon.png", "icons/../manifest.json", "data:image/svg+xml,<svg/>", "data:image/png;base64,YQ==", {}, null]) assert.equal(validIcon(icon), false);
  assert.equal(validateApp({...DEFAULT_APPS[0], name: "<img onerror=alert(1)>"}).name, "<img onerror=alert(1)>");
});

test("corruption recovery retains safe entries without mutating source", () => {
  for (const raw of [null, "bad", {}, {version: 1, apps: "bad"}, {version: -1}]) {
    const result = decodeState(raw); assert.equal(result.state.apps.length, 14); assert.ok(result.notice); assert.equal(result.readOnly, true);
  }
  const raw = defaults();
  raw.apps[0].url = "javascript:alert(1)";
  raw.apps[1].icon = "https://evil.test/a";
  raw.apps.push(raw.apps[2], null);
  const before = structuredClone(raw);
  const result = decodeState(raw);
  assert.deepEqual(raw, before);
  assert.equal(result.state.apps.length, 13);
  assert.equal(result.state.apps[0].icon, DEFAULT_ICON);
  assert.ok(result.notice);
  assert.equal(result.readOnly, true);
  assert.equal(decodeState({version: 1, apps: [], settings: {theme: "dark"}}).state.apps.length, 0);
  assert.equal(decodeState({version: 1, apps: [null]}).state.apps.length, 14);
  assert.equal(decodeState({...defaults(), version: 2}).readOnly, true);
  assert.equal(decodeState(undefined).notice, "");
});

test("limits, invalid themes, and stable reorder", () => {
  const raw = defaults();
  raw.apps = Array.from({length: MAX_APPS + 1}, (_, i) => ({...DEFAULT_APPS[0], id: `app-${i}`}));
  raw.settings.theme = "bad";
  const result = decodeState(raw);
  assert.equal(result.state.apps.length, MAX_APPS);
  assert.equal(result.state.settings.theme, "auto");
  const moved = moveApp(DEFAULT_APPS, "account", 3);
  assert.equal(moved[3].id, "account");
  assert.equal(moved[0].id, "search");
  assert.equal(DEFAULT_APPS[0].id, "account");
  assert.deepEqual(moveApp(DEFAULT_APPS, "missing", 3), DEFAULT_APPS);
  assert.deepEqual(moveApp(DEFAULT_APPS, "account", -1), DEFAULT_APPS);
});

test("language defaults preserve version 1 data and repair only unsupported values", () => {
  const legacy = defaults();
  delete legacy.settings.language;
  legacy.apps = [legacy.apps[2], {id: "custom", name: "手動登録", url: "https://example.com/", icon: DEFAULT_ICON}];
  const before = structuredClone(legacy);
  const loaded = decodeState(legacy);
  assert.equal(loaded.state.version, VERSION);
  assert.equal(loaded.state.settings.language, "ja");
  assert.equal(loaded.notice, "");
  assert.deepEqual(loaded.state.apps, before.apps);
  assert.deepEqual(legacy, before);
  assert.equal(validateState(legacy).settings.language, "ja");
  assert.equal(defaults().settings.language, "ja");

  const english = {...legacy, settings: {...legacy.settings, language: "en"}};
  assert.equal(decodeState(english).state.settings.language, "en");
  assert.equal(decodeState(english).notice, "");
  assert.equal(validateState(english).settings.language, "en");
  assert.deepEqual(decodeState(english).state.apps, legacy.apps);

  for (const language of ["fr", "", null, false, 1, [], {}]) {
    const invalid = {...legacy, settings: {...legacy.settings, language}};
    const repaired = decodeState(invalid);
    assert.equal(repaired.state.settings.language, "ja");
    assert.equal(repaired.notice, "noticeRepaired");
    assert.deepEqual(repaired.state.apps, legacy.apps);
    assert.throws(() => validateState(invalid));
  }
});

test("fallback states preserve a supported language when other stored data is unreadable", () => {
  for (const language of ["ja", "en", "fr", null, undefined]) {
    const expectedLanguage = language === "en" ? "en" : "ja";
    assert.equal(defaults(language).settings.language, expectedLanguage);
    for (const [raw, notice, readOnly] of [
      [{version: VERSION + 1, apps: [], settings: {language}}, "noticeFuture", true],
      [{version: VERSION, apps: "broken", settings: {language}}, "noticeInvalid", true],
      [{version: -1, settings: {language}}, "noticeInvalid", true]
    ]) {
      const before = structuredClone(raw);
      const loaded = decodeState(raw);
      assert.equal(loaded.state.settings.language, expectedLanguage);
      assert.equal(loaded.state.apps.length, 14);
      assert.equal(loaded.notice, notice);
      assert.equal(loaded.readOnly, readOnly);
      assert.deepEqual(raw, before);
    }
  }
});

test("state validation returns a normalized copy with the complete storage format", () => {
  const input = Object.freeze({
    version: VERSION,
    apps: Object.freeze([Object.freeze({id: "custom", name: " Example ", url: " https://EXAMPLE.com ", icon: DEFAULT_ICON, unused: true})]),
    settings: Object.freeze({theme: "dark", unused: true}),
    unused: true
  });
  const before = structuredClone(input);
  const normalized = validateState(input);
  assert.deepEqual(normalized, {
    version: VERSION,
    apps: [{id: "custom", name: "Example", url: "https://example.com/", icon: DEFAULT_ICON}],
    settings: {theme: "dark", language: "ja"}
  });
  assert.deepEqual(input, before);
  assert.notEqual(normalized, input);
  assert.notEqual(normalized.apps, input.apps);
  assert.notEqual(normalized.apps[0], input.apps[0]);
  assert.notEqual(normalized.settings, input.settings);
  assert.deepEqual(validateState({...defaults(), apps: []}).apps, []);
});

test("storage validates complete state before writing and continues after failed operations", async () => {
  installLocks();
  let raw;
  let readFails = false;
  let writeError = null;
  let writes = 0;
  globalThis.browser = {tabs: {getCurrent: async () => ({cookieStoreId: "firefox-default"})}, storage: {local: {
    get: async () => { if (readFails) throw new Error("read"); return {[STORAGE_KEY]: structuredClone(raw)}; },
    set: async value => {
      writes++;
      if (writeError) { const error = writeError; writeError = null; throw error; }
      raw = structuredClone(value[STORAGE_KEY]);
    }
  }}};
  const {loadState, updateState} = await import("../extension/storage.js");
  assert.equal((await loadState()).state.apps.length, 14);
  await Promise.all([
    updateState(state => ({...state, apps: [...state.apps, {id: "custom", name: "Example", url: "https://example.com/", icon: DEFAULT_ICON}]})),
    updateState(state => ({...state, settings: {...state.settings, theme: "dark", language: "en"}}))
  ]);
  assert.equal(raw.apps.length, 15); assert.equal(raw.settings.theme, "dark");
  assert.equal(raw.settings.language, "en");
  await updateState(state => ({...state, apps: state.apps.filter(app => app.id !== "custom")}));
  assert.equal(raw.apps.length, 14);
  await updateState(state => ({...state, settings: {...state.settings, theme: "light"}}));
  assert.equal(raw.settings.language, "en");
  const invalidStates = [
    undefined, null, [], {},
    {apps: [], settings: {theme: "auto"}},
    {...defaults(), version: VERSION + 1},
    {...defaults(), version: String(VERSION)},
    {...defaults(), apps: null},
    {...defaults(), apps: {}},
    {...defaults(), apps: new Array(1)},
    {version: VERSION, apps: []},
    {...defaults(), settings: null},
    {...defaults(), settings: []},
    {...defaults(), settings: {}},
    {...defaults(), settings: {theme: "invalid"}},
    {...defaults(), settings: {theme: "auto", language: "fr"}},
    {...defaults(), settings: {theme: "auto", language: null}},
    {...defaults(), apps: Array.from({length: MAX_APPS + 1}, (_, i) => ({...DEFAULT_APPS[0], id: `app-${i}`}))},
    {...defaults(), apps: [DEFAULT_APPS[0], DEFAULT_APPS[0]]},
    {...defaults(), apps: [{...DEFAULT_APPS[0], url: "javascript:alert(1)"}]},
    {...defaults(), apps: [{...DEFAULT_APPS[0], icon: "https://example.com/icon.png"}]}
  ];
  const beforeInvalid = structuredClone(raw);
  const writesBeforeInvalid = writes;
  for (const invalid of invalidStates) {
    assert.throws(() => validateState(invalid));
    await assert.rejects(updateState(() => invalid));
    assert.equal(writes, writesBeforeInvalid);
    assert.deepEqual(raw, beforeInvalid);
  }

  const candidate = Object.freeze({
    ...defaults(),
    apps: Object.freeze([Object.freeze({id: "custom", name: " Example ", url: "https://EXAMPLE.com", icon: DEFAULT_ICON})]),
    settings: Object.freeze({theme: "dark"})
  });
  const beforeCandidate = structuredClone(candidate);
  const saved = await updateState(() => candidate);
  assert.deepEqual(candidate, beforeCandidate);
  assert.notEqual(saved, candidate);
  assert.notEqual(saved.apps, candidate.apps);
  assert.deepEqual(raw, validateState(candidate));

  readFails = true;
  assert.equal((await loadState()).readOnly, true);
  const writesBeforeReadFailure = writes;
  await assert.rejects(updateState(state => state));
  assert.equal(writes, writesBeforeReadFailure);
  readFails = false;
  raw.version = VERSION + 1;
  await assert.rejects(updateState(state => state));
  assert.equal(raw.version, VERSION + 1);
  assert.equal(writes, writesBeforeReadFailure);

  raw = defaults();
  writeError = new Error("quota");
  const failed = updateState(state => ({...state, settings: {theme: "light"}}));
  const queued = updateState(state => ({...state, apps: moveApp(state.apps, "account", 3)}));
  await Promise.all([assert.rejects(failed, /quota/), queued]);
  assert.equal(raw.settings.theme, "auto");
  assert.equal(raw.apps[3].id, "account");
  await updateState(state => ({...state, settings: {theme: "dark"}}));
  assert.equal(raw.settings.theme, "dark");
});

test("manifest and executable sources enforce minimal privileges and no networking", async () => {
  const root = new URL("../extension/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
  assert.deepEqual(manifest.permissions, ["storage"]);
  for (const field of ["host_permissions", "content_scripts", "background", "web_accessible_resources"]) assert.equal(field in manifest, false);
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ["none"]);
  for (const file of await readdir(root)) {
    if (!/\.(js|html|css)$/.test(file)) continue;
    const source = await readFile(new URL(file, root), "utf8");
    assert.doesNotMatch(source, /\b(?:eval|fetch|XMLHttpRequest|WebSocket)\s*\(|new\s+Function\b|\.innerHTML\s*=|https?:\/\/.*(?:\.js|\.css)["']/);
  }
});
