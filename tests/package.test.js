import test from "node:test";
import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {basename, dirname, join, resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {unzipSync} from "fflate";
import {packageExtension} from "../tools/package.mjs";
import {imageDimensions} from "../extension/image-header.js";

test("Firefox and Chromium packages preserve shared files, privileges and reproducible ZIPs", async t => {
  const root = resolve("test-results");
  await mkdir(root, {recursive: true});
  const directory = await mkdtemp(join(root, "packages-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), root);
    await rm(directory, {recursive: true, force: true});
  });
  const output = pathToFileURL(directory + "/");
  const sourceManifest = await readFile(new URL("../extension/manifest.json", import.meta.url));
  const version = JSON.parse(sourceManifest).version;
  const firefox = await packageExtension("firefox", output);
  const firefoxBytes = await readFile(firefox.destination);
  const firefoxFiles = unzipSync(firefoxBytes);
  assert.deepEqual(Buffer.from(firefoxFiles["manifest.json"]), sourceManifest);
  assert.equal(firefox.directory, undefined);
  assert.equal(basename(firefox.destination), `hiratoco-${version}.zip`);

  const chromium = await packageExtension("chromium", output);
  const chromiumBytes = await readFile(chromium.destination);
  const chromiumFiles = unzipSync(chromiumBytes);
  const manifest = JSON.parse(Buffer.from(chromiumFiles["manifest.json"]));
  assert.equal(basename(chromium.destination), `hiratoco-chromium-${version}.zip`);
  assert.equal("browser_specific_settings" in manifest, false);
  assert.equal("theme_icons" in manifest.action, false);
  assert.equal(manifest.minimum_chrome_version, "109");
  assert.equal(manifest.incognito, "not_allowed");
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.content_security_policy, JSON.parse(sourceManifest).content_security_policy);
  for (const field of ["host_permissions", "content_scripts", "background", "web_accessible_resources"]) assert.equal(field in manifest, false);
  for (const size of [16, 32, 48, 128]) {
    const path = manifest.icons[size];
    assert.match(path, /\.png$/);
    assert.deepEqual(imageDimensions(chromiumFiles[path], "image/png"), {width: size, height: size});
  }
  assert.deepEqual(manifest.action.default_icon, {16: manifest.icons[16], 32: manifest.icons[32]});
  for (const [name, bytes] of Object.entries(firefoxFiles)) {
    if (name !== "manifest.json") assert.deepEqual(chromiumFiles[name], bytes, name);
  }
  for (const [name, bytes] of Object.entries(chromiumFiles)) {
    assert.deepEqual(await readFile(join(chromium.directory, name)), Buffer.from(bytes), name);
  }

  // A rebuild must remove entries from an earlier unpacked build and preserve
  // byte-for-byte archives, independent of generation time or the target order.
  await writeFile(join(chromium.directory, "stale-file.txt"), "old build");
  await packageExtension("chromium", output);
  await packageExtension("firefox", output);
  assert.equal((await readdir(chromium.directory)).includes("stale-file.txt"), false);
  assert.deepEqual(await readFile(chromium.destination), chromiumBytes);
  assert.deepEqual(await readFile(firefox.destination), firefoxBytes);
  assert.deepEqual(await readFile(new URL("../extension/manifest.json", import.meta.url)), sourceManifest);
  await assert.rejects(packageExtension("unknown", output), /Unknown package target/);
});
