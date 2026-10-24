import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readdir, readFile, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {Builder, By, until} from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

test("Firefox privacy: packaged DNS/HTTP silence, raster decoding and complete data erasure", {timeout: 120000}, async () => {
  await mkdir("test-results", {recursive:true});
  const logs = await mkdtemp(resolve("test-results/privacy-"));
  const previousLog = process.env.MOZ_LOG;
  const previousFile = process.env.MOZ_LOG_FILE;
  process.env.MOZ_LOG = "timestamp,sync,nsHostResolver:5,nsHttp:3";
  process.env.MOZ_LOG_FILE = resolve(logs, "dns.log");
  const options = new firefox.Options().addArguments("-headless");
  if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
  options.setPreference("network.dns.localDomains", "appdock-privacy.invalid");
  options.setPreference("network.proxy.type", 0);
  options.setPreference("network.trr.mode", 5);
  const service = new firefox.ServiceBuilder(process.env.GECKODRIVER).addArguments("--allow-system-access");
  let driver;
  let server;
  const report = {};
  const dnsCount = async () => {
    const names = await readdir(logs);
    const content = await Promise.all(names.filter(name => name.startsWith("dns.log")).map(name => readFile(resolve(logs,name),"utf8")));
    return content.join("\n").split("\n").filter(line => /Resolving host \[localhost\]</.test(line)).length;
  };
  const execute = async code => {
    const result = await driver.executeAsyncScript('const done=arguments[arguments.length-1]; (async()=>{' + code + '})().then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error)}));');
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  try {
    driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options).setFirefoxService(service).build();
    await driver.manage().setTimeouts({implicit:0,script:15000,pageLoad:15000});
    report.firefox = (await driver.getCapabilities()).get("browserVersion");
    await driver.installAddon(resolve(process.env.FIREFOX_ADDON_PATH ?? "extension"),true);
    await driver.setContext(firefox.Context.CHROME);
    const keys = ["network.dns.disablePrefetch", "network.dns.disablePrefetchFromHTTPS", "dom.prefetch_dns_for_anchor_http_document", "dom.prefetch_dns_for_anchor_https_document"];
    await driver.executeScript('for(const key of arguments[0])Services.prefs.clearUserPref(key);',keys);
    report.dnsDefaults = await driver.executeScript('return arguments[0].map(key=>({key,value:Services.prefs.getBoolPref(key),defaultValue:Services.prefs.getDefaultBranch("").getBoolPref(key)}));',keys);
    assert.ok(report.dnsDefaults.every(pref=>pref.value===pref.defaultValue));
    const base = await driver.executeScript('return WebExtensionPolicy.getByID("appdock@personal.local").getURL("");');
    await driver.executeScript(`window.privacyRequests=[];window.privacyObserver={observe(subject){const c=subject.QueryInterface(Ci.nsIHttpChannel);window.privacyRequests.push({uri:c.URI.spec,loading:c.loadInfo.loadingPrincipal?.origin??null,triggering:c.loadInfo.triggeringPrincipal?.origin??null});if(c.URI.host!=="appdock-privacy.invalid"||!c.URI.pathQueryRef.startsWith("/positive-control"))c.cancel(Cr.NS_BINDING_ABORTED);}};Services.obs.addObserver(window.privacyObserver,"http-on-modify-request");`);
    await driver.setContext(firefox.Context.CONTENT);
    await driver.get(base+"options.html");
    await driver.wait(until.elementLocated(By.css(".editor-row")),10000);
    report.permissions=await execute('return await browser.permissions.getAll();');
    assert.deepEqual(report.permissions.permissions,["storage"]);
    assert.deepEqual(report.permissions.origins,[]);
    assert.deepEqual(await execute('return await browser.storage.local.get(null);'),{});
    await execute('await browser.storage.local.set({appdock:{version:1,apps:[{id:"canary",name:"Synthetic",url:"https://appdock-privacy.invalid/?token=SYNTHETIC",icon:"icons/site.svg"}],settings:{theme:"auto",language:"ja"}}});return true;');
    const before=await dnsCount();
    await driver.get(base+"popup.html");
    await driver.wait(until.elementLocated(By.css(".app-tile")),10000);
    await driver.actions({async:true}).move({origin:await driver.findElement(By.css(".app-tile"))}).perform();
    await driver.executeAsyncScript('const done=arguments[arguments.length-1];setTimeout(done,4200);');
    report.passiveDnsRequests=(await dnsCount())-before;
    assert.equal(report.passiveDnsRequests,0);
    await driver.setContext(firefox.Context.CHROME);
    report.passiveHttpRequests=await driver.executeScript('return window.privacyRequests.filter(r=>r.loading?.startsWith(arguments[0])||r.triggering?.startsWith(arguments[0])).length;',base.slice(0,-1));
    assert.equal(report.passiveHttpRequests,0);
    await driver.setContext(firefox.Context.CONTENT);
    await driver.get(base+"options.html");
    await driver.wait(until.elementLocated(By.css(".editor-row")),10000);
    report.imageTypes=await execute(`const {readIconFile}=await import('./icons.js');const {validIcon}=await import('./model.js');const c=document.createElement('canvas');c.width=c.height=8;c.getContext('2d').fillRect(0,0,8,8);const result=[];for(const mime of ['image/png','image/jpeg','image/webp']){const blob=await new Promise(resolve=>c.toBlob(resolve,mime));if(blob.type!==mime)throw Error('Encoder unavailable: '+mime);const icon=await readIconFile(new File([blob],'synthetic',{type:mime}));result.push({mime,valid:validIcon(icon)});}return result;`);
    assert.ok(report.imageTypes.every(image=>image.valid));
    // Repair a synthetic corrupt list, then erase an item through the real UI.
    await execute('const {defaults}=await import("./model.js");const state=defaults();state.apps[0].url="http://example.invalid/corrupt";await browser.storage.local.set({appdock:state});return true;');
    await driver.wait(until.elementIsVisible(await driver.findElement(By.id("repair"))),10000);
    await driver.findElement(By.id("repair")).click();await driver.findElement(By.id("repair-confirm")).click();
    await driver.wait(()=>driver.executeScript('return !document.querySelector("#repair-dialog").open'),10000);
    assert.equal(await execute('return Object.keys(await browser.storage.local.get(null)).filter(key=>key.startsWith("appdock-recovery-")).length;'),1);
    await driver.findElement(By.css('.editor-row:first-child [data-action="delete"]')).click();await driver.findElement(By.id("delete-confirm")).click();
    await driver.wait(()=>driver.executeScript('return !document.querySelector("#delete-dialog").open'),10000);
    report.backupsAfterAppDelete=await execute('return Object.keys(await browser.storage.local.get(null)).filter(key=>key.startsWith("appdock-recovery-")).length;');
    assert.equal(report.backupsAfterAppDelete,0);
    await execute('await browser.storage.local.set({legacySynthetic:"old-private-value","appdock-recovery-old":{source:"synthetic"}});return true;');
    await driver.findElement(By.id("erase-data")).click();await driver.findElement(By.id("data-cancel")).click();
    assert.equal(await execute('return (await browser.storage.local.get("legacySynthetic")).legacySynthetic;'),"old-private-value");
    await driver.findElement(By.id("erase-data")).click();await driver.findElement(By.id("data-confirm")).click();
    await driver.wait(()=>driver.executeScript('return !document.querySelector("#data-dialog").open'),10000);
    report.storageAfterErase=await execute('return await browser.storage.local.get(null);');
    assert.deepEqual(report.storageAfterErase,{});
    // Positive loopback control proves the resolver log is recording requests.
    server=createServer((request,response)=>response.end("synthetic DNS logging control"));
    await new Promise(done=>server.listen(0,"127.0.0.1",done));
    const prePositive=await dnsCount();
    await driver.get(`http://appdock-privacy.invalid:${server.address().port}/positive-control`);
    report.positiveDnsRequests=(await dnsCount())-prePositive;
    assert.ok(report.positiveDnsRequests>0);
    await writeFile(resolve("test-results/privacy-last.json"),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  } finally {
    if(driver){try{await driver.setContext(firefox.Context.CHROME);await driver.executeScript('if(window.privacyObserver)Services.obs.removeObserver(window.privacyObserver,"http-on-modify-request");');}catch{}await driver.quit();}
    if(server)await new Promise(done=>server.close(done));
    if(previousLog===undefined)delete process.env.MOZ_LOG;else process.env.MOZ_LOG=previousLog;
    if(previousFile===undefined)delete process.env.MOZ_LOG_FILE;else process.env.MOZ_LOG_FILE=previousFile;
  }
});
