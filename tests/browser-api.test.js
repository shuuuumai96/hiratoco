import test from "node:test";
import assert from "node:assert/strict";
import {extensionApi} from "../extension/browser-api.js";
import {initialLanguage} from "../extension/i18n.js";

test("extension APIs and initial language work with either browser or chrome namespaces", () => {
  const originalBrowser = globalThis.browser;
  const originalChrome = globalThis.chrome;
  try {
    delete globalThis.browser;
    delete globalThis.chrome;
    assert.equal(extensionApi(), undefined);
    assert.equal(initialLanguage(), "ja");
    for (const namespace of ["browser", "chrome"]) {
      const api = {i18n: {getUILanguage: () => "en-US"}};
      globalThis[namespace] = api;
      assert.equal(extensionApi(), api);
      assert.equal(initialLanguage(), "en");
      api.i18n.getUILanguage = () => "ja-JP";
      assert.equal(initialLanguage(), "ja");
      delete globalThis[namespace];
    }
    globalThis.browser = {i18n: {getUILanguage: () => "ja"}};
    globalThis.chrome = {i18n: {getUILanguage: () => "en"}};
    assert.equal(extensionApi(), globalThis.browser);
    assert.equal(initialLanguage(), "ja");
  } finally {
    if (originalBrowser === undefined) delete globalThis.browser;
    else globalThis.browser = originalBrowser;
    if (originalChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = originalChrome;
  }
});
