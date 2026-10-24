# Developing Hiratoco

[Back to README](../README.md)

The extension uses plain JavaScript, HTML, CSS, and bundled SVG icons. There is no build step or runtime dependency. Node.js 22 or later and npm are needed only for development tools and packaging.

## Local setup

```sh
npm ci --ignore-scripts
```

Load `extension/manifest.json` from **Load Temporary Add-on…** at `about:debugging#/runtime/this-firefox`. After editing the source, use **Reload** on the same page. Firefox removes temporary add-ons when it exits.

## Tests

```sh
npm test
npm run lint
npx playwright install chromium
npm run test:ui
npm run test:firefox
npm run test:privacy
```

| Command | Coverage |
| --- | --- |
| `npm test` | Data validation, storage, conflicting edits, image validation, translations, and network restrictions |
| `npm run lint` | Mozilla's add-on validation, with warnings treated as errors |
| `npm run test:ui` | Playwright Chromium; UI behavior against mocked extension storage |
| `npm run test:firefox` | A temporary Firefox profile; real extension APIs, storage, links, and settings |
| `npm run test:privacy` | DNS and HTTP requests before opening a site, supported image formats, and data deletion |

The Firefox tests use an installed Firefox and Selenium. Selenium Manager downloads geckodriver if necessary. To use existing executables, set `GECKODRIVER` and `FIREFOX_BINARY` to their absolute paths. Set `SE_OFFLINE=true` when driver discovery must stay offline.

Both Firefox tests accept `FIREFOX_ADDON_PATH` to test a ZIP instead of `extension/`. For example, in PowerShell:

```powershell
$env:FIREFOX_ADDON_PATH = "dist/hiratoco-0.1.0.zip"
npm run test:firefox
npm run test:privacy
```

Tests use disposable browser profiles. Link tests keep external services offline and check destination URLs and tab selection. Privacy tests use a synthetic domain mapped to localhost and block external requests. The test driver's `--allow-system-access` flag is used to install and inspect the test extension; it is not a permission requested by Hiratoco.

See [TESTING.md](../TESTING.md) for recorded results and unverified scenarios. These include the actual toolbar panel, Firefox 142, other operating systems, and signed-install restart and update behavior.

## Packaging and distribution

```sh
npm run lint
npm run package
```

This creates `dist/hiratoco-0.1.0.zip` from `extension/` only. The archive contains a root-level `manifest.json`, both locale catalogs, source files, icons, and the asset license. It excludes tests, dependencies, and development documents. Packaging uses a fixed timestamp so the same source produces the same ZIP.

The ZIP is unsigned. Standard Firefox requires Mozilla signing for permanent installation, including private distribution.

Submit the ZIP through the [AMO Developer Hub](https://addons.mozilla.org/developers/). Choose **On this site** for a public Firefox Add-ons listing, or **On your own** for distribution without a listing. The repository does not yet provide a signed XPI. Follow Mozilla's [signing overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) and [submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) for the current process.

## Updates and compatibility

Keep `extension/manifest.json`, `package.json`, and the root package entries in `package-lock.json` at the same product version. Update the documented package filename when changing versions.

Keep the extension ID `appdock@personal.local` after the first signed release so Firefox can recognize updates. For self-distributed builds, sign the new version with the same ID and install it over the existing one. Hiratoco has no custom update server or `update_url`; self-distributed updates are manual.

The `appdock` storage key, recovery-copy prefix, and write-lock name are retained from the former AppDock name. Renaming them requires a migration plan. The storage format version in `model.js` is independent of the product version.

The browser uses `_locales/` for the add-on name and description. The extension UI uses `i18n.js` because its saved language can differ from Firefox's language. Keep the two sets of display names consistent.

## Source map

| Path | Purpose |
| --- | --- |
| `extension/model.js` | Default sites, validation, ordering, and storage-format decoding |
| `extension/storage.js` | Locked writes, data repair, and deletion |
| `extension/popup.*` | Toolbar launcher |
| `extension/options.*` | Shortcut editor and settings |
| `extension/icons.js`, `image-header.js` | Local image validation and conversion |
| `extension/i18n.js`, `_locales/` | UI and manifest translations |
| `extension/ui.js`, `styles.css` | Shared display helpers and styling |
| `tools/generate-icons.mjs` | Regenerate the bundled SVG icons |

See [asset notes](../ASSETS.md) for icon sources and license requirements.
