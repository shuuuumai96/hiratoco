import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {chromium} from "playwright";
import {DEFAULT_APPS, defaults} from "../extension/model.js";
import {RECOVERY_PREFIX, WRITE_LOCK} from "../extension/storage.js";

const WAIT_TIMEOUT = 10000;
const TEST_TIMEOUT = 120000;

async function extensionBase(context) {
  const manager = await context.newPage();
  await manager.goto("chrome://extensions/");
  const item = manager.locator("extensions-item").filter({hasText: "Hiratoco"});
  await item.waitFor({timeout: WAIT_TIMEOUT});
  const id = await item.evaluate(element => element.data.id);
  assert.match(id, /^[a-p]{32}$/);
  await manager.close();
  return `chrome-extension://${id}/`;
}

const waitRows = (page, count) => page.waitForFunction(
  expected => document.querySelectorAll(".editor-row").length === expected,
  count,
  {timeout: WAIT_TIMEOUT}
);
const readStorage = page => page.evaluate(() => chrome.storage.local.get(null));

test("Chromium: unpacked extension permissions, storage, links, CRUD, settings, locks and recovery", {timeout: TEST_TIMEOUT}, async () => {
  const profilePrefix = join(tmpdir(), "hiratoco-chromium-");
  const profile = await mkdtemp(profilePrefix);
  const extension = resolve("dist/chromium");
  const errors = [];
  let context;
  const launch = async () => {
    const launched = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    launched.setDefaultTimeout(WAIT_TIMEOUT);
    launched.on("page", page => page.on("pageerror", error => {
      if (page.url().startsWith("chrome-extension://")) errors.push(error.message);
    }));
    // Fulfill navigation locally; no request reaches an external service.
    await launched.route(/^https?:/, route => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Test destination</title>"
    }));
    return launched;
  };
  try {
    context = await launch();
    console.log(`Chromium ${context.browser().version()}`);
    const base = await extensionBase(context);
    const popup = await context.newPage();
    // Loading popup.html as an extension tab verifies the page and real APIs;
    // it does not claim to exercise the browser's toolbar popup surface.
    await popup.goto(`${base}popup.html`);
    await popup.locator(".app-tile").first().waitFor();
    assert.equal(await popup.locator(".app-tile").count(), DEFAULT_APPS.length);
    assert.deepEqual(await popup.locator(".app-tile").evaluateAll(links => links.map(link => link.href)), DEFAULT_APPS.map(app => app.url));
    await popup.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await popup.locator("#notice").isVisible(), false);
    assert.deepEqual(await readStorage(popup), {});
    const metadata = await popup.evaluate(async () => ({
      manifest: chrome.runtime.getManifest(),
      permissions: await chrome.permissions.getAll(),
      locale: chrome.i18n.getUILanguage(),
      name: chrome.i18n.getMessage("extensionName")
    }));
    assert.equal(metadata.manifest.manifest_version, 3);
    assert.equal(metadata.manifest.name, metadata.name);
    assert.equal(metadata.manifest.incognito, "not_allowed");
    assert.equal(Object.hasOwn(metadata.manifest, "browser_specific_settings"), false);
    assert.deepEqual(metadata.permissions.permissions, ["storage"]);
    assert.deepEqual(metadata.permissions.origins, []);
    const initialLanguage = /^ja(?:-|$)/i.test(metadata.locale) ? "ja" : "en";
    assert.equal(await popup.locator("html").getAttribute("lang"), initialLanguage);

    const [destination] = await Promise.all([
      context.waitForEvent("page"),
      popup.locator(".app-tile").first().click()
    ]);
    await destination.waitForURL(DEFAULT_APPS[0].url);
    assert.equal(await destination.title(), "Test destination");
    await destination.close();

    const [editor] = await Promise.all([
      context.waitForEvent("page"),
      popup.locator("#edit").click()
    ]);
    await editor.waitForURL(`${base}options.html`);
    await waitRows(editor, DEFAULT_APPS.length);
    assert.equal(await editor.locator("#add").isEnabled(), true);
    // Chrome supplies no Firefox cookieStoreId; its normal tab must be editable.
    assert.equal(await editor.evaluate(async () => (await chrome.tabs.getCurrent()).cookieStoreId), undefined);
    await editor.locator("#language").selectOption("ja");
    await editor.waitForFunction(() => document.documentElement.lang === "ja");

    await editor.locator("#add").click();
    await editor.locator("#name").fill("Chromium test");
    await editor.locator("#url").fill("https://example.com/chromium-test");
    await editor.locator("#save").click();
    await waitRows(editor, DEFAULT_APPS.length + 1);
    const custom = editor.locator(".editor-row").last();
    await custom.locator('[data-action="edit"]').click();
    await editor.locator("#name").fill("Edited in Chromium");
    await editor.locator("#save").click();
    await editor.waitForFunction(() => !document.querySelector("#editor").open);
    await custom.press("Alt+ArrowUp");
    await editor.waitForFunction(() => document.querySelector(".editor-row:nth-child(14) strong")?.textContent === "Edited in Chromium");
    await editor.reload();
    await waitRows(editor, DEFAULT_APPS.length + 1);
    assert.equal(await editor.locator(".editor-row:nth-child(14) strong").textContent(), "Edited in Chromium");
    await editor.locator('.editor-row:nth-child(14) [data-action="delete"]').click();
    await editor.locator("#delete-confirm").click();
    await waitRows(editor, DEFAULT_APPS.length);
    await editor.locator("#theme").selectOption("dark");
    await editor.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await editor.locator("#language").selectOption("en");
    await editor.waitForFunction(() => document.documentElement.lang === "en");
    await editor.reload();
    await waitRows(editor, DEFAULT_APPS.length);
    assert.equal(await editor.locator("#theme").inputValue(), "dark");
    assert.equal(await editor.locator("#language").inputValue(), "en");
    assert.equal(await editor.title(), "Hiratoco — Edit apps");

    const secondEditor = await context.newPage();
    await secondEditor.goto(`${base}options.html`);
    await waitRows(secondEditor, DEFAULT_APPS.length);
    await editor.evaluate(lock => {
      window.heldLock = navigator.locks.request(lock, async () => {
        window.lockHeld = true;
        await new Promise(resolve => { window.releaseLock = resolve; });
      });
    }, WRITE_LOCK);
    await editor.waitForFunction(() => window.lockHeld === true);
    await editor.evaluate(async () => {
      const {updateState} = await import("./storage.js");
      window.saveResult = "pending";
      window.testSave = updateState(state => ({...state, apps: state.apps.filter(app => app.id !== "account")}))
        .then(() => { window.saveResult = "ok"; }, error => { window.saveResult = error.key ?? error.message; });
    });
    await editor.waitForFunction(async () => (await navigator.locks.query()).pending.length === 1);
    await secondEditor.evaluate(async () => {
      const {updateState} = await import("./storage.js");
      window.saveResult = "pending";
      window.testSave = updateState(state => ({...state, settings: {...state.settings, theme: "light"}}))
        .then(() => { window.saveResult = "ok"; }, error => { window.saveResult = error.key ?? error.message; });
    });
    await editor.waitForFunction(async () => (await navigator.locks.query()).pending.length === 2);
    await editor.evaluate(() => window.releaseLock());
    await editor.waitForFunction(() => window.saveResult === "ok");
    await secondEditor.waitForFunction(() => window.saveResult === "ok");
    const concurrent = (await readStorage(editor)).appdock;
    assert.equal(concurrent.apps.some(app => app.id === "account"), false);
    assert.equal(concurrent.apps.length, DEFAULT_APPS.length - 1);
    assert.equal(concurrent.settings.theme, "light");
    await secondEditor.close();

    const corrupted = defaults("en");
    corrupted.apps[0].url = "javascript:alert(1)";
    await editor.evaluate(state => chrome.storage.local.set({appdock: state}), corrupted);
    await editor.reload();
    await waitRows(editor, DEFAULT_APPS.length - 1);
    assert.equal(await editor.locator("#add").isEnabled(), false);
    assert.equal(await editor.locator("#theme").isEnabled(), false);
    await editor.locator("#repair").click();
    await editor.locator("#repair-cancel").click();
    assert.deepEqual((await readStorage(editor)).appdock, corrupted);
    assert.equal(Object.keys(await readStorage(editor)).filter(key => key.startsWith(RECOVERY_PREFIX)).length, 0);
    await editor.locator("#repair").click();
    await editor.locator("#repair-confirm").click();
    await editor.waitForFunction(() => !document.querySelector("#repair-dialog").open && !document.querySelector("#add").disabled);
    const repaired = await readStorage(editor);
    const backups = Object.keys(repaired).filter(key => key.startsWith(RECOVERY_PREFIX));
    assert.equal(backups.length, 1);
    assert.deepEqual(repaired[backups[0]].source, corrupted);
    assert.equal(repaired.appdock.apps.length, DEFAULT_APPS.length - 1);
    assert.equal(repaired.appdock.apps.some(app => app.id === "account"), false);

    await editor.locator('[data-app-id="search"] [data-action="edit"]').click();
    const png = await editor.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 20;
      canvas.getContext("2d").fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL().split(",")[1];
    });
    await editor.locator("#icon-file").setInputFiles({
      name: "chromium-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64")
    });
    await editor.waitForFunction(() => document.querySelector("#preview").src.startsWith("data:image/png"));
    await editor.locator("#save").click();
    await editor.waitForFunction(() => !document.querySelector("#editor").open);
    const persistedState = await readStorage(editor);
    const savedIcon = persistedState.appdock.apps.find(app => app.id === "search").icon;
    assert.match(savedIcon, /^data:image\/png;base64,/);
    assert.deepEqual(persistedState[backups[0]].source, corrupted);

    // Reopen the isolated profile to verify disk persistence as well as reloads.
    await context.close();
    context = await launch();
    assert.equal(await extensionBase(context), base);
    const persisted = await context.newPage();
    await persisted.goto(`${base}options.html`);
    await waitRows(persisted, DEFAULT_APPS.length - 1);
    assert.deepEqual(await readStorage(persisted), persistedState);
    const icon = persisted.locator('[data-app-id="search"] img');
    assert.equal(await icon.getAttribute("src"), savedIcon);
    await icon.evaluate(image => image.decode());
    assert.equal(await icon.evaluate(image => image.naturalWidth), 64);
    assert.equal(await persisted.locator("#add").isEnabled(), true);

    // Erasure must also cover old keys and the recovery copies stored above.
    await persisted.evaluate(() => chrome.storage.local.set({legacyTest: "synthetic-old-value"}));
    const beforeErase = await readStorage(persisted);
    await persisted.locator("#erase-data").click();
    await persisted.locator("#data-cancel").click();
    assert.deepEqual(await readStorage(persisted), beforeErase);
    await persisted.locator("#erase-data").click();
    await persisted.locator("#data-confirm").click();
    await persisted.waitForFunction(() => !document.querySelector("#data-dialog").open);
    await waitRows(persisted, DEFAULT_APPS.length);
    assert.deepEqual(await readStorage(persisted), {});
    assert.deepEqual(errors, []);
  } finally {
    await context?.close();
    assert.ok(profile.startsWith(profilePrefix));
    await rm(profile, {recursive: true, force: true});
  }
});
