// 課金ゲート（Google Play 版だけで有効にする）
//   - 患者1〜2人目は無料。3人目以降（3〜6人目）は 500円の買い切り（1回の購入で残り全員を開放）
//   - 広告・サブスクはなし
//   - Web 公開版（GitHub Pages）はフラグ無効＝今までどおり全員遊べる
//
// 有効にする方法
//   - Play 版ビルド：tools/build-play.js が index.html に window.KOKORO_PAYWALL = { enabled: true } を入れる
//   - テスト（Web でも）：URL に ?paywall=1 を付ける
// テスト用の操作（URL に付ける）
//   ?unlock=1  … 購入済みにする（実際の課金なし）
//   ?relock=1  … 購入済みを消して、ロック状態に戻す
//
// 差し込み口（Google Play 課金に差し替える所）
//   window.KokoroStore = { isOwned(): Promise<boolean>, purchase(): Promise<boolean>, restore(): Promise<boolean> }
//   を、アプリ側（Capacitor のプラグインなど）で用意すれば、それを使う。無ければ下のモック（端末に保存するだけ）を使う。
var Paywall = (function () {
  var CONFIG = window.KOKORO_PAYWALL || {};
  var q = location.search;
  var ENABLED = !!CONFIG.enabled || /[?&]paywall=1\b/.test(q);
  var FREE = 2;                                  // 無料の患者の人数
  var PRICE = '500円';
  var PRODUCT_ID = CONFIG.productId || 'unlock_all_patients'; // Play Console の「アプリ内アイテム（買い切り）」の商品ID
  var KEY = 'kokoro_clinic_unlock_v1';           // 購入済みの印（端末に保存）

  function readFlag() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function writeFlag(v) { try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {} }

  // テスト用の操作
  if (/[?&]unlock=1\b/.test(q)) writeFlag(true);
  if (/[?&]relock=1\b/.test(q)) writeFlag(false);

  var owned = readFlag();

  // ---- モックの課金（実際の課金は行わない）。Play 課金をつなぐまでの仮の動作 ----
  var MockStore = {
    isOwned: function () { return Promise.resolve(readFlag()); },
    purchase: function () {
      var ok = window.confirm('【テスト用】実際の課金は行われません。\n購入したことにして、患者3〜6人目を開放しますか？');
      if (ok) writeFlag(true);
      return Promise.resolve(ok);
    },
    restore: function () { return Promise.resolve(readFlag()); },
  };
  function store() { return window.KokoroStore || MockStore; }

  // 起動時に、アプリ側の課金状態で上書きする（Play 版で別の端末から買った場合など）
  if (ENABLED && window.KokoroStore) {
    store().isOwned().then(function (v) { if (v) { owned = true; writeFlag(true); } }).catch(function () {});
  }

  return {
    enabled: ENABLED,
    free: FREE,
    price: PRICE,
    productId: PRODUCT_ID,
    // i 番目（0始まり）の患者が、課金のためにロックされているか
    locked: function (i) { return ENABLED && i >= FREE && !owned; },
    owned: function () { return owned; },
    // 購入を実行する（差し込み口）。成功したら true
    buy: function () {
      return store().purchase().then(function (ok) { if (ok) { owned = true; writeFlag(true); } return !!ok; });
    },
    // 購入の復元（機種変更・再インストールのとき）
    restore: function () {
      return store().restore().then(function (ok) { if (ok) { owned = true; writeFlag(true); } return !!ok; });
    },
  };
})();
