# Data, privacy, and recovery

[Back to README](../README.md)

Hiratoco stores shortcuts, appearance and language preferences, and custom icons in the current browser profile. Firefox and Chromium installations keep separate data; there is no sync or external backup. Settings are not encrypted as a secret vault; avoid saving URLs that contain private access tokens.

## Limits

| Item | Limit |
| --- | --- |
| Shortcuts | 100 |
| Display name | 50 characters |
| URL | 2,048 characters; HTTPS only, with no embedded username or password |
| Custom image | Static PNG, JPEG, or WebP; up to 2 MB and roughly 16 megapixels |
| Saved icon | Converted to a 64 × 64 PNG; original filename and metadata are not retained |

SVG uploads, animated images, and remote image URLs are not supported. Files are checked for type and dimensions before browser decoding. Invalid saved icons fall back to the bundled generic icon.

## Language and appearance

With no saved data, Hiratoco uses Japanese for a Japanese browser UI and English for other UI languages. If the locale API is unavailable, it falls back to Japanese. A language selected in settings takes priority over the browser's language. Your custom names and renamed default shortcuts are never translated.

Older version 1 settings without a `language` field retain Japanese. Unsupported saved language values fall back to Japanese and require repair before further edits. Existing shortcuts are not automatically replaced when the bundled default list changes.

Automatic appearance follows the `prefers-color-scheme` value the browser provides to extension pages. It does not reproduce every color from a browser theme. You can select light or dark appearance explicitly.

## Storage format

Data is stored under the extension's `storage.local` key `appdock`, using `browser.*` or `chrome.*` APIs as available. The format is shared by both packages. Array order determines shortcut order. The initial list is displayed without writing to storage; the first edit saves it.

```json
{
  "version": 1,
  "apps": [
    {
      "id": "account",
      "name": "アカウント",
      "url": "https://myaccount.google.com/",
      "icon": "icons/account.svg"
    }
  ],
  "settings": {"theme": "auto", "language": "ja"}
}
```

The app's display name for an unchanged default shortcut follows the selected UI language. This does not require rewriting its stored name.

Writes use a shared Web Lock to avoid losing changes across settings pages. Stale edit or delete dialogs are rejected if another page has changed the same shortcut. In Firefox, open settings in a regular, non-container tab: editing, repair, and data deletion are disabled in private windows or containers. The Chromium package disables incognito/InPrivate use. Both packages also refuse writes when the settings-tab context or safe locking is unavailable.

## Repairing damaged settings

Hiratoco validates saved data when loading it. Invalid URLs and duplicate IDs are hidden. If every entry is invalid, it displays the default list; an intentionally empty list stays empty. Damaged data is not overwritten automatically, and editing is disabled until it is repaired. Unknown future formats and read failures also disable editing to protect the original data.

Select **Repair saved data** in settings to review and confirm a repair. Hiratoco first stores a copy of the original, then saves the displayed valid entries. Cancellation, a failed backup, or a change to the original while the dialog is open stops the repair.

Each recovery copy has its own `appdock-recovery-` key and stores `{savedAt, source}`. Copies can retain past names, URLs, images, and invalid entries. They have no expiry and are not overwritten by later repairs. If a copy cannot be saved, the repair stops.

## Deleting data

| Action | Result |
| --- | --- |
| Delete a shortcut | Removes that shortcut and **all recovery copies**, so its old data does not remain in a copy. Other current shortcuts stay intact. |
| Delete all recovery copies | Removes recovery copies while keeping current shortcuts and preferences. |
| Erase all data | Clears this extension's storage, including old keys, and returns to the default list and initial language selection. |

These actions ask for confirmation and cannot be undone. If recovery-copy deletion fails, deleting a shortcut stops. If copies are removed but saving the updated list fails, the shortcut remains and the copies are already gone; retry the deletion.

Uninstalling normally removes extension storage. Hiratoco's erase action does not delete files or backups created outside the extension.

## Permissions and network access

The only requested permission is `storage`. There are no content scripts, background scripts, service workers, analytics, ads, or remote code. Hiratoco does not read page contents, browsing history, cookies, login state, or the list of open tabs. `tabs.getCurrent()` is used only to identify the settings tab's private/container context and needs no `tabs` permission.

Extension pages disable DNS prefetch. A Content Security Policy blocks external requests, remote scripts, frames, and form submission from those pages. User text is inserted as text, and shortcut URLs are checked when entered and loaded.

Opening a shortcut creates a normal link navigation in the browser. Network requests, redirects, and authentication at the destination are handled by the browser and that website. Hiratoco does not guarantee the trustworthiness of a destination.
