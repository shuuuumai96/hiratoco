import {randomUUID} from "node:crypto";
import {mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from "node:fs/promises";
import {fileURLToPath, pathToFileURL} from "node:url";
import {basename, dirname, extname, join, resolve} from "node:path";
import {zipSync} from "fflate";

const SOURCE_DIRECTORY = new URL("../extension/", import.meta.url);
const OUTPUT_DIRECTORY = new URL("../dist/", import.meta.url);
const CHROMIUM_ICON_DIRECTORY = new URL("./chromium-icons/", import.meta.url);
const CHROMIUM_ICON_SIZES = [16, 32, 48, 128];
const MINIMUM_CHROME_VERSION = "109";
// ZIP stores local calendar fields. A fixed local date keeps archives repeatable
// across build times and time zones without preserving source-file timestamps.
const ZIP_TIMESTAMP = new Date(1980, 0, 1, 0, 0, 0);
const ASSET_TYPES = new Set([".js", ".html", ".css", ".svg"]);
const SPECIAL_FILES = new Set(["manifest.json", "ASSET-LICENSE.txt", "_locales/ja/messages.json", "_locales/en/messages.json"]);

async function collectFiles(directory, prefix = "") {
  const files = {};
  const entries = await readdir(directory, {withFileTypes: true});
  entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (const entry of entries) {
    if (entry.name.startsWith(".")) throw new Error(`Hidden package entries are not allowed: ${prefix}${entry.name}`);
    if (entry.isSymbolicLink()) throw new Error(`Packaging symlinks is not allowed: ${prefix}${entry.name}`);
    const name = `${prefix}${entry.name}`;
    const path = new URL(encodeURIComponent(entry.name), directory);
    if (entry.isDirectory()) {
      path.pathname += "/";
      Object.assign(files, await collectFiles(path, `${name}/`));
    } else if (entry.isFile()) {
      if (!ASSET_TYPES.has(extname(entry.name)) && !SPECIAL_FILES.has(name)) throw new Error(`Unexpected package file: ${name}`);
      files[name] = await readFile(path);
    } else {
      throw new Error(`Unsupported package entry: ${name}`);
    }
  }
  return files;
}

async function packageFiles(target) {
  const files = await collectFiles(SOURCE_DIRECTORY);
  const manifest = JSON.parse(files["manifest.json"]);
  if (typeof manifest.version !== "string" || !/^[0-9][A-Za-z0-9.+_-]*$/.test(manifest.version)) {
    throw new Error("The manifest version cannot be used as a package filename.");
  }
  if (target === "chromium") {
    delete manifest.browser_specific_settings;
    delete manifest.action.theme_icons;
    manifest.minimum_chrome_version = MINIMUM_CHROME_VERSION;
    // Private and normal extension pages must not write through separate locks
    // into shared storage. Firefox enforces this at runtime; Chromium opts out.
    manifest.incognito = "not_allowed";
    const icons = {};
    for (const size of CHROMIUM_ICON_SIZES) {
      const name = `launcher-${size}.png`;
      icons[size] = `icons/${name}`;
      files[icons[size]] = await readFile(new URL(name, CHROMIUM_ICON_DIRECTORY));
    }
    manifest.icons = icons;
    manifest.action.default_icon = {16: icons[16], 32: icons[32]};
    files["manifest.json"] = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  }
  return {files, version: manifest.version};
}

// Every recursive removal is restricted to one generated child of the output
// directory. No source paths or archive entry paths reach this operation.
async function removeGeneratedDirectory(directory, outputRoot) {
  const absolute = resolve(directory);
  if (dirname(absolute) !== outputRoot || !/^(?:chromium|\.chromium-[A-Za-z0-9]+)$/.test(basename(absolute))) {
    throw new Error(`Refusing to remove a directory outside the package output: ${absolute}`);
  }
  await rm(absolute, {recursive: true, force: true});
}

export async function packageExtension(target = "firefox", outputDirectory = OUTPUT_DIRECTORY) {
  if (!["firefox", "chromium"].includes(target)) throw new Error(`Unknown package target: ${target}`);
  const {files, version} = await packageFiles(target);
  const outputRoot = resolve(fileURLToPath(outputDirectory));
  const packageName = `hiratoco-${target === "chromium" ? "chromium-" : ""}${version}`;
  const destination = join(outputRoot, `${packageName}.zip`);
  const temporary = join(outputRoot, `${packageName}.${randomUUID()}.tmp`);
  const archive = zipSync(files, {level: 9, mtime: ZIP_TIMESTAMP});
  await mkdir(outputRoot, {recursive: true});
  let staging;
  const directory = target === "chromium" ? join(outputRoot, "chromium") : undefined;
  try {
    await writeFile(temporary, archive, {flag: "wx"});
    if (directory) {
      staging = await mkdtemp(join(outputRoot, ".chromium-"));
      for (const [name, bytes] of Object.entries(files)) {
        const path = join(staging, name);
        await mkdir(dirname(path), {recursive: true});
        await writeFile(path, bytes);
      }
      await removeGeneratedDirectory(directory, outputRoot);
      await rename(staging, directory);
      staging = undefined;
    }
    await rename(temporary, destination);
  } finally {
    await rm(temporary, {force: true});
    if (staging) await removeGeneratedDirectory(staging, outputRoot);
  }
  return {destination, directory, fileCount: Object.keys(files).length};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length > 3) throw new Error("Usage: node tools/package.mjs [firefox|chromium]");
  const result = await packageExtension(process.argv[2]);
  console.log(`Packaged ${result.fileCount} files: ${result.destination}`);
  if (result.directory) console.log(`Unpacked extension: ${result.directory}`);
}
