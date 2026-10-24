import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdir} from "node:fs/promises";
import {extname, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {DEFAULT_APPS} from "../extension/model.js";

test("browser UI: CRUD, keyboard, drag, local image, persistence, errors, themes, and languages", {timeout: 90000}, async () => {
  const root = resolve(fileURLToPath(new URL("../extension/", import.meta.url)));
  const server = createServer(async (request, response) => {
    const path = resolve(root, `.${new URL(request.url, "http://localhost").pathname}`);
    if (!path.startsWith(root + sep) && path !== root) { response.writeHead(403).end(); return; }
    try {
      const mime = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml"}[extname(path)];
      response.writeHead(200, {"Content-Type": `${mime ?? "application/octet-stream"}; charset=utf-8`});
      response.end(await readFile(path));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({headless: true});
    const context = await browser.newContext({viewport: {width: 1000, height: 900}});
    await context.addInitScript(() => {
      const listeners = [];
      window.failSave = false;
      window.imageReadsClosed = 0;
      const decodeImage = window.createImageBitmap.bind(window);
      window.createImageBitmap = async file => {
        const pending = window.imageReadGate;
        window.imageReadGate = null;
        if (pending) await pending;
        const bitmap = await decodeImage(file);
        const close = bitmap.close.bind(bitmap);
        bitmap.close = () => { close(); window.imageReadsClosed++; };
        return bitmap;
      };
      window.browser = {
        i18n: {getUILanguage: () => sessionStorage.getItem("testUILanguage") ?? "ja-JP"},
        tabs: {getCurrent: async () => ({cookieStoreId: "firefox-default"})},
        runtime: {openOptionsPage: async () => {}},
        storage: {
          local: {
            get: async key => key === null ? Object.fromEntries(Object.keys(localStorage).map(name => [name, JSON.parse(localStorage.getItem(name))])) : ({[key]: JSON.parse(localStorage.getItem(key) ?? "null") ?? undefined}),
            set: async data => {
              if (window.failSave) throw new Error("quota");
              const pending = window.saveGate;
              window.saveGate = null;
              if (pending) await pending;
              for (const [key, value] of Object.entries(data)) {
                localStorage.setItem(key, JSON.stringify(value));
                for (const listener of listeners) listener({[key]: {newValue: value}}, "local");
              }
            },
            remove: async keys => {
              if (window.failSave) throw new Error("remove failure");
              for (const key of keys) {
                localStorage.removeItem(key);
                for (const listener of listeners) listener({[key]: {}}, "local");
              }
            },
            clear: async () => {
              if (window.failSave) throw new Error("clear failure");
              const changes = Object.fromEntries(Object.keys(localStorage).map(key => [key, {}]));
              localStorage.clear();
              for (const listener of listeners) listener(changes, "local");
            }
          },
          onChanged: {addListener: listener => listeners.push(listener)}
        }
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    const waitRows = count => page.waitForFunction(n => document.querySelectorAll(".editor-row").length === n, count);
    // Start with no stored settings in an English Firefox UI, then explicitly
    // choose Japanese and ensure a different browser locale cannot override it.
    await page.goto(`${url}/options.html`);
    await page.waitForSelector(".editor-row");
    await page.evaluate(() => sessionStorage.setItem("testUILanguage", "en-US"));
    await page.reload(); await waitRows(14);
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.title(), "Hiratoco — Edit apps");
    assert.equal(await page.locator("#language").inputValue(), "en");
    assert.equal(await page.evaluate(() => localStorage.getItem("appdock")), null);
    await page.goto(`${url}/popup.html`);
    await page.waitForSelector(".app-tile");
    assert.equal(await page.title(), "Hiratoco — Web App Launcher");
    assert.equal(await page.locator('.app-tile[data-app-id="account"] span').textContent(), "Account");
    await page.goto(`${url}/options.html`); await waitRows(14);
    await page.locator("#language").selectOption("ja");
    await page.waitForFunction(() => document.documentElement.lang === "ja");
    await page.reload(); await waitRows(14);
    assert.equal(await page.locator("html").getAttribute("lang"), "ja");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("appdock")).settings.language), "ja");
    await page.evaluate(() => { localStorage.clear(); sessionStorage.removeItem("testUILanguage"); });
    await page.goto(`${url}/popup.html`);
    await page.waitForSelector(".app-tile");
    assert.equal(await page.title(), "Hiratoco — Webアプリランチャー");
    assert.equal(await page.locator(".app-tile").count(), 14);
    assert.deepEqual(await page.locator(".app-tile").evaluateAll(links => links.map(link => link.href)), DEFAULT_APPS.map(app => app.url));
    assert.equal(await page.locator(".app-grid").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length), 3);
    assert.ok(await page.locator(".app-tile img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)));
    await page.locator(".app-tile").first().focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.appId), "youtube");
    await mkdir("test-results", {recursive: true});
    await page.locator("body").screenshot({path: "test-results/popup-light.png"});
    await page.emulateMedia({colorScheme: "dark"});
    assert.equal(await page.locator("body").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(35, 38, 46)");
    await page.locator("body").screenshot({path: "test-results/popup-dark.png"});
    await page.goto(`${url}/options.html`);
    await waitRows(14);
    await page.getByRole("button", {name: "＋ アプリを追加"}).click();
    await page.locator("#name").fill("<img onerror=alert(1)>");
    await page.locator("#url").fill("javascript:alert(1)");
    await page.locator("#save").click();
    await page.waitForFunction(() => document.querySelector("#form-error").textContent.length > 0);
    assert.equal(await page.locator("#editor").evaluate(el => el.open), true);
    await page.locator("#url").fill("https://example.com/");
    await page.locator("#icon-file").setInputFiles({name: "evil.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')});
    await page.waitForFunction(() => document.querySelector("#form-error").textContent.includes("画像"));
    const png = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = canvas.height = 20; canvas.getContext("2d").fillRect(0, 0, 20, 20); return canvas.toDataURL().split(",")[1]; });
    await page.locator("#icon-file").setInputFiles({name: "icon.png", mimeType: "image/png", buffer: Buffer.from(png, "base64")});
    await page.waitForFunction(() => document.querySelector("#preview").src.startsWith("data:image/png"));
    await page.locator("#save").click();
    await waitRows(15);
    await page.waitForFunction(() => !document.querySelector("#editor").open);
    const custom = page.locator(".editor-row").last();
    assert.equal(await custom.locator("strong").textContent(), "<img onerror=alert(1)>");
    assert.equal(await page.locator("strong img").count(), 0);
    assert.match(await custom.locator("img").getAttribute("src"), /^data:image\/png;base64,/);

    /**
     * A dismissed dialog's late image result must not alter a new edit.
     */
    await custom.locator('[data-action="edit"]').click();
    await page.evaluate(() => { window.imageReadGate = new Promise(resolve => { window.releaseImageRead = resolve; }); });
    await page.locator("#icon-file").setInputFiles({name: "delayed.png", mimeType: "image/png", buffer: Buffer.from(png, "base64")});
    assert.equal(await page.locator("#save").isDisabled(), true);
    await page.keyboard.press("Escape");
    await page.locator('.editor-row[data-app-id="gmail"] [data-action="edit"]').click();
    assert.equal(await page.locator("#save").isEnabled(), true);
    const closedBefore = await page.evaluate(() => window.imageReadsClosed);
    await page.evaluate(() => window.releaseImageRead());
    await page.waitForFunction(count => window.imageReadsClosed === count + 1, closedBefore);
    assert.equal(await page.locator("#preview").getAttribute("src"), "icons/gmail.svg");
    assert.equal(await page.locator("#form-error").textContent(), "");
    await page.keyboard.press("Escape");

    /**
     * Choosing the shared icon must ignore any late image result.
     */
    await custom.locator('[data-action="edit"]').click();
    await page.evaluate(() => { window.imageReadGate = new Promise(resolve => { window.releaseImageRead = resolve; }); });
    await page.locator("#icon-file").setInputFiles({name: "delayed.png", mimeType: "image/png", buffer: Buffer.from(png, "base64")});
    await page.locator("#clear-icon").click();
    const closedBeforeClear = await page.evaluate(() => window.imageReadsClosed);
    await page.evaluate(() => window.releaseImageRead());
    await page.waitForFunction(count => window.imageReadsClosed === count + 1, closedBeforeClear);
    assert.equal(await page.locator("#preview").getAttribute("src"), "icons/site.svg");
    assert.equal(await page.locator("#save").isEnabled(), true);
    await page.locator("#name").fill("Example");
    await page.locator("#save").click();
    await page.waitForFunction(() => !document.querySelector("#editor").open);
    await page.locator(".editor-row").last().focus();
    await page.keyboard.press("Alt+ArrowUp");
    await page.waitForFunction(() => document.querySelectorAll(".editor-row strong")[13].textContent === "Example");
    assert.equal(await page.locator(".editor-row").nth(13).evaluate(row => row === document.activeElement), true);
    await page.locator(".editor-row").first().dragTo(page.locator(".editor-row").nth(2));
    await page.waitForFunction(() => document.querySelectorAll(".editor-row")[2].dataset.appId === "account");
    await page.locator("#theme").selectOption("dark");
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await page.reload(); await waitRows(15);
    assert.equal(await page.locator("#theme").inputValue(), "dark");
    assert.equal(await page.locator(".editor-row").nth(2).getAttribute("data-app-id"), "account");
    await page.screenshot({path: "test-results/options-dark.png", fullPage: true});
    await page.locator(".editor-row").filter({hasText: "Example"}).locator('[data-action="delete"]').click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".editor-row").count(), 15);
    await page.locator(".editor-row").filter({hasText: "Example"}).locator('[data-action="delete"]').click();
    await page.locator("#delete-confirm").click();
    await waitRows(14);
    await page.evaluate(() => { window.failSave = true; });
    await page.locator("#theme").selectOption("light");
    await page.waitForFunction(() => document.querySelector("#status").textContent.includes("保存できません"));
    assert.equal(await page.locator("#theme").inputValue(), "dark");

    /**
     * Failed saves must retain input for retry, while pending writes prevent
     * conflicting changes.
     */
    await page.getByRole("button", {name: "＋ アプリを追加"}).click();
    await page.locator("#name").fill("Retry");
    await page.locator("#url").fill("https://example.com/retry");
    await page.locator("#save").click();
    await page.waitForFunction(() => document.querySelector("#form-error").textContent.includes("保存できません"));
    assert.equal(await page.locator("#editor").evaluate(dialog => dialog.open), true);
    assert.equal(await page.locator("#name").inputValue(), "Retry");
    assert.equal(await page.locator("#save").isEnabled(), true);
    assert.equal(await page.locator("#cancel").isEnabled(), true);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("appdock")).apps.length), 14);
    await page.evaluate(() => {
      window.failSave = false;
      window.saveGate = new Promise(resolve => { window.releaseSave = resolve; });
    });
    await page.locator("#save").click();
    for (const selector of ["#save", "#cancel", "#icon-file", "#clear-icon"]) {
      assert.equal(await page.locator(selector).isDisabled(), true);
    }
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#editor").evaluate(dialog => dialog.open), true);
    await page.evaluate(() => window.releaseSave());
    await waitRows(15);
    await page.waitForFunction(() => !document.querySelector("#editor").open);
    assert.equal(await page.locator(".editor-row").last().locator("strong").textContent(), "Retry");
    await page.locator('.editor-row:last-child [data-action="delete"]').click();
    await page.locator("#delete-confirm").click();
    await waitRows(14);
    await page.evaluate(() => localStorage.setItem("appdock", JSON.stringify({version: 1, apps: [{id: "bad", name: "bad", url: "javascript:alert(1)"}]})));
    await page.reload(); await waitRows(14);
    assert.ok(await page.locator("#notice").isVisible());
    await page.evaluate(() => localStorage.setItem("appdock", JSON.stringify({version: 99, apps: []})));
    await page.reload(); await waitRows(14);
    assert.equal(await page.locator("#add").isDisabled(), true);
    assert.equal(await page.locator("#theme").isDisabled(), true);
    assert.equal(await page.locator("#language").isDisabled(), true);

    /**
     * Isolate language checks from the preceding corruption scenarios.
     */
    await page.evaluate(() => localStorage.removeItem("appdock"));
    await page.reload(); await waitRows(14);
    assert.equal(await page.locator("#language").inputValue(), "ja");
    assert.equal(await page.locator("html").getAttribute("lang"), "ja");
    await page.locator("#language").selectOption("en");
    await page.waitForFunction(() => document.documentElement.lang === "en");
    assert.equal(await page.locator("h1").textContent(), "Edit apps");
    assert.equal(await page.locator("#add").textContent(), "+ Add app");
    const englishNames = {account: "Account", search: "Search", maps: "Maps", drive: "Drive", calendar: "Calendar", translate: "Translate", news: "News", photos: "Photos"};
    for (const [id, label] of Object.entries(englishNames)) {
      assert.equal(await page.locator(`.editor-row[data-app-id="${id}"] strong`).textContent(), label);
    }

    /**
     * Editing a default URL must not turn its translated name into a custom one.
     */
    await page.locator('.editor-row[data-app-id="account"] [data-action="edit"]').click();
    assert.equal(await page.locator("#name").inputValue(), "Account");
    await page.locator("#url").fill("https://myaccount.google.com/?from=appdock");
    await page.locator("#save").click();
    await page.waitForFunction(() => !document.querySelector("#editor").open);
    await page.locator('.editor-row[data-app-id="maps"] [data-action="edit"]').click();
    await page.locator("#name").fill("自分の地図");
    await page.locator("#save").click();
    await page.waitForFunction(() => !document.querySelector("#editor").open);
    await page.locator("#add").click();
    await page.locator("#name").fill("自分のサイト");
    await page.locator("#url").fill("javascript:alert(1)");
    await page.locator("#save").click();
    await page.waitForFunction(() => document.querySelector("#form-error").textContent.includes("HTTPS"));
    await page.locator("#url").fill("https://example.com/custom");
    await page.evaluate(() => { window.failSave = true; });
    await page.locator("#save").click();
    await page.waitForFunction(() => /save/i.test(document.querySelector("#form-error").textContent));
    assert.equal(await page.locator("#name").inputValue(), "自分のサイト");
    await page.evaluate(() => { window.failSave = false; });
    await page.locator("#save").click();
    await waitRows(15);
    await page.waitForFunction(() => !document.querySelector("#editor").open);
    await page.locator("#theme").selectOption("light");
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    await page.reload(); await waitRows(15);
    assert.equal(await page.locator("#language").inputValue(), "en");
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.title(), "Hiratoco — Edit apps");
    assert.equal(await page.locator("#theme").inputValue(), "light");
    assert.equal(await page.locator(".editor-row").last().locator("strong").textContent(), "自分のサイト");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("appdock")).settings.language), "en");
    await page.screenshot({path: "test-results/options-english.png", fullPage: true});

    await page.goto(`${url}/popup.html`);
    await page.waitForSelector(".app-tile");
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.locator('.app-tile[data-app-id="account"] span').textContent(), "Account");
    assert.equal(await page.locator(".app-tile").last().locator("span").textContent(), "自分のサイト");
    await page.locator("body").screenshot({path: "test-results/popup-english.png"});
    assert.equal(await page.title(), "Hiratoco — Web App Launcher");
    await page.goto(`${url}/options.html`); await waitRows(15);
    await page.locator("#language").selectOption("ja");
    await page.waitForFunction(() => document.documentElement.lang === "ja");
    assert.equal(await page.title(), "Hiratoco — アプリの編集");
    assert.equal(await page.locator("h1").textContent(), "アプリの編集");
    assert.equal(await page.locator('.editor-row[data-app-id="account"] strong').textContent(), "アカウント");
    assert.equal(await page.locator('.editor-row[data-app-id="maps"] strong').textContent(), "自分の地図");
    assert.equal(await page.locator(".editor-row").last().locator("strong").textContent(), "自分のサイト");

    /**
     * Settings saved before language selection must remain usable.
     */
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("appdock"));
      state.settings = {theme: "dark"};
      localStorage.setItem("appdock", JSON.stringify(state));
    });
    await page.reload(); await waitRows(15);
    assert.equal(await page.locator("#language").inputValue(), "ja");
    assert.equal(await page.locator("html").getAttribute("lang"), "ja");
    assert.equal(await page.locator("#theme").inputValue(), "dark");
    /**
     * External changes must not be overwritten by an already open edit/delete.
     */
    const account = page.locator('[data-app-id="account"]');
    await account.locator('[data-action="edit"]').click();
    await page.locator("#name").fill("Stale rename");
    await page.evaluate(async () => {
      const data = JSON.parse(localStorage.getItem("appdock"));
      data.apps.find(app => app.id === "account").url = "https://example.com/latest";
      await browser.storage.local.set({appdock: data});
    });
    await page.waitForFunction(() => document.querySelector('[data-app-id="account"] .row-text span').textContent === "https://example.com/latest");
    await page.locator("#save").click();
    await page.waitForFunction(() => document.querySelector("#form-error").textContent.includes("別の画面で変更されました"));
    assert.equal(await page.locator("#name").inputValue(), "Stale rename");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("appdock")).apps.find(app => app.id === "account").url), "https://example.com/latest");
    await page.locator("#cancel").click();
    await account.locator('[data-action="delete"]').click();
    await page.evaluate(async () => {
      const data = JSON.parse(localStorage.getItem("appdock"));
      data.apps.find(app => app.id === "account").name = "Changed before delete";
      await browser.storage.local.set({appdock: data});
    });
    await page.locator("#delete-confirm").click();
    await page.waitForFunction(() => document.querySelector("#delete-message").textContent.includes("別の画面で変更されました"));
    assert.equal(await page.locator("#delete-dialog").evaluate(dialog => dialog.open), true);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("appdock")).apps.some(app => app.id === "account")), true);
    await page.locator("#delete-cancel").click();

    /**
     * Corruption repair requires confirmation and a successful backup first.
     * Confirming stale source must fail, even if the displayed list is the same.
     */
    const corruptSource = await page.evaluate(async () => {
      const data = JSON.parse(localStorage.getItem("appdock"));
      data.apps.find(app => app.id === "account").url = "http://example.com/recover-me";
      await browser.storage.local.set({appdock: data});
      return data;
    });
    await waitRows(14);
    assert.equal(await page.locator("#add").isDisabled(), true);
    assert.equal(await page.locator("#theme").isDisabled(), true);
    assert.equal(await page.locator("#language").isDisabled(), true);
    await page.locator("#repair").click();
    await page.screenshot({path: "test-results/repair-dialog.png", fullPage: true});
    await page.keyboard.press("Escape");
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("appdock"))), corruptSource);
    await page.locator("#repair").click();
    await page.evaluate(() => { window.failSave = true; });
    await page.locator("#repair-confirm").click();
    await page.waitForFunction(() => document.querySelector("#repair-error").textContent.length > 0);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("appdock"))), corruptSource);
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("appdock-recovery-")).length), 0);
    await page.evaluate(async () => {
      window.failSave = false;
      const data = JSON.parse(localStorage.getItem("appdock"));
      data.apps.find(app => app.id === "account").url = "http://example.com/new-corruption";
      await browser.storage.local.set({appdock: data});
    });
    await page.locator("#repair-confirm").click();
    await page.waitForFunction(() => document.querySelector("#repair-error").textContent.includes("保存データが変わりました"));
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("appdock-recovery-")).length), 0);
    await page.locator("#repair-cancel").click();
    await page.locator("#repair").click();
    const latestSource = await page.evaluate(() => JSON.parse(localStorage.getItem("appdock")));
    await page.locator("#repair-confirm").click();
    await page.waitForFunction(() => !document.querySelector("#repair-dialog").open && !document.querySelector("#theme").disabled);
    const storedBackup = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key => key.startsWith("appdock-recovery-")))));
    assert.deepEqual(storedBackup.source, latestSource);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("appdock")).apps.some(app => app.id === "account")), false);
    assert.equal(await page.locator("#backup-count").textContent(), "修復コピー：1件");
    const beforeBackupDelete = await page.evaluate(() => JSON.parse(localStorage.getItem("appdock")));
    await page.locator("#delete-backups").click();
    await page.locator("#data-cancel").click();
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("appdock-recovery-")).length), 1);
    await page.locator("#delete-backups").click();
    await page.evaluate(() => { window.failSave = true; });
    await page.locator("#data-confirm").click();
    await page.waitForFunction(() => document.querySelector("#data-error").textContent.length > 0);
    assert.equal(await page.locator("#data-dialog").evaluate(dialog => dialog.open), true);
    await page.evaluate(() => { window.failSave = false; });
    await page.locator("#data-confirm").click();
    await page.waitForFunction(() => !document.querySelector("#data-dialog").open);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("appdock"))), beforeBackupDelete);
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("appdock-recovery-")).length), 0);
    // App deletion also erases copies made by earlier repairs.
    await page.evaluate(async () => {
      const data = JSON.parse(localStorage.getItem("appdock")); data.apps[0].url = "http://example.com/corrupt";
      await browser.storage.local.set({appdock: data});
    });
    await page.locator("#repair").click(); await page.locator("#repair-confirm").click();
    await page.waitForFunction(() => !document.querySelector("#repair-dialog").open);
    await page.locator('.editor-row:first-child [data-action="delete"]').click();
    assert.ok((await page.locator("#delete-message").textContent()).includes("すべての修復コピー"));
    await page.locator("#delete-confirm").click();
    await page.waitForFunction(() => !document.querySelector("#delete-dialog").open);
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("appdock-recovery-")).length), 0);
    await page.evaluate(() => browser.storage.local.set({legacySecret: "synthetic"}));
    await page.locator("#erase-data").click(); await page.locator("#data-cancel").click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("legacySecret"))), "synthetic");
    await page.locator("#erase-data").click();
    await page.evaluate(() => { window.failSave = true; });
    await page.locator("#data-confirm").click();
    await page.waitForFunction(() => document.querySelector("#data-error").textContent.length > 0);
    assert.ok(await page.evaluate(() => localStorage.getItem("appdock")));
    await page.evaluate(() => { window.failSave = false; });
    await page.locator("#data-confirm").click();
    await page.waitForFunction(() => !document.querySelector("#data-dialog").open);
    await waitRows(14);
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    await page.screenshot({path:"test-results/data-management.png",fullPage:true});
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
