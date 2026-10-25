import test from "node:test";
import assert from "node:assert/strict";
import {setImmediate} from "node:timers/promises";
import {defaults, DEFAULT_ICON, MAX_APPS, STORAGE_KEY, assertAppUnchanged} from "../extension/model.js";
import {deleteAppState, deleteRecoveryCopies, eraseAllData, loadDataSummary, loadState, updateState, repairState, RECOVERY_PREFIX} from "../extension/storage.js";
import {installLocks} from "./helpers/locks.js";

function harness(source = defaults(), {chromium = false, namespace = "browser"} = {}) {
  installLocks();
  const saved = {[STORAGE_KEY]: structuredClone(source)};
  const writes = [];
  const control = {saved, writes, readFails: false, failBackup: false, failMain: false, failRemove: false, failClear: false};
  const api = {runtime: {getURL: path => `${chromium ? "chrome-extension" : "moz-extension"}://test/${path}`}, extension: {inIncognitoContext: false}, tabs: {getCurrent: async () => chromium ? {incognito: false} : {cookieStoreId: "firefox-default"}}, storage: {local: {
    get: async key => {
      if (control.readFails) throw new Error("read failure");
      const snapshot = structuredClone(key === null ? saved : {[key]: saved[key]});
      // Let a second page enter get() too if writes are not truly serialized.
      await setImmediate();
      return snapshot;
    },
    set: async entries => {
      const isBackup = Object.keys(entries).some(key => key.startsWith(RECOVERY_PREFIX));
      if (isBackup && control.failBackup) throw new Error("backup quota");
      if (!isBackup && control.failMain) throw new Error("main write failure");
      writes.push(structuredClone(entries));
      Object.assign(saved, structuredClone(entries));
    },
    remove: async keys => { if (control.failRemove) throw new Error("remove failure"); for (const key of keys) delete saved[key]; },
    clear: async () => { if (control.failClear) throw new Error("clear failure"); for (const key of Object.keys(saved)) delete saved[key]; }
  }}};
  delete globalThis.browser;
  delete globalThis.chrome;
  globalThis[namespace] = api;
  control.api = api;
  return control;
}

const hasKey = key => error => error.key === key;
const backups = saved => Object.entries(saved).filter(([key]) => key.startsWith(RECOVERY_PREFIX));

test("fresh settings follow Firefox UI language without writing defaults", async () => {
  for (const [locale, expected] of [["ja", "ja"], ["ja-JP", "ja"], ["en-US", "en"], ["en-GB", "en"], ["fr", "en"], [undefined, "ja"]]) {
    const {saved, writes} = harness();
    delete saved[STORAGE_KEY];
    browser.i18n = {getUILanguage: () => locale};
    const loaded = await loadState();
    assert.equal(loaded.state.settings.language, expected, String(locale));
    assert.equal(loaded.readOnly, false);
    assert.deepEqual(saved, {});
    assert.equal(writes.length, 0);
  }
});

test("saved language and legacy settings survive browser locale changes", async () => {
  for (const language of ["ja", "en"]) {
    const {saved} = harness(defaults(language));
    const before = structuredClone(saved);
    browser.i18n = {getUILanguage: () => language === "ja" ? "en-US" : "ja-JP"};
    assert.equal((await loadState()).state.settings.language, language);
    assert.deepEqual(saved, before);
  }
  const legacy = defaults();
  delete legacy.settings.language;
  const {saved} = harness(legacy);
  browser.i18n = {getUILanguage: () => "en-US"};
  assert.equal((await loadState()).state.settings.language, "ja");
  assert.deepEqual(saved[STORAGE_KEY], legacy);
});

test("erasing settings restores browser language and locale failures remain usable", async () => {
  const {saved} = harness(defaults("ja"));
  browser.i18n = {getUILanguage: () => "en-US"};
  assert.equal((await eraseAllData()).settings.language, "en");
  assert.equal((await loadState()).state.settings.language, "en");
  assert.deepEqual(saved, {});
  browser.i18n.getUILanguage = () => { throw new Error("unavailable"); };
  assert.equal((await loadState()).state.settings.language, "ja");
  delete browser.i18n;
  assert.equal((await loadState()).state.settings.language, "ja");
});

test("independent pages serialize delete, theme and add without resurrecting or losing apps", async () => {
  const {saved} = harness();
  const otherPage = await import("../extension/storage.js?second-page");
  await Promise.all([
    updateState(state => ({...state, apps: state.apps.filter(app => app.id !== "account")})),
    otherPage.updateState(state => ({...state, settings: {...state.settings, theme: "dark", language: "en"}})),
    otherPage.updateState(state => ({...state, apps: [...state.apps, {id: "custom", name: "Custom", url: "https://example.com/", icon: DEFAULT_ICON}]}))
  ]);
  assert.equal(saved.appdock.apps.some(app => app.id === "account"), false);
  assert.equal(saved.appdock.apps.some(app => app.id === "custom"), true);
  assert.deepEqual(saved.appdock.settings, {theme: "dark", language: "en"});
});

test("confirmed app deletion erases all historical recovery copies without deleting other active apps", async () => {
  const source = defaults(); source.apps[0].url = "http://example.com/corrupt";
  const control = harness(source);
  await repairState(source);
  const target = structuredClone(control.saved.appdock.apps[0]);
  assert.equal((await loadDataSummary()).backups, 1);
  await deleteAppState(target);
  assert.equal(control.saved.appdock.apps.some(app => app.id === target.id), false);
  assert.equal(control.saved.appdock.apps.length, 12);
  assert.equal(backups(control.saved).length, 0);
});

test("failed cleanup keeps the active app; stale deletions never erase recovery copies", async () => {
  const source = defaults(); source.apps[0].url = "http://example.com/corrupt";
  const control = harness(source); await repairState(source);
  const target = structuredClone(control.saved.appdock.apps[0]);
  const before = structuredClone(control.saved);
  control.failRemove = true;
  await assert.rejects(deleteAppState(target), /remove failure/);
  assert.deepEqual(control.saved, before);
  control.failRemove = false;
  control.saved.appdock.apps[0].name = "Changed elsewhere";
  await assert.rejects(deleteAppState(target), keyedConflict);
  assert.equal(backups(control.saved).length, 1);
  control.saved.appdock.apps[0].name = target.name;
  control.failMain = true;
  await assert.rejects(deleteAppState(target), /main write failure/);
  assert.ok(control.saved.appdock.apps.some(app => app.id === target.id));
  assert.equal(backups(control.saved).length, 0);
  control.failMain = false;
  await deleteAppState(target);
  assert.equal(control.saved.appdock.apps.some(app => app.id === target.id), false);
});

function keyedConflict(error) { return error.key === "editConflict"; }

test("backup deletion leaves active state and full erasure also removes legacy keys", async () => {
  const source = defaults(); source.apps[0].url = "http://example.com/corrupt";
  const control = harness(source); await repairState(source);
  const active = structuredClone(control.saved.appdock);
  await deleteRecoveryCopies();
  assert.deepEqual(control.saved.appdock, active);
  assert.equal(backups(control.saved).length, 0);
  control.saved["legacy-secret"] = {private: "synthetic"};
  control.saved[RECOVERY_PREFIX + "legacy"] = {source};
  control.failClear = true;
  await assert.rejects(eraseAllData(), /clear failure/);
  assert.ok(control.saved["legacy-secret"]);
  control.failClear = false;
  assert.deepEqual(await eraseAllData(), defaults());
  assert.deepEqual(control.saved, {});
});

test("stale edit and delete reject inside the locked write and preserve the latest URL", async () => {
  const {saved, writes} = harness();
  const snapshot = structuredClone(saved.appdock.apps[0]);
  await updateState(state => ({...state, apps: state.apps.map(app => app.id === snapshot.id ? {...app, url: "https://example.com/new"} : app)}));
  const before = structuredClone(saved);
  for (const remove of [false, true]) {
    await assert.rejects(updateState(state => {
      assertAppUnchanged(state.apps, snapshot);
      return {...state, apps: remove ? state.apps.filter(app => app.id !== snapshot.id) : state.apps.map(app => app.id === snapshot.id ? {...snapshot, name: "Rename only"} : app)};
    }), hasKey("editConflict"));
    assert.deepEqual(saved, before);
  }
  assert.equal(writes.length, 1);
});

test("ordinary writes never overwrite partially corrupt, invalid, duplicate or oversized data", async () => {
  const partial = defaults();
  partial.apps[0].url = "http://example.com/recover-me";
  const duplicate = defaults(); duplicate.apps.push({...duplicate.apps[0], url: "https://example.com/duplicate"});
  const oversized = defaults(); oversized.apps = Array.from({length: MAX_APPS + 1}, (_, i) => ({...oversized.apps[0], id: `app-${i}`}));
  for (const source of [partial, duplicate, oversized, null, {version: 1, apps: "broken"}]) {
    const {saved, writes} = harness(source);
    const loaded = await loadState();
    assert.equal(loaded.readOnly, true);
    assert.deepEqual(loaded.repairSource, source);
    await assert.rejects(updateState(state => ({...state, settings: {...state.settings, theme: "dark"}})));
    assert.deepEqual(saved.appdock, source);
    assert.equal(writes.length, 0);
  }
});

test("explicit repair preserves every original before replacement, including on repeated repairs", async () => {
  const source = defaults(); source.apps[0].url = "http://example.com/original";
  const {saved, writes} = harness(source);
  const repaired = await repairState((await loadState()).repairSource);
  assert.equal(repaired.apps.length, 13);
  assert.equal((await loadState()).readOnly, false);
  assert.deepEqual(backups(saved)[0][1].source, source);
  assert.ok(backups(saved)[0][1].savedAt);
  assert.ok(Object.keys(writes[0])[0].startsWith(RECOVERY_PREFIX));
  assert.deepEqual(writes[1], {[STORAGE_KEY]: repaired});
  const firstBackup = structuredClone(backups(saved)[0]);
  saved.appdock = null;
  await repairState(null);
  assert.equal(saved.appdock.apps.length, 14);
  assert.equal(backups(saved).length, 2);
  assert.deepEqual(saved[firstBackup[0]], firstBackup[1]);
  await updateState(state => ({...state, settings: {...state.settings, theme: "dark"}}));
  assert.equal(backups(saved).length, 2);
});

test("backup or main-write failure preserves the corrupt original and permits retry", async () => {
  const source = defaults(); source.apps[0].url = "http://example.com/original";
  const control = harness(source);
  control.failBackup = true;
  await assert.rejects(repairState(source), /backup quota/);
  assert.deepEqual(control.saved.appdock, source);
  assert.equal(control.writes.length, 0);
  control.failBackup = false; control.failMain = true;
  await assert.rejects(repairState(source), /main write failure/);
  assert.deepEqual(control.saved.appdock, source);
  assert.deepEqual(backups(control.saved)[0][1].source, source);
  control.failMain = false;
  await repairState(source);
  assert.equal(control.saved.appdock.apps.length, 13);
});

test("stale repair confirmation rejects changed raw data even when the safe display is identical", async () => {
  const source = defaults(); source.apps[0].url = "http://example.com/first";
  const {saved, writes} = harness(source);
  const snapshot = (await loadState()).repairSource;
  saved.appdock.apps[0].url = "http://example.com/second";
  await assert.rejects(repairState(snapshot), hasKey("repairChanged"));
  assert.equal(saved.appdock.apps[0].url, "http://example.com/second");
  assert.equal(writes.length, 0);
});

test("future data, failed reads, private contexts, containers and unavailable locks block all writes and repair", async () => {
  for (const restriction of ["future", "read", "private", "private-tab", "container", "unknown-store", "context-failure", "locks"]) {
    const source = defaults();
    if (restriction === "future") source.version++;
    const control = harness(source);
    if (restriction === "read") control.readFails = true;
    if (restriction === "private") browser.extension.inIncognitoContext = true;
    if (restriction === "private-tab") browser.tabs.getCurrent = async () => ({cookieStoreId: "firefox-private", incognito: true});
    if (restriction === "container") browser.tabs.getCurrent = async () => ({cookieStoreId: "firefox-container-1"});
    if (restriction === "unknown-store") browser.tabs.getCurrent = async () => ({});
    if (restriction === "context-failure") browser.tabs.getCurrent = async () => { throw new Error("tab query failed"); };
    if (restriction === "locks") navigator.locks = undefined;
    const loaded = await loadState();
    assert.equal(loaded.readOnly, true, restriction);
    assert.equal(Object.hasOwn(loaded, "repairSource"), false, restriction);
    await assert.rejects(updateState(state => state));
    await assert.rejects(repairState(source));
    assert.equal(control.writes.length, 0, restriction);
    assert.deepEqual(control.saved.appdock, source);
  }
});

test("popup display has no container warning, while writes without a confirmed settings tab fail closed", async () => {
  const control = harness();
  browser.tabs.getCurrent = async () => undefined;
  const loaded = await loadState();
  assert.equal(loaded.notice, "");
  assert.equal(loaded.state.apps.length, 14);
  await assert.rejects(updateState(state => ({...state, settings: {...state.settings, theme: "dark"}})), hasKey("noticeContainer"));
  await assert.rejects(repairState(null), hasKey("noticeContainer"));
  assert.equal(control.writes.length, 0);
  assert.deepEqual(control.saved.appdock, defaults());
});

test("all privacy deletion operations obey the same context restrictions", async () => {
  for (const kind of ["private", "container", "missing-tab", "locks"]) {
    const control = harness();
    const target = structuredClone(control.saved.appdock.apps[0]);
    control.saved[RECOVERY_PREFIX + "old"] = {source:structuredClone(control.saved.appdock)};
    const before = structuredClone(control.saved);
    if (kind === "private") browser.extension.inIncognitoContext = true;
    if (kind === "container") browser.tabs.getCurrent = async () => ({cookieStoreId:"firefox-container-1"});
    if (kind === "missing-tab") browser.tabs.getCurrent = async () => undefined;
    if (kind === "locks") navigator.locks = undefined;
    await assert.rejects(deleteAppState(target));
    await assert.rejects(deleteRecoveryCopies());
    await assert.rejects(eraseAllData());
    assert.deepEqual(control.saved, before);
  }
});

test("erasure invalidates an old repair confirmation and also works for unknown future data", async () => {
  const source = defaults(); source.apps[0].url="http://example.com/corrupt";
  const control=harness(source);
  await eraseAllData();
  await assert.rejects(repairState(source), hasKey("repairChanged"));
  assert.deepEqual(control.saved,{});
  control.saved.appdock={...defaults(),version:99};
  assert.equal((await loadState()).readOnly,true);
  assert.equal((await loadDataSummary()).canManage,true);
  await eraseAllData();
  assert.deepEqual(control.saved,{});
});

test("Chromium settings save, serialize, repair and erase using real-shaped tabs in either API namespace", async () => {
  for (const namespace of ["chrome", "browser"]) {
    const {api, saved} = harness(defaults(), {chromium: true, namespace});
    api.i18n = {getUILanguage: () => "en-US"};
    assert.equal((await loadState()).readOnly, false);
    await Promise.all([
      updateState(state => ({...state, apps: state.apps.filter(app => app.id !== "account")})),
      updateState(state => ({...state, settings: {...state.settings, theme: "dark"}}))
    ]);
    assert.equal(saved.appdock.apps.length, 13);
    assert.equal(saved.appdock.settings.theme, "dark");
    saved.appdock.apps[0].url = "http://example.com/corrupt";
    const source = structuredClone(saved.appdock);
    const loaded = await loadState();
    assert.equal(loaded.readOnly, true);
    assert.deepEqual(loaded.repairSource, source);
    await repairState(source);
    assert.equal((await loadDataSummary()).backups, 1);
    assert.equal(saved.appdock.apps.length, 12);
    await deleteAppState(saved.appdock.apps[0]);
    assert.equal((await loadDataSummary()).backups, 0);
    assert.equal(saved.appdock.apps.length, 11);
    assert.equal((await eraseAllData()).settings.language, "en");
    assert.deepEqual(saved, {});
  }
});

test("Chromium private, unconfirmed and lockless contexts cannot mutate any stored data", async () => {
  for (const restriction of ["private", "private-tab", "missing-tab", "unknown-tab", "context-failure", "locks", "unknown-origin"]) {
    const {api, saved, writes} = harness(defaults(), {chromium: true, namespace: "chrome"});
    if (restriction === "private") api.extension.inIncognitoContext = true;
    if (restriction === "private-tab") api.tabs.getCurrent = async () => ({incognito: true});
    if (restriction === "missing-tab") api.tabs.getCurrent = async () => undefined;
    if (restriction === "unknown-tab") api.tabs.getCurrent = async () => ({});
    if (restriction === "context-failure") api.tabs.getCurrent = async () => { throw new Error("tab query failed"); };
    if (restriction === "locks") navigator.locks = undefined;
    if (restriction === "unknown-origin") api.runtime.getURL = () => "https://example.com/";
    const before = structuredClone(saved);
    await assert.rejects(updateState(state => state), restriction);
    await assert.rejects(repairState(null), restriction);
    await assert.rejects(deleteAppState(saved.appdock.apps[0]), restriction);
    await assert.rejects(deleteRecoveryCopies(), restriction);
    await assert.rejects(eraseAllData(), restriction);
    assert.equal((await loadDataSummary()).canManage, false, restriction);
    assert.deepEqual(saved, before, restriction);
    assert.equal(writes.length, 0, restriction);
  }
});
