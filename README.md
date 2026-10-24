# Hiratoco（ヒラトコ）

バージョン：v0.1.0。

| 言語 | 公開名 | 説明文 |
| --- | --- | --- |
| 日本語 | Hiratoco — Webアプリランチャー | よく使うWebアプリやサイトを、ツールバーからすばやく開く。 |
| English | Hiratoco — Web App Launcher | Quickly open your favorite web apps and sites from the toolbar. |

Firefoxの拡張機能管理画面の名前・説明は `_locales/ja/messages.json` と `_locales/en/messages.json` を使い、Firefoxの表示言語に合わせます。その他の言語では英語を使います。アプリ内も初回はFirefoxの表示言語に合わせ、設定画面で言語を選んだ後は、その選択を優先します。AMOの公開ページにも、上記の名前・説明を言語ごとに設定してください。

旧称はAppDockです。既存の登録情報と更新の互換性を保つため、拡張ID `appdock@personal.local`、保存キー `appdock`、修復コピーの接頭辞と保存時のロック名は維持しています。同梱MITライセンスの既存著作権表示も保持しています。

FirefoxのツールバーからGoogleサービスや好きなHTTPSサイトを開く、個人用のアプリランチャーです。初期アプリ14件を3列で表示します。実行時の依存ライブラリやビルド作業は不要です。

対象はWindows版Firefoxの安定版です。Manifest V3を使用し、最低対応バージョンは142です。最初は「一時的に読み込む」「使う」を読めば試せます。継続利用には「署名して通常版Firefoxにインストールする」の手順が必要です。

## 一時的に読み込む

1. Firefoxで `about:debugging#/runtime/this-firefox` を開きます。
2. 「一時的なアドオンを読み込む」を選び、`extension/manifest.json` を指定します。
3. ツールバーの拡張機能メニューからHiratocoを開きます。必要に応じてツールバーにピン留めしてください。
4. Hiratocoの9点アイコンを押すとランチャーが開きます。

ソースを変更した後は、同じ画面の「再読み込み」を押します。一時インストールはFirefoxを終了すると解除されます。通常のインストールや再起動の試験と同一には扱えません。[Mozillaの一時インストール手順](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　
## 使う

アプリをクリックするか、Tabで選択してEnterを押すと新しいタブで開きます。既存タブの内容は変わりません。通常のリンクを `target="_blank"`、`rel="noopener noreferrer"` 付きで開くため、通常は前面の新規タブになります。Ctrl・中クリックやFirefox側のタブ設定による動作はブラウザーに従います。

ポップアップでは矢印キーでもアプリ間を移動できます。Escapeで閉じます。アプリが多い場合は縦にスクロールできます。長い名前は省略し、ホバー時のツールチップに名前とURLを表示します。

右上の「編集」を押すと、通常表示とは別の設定タブを開きます。

| 操作 | 手順 |
| --- | --- |
| 追加 | 「アプリを追加」で表示名とHTTPSのURLを入力し、「保存」を押す |
| 編集 | 各行の「編集」で名前・URL・アイコンを変更する |
| 削除 | 各行の「削除」で対象を確認して削除する。キャンセルも可能 |
| 並び替え | 行を移動先の行までドラッグする。移動先の位置に挿入する |
| キーボードで並び替え | 「上へ」「下へ」を押すか、行をTabで選んでAlt + ↑ / ↓ を押す |
| 配色 | 「Firefox / OSに合わせる」「ライト」「ダーク」から選ぶ |
| 表示言語 | 「日本語」「English」から選ぶ。選択は自動保存され、ポップアップと設定画面に反映される |

フォームはTabで移動し、Escapeでキャンセルできます。変更が保存されると設定画面に結果を表示します。保存に失敗した場合は通知し、表示中の一覧は保存前の状態を保ちます。入力中のフォームは閉じず、再試行できます。

保存データがない初回は、Firefoxの表示言語が日本語（`ja`・`ja-JP`など）なら日本語、それ以外なら英語で表示します。Firefoxの言語を取得できない場合は日本語を使います。設定画面で選んだ言語は保存され、Firefoxの表示言語を変えても維持します。「全データを消去」した後は初回と同じ判定に戻ります。メニュー・操作ボタン・説明・エラーと、名前を変更していない初期アプリが切り替わります。追加したサイト名や編集済みの名前は翻訳せず、そのまま残します。ファイル選択ダイアログなど、Firefox標準UIの言語はFirefox側の設定に従います。

最大100件、表示名は50文字、URLは2,048文字までです。URL内にユーザー名・パスワードを含めることはできません。アイコンは任意で、未指定なら共通アイコンを使います。ローカルのPNG・JPEG・WebPの静止画（2MB以下、約1,600万画素以下）を選べます。デコード前に実データの形式と寸法を検査し、アニメーション・壊れた形式・寸法が矛盾する形式を拒否します。画像は64 × 64pxのPNGに変換し、元のファイル名や画像メタデータは保存しません。SVGや外部画像URLは受け付けません。

自動配色は `prefers-color-scheme` を使います。Firefoxが拡張ページへ伝える配色に追従しますが、テーマの任意の色を完全には再現しません。自動判定が好みに合わない場合は配色を指定してください。Manifest V3では旧式の `browser_style` に頼らず独自CSSで表示します。[MozillaのBrowser styles](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Browser_styles)

## 保存データと復旧

`browser.storage.local` の `appdock` キーに、次の形式で保存します。配列の順番が表示順です。初回は `model.js` の初期定義を使い、編集した時点で保存します。

```json
{
  "version": 1,
  "apps": [
    {"id": "account", "name": "アカウント", "url": "https://myaccount.google.com/", "icon": "icons/account.svg"}
  ],
  "settings": {"theme": "auto", "language": "ja"}
}
```

読込時にも項目を検証します。不正なURL・重複IDなどは表示から除外し、不正な画像指定は共通アイコンに置き換えます。全項目が壊れている場合は初期アプリを表示します。意図的に全件削除した空の配列は維持します。破損がある場合は編集・配色変更・言語変更を無効にし、元データを保護します。

修復するには、設定画面の「保存データを修復」を押し、内容を確認して確定します。元データのコピーを保存してから、表示中の一覧で置き換えます。キャンセルした場合やコピーの保存に失敗した場合は、元データを変更しません。確認中に元データが変わった場合も修復を止めるため、キャンセルして最新の一覧を確認してください。

修復前のコピーは、同じ `browser.storage.local` の `appdock-recovery-` で始まる別々のキーに、`{savedAt, source}` の形式で残します。不正な項目や過去の登録情報も含まれます。修復時に過去のコピーを上書きせず、容量不足の場合は修復を止めます。コピーに保存期限はありません。設定画面の「保存データ」で件数を確認し、「修復コピーをすべて削除」で消去できます。現在の登録と表示設定は残ります。

アプリの「削除」を確定すると、そのアプリとすべての修復コピーを消去します。コピーに古い情報が残るのを防ぐため、他のアプリの過去のコピーも対象です。他のアプリの現在の登録は維持します。コピーの削除に失敗した場合はアプリを削除しません。コピーを削除した後にアプリの保存が失敗した場合は、アプリは残り、コピーだけが消えた状態になります。再試行してください。

登録・表示設定・修復コピーをまとめて消すには、「全データを消去」を押し、確認画面で確定します。古い保存キーも含めて、この拡張機能の保存領域を空にします。初期アプリが再表示されますが、次の編集まで保存しません。キャンセルした場合は何も消しません。これはFirefoxの拡張ストレージの消去で、別途保存した外部バックアップやOSの履歴を消す操作ではありません。

以前のversion 1データに `language` がない場合は、日本語として読み込みます。登録・順番・配色を維持し、次の保存時に言語を追記します。対応していない言語の値は日本語に戻します。

未知の将来バージョンやストレージ読込失敗では初期アプリを表示し、編集を無効にして元データを保護します。拡張機能を更新するか、ページを開き直してください。初期定義を将来変更しても、保存済みの利用者データに自動で追加・再登録はしません。

データと修復前のコピーはFirefoxプロファイル内に残り、同期や外部バックアップは行いません。アンインストールすると通常は削除されます。設定は暗号化用の保管庫ではないため、秘密のトークンを含むURLは登録しないでください。[Mozillaのstorage.local仕様](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)

複数の設定画面からの保存は、Web Locks APIで読み込みから書き込みまで排他制御します。同じアプリを他の画面で変更・削除した場合、古い編集・削除ダイアログからの操作は拒否します。入力は保持するので、キャンセルして最新の内容を開き直してください。[Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)

編集と修復は、通常ウィンドウのコンテナに属さない設定タブから行ってください。プライベートウィンドウやコンテナではロックが分離されるため、保存データの競合を防ぐ目的で編集を無効にします。ロック機能やタブの区分を確認できない場合も保存しません。

## 権限とセキュリティ設計

要求権限は `storage` のみです。URLの起動は標準リンク、設定タブの表示は `runtime.openOptionsPage()` を使います。

- `host_permissions`、`activeTab`、`tabs`、`history`、`cookies`、`webRequest` は要求しません。`tabs.getCurrent()` で現在の拡張タブが通常・プライベート・コンテナのどれに属するかだけを確認します。タブの一覧やページ内容、Cookieの中身は取得しません。
- コンテンツスクリプト、バックグラウンド処理、サービスワーカーはありません。ページ内容やログイン状態を読み取りません。
- 外部コード、CDN、解析、広告、テレメトリー、アイコン取得通信はありません。
- 各拡張ページの先頭でDNS先読みを無効にします。ポップアップを表示しただけで登録先の名前解決が始まらないようにしています。
- `eval`、`new Function`、ユーザー入力の `innerHTML` 挿入は使いません。文字列は `textContent` で表示します。
- 登録時・読込時の両方でURLを検証し、HTTPS以外と認証情報付きURLを拒否します。
- 保存画像は同梱パスの許可リストか、サイズ制限とPNGヘッダー検証を通った64pxのPNGだけを許可します。画像の読込失敗時は共通アイコンを表示します。
- CSP（拡張ページが読めるリソースを制限する規則）で外部通信、外部スクリプト、埋め込みフレーム、フォーム送信を禁止します。画像の `data:` はローカルPNG表示用に限定し、サイトURLには許可しません。

サイトを開いた後の通信・リダイレクト・認証は、そのサイトとFirefoxが処理します。リンク先の信頼性をこの拡張機能が保証するものではありません。

## 開発と検証

開発用にNode.js 22以降とnpmが必要です。拡張機能の利用だけならNode.jsは不要です。

```powershell
npm ci --ignore-scripts
npm test
npm run lint
npx playwright install chromium
npm run test:ui
npm run test:firefox
npm run package
npm run test:privacy
```

`test:ui` は一時的なローカルHTTPサーバーとPlaywright Chromiumで動作を検証します。ストレージAPIはモックです。`test:firefox` はSeleniumとインストール済みFirefoxで実際の拡張APIを検証します。Selenium Managerは初回にgeckodriverを取得するためインターネット接続が必要です。既存の実行ファイルを使う場合は、`GECKODRIVER` にgeckodriver、`FIREFOX_BINARY` にFirefoxの絶対パスを指定できます。テストは専用の一時プロファイルを使い、通常利用のプロファイルを変更しません。

`test:privacy` はFirefoxの既定DNS設定で未クリック時の名前解決・HTTP要求を調べ、正常な3画像形式とデータ消去を検証します。合成ドメインをlocalhostへ固定し、外部通信は送信前に止めます。正の対照として、最後にローカルサーバーへ接続してDNSログが機能していることも確認します。`FIREFOX_ADDON_PATH` にZIPのパスを指定すると、Firefoxの両テストでその配布物を使います。未指定の場合は `extension/` を読み込みます。

Firefoxのテストで使うgeckodriverの `--allow-system-access` は、テスト用プロファイル内の拡張読込・UI操作に限ったものです。配布拡張の権限ではありません。検証結果と未確認項目は [TESTING.md](TESTING.md) を参照してください。

## 配布用パッケージを作る

```powershell
npm run lint
npm run package
```

`dist/hiratoco-0.1.0.zip` を生成します。Mozillaの `addons-linter` で検証し、ローカルの `tools/package.mjs` で `extension/` 内だけを梱包します。隠しファイル、シンボリックリンク、想定外の種類のファイルはエラーにします。ZIP直下に `manifest.json` があり、テストやnpmパッケージは含めません。同じソースからは同じZIPを生成します。このZIPは未署名で、通常版Firefoxへの継続インストール用XPIではありません。

## 署名して通常版Firefoxにインストールする

通常版Firefoxで継続利用するにはMozillaの署名が必要です。自分だけで使う場合も同じです。unlisted（非公開配布）はAMOの公開一覧には掲載されませんが、署名のためにMozillaへソースを提出します。審査対象にもなります。[Mozillaの署名・配布要件](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

本プロジェクトではアップロード、公開、署名申請を実行していません。以下の手順は利用者が提出すると決めた場合に行ってください。

1. Mozillaアカウントで [AMO Developer Hub](https://addons.mozilla.org/developers/) にログインします。
2. 新しいアドオンの提出で **On your own（自分で配布）** を選びます。
3. `dist/hiratoco-0.1.0.zip` をアップロードし、検証結果と必要な申告項目を確認します。コードは難読化・圧縮していません。
4. 署名済みの `.xpi` をダウンロードします。
5. Firefoxの `about:addons` で歯車メニューから「ファイルからアドオンをインストール」を選び、そのXPIを指定します。

画面の詳細は [Mozillaの提出手順](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) を確認してください。拡張IDは `appdock@personal.local` です。初回提出で衝突した場合だけ、自分専用の一意なIDに変更してください。初回署名後はIDを変えないでください。

署名は上記のAMOアップロード手順を使います。開発依存から `web-ext` を外し、未修正の暗号ライブラリを持つAndroid用依存を取り除いています。署名のためにプロジェクトへAPI認証情報を保存する必要はありません。

## 更新する

`extension/manifest.json` の `version` を増やし、検証とパッケージ作成を行います。開発時は `about:debugging` で再読み込みします。継続利用版は同じ拡張IDで新バージョンをunlisted署名し、署名済みXPIを上からインストールします。アンインストールを挟まなければ `storage.local` の設定を維持できます。データ形式を変える際は `model.js` のバージョンと移行処理を追加してください。

この版では更新サーバーや `update_url` は設定していません。unlisted版の更新は手動です。

## ファイル構成と画像

| ファイル | 役割 |
| --- | --- |
| `extension/model.js` | 初期14件、上限値、読込時の復旧・保存前の検証・並び替え |
| `extension/storage.js` | ローカル保存、画面間の排他制御、読込失敗の保護、元データを残した修復 |
| `extension/popup.*` | 通常のランチャー |
| `extension/options.*` | 編集・表示設定。一覧生成、ダイアログ操作、イベント登録を名前付き関数で管理 |
| `extension/icons.js` | ローカル画像の検証・64px PNGへの変換・画像リソースの解放 |
| `extension/image-header.js` | デコード前のPNG・JPEG・WebP形式と寸法の検査 |
| `extension/i18n.js` | 日本語・英語の文言、差し込み文字列、翻訳対象の画面要素への反映 |
| `extension/ui.js`、`styles.css` | 共通の画像表示・配色・見た目 |
| `extension/icons/` | 同梱SVG |
| `tests/` | データ・UI・Firefoxのテスト |
| `tools/generate-icons.mjs` | 同梱SVGの再生成用。実行時には不要 |

画像の出典・ライセンス・差し替え時の注意は [ASSETS.md](ASSETS.md) に記載しています。HiratocoはGoogleやMozillaの公式製品ではありません。

Firefoxの `i18n.getMessage()` はブラウザーの言語に応じた文言を返します。この拡張では利用者が表示言語を選ぶため、両言語の文言をJavaScriptモジュールとして同梱し、保存した言語で選択します。外部への取得通信は不要です。[Mozillaのi18n.getMessage()仕様](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/i18n/getMessage)

用語：Manifestは拡張機能の構成と権限を宣言するJSON、CSPはリソース読込の制限、AMOはMozillaのアドオン配布・署名サービス、XPIはFirefox拡張のインストール用パッケージです。

問題が起きた場合は、[TESTING.md](TESTING.md) の再現手順と `about:debugging` のHiratoco「調査」でエラーを確認してください。報告にはFirefoxのバージョン・操作手順・エラーを添え、登録した私的URLや画像を共有しないでください。

仕様確認日：2026-10-24。
