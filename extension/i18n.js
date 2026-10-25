import {extensionApi} from "./browser-api.js";

export const DEFAULT_LANGUAGE = "ja";
export const LANGUAGES = Object.freeze(["ja", "en"]);

/** Use the browser's UI locale only when there are no saved settings. */
export function initialLanguage() {
  try {
    const locale = extensionApi()?.i18n?.getUILanguage();
    if (typeof locale !== "string" || !locale) return DEFAULT_LANGUAGE;
    return /^ja(?:-|$)/i.test(locale) ? "ja" : "en";
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Bundle both languages because the saved UI language can differ from
 * the browser's locale.
 */
export const MESSAGES = Object.freeze({
  extensionName: ["Hiratoco — Webアプリランチャー", "Hiratoco — Web App Launcher"],
  popupTitle: ["アプリ", "Apps"],
  edit: ["編集", "Edit"],
  editTooltip: ["アプリと表示設定を編集", "Edit apps and display settings"],
  launcherLabel: ["アプリランチャー", "App launcher"],
  registeredApps: ["登録済みアプリ", "Your apps"],
  popupEmpty: ["アプリがありません。「編集」から追加できます。", "No apps yet. Select Edit to add one."],
  openOptionsFailed: ["設定ページを開けません。拡張機能の管理画面から設定を開いてください。", "Unable to open settings. Open Hiratoco's preferences from the extension manager."],
  optionsTitle: ["Hiratoco — アプリの編集", "Hiratoco — Edit apps"],
  settingsEyebrow: ["HIRATOCO / 設定", "HIRATOCO / SETTINGS"],
  editApps: ["アプリの編集", "Edit apps"],
  addApp: ["＋ アプリを追加", "+ Add app"],
  description: ["毎日使うサイトを、自分の順番に。変更は自動で保存されます。", "Arrange your everyday sites. Changes are saved automatically."],
  displaySettings: ["表示設定", "Display settings"],
  theme: ["配色", "Appearance"],
  themeAuto: ["ブラウザー / OSに合わせる", "Follow browser / system"],
  themeLight: ["ライト", "Light"],
  themeDark: ["ダーク", "Dark"],
  language: ["表示言語", "Language"],
  reorderHelp: ["行をドラッグして移動できます。キーボードでは「上へ」「下へ」、または行にフォーカスして Alt + ↑ / ↓ を使います。", "Drag rows to reorder. Use Move up / Move down, or focus a row and press Alt + ↑ / ↓."],
  optionsEmpty: ["まだアプリがありません。「アプリを追加」から登録してください。", "No apps yet. Select Add app to get started."],
  storagePrivacy: ["登録情報はこのブラウザー内に保存されます。Hiratocoから外部への送信はありません。", "Your apps are stored in this browser profile. Hiratoco does not send them elsewhere."],
  dialogAdd: ["アプリを追加", "Add app"],
  dialogEdit: ["アプリを編集", "Edit app"],
  name: ["表示名", "Name"],
  url: ["URL", "URL"],
  iconFile: ["アイコン画像（任意）", "Icon image (optional)"],
  imageHelp: ["PNG・JPEG・WebPの静止画、2MBまで。64 × 64pxのPNGに変換して保存します。", "Static PNG, JPEG or WebP, up to 2MB. Saved as a 64 × 64px PNG."],
  iconPreview: ["アイコンのプレビュー", "Icon preview"],
  clearIcon: ["共通アイコンにする", "Use default icon"],
  cancel: ["キャンセル", "Cancel"],
  save: ["保存", "Save"],
  dialogDelete: ["アプリを削除", "Delete app"],
  delete: ["削除", "Delete"],
  deleteMessage: ["「{name}」と、すべての修復コピーを削除しますか？ コピーに残った過去の登録情報も消去します。他のアプリの現在の登録は残ります。この操作は取り消せません。", "Delete “{name}” and all recovery copies? Past data in those copies will also be erased. Other current apps will remain. This cannot be undone."],
  moveUp: ["上へ", "Move up"],
  moveDown: ["下へ", "Move down"],
  rowLabel: ["{name}、{position}番目", "{name}, position {position}"],
  actionUp: ["{name}を上へ移動", "Move {name} up"],
  actionDown: ["{name}を下へ移動", "Move {name} down"],
  actionEdit: ["{name}を編集", "Edit {name}"],
  actionDelete: ["{name}を削除", "Delete {name}"],
  savedOrder: ["並び順を保存しました。", "Order saved."],
  savedApp: ["アプリを保存しました。", "App saved."],
  deletedApp: ["アプリを削除しました。", "App deleted."],
  savedTheme: ["配色を保存しました。", "Appearance saved."],
  savedLanguage: ["表示言語を保存しました。", "Language saved."],
  saveFailed: ["保存できませんでした。{reason} 再度操作してください。", "Unable to save. {reason} Please try again."],
  editMissing: ["編集対象が削除されています。ページを開き直してください。", "This app has been deleted. Reopen the page."],
  editConflict: ["このアプリは別の画面で変更されました。キャンセルして開き直し、最新の内容を確認してください。", "This app was changed in another page. Cancel and reopen the dialog to review the latest values."],
  imageUnavailable: ["画像を使用できません。{reason}", "Unable to use this image. {reason}"],
  imageFileInvalid: ["2MB以下のPNG・JPEG・WebP画像を選んでください。", "Choose a PNG, JPEG or WebP image no larger than 2MB."],
  imageTooLarge: ["画像は約1,600万画素以下にしてください。", "Choose an image no larger than 16 megapixels."],
  imageConvertFailed: ["画像を縮小できませんでした。別の画像を選んでください。", "Unable to convert this image. Choose another image."],
  imageDecodeFailed: ["画像を読み込めませんでした。別の画像を選んでください。", "Unable to read this image. Choose another image."],
  imageUnsupported: ["静止画のPNG・JPEG・WebPを選んでください。対応していない形式です。", "Choose a supported, non-animated PNG, JPEG or WebP image."],
  unexpectedError: ["操作を完了できませんでした。", "The operation could not be completed."],
  urlWhitespace: ["URLは空白を含まないHTTPSのURLを入力してください。", "Enter an HTTPS URL without spaces."],
  urlInvalid: ["有効なHTTPSのURLを入力してください。", "Enter a valid HTTPS URL."],
  urlHttpsOnly: ["HTTPSのみ登録できます。認証情報を含むURLは使えません。", "Only HTTPS URLs are allowed. URLs containing credentials are not supported."],
  appInvalid: ["アプリの形式が不正です。", "Invalid app data."],
  nameInvalid: ["表示名は1〜{max}文字で入力してください。", "Enter a name between 1 and {max} characters."],
  iconInvalid: ["アイコンの形式が不正です。", "Invalid icon data."],
  stateInvalid: ["保存データの形式が不正です。", "Invalid settings data."],
  stateLimits: ["保存できる件数または設定の範囲を超えています。", "The app limit or a supported setting has been exceeded."],
  duplicateId: ["アプリIDが重複しています。", "App IDs must be unique."],
  noticeFuture: ["新しいバージョンの保存データです。データを保護するため編集できません。拡張機能を更新してください。", "These settings were saved by a newer version. Editing is disabled to protect your data. Update Hiratoco."],
  noticeInvalid: ["保存データを読み取れないため初期アプリを表示しています。元データを保護するため編集できません。設定画面から修復できます。", "Unable to read your settings. Default apps are shown. Editing is disabled to protect the original data. Open settings to repair it."],
  noticeRepaired: ["不正な保存項目を除外して表示しています。元データを保護するため編集できません。設定画面から修復できます。", "Invalid entries are hidden. Editing is disabled to protect the original data. Open settings to repair it."],
  noticePrivate: ["プライベートウィンドウでは編集できません。通常のウィンドウから設定を開いてください。", "Editing is disabled in private windows. Open settings in a regular window."],
  noticeContainer: ["このタブでは安全に保存できないため編集できません。通常のウィンドウで、コンテナーを使わずに設定を開いてください。", "Editing is disabled because this tab cannot save safely. Open settings in a regular window without a container."],
  noticeLockUnavailable: ["安全に保存するための機能を利用できません。通常のブラウザーウィンドウでページを開き直してください。", "Safe saving is unavailable. Reopen this page in a regular browser window."],
  repair: ["保存データを修復", "Repair saved data"],
  repairTitle: ["保存データを修復しますか？", "Repair saved data?"],
  repairMessage: ["元データのコピーをこのブラウザー内に保存してから、表示中の一覧で置き換えます。不正な項目もコピーには残ります。コピーに保存期限はなく、設定画面の「保存データ」で削除できます。アプリを削除すると、すべての修復コピーも消去します。安全な項目がない場合は初期アプリに戻ります。", "A copy of the original data, including invalid entries, will be kept in this browser profile before replacing it with the displayed list. Copies have no expiry; delete them under Saved data. Deleting an app also erases all recovery copies. If no safe entries remain, default apps will be restored."],
  dataTitle: ["保存データ", "Saved data"],
  dataHelp: ["修復コピーには過去の名前・URL・画像も残ります。必要がなくなったコピーは削除してください。全データの消去では、登録・設定・修復コピーを消して初期状態に戻します。", "Recovery copies retain past names, URLs and images. Delete copies you no longer need. Erasing all data removes apps, settings and recovery copies, then restores the initial display."],
  backupCount: ["修復コピー：{count}件", "Recovery copies: {count}"],
  deleteBackups: ["修復コピーをすべて削除", "Delete all recovery copies"],
  eraseData: ["全データを消去", "Erase all data"],
  deleteBackupsMessage: ["すべての修復コピーを削除します。現在の登録と表示設定は残ります。この操作は取り消せません。", "Delete all recovery copies? Current apps and display settings will remain. This cannot be undone."],
  eraseDataMessage: ["この拡張機能の登録・設定・修復コピーをすべて消去します。過去の保存キーも削除し、初期アプリの表示に戻ります。この操作は取り消せません。", "Erase all apps, settings and recovery copies stored by this extension, including old storage keys? The initial apps will be displayed again. This cannot be undone."],
  deletedBackups: ["すべての修復コピーを削除しました。", "All recovery copies deleted."],
  erasedData: ["全データを消去し、初期状態に戻しました。", "All data erased. Initial display restored."],
  repairedData: ["元データのコピーを保存し、修復しました。", "Original data backed up. Repair complete."],
  repairChanged: ["保存データが変わりました。修復をキャンセルし、最新の一覧を確認してからやり直してください。", "The saved data has changed. Cancel the repair, review the latest list, and try again."],
  noticeReadFailed: ["保存データを読み込めません。初期アプリを一時表示しています。ページを開き直してください。", "Unable to load your settings. Default apps are shown temporarily. Reopen the page."],
  app_account: ["アカウント", "Account"],
  app_search: ["検索", "Search"],
  app_maps: ["マップ", "Maps"],
  app_youtube: ["YouTube", "YouTube"],
  app_play: ["Play", "Play"],
  app_gmail: ["Gmail", "Gmail"],
  app_drive: ["ドライブ", "Drive"],
  app_calendar: ["カレンダー", "Calendar"],
  app_translate: ["翻訳", "Translate"],
  app_gemini: ["Gemini", "Gemini"],
  app_news: ["ニュース", "News"],
  app_photos: ["フォト", "Photos"],
  app_keep: ["Keep", "Keep"],
  app_meet: ["Meet", "Meet"]
});

export function t(key, values = {}, language = typeof document === "undefined" ? DEFAULT_LANGUAGE : document.documentElement.lang) {
  const message = MESSAGES[key]?.[language === "en" ? 1 : 0] ?? key;
  return message.replace(/\{(\w+)\}/g, (placeholder, name) => String(values[name] ?? placeholder));
}

/**
 * Preserve error keys so the UI can render them in the selected language.
 */
export class AppError extends Error {
  constructor(key, values = {}) {
    super(t(key, values, DEFAULT_LANGUAGE));
    this.key = key;
    this.values = values;
  }
}

export function errorText(error) {
  return error instanceof AppError ? t(error.key, error.values) : t("unexpectedError");
}

export function applyTranslations(language) {
  document.documentElement.lang = LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const attribute of ["title", "aria-label", "alt"]) {
    for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    }
  }
}
