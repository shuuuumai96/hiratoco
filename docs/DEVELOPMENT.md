# Developing Hiratoco

[Back to README](../README.md)

The extension uses plain JavaScript, HTML, CSS, and bundled icons, with no runtime dependency. Firefox can load the source directly. Chromium uses a generated manifest and PNG toolbar icons. Node.js 22 or later and npm are needed for development tools and packaging.

## Local setup

```sh
npm ci --ignore-scripts
```

Load `extension/manifest.json` from **Load Temporary Add-on…** at `about:debugging#/runtime/this-firefox`. After editing the source, use **Reload** on the same page. Firefox removes temporary add-ons when it exits.

For Chrome or Edge, run `npm run package:chromium`, enable **Developer mode** at `chrome://extensions` or `edge://extensions`, select **Load unpacked**, and choose `dist/chromium/`. Keep that directory in place. After editing source files, regenerate the package and reload it from the extensions page. The Chromium manifest targets Chrome/Chromium 109 or later and disables incognito use.

## Tests

```sh
npm test
npm run lint
npx playwright install chromium
npm run test:ui
npm run test:chromium
npm run test:firefox
npm run test:privacy
```

| Command | Coverage |
| --- | --- |
| `npm test` | Data validation, storage, conflicting edits, image validation, translations, and network restrictions |
| `npm run lint` | Mozilla's add-on validation, with warnings treated as errors |
| `npm run test:ui` | Playwright Chromium; UI behavior against mocked extension storage |
| `npm run test:chromium` | Generated Chromium package in a disposable Playwright Chromium profile; real extension APIs and storage |
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

The Chromium extension test requires Playwright's installed Chromium. It loads the generated unpacked extension with a persistent test context; it does not mock the extension APIs. Opening `popup.html` as an extension page checks its content but does not verify the actual toolbar panel.

See [TESTING.md](../TESTING.md) for recorded results and unverified scenarios. These include the actual toolbar panels, minimum browser versions, Chrome and Edge release builds, other operating systems, and signed-install restart and update behavior.

## Packaging and distribution

```sh
npm run lint
npm run package
npm run package:chromium
```

`npm run package` creates the Firefox archive `dist/hiratoco-0.1.0.zip` from `extension/`. `npm run package:chromium` creates `dist/hiratoco-chromium-0.1.0.zip` and the unpacked `dist/chromium/` directory. Both archives contain a root-level `manifest.json`, both locale catalogs, source files, icons, and the asset license. They exclude tests, dependencies, and development documents. Packaging uses a fixed timestamp so the same source and target produce the same ZIP.

The Chromium manifest is generated from `extension/manifest.json`: Firefox-specific settings and toolbar theme icons are removed, PNG icons replace manifest SVG references, and Chromium's minimum version and incognito policy are set. Keep application code and the stored data format shared between targets. Do not load the Firefox source directory directly into Chrome.

The Firefox ZIP is unsigned. Standard Firefox requires Mozilla signing for permanent installation, including private distribution.

Submit the ZIP through the [AMO Developer Hub](https://addons.mozilla.org/developers/). Choose **On this site** for a public Firefox Add-ons listing, or **On your own** for distribution without a listing. The repository does not yet provide a signed XPI. Follow Mozilla's [signing overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) and [submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) for the current process.

The Chromium ZIP is a packaging artifact, not an installer. Use `dist/chromium/` with **Load unpacked** for local development. The repository does not provide a Chrome Web Store or Edge Add-ons listing, signed CRX, or store-publishing workflow.

## Updates and compatibility

Keep `extension/manifest.json`, `package.json`, and the root package entries in `package-lock.json` at the same product version. Update the documented package filename when changing versions.

Keep the extension ID `appdock@personal.local` after the first signed release so Firefox can recognize updates. For self-distributed builds, sign the new version with the same ID and install it over the existing one. Hiratoco has no custom update server or `update_url`; self-distributed updates are manual.

The `appdock` storage key, recovery-copy prefix, and write-lock name are retained from the former AppDock name. Renaming them requires a migration plan. The storage format version in `model.js` is independent of the product version.

The browser uses `_locales/` for the extension name and description. The extension UI uses `i18n.js` because its saved language can differ from the browser's language. Keep the two sets of display names consistent.

## Source map

| Path | Purpose |
| --- | --- |
| `extension/model.js` | Default sites, validation, ordering, and storage-format decoding |
| `extension/browser-api.js` | Shared access to Firefox and Chromium extension APIs |
| `extension/storage.js` | Locked writes, data repair, and deletion |
| `extension/popup.*` | Toolbar launcher |
| `extension/options.*` | Shortcut editor and settings |
| `extension/icons.js`, `image-header.js` | Local image validation and conversion |
| `extension/i18n.js`, `_locales/` | UI and manifest translations |
| `extension/ui.js`, `styles.css` | Shared display helpers and styling |
| `tools/generate-icons.mjs` | Regenerate the bundled SVG icons |
| `tools/generate-chromium-icons.mjs`, `tools/chromium-icons/` | Regenerate and store the launcher PNGs used by Chromium |
| `tools/package.mjs` | Generate the Firefox and Chromium packages |

See [asset notes](../ASSETS.md) for icon sources and license requirements.
