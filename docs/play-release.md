# Google Play 公開の手順と、課金をつなぐための作業（2026-11-27 下調べ）

決定事項：Google Play で無料公開／患者1〜2人目は無料、3人目以降は **600円の買い切り**（1回で残り全員を開放）／広告・サブスクなし。

※Google Play と各ライブラリのルールは変わることがあります。実際に進める前に、各公式ページで最新の要件を確認してください。

---

## 1. このリポジトリで済んでいること

- 課金ゲート：`js/paywall.js`（ui.js から使う）
  - 患者3〜6人目をロック。2人目をクリアしたら開放画面（600円・買い切り・一度で全員分）。
  - 購入済みの印は端末に保存（`localStorage` の `kokoro_clinic_unlock_v1`）。再訪しても開いたまま。
  - **差し込み口**：`window.KokoroStore = { isOwned(), purchase(), restore() }`（どれも Promise を返す）をアプリ側で用意すれば、それで本物の課金に切り替わる。無いときはモック（確認ダイアログだけ。実際の課金なし）。
  - **フラグ**：`window.KOKORO_PAYWALL = { enabled: true }` があるときだけ有効。Web 公開版は無効＝今までどおり全員遊べる。
- Play 版の Web 部分を作る：`node tools/build-play.js [出力先]`
  - 既定の出力先：`../kokoro-clinic-play/www`。index.html にフラグ（enabled: true・商品ID）を入れて書き出す。
- テスト用の操作（URL に付ける）：`?paywall=1`（Web でもゲートを有効に）／`?unlock=1`（購入済みにする）／`?relock=1`（購入済みを消す）

---

## 2. Android アプリにする手順（Capacitor・WebView ラッパー方式）

前提：Node.js、Android Studio（Android SDK・JDK 同梱）

1. 別フォルダ `kokoro-clinic-play/` を作り、`npm init -y`
2. `npm i @capacitor/core @capacitor/cli @capacitor/android`
3. `npx cap init "こころ診療所" <パッケージ名> --web-dir www`（パッケージ名は下の「決めてほしいこと」）
4. ゲーム側で `node tools/build-play.js` → `www/` ができる
5. `npx cap add android` → `npx cap sync android`
6. Android Studio で開き（`npx cap open android`）、アイコン・スプラッシュ・アプリ名を設定
7. 対象 API レベルを Google Play の最新要件に合わせる（毎年引き上げあり）
8. 署名付き **App Bundle（.aab）** を作成（Play App Signing を使う。アップロード鍵は安全に保管）
9. 更新のたびに：ゲーム側で `node tools/build-play.js` → `npx cap sync android` → バージョンコードを上げて .aab を作る

### アプリ化で必ず直す所（重要）
- **AI とお問い合わせのサーバーが、アプリからの通信を断る**：`server/netlify/functions/talk.mjs` と `feedback.mjs` の `ALLOWED`（許可する呼び出し元）が `https://shuheiyam89.github.io` と `http://localhost:8781` だけ。Capacitor の Android は呼び出し元が `https://localhost` になるため、ここに追加して Netlify に再公開が必要（未対応。進めてよいか確認したい）
- 外部リンク（シェア・メール・お問い合わせ）は、アプリ内ではなく端末のブラウザやメールで開く設定にする（@capacitor/browser など）
- 戻るボタン（Android の戻る操作）で画面が抜けないように、ゲーム内の「戻る」に割り当てる（@capacitor/app）

---

## 3. Google Play 課金（買い切りアイテム）をつなぐ作業

選択肢（どちらも Capacitor で使える）：
- **cordova-plugin-purchase（CdvPurchase）**：Google Play Billing を直接使う。無料。設定はやや多い
- **RevenueCat（@revenuecat/purchases-capacitor）**：購入の管理・復元・検証を代行。一定の売上までは無料枠あり。設定が楽
→ 個人で小さく始めるなら、まず cordova-plugin-purchase で十分。迷ったら相談してください

つなぎ方：
1. プラグインを入れ、起動時に商品ID `unlock_all_patients`（**非消費型・一度きり**）を登録
2. `window.KokoroStore` を用意して、ゲームの差し込み口につなぐ
   - `isOwned()`：所有中なら true（起動時に確認）
   - `purchase()`：購入画面を出し、成功したら true
   - `restore()`：過去の購入を問い合わせて、あれば true
3. 購入したら **3日以内に「承認（acknowledge）」** する（しないと自動で返金される）。プラグインの finish/acknowledge を必ず呼ぶ
4. テスト：Play Console の「ライセンス テスター」に登録したアカウントで、内部テストのアプリから購入（テストカードで実際には請求されない）
5. 任意：不正対策としてサーバーで購入を検証（600円の買い切りなら、最初は端末側の確認だけでも運用可能）

---

## 4. Play Console 側で必要なこと（用意してほしいもの）

- **デベロッパー アカウント**（登録料 25ドル・一度だけ／本人確認あり）
  - **個人アカウントは、本番公開の前に「12人以上のテスターで14日間のクローズドテスト」が必要**（2023年11月以降に作った個人アカウントの決まり）。テスターの集め方を決める必要あり
- **お支払いプロファイル（販売者）**：有料アイテムを売るために必要（銀行口座・税の情報）
- **アプリ内アイテム（買い切り）**
  - 商品ID：`unlock_all_patients`（作成後は変更できない）
  - 名前：例「患者さんをすべて開放」／説明：例「3人目〜6人目の患者さん4人が開きます（買い切り）」
  - 価格：600円（日本の表示価格は税込。Google の手数料は売上の一部＝多くの場合15%）
- **ストアの掲載情報**：アプリ名、短い説明、詳しい説明、アイコン 512×512、フィーチャー画像 1024×500、スクリーンショット（スマホ縦）
- **プライバシーポリシーの URL**（必須。AI サーバーに会話を送る・感想を送る点を書く）
- **データ セーフティ**（集めるデータ：会話の文章をAIに送る／感想フォーム／端末への保存）
- **コンテンツのレーティング**（アンケート）、**ターゲット層**、**広告の有無**（なし）

---

## 5. 決めてほしいこと（勝手に決めていません）

1. **パッケージ名**（例：`com.<名前>.kokoroclinic`。公開後は変更不可）
2. **アカウントの種類**：個人か組織か（個人なら 12人×14日のテストが必要）
3. **課金ライブラリ**：cordova-plugin-purchase か RevenueCat か
4. **AI サーバーの許可先追加**（`https://localhost` を ALLOWED に足して Netlify に再公開してよいか）
5. **AI の費用**：無料で遊べる2人分も AI を使うため、利用者が増えると AI の費用が増える。上限（今は回数制限で自動的にキーワード返事へ切り替え）のままでよいか
6. **プライバシーポリシー**の置き場所（GitHub Pages に1ページ作るのが手軽）
