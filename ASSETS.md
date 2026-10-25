# アイコンの出典と利用条件

`extension/icons/` の18点は、このプロジェクトで作成したSVGです。Google公式ロゴ、favicon、外部アイコン集の画像はダウンロードしていません。各サービスを識別するため、人物・封筒・地図ピンなどの記号を独自に描いています。Google純正の外観を完全に再現するものではありません。

Chromium版の拡張機能アイコンには、同じランチャーの図案をPNGで同梱しています。原本は `tools/chromium-icons/launcher-{16,32,48,128}.png` です。第三者の画像は使用していません。PNGにも本プロジェクトのMITライセンスを適用します。

図案のソースは `tools/generate-icons.mjs` にあります。プロジェクトのMITライセンス（[LICENSE](LICENSE)）を適用します。配布時にも著作権表示とライセンス文を保持してください。配布ZIP内には `extension/ASSET-LICENSE.txt` を同梱しています。

再生成する場合：

```powershell
node tools/generate-icons.mjs
```

Chromium用PNGを再生成する場合は、PlaywrightのChromiumを用意して次を実行します。通常のパッケージ生成ではブラウザーは不要です。

```powershell
npx playwright install chromium
node tools/generate-chromium-icons.mjs
```

取得元が異なる画像へ差し替える場合は、配布・改変・商標利用の条件を取得元で確認し、出典、ライセンス、取得日を本ファイルに追記してください。ダウンロードできることだけで再配布の許諾があるとは判断できません。Googleの公式素材を使う場合は [Googleのブランド案内](https://about.google/brand-resource-center/) と各サービス固有の条件を確認してください。

Google、YouTube、Gmail等の名称や商標の権利は各権利者に帰属します。このプロジェクトのライセンスは第三者の商標利用を許諾するものではありません。ユーザーが追加する画像も、利用する本人が権利を確認してください。追加画像はブラウザー内で処理し、外部に送信しません。

## READMEの画面画像

`docs/images/launcher-light.png` と `launcher-dark.png` は、現在の `extension/popup.html` を英語・初期登録14件で表示して撮影した画像です。ローカル表示用に拡張APIをモックしています。実際のFirefoxツールバーパネルの動作検証とは別です。画面画像にも本プロジェクトのMITライセンスを適用します。
