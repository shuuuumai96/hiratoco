import test from "node:test";
import assert from "node:assert/strict";
import {AppError} from "../extension/i18n.js";
import {DEFAULT_ICON, assertAppUnchanged, defaults, moveApp} from "../extension/model.js";

test("a stale app snapshot rejects changes to any saved field and a missing target", () => {
  const initial = defaults();
  const snapshot = {...initial.apps[0]};
  const before = structuredClone(initial);
  for (const change of [
    {name: "Changed elsewhere"},
    {url: "https://example.com/new-destination"},
    {icon: DEFAULT_ICON}
  ]) {
    const apps = initial.apps.map(app => app.id === snapshot.id ? {...app, ...change} : app);
    assert.throws(() => assertAppUnchanged(apps, snapshot), error => error instanceof AppError && error.key === "editConflict");
  }
  assert.throws(() => assertAppUnchanged(initial.apps.slice(1), snapshot), error => error instanceof AppError && error.key === "editMissing");
  assert.deepEqual(initial, before);
});

test("another app edit and reordering do not invalidate an unchanged target", () => {
  const initial = defaults();
  const snapshot = {...initial.apps[0]};
  const reordered = moveApp(initial.apps, snapshot.id, 3).map(app => app.id === "search" ? {...app, name: "Renamed elsewhere"} : app);
  assert.doesNotThrow(() => assertAppUnchanged(reordered, snapshot));
  assert.doesNotThrow(() => assertAppUnchanged(structuredClone(initial.apps), snapshot));
});
