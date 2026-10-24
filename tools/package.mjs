import {randomUUID} from "node:crypto";
import {mkdir, readFile, readdir, rename, rm, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {extname} from "node:path";
import {zipSync} from "fflate";

const SOURCE_DIRECTORY = new URL("../extension/", import.meta.url);
const OUTPUT_DIRECTORY = new URL("../dist/", import.meta.url);
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

const manifest = JSON.parse(await readFile(new URL("manifest.json", SOURCE_DIRECTORY), "utf8"));
if (typeof manifest.version !== "string" || !/^[0-9][A-Za-z0-9.+_-]*$/.test(manifest.version)) {
  throw new Error("The manifest version cannot be used as a package filename.");
}
const destination = new URL(`hiratoco-${manifest.version}.zip`, OUTPUT_DIRECTORY);
const temporary = new URL(`hiratoco-${manifest.version}.${randomUUID()}.tmp`, OUTPUT_DIRECTORY);
const files = await collectFiles(SOURCE_DIRECTORY);
const archive = zipSync(files, {level: 9, mtime: ZIP_TIMESTAMP});
await mkdir(OUTPUT_DIRECTORY, {recursive: true});
try {
  await writeFile(temporary, archive, {flag: "wx"});
  await rename(temporary, destination);
} finally {
  await rm(temporary, {force: true});
}
console.log(`Packaged ${Object.keys(files).length} files: ${fileURLToPath(destination)}`);
