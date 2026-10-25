<div align="center">
  <img src="extension/icons/launcher.svg" width="56" height="56" alt="">
  <h1>Hiratoco</h1>
  <p>Your web apps, a click away.</p>
  <p><strong>English</strong> · <a href="README.ja.md">日本語</a></p>
</div>

Hiratoco is a small extension for Firefox and Chromium-based browsers, including Chrome and Edge, that puts your favorite web apps and sites in a toolbar menu. Start with 14 Google services, or add your own shortcuts and arrange them the way you like.

<p align="center">
  <img src="docs/images/launcher-light.png" width="300" alt="Hiratoco's English launcher in light mode">
  &nbsp;&nbsp;
  <img src="docs/images/launcher-dark.png" width="300" alt="Hiratoco's English launcher in dark mode">
</p>

## A grid you can make your own

- **Your sites, your order.** Add, rename, remove, and rearrange up to 100 shortcuts. Each opens in a new tab.
- **Custom icons.** Choose a local PNG, JPEG, or WebP image for any shortcut.
- **Light or dark.** Follow your browser's color scheme or pick light or dark.
- **English and Japanese.** Start in your browser's language, then save your preferred language in settings.
- **Keyboard controls.** Navigate the grid with Tab or the arrow keys, open a site with Enter, and close the menu with Escape.

## Try it in Firefox

**v0.1.0 is available as source.** There is no Firefox Add-ons listing or signed download yet.

1. [Download the source](https://github.com/shuuuumai96/hiratoco/archive/refs/heads/main.zip) and extract it, or clone this repository.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Select **Load Temporary Add-on…**, then choose `extension/manifest.json`.
4. Pin Hiratoco to the toolbar and open its nine-dot icon.

No build step is needed. A temporary installation lasts until Firefox closes; permanent installation requires a Mozilla-signed XPI. See [packaging and distribution](docs/DEVELOPMENT.md#packaging-and-distribution) for the signing process.

The extension targets Firefox 142 or later. It has been tested on Windows with Firefox 158.0.1; see the [testing notes](TESTING.md) for coverage and remaining checks.

## Try it in Chrome or Edge

The Chromium package targets Chrome/Chromium 109 or later. There is no Chrome Web Store or Edge Add-ons listing yet. Chrome and Edge release builds require separate manual verification; see the [testing notes](TESTING.md) for recorded results.

1. Download or clone the source, then install Node.js 22 or later and npm.
2. In the repository directory, run:

   ```sh
   npm ci --ignore-scripts
   npm run package:chromium
   ```

3. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge, and enable **Developer mode**.
4. Select **Load unpacked** and choose the generated `dist/chromium/` directory.
5. Pin Hiratoco to the toolbar and open its nine-dot icon.

Keep the unpacked directory in place. After changing the source, run `npm run package:chromium` again and reload the extension from the browser's extensions page. The Chromium package cannot run in incognito/InPrivate windows.

## Set up your shortcuts

Open **Edit** in the launcher to add a site, change its name or icon, or adjust appearance and language. Sites must use HTTPS.

Drag a row to reorder it. You can also use **Move up** / **Move down**, or focus a row and press **Alt + ↑ / ↓**. Your changes are saved in the current browser profile.

On first use, a Japanese browser UI selects Japanese; other UI languages select English. A language you choose in settings takes priority after that. Custom shortcut names stay as you entered them.

## Privacy

Hiratoco requests only the `storage` permission. It does not read page content, browsing history, cookies, or your list of open tabs. There are no ads, analytics, remote scripts, or automatic icon downloads.

Shortcuts, settings, and icons stay in your browser profile. They are not synced between browsers or backed up externally. When you open a shortcut, your browser connects to that site as usual.

See [data, privacy, and recovery](docs/DATA.md) for storage limits, deletion, and repair behavior.

## Development

Requires Node.js 22 or later and npm.

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm run package
npm run package:chromium
```

The unsigned Firefox package is written to `dist/hiratoco-0.1.0.zip`. The Chromium command creates `dist/hiratoco-chromium-0.1.0.zip` and an unpacked extension in `dist/chromium/`.

- [Development guide](docs/DEVELOPMENT.md) — browser tests, packaging, and updates.
- [Testing notes](TESTING.md) — recorded results and known gaps, in Japanese.
- [Asset notes](ASSETS.md) — icon sources and licensing, in Japanese.

For bugs, [open an issue](https://github.com/shuuuumai96/hiratoco/issues) with your browser name, version, and steps to reproduce the problem. Keep private URLs and images out of reports.

## License

[MIT](LICENSE). Hiratoco is an independent project and is not affiliated with Google, Mozilla, or Microsoft.
