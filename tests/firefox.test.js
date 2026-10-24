import test from "node:test";
import assert from "node:assert/strict";
import {mkdir, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {Builder, By, until, Key} from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import {DEFAULT_APPS, defaults} from "../extension/model.js";
import {WRITE_LOCK} from "../extension/storage.js";

test("Firefox stable: real extension storage, links, CRUD, theme, language, and corruption recovery", {timeout: 180000}, async () => {
  const options = new firefox.Options().addArguments("-headless");
  options.setPreference("browser.shell.checkDefaultBrowser", false);
  options.setPreference("datareporting.policy.dataSubmissionEnabled", false);
  options.setPreference("privacy.userContext.enabled", true);
  if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
  const service = new firefox.ServiceBuilder(process.env.GECKODRIVER).addArguments("--allow-system-access");
  const driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options).setFirefoxService(service).build();
  try {
    const capabilities = await driver.getCapabilities();
    console.log(`Firefox ${capabilities.get("browserVersion")}`);
    await driver.manage().setTimeouts({implicit: 0, script: 15000, pageLoad: 30000});
    await driver.installAddon(resolve(process.env.FIREFOX_ADDON_PATH ?? "extension"), true);
    await driver.setContext(firefox.Context.CHROME);
    const base = await driver.executeScript('return WebExtensionPolicy.getByID("appdock@personal.local").getURL("");');
    await driver.setContext(firefox.Context.CONTENT);
    await driver.get(`${base}popup.html`);
    await driver.wait(until.elementLocated(By.css(".app-tile")), 10000);
    const uiLocale = await driver.executeScript('return browser.i18n.getUILanguage();');
    const initialLanguage = /^ja(?:-|$)/i.test(uiLocale) ? "ja" : "en";
    assert.equal(await driver.getTitle(), initialLanguage === "ja" ? "Hiratoco — Webアプリランチャー" : "Hiratoco — Web App Launcher");
    assert.equal(await driver.executeScript("return document.documentElement.lang"), initialLanguage);
    console.log(`Firefox UI language: ${uiLocale}; initial app language: ${initialLanguage}`);
    const metadata = await driver.executeScript('return {manifest: browser.runtime.getManifest(), name: browser.i18n.getMessage("extensionName"), description: browser.i18n.getMessage("extensionDescription")};');
    assert.ok(["Hiratoco — Webアプリランチャー", "Hiratoco — Web App Launcher"].includes(metadata.name));
    assert.equal(metadata.manifest.name, metadata.name);
    assert.equal(metadata.manifest.description, metadata.description);
    assert.equal(metadata.manifest.action.default_title, "Hiratoco");
    console.log(`Localized extension name: ${metadata.name}`);
    const links = await driver.findElements(By.css(".app-tile"));
    assert.equal(links.length, 14);
    for (let i = 0; i < links.length; i++) assert.equal(await links[i].getAttribute("href"), DEFAULT_APPS[i].url);
    assert.equal(await driver.executeScript("return document.body.offsetWidth"), 340);
    assert.ok(await driver.executeScript("return [...document.images].every(i => i.complete && i.naturalWidth > 0)"));
    // The rest of this scenario starts in Japanese; this is an explicit saved
    // choice and must take precedence over the detected browser language.
    await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; import("./model.js").then(({defaults}) => browser.storage.local.set({appdock: defaults("ja")})).then(done);');
    await driver.navigate().refresh();
    await driver.wait(async () => (await driver.executeScript("return document.documentElement.lang")) === "ja", 10000);
    await mkdir("test-results", {recursive: true});
    await writeFile("test-results/firefox-popup.png", await driver.takeScreenshot(), "base64");
    /**
     * Keep external services offline; only the destination and focus are tested.
     */
    await driver.setContext(firefox.Context.CHROME);
    await driver.executeScript('Services.io.offline = true;');
    await driver.setContext(firefox.Context.CONTENT);
    const original = await driver.getWindowHandle();
    await driver.findElement(By.css(".app-tile")).click();
    await driver.wait(async () => (await driver.getAllWindowHandles()).length === 2, 10000);
    const handles = await driver.getAllWindowHandles();
    const opened = handles.find(handle => handle !== original);
    await driver.setContext(firefox.Context.CHROME);
    await driver.wait(async () => (await driver.executeScript('return gBrowser.selectedBrowser.currentURI.spec')) === DEFAULT_APPS[0].url, 10000);
    assert.equal(await driver.executeScript('return gBrowser.selectedBrowser.currentURI.spec'), DEFAULT_APPS[0].url);
    await driver.setContext(firefox.Context.CONTENT);
    await driver.switchTo().window(opened);
    await driver.close();
    await driver.switchTo().window(original);
    assert.equal(await driver.getCurrentUrl(), `${base}popup.html`);
    await driver.get(`${base}options.html`);
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    await driver.findElement(By.id("add")).click();
    await driver.findElement(By.id("name")).sendKeys("Firefox test");
    await driver.findElement(By.id("url")).sendKeys("https://example.com/");
    await driver.findElement(By.id("save")).click();
    await driver.wait(async () => (await driver.findElements(By.css(".editor-row"))).length === 15, 10000);
    await driver.findElement(By.css('.editor-row:last-child [data-action="edit"]')).click();
    const name = await driver.findElement(By.id("name"));
    await name.clear(); await name.sendKeys("Edited");
    await driver.findElement(By.id("save")).click();
    await driver.wait(async () => !(await driver.executeScript('return document.querySelector("#editor").open')), 10000);
    const last = await driver.findElement(By.css(".editor-row:last-child"));
    await last.sendKeys(Key.chord(Key.ALT, Key.ARROW_UP));
    await driver.wait(async () => driver.executeScript('return document.querySelector(".editor-row:nth-child(14) strong")?.textContent === "Edited"'), 10000);
    await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; browser.storage.local.get("appdock").then(done);');
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    assert.equal(await driver.findElement(By.css(".editor-row:nth-child(14) strong")).getText(), "Edited");
    await driver.findElement(By.css('.editor-row:nth-child(14) [data-action="delete"]')).click();
    await driver.findElement(By.id("delete-confirm")).click();
    await driver.wait(async () => (await driver.findElements(By.css(".editor-row"))).length === 14, 10000);
    await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; browser.storage.local.get("appdock").then(({appdock}) => browser.storage.local.set({appdock: {...appdock, settings: {theme: "dark"}}})).then(done);');
    await driver.wait(async () => (await driver.executeScript("return document.documentElement.dataset.theme")) === "dark", 10000);
    assert.equal(await driver.executeScript("return getComputedStyle(document.body).backgroundColor"), "rgb(23, 25, 31)");
    assert.equal(await driver.findElement(By.id("language")).getAttribute("value"), "ja");
    await driver.findElement(By.css('#language option[value="en"]')).click();
    await driver.wait(async () => (await driver.executeScript("return document.documentElement.lang")) === "en", 10000);
    assert.equal(await driver.findElement(By.css("h1")).getText(), "Edit apps");
    assert.equal(await driver.getTitle(), "Hiratoco — Edit apps");
    await driver.findElement(By.css('#theme option[value="light"]')).click();
    await driver.wait(async () => (await driver.executeScript("return document.documentElement.dataset.theme")) === "light", 10000);
    const saved = await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; browser.storage.local.get("appdock").then(done);');
    assert.equal(saved.appdock.settings.language, "en");
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    assert.equal(await driver.findElement(By.id("language")).getAttribute("value"), "en");
    assert.equal(await driver.findElement(By.id("theme")).getAttribute("value"), "light");
    assert.equal(await driver.executeScript("return document.documentElement.lang"), "en");
    await driver.get(`${base}popup.html`);
    await driver.wait(until.elementLocated(By.css(".app-tile")), 10000);
    assert.equal(await driver.executeScript("return document.documentElement.lang"), "en");
    assert.equal(await driver.findElement(By.css('.app-tile[data-app-id="account"] span')).getText(), "Account");
    assert.equal(await driver.getTitle(), "Hiratoco — Web App Launcher");
    await driver.get(`${base}options.html`);
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; browser.storage.local.set({appdock: {version: 1, apps: [{id: "bad", name: "bad", url: "javascript:alert(1)"}]}}).then(done);');
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    assert.equal((await driver.findElements(By.css(".editor-row"))).length, 14);
    assert.ok(await driver.findElement(By.id("notice")).isDisplayed());
    assert.equal(await driver.findElement(By.id("add")).isEnabled(), false);
    assert.equal(await driver.findElement(By.id("theme")).isEnabled(), false);

    const setState = async state => {
      const result = await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; browser.storage.local.set({appdock: arguments[0]}).then(() => done("ok"), error => done(error.message));', state);
      assert.equal(result, "ok");
    };
    const readStorage = () => driver.executeAsyncScript('const done = arguments[arguments.length - 1]; browser.storage.local.get(null).then(done);');

    /**
     * Both pages queue behind the same browser lock. A completed deletion must
     * survive the following appearance change, even with separate module state.
     */
    await setState(defaults());
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    const firstEditor = await driver.getWindowHandle();
    await driver.switchTo().newWindow("tab");
    const secondEditor = await driver.getWindowHandle();
    await driver.get(`${base}options.html`);
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    await driver.switchTo().window(firstEditor);
    await driver.executeScript('window.lockGate = new Promise(resolve => { window.releaseLockGate = resolve; }); window.heldLock = navigator.locks.request(arguments[0], async () => { window.lockHeld = true; await window.lockGate; });', WRITE_LOCK);
    await driver.wait(() => driver.executeScript("return window.lockHeld === true"), 10000);
    await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; import("./storage.js").then(({updateState}) => { window.saveResult = "pending"; window.testSave = updateState(state => ({...state, apps: state.apps.filter(app => app.id !== "account")})).then(() => { window.saveResult = "ok"; }, error => { window.saveResult = error.key ?? error.message; }); done(); });');
    await driver.wait(() => driver.executeAsyncScript('const done = arguments[arguments.length - 1]; navigator.locks.query().then(snapshot => done(snapshot.pending.length === 1));'), 10000);
    await driver.switchTo().window(secondEditor);
    await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; import("./storage.js").then(({updateState}) => { window.saveResult = "pending"; window.testSave = updateState(state => ({...state, settings: {...state.settings, theme: "dark"}})).then(() => { window.saveResult = "ok"; }, error => { window.saveResult = error.key ?? error.message; }); done(); });');
    await driver.wait(() => driver.executeAsyncScript('const done = arguments[arguments.length - 1]; navigator.locks.query().then(snapshot => done(snapshot.pending.length === 2));'), 10000);
    await driver.switchTo().window(firstEditor);
    assert.equal(await driver.executeScript("return window.saveResult"), "pending");
    await driver.executeScript("window.releaseLockGate();");
    await driver.wait(() => driver.executeScript('return window.saveResult === "ok"'), 10000);
    await driver.switchTo().window(secondEditor);
    await driver.wait(() => driver.executeScript('return window.saveResult === "ok"'), 10000);
    const concurrent = (await readStorage()).appdock;
    assert.equal(concurrent.apps.some(app => app.id === "account"), false);
    assert.equal(concurrent.apps.length, 13);
    assert.equal(concurrent.settings.theme, "dark");

    /**
     * Refreshing the list does not refresh an open form. Its stale snapshot
     * must reject a name-only save instead of reverting the other page's URL.
     */
    await setState(defaults());
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    await driver.findElement(By.css('[data-app-id="account"] [data-action="edit"]')).click();
    await driver.switchTo().window(firstEditor);
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    await driver.findElement(By.css('[data-app-id="account"] [data-action="edit"]')).click();
    const changedUrl = "https://example.com/new-destination";
    const destination = await driver.findElement(By.id("url"));
    await destination.clear(); await destination.sendKeys(changedUrl);
    await driver.findElement(By.id("save")).click();
    await driver.wait(() => driver.executeScript('return !document.querySelector("#editor").open'), 10000);
    await driver.switchTo().window(secondEditor);
    await driver.wait(() => driver.executeScript('return document.querySelector(\'[data-app-id="account"] .row-text span\').textContent === arguments[0]', changedUrl), 10000);
    const staleName = await driver.findElement(By.id("name"));
    await staleName.clear(); await staleName.sendKeys("Name from stale form");
    await driver.findElement(By.id("save")).click();
    await driver.wait(() => driver.executeScript('return document.querySelector("#form-error").textContent.length > 0'), 10000);
    assert.equal(await driver.executeScript('return document.querySelector("#editor").open'), true);
    assert.equal(await staleName.getAttribute("value"), "Name from stale form");
    assert.equal((await readStorage()).appdock.apps[0].url, changedUrl);
    assert.equal((await readStorage()).appdock.apps[0].name, DEFAULT_APPS[0].name);
    await driver.findElement(By.id("cancel")).click();
    await driver.findElement(By.css('[data-app-id="account"] [data-action="edit"]')).click();
    assert.equal(await driver.findElement(By.id("url")).getAttribute("value"), changedUrl);
    await driver.findElement(By.id("name")).clear();
    await driver.findElement(By.id("name")).sendKeys("Name after reopening");
    await driver.findElement(By.id("save")).click();
    await driver.wait(() => driver.executeScript('return !document.querySelector("#editor").open'), 10000);
    assert.equal((await readStorage()).appdock.apps[0].name, "Name after reopening");
    assert.equal((await readStorage()).appdock.apps[0].url, changedUrl);
    await driver.switchTo().window(firstEditor);
    await driver.close();
    await driver.switchTo().window(secondEditor);

    /**
     * Recovery is explicit, preserves original data before replacement, and
     * retains the original unchanged when the confirmation is cancelled.
     */
    const corrupted = defaults();
    corrupted.apps[0].url = "javascript:alert(1)";
    await setState(corrupted);
    await driver.navigate().refresh();
    await driver.wait(async () => (await driver.findElements(By.css(".editor-row"))).length === 13, 10000);
    assert.equal(await driver.findElement(By.id("theme")).isEnabled(), false);
    assert.equal(await driver.findElement(By.id("language")).isEnabled(), false);
    const blockedEdit = await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; import("./storage.js").then(({updateState}) => updateState(state => ({...state, settings: {...state.settings, theme: "dark"}}))).then(() => done("unexpected success"), error => done(error.key));');
    assert.equal(blockedEdit, "noticeRepaired");
    assert.deepEqual((await readStorage()).appdock, corrupted);
    await driver.findElement(By.id("repair")).click();
    await driver.findElement(By.id("repair-cancel")).click();
    assert.deepEqual((await readStorage()).appdock, corrupted);
    assert.equal(Object.keys(await readStorage()).filter(key => key.startsWith("appdock-recovery-")).length, 0);
    await driver.findElement(By.id("repair")).click();
    await driver.findElement(By.id("repair-confirm")).click();
    await driver.wait(() => driver.executeScript('return !document.querySelector("#repair-dialog").open && !document.querySelector("#theme").disabled'), 10000);
    const repaired = await readStorage();
    const backupKeys = Object.keys(repaired).filter(key => key.startsWith("appdock-recovery-"));
    assert.equal(backupKeys.length, 1);
    assert.deepEqual(repaired[backupKeys[0]].source, corrupted);
    assert.equal(repaired.appdock.apps.length, 13);
    assert.equal(repaired.appdock.apps.some(app => app.id === "account"), false);
    await driver.findElement(By.css('#theme option[value="dark"]')).click();
    await driver.wait(() => driver.executeScript('return document.documentElement.dataset.theme === "dark"'), 10000);
    assert.deepEqual((await readStorage())[backupKeys[0]].source, corrupted);

    /**
     * Firefox containers share extension storage but partition Web Locks.
     * Settings in those tabs must remain read-only without requesting cookies
     * or contextual-identities permissions.
     */
    const beforeContainer = await readStorage();
    const normalEditor = await driver.getWindowHandle();
    await driver.setContext(firefox.Context.CHROME);
    await driver.executeScript('const tab = gBrowser.addTab(arguments[0], {userContextId: 1, triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()}); gBrowser.selectedTab = tab;', `${base}options.html`);
    await driver.setContext(firefox.Context.CONTENT);
    await driver.wait(async () => (await driver.getAllWindowHandles()).length === 2, 10000);
    const containerEditor = (await driver.getAllWindowHandles()).find(handle => handle !== normalEditor);
    await driver.switchTo().window(containerEditor);
    await driver.wait(until.elementLocated(By.css(".editor-row")), 10000);
    assert.equal(await driver.findElement(By.id("add")).isEnabled(), false);
    assert.equal(await driver.findElement(By.id("theme")).isEnabled(), false);
    assert.equal(await driver.findElement(By.id("language")).isEnabled(), false);
    assert.match(await driver.findElement(By.id("notice")).getText(), /コンテナー/);
    const containerTab = await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; browser.tabs.getCurrent().then(done);');
    assert.equal(containerTab.cookieStoreId, "firefox-container-1");
    const blockedContainerWrite = await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; import("./storage.js").then(({updateState}) => updateState(state => ({...state, apps: []}))).then(() => done("unexpected success"), error => done(error.key));');
    assert.equal(blockedContainerWrite, "noticeContainer");
    const blockedContainerRepair = await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; import("./storage.js").then(({repairState}) => repairState(null)).then(() => done("unexpected success"), error => done(error.key));');
    assert.equal(blockedContainerRepair, "noticeContainer");
    assert.deepEqual(await readStorage(), beforeContainer);
    await driver.close();
    await driver.switchTo().window(normalEditor);
    assert.equal(await driver.findElement(By.id("theme")).isEnabled(), true);
  } finally { await driver.quit(); }
});
