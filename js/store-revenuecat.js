// Google Play 課金（RevenueCat）を、課金ゲート（js/paywall.js）の差し込み口 window.KokoroStore につなぐ
// Play 版のビルド（tools/build-play.js）でだけ、paywall.js より前に読み込む。Web 公開版では読み込まない。
// 設定（build-play.js が index.html に入れる）：
//   window.KOKORO_PAYWALL = { enabled: true, productId: 'unlock_all_patients', revenuecatKey: 'goog_…', entitlement: 'full_unlock' }
// キーが未設定（REPLACE_ME）またはアプリ外で開いたときは何もしない → paywall.js のモック（実際の課金なし）のまま
(function () {
  var C = window.KOKORO_PAYWALL || {};
  var cap = window.Capacitor;
  var P = cap && cap.Plugins && cap.Plugins.Purchases;
  if (!P || !C.revenuecatKey || /REPLACE/.test(C.revenuecatKey)) return;
  var ENT = C.entitlement || 'full_unlock';
  var PRODUCT = C.productId || 'unlock_all_patients';

  var ready = P.configure({ apiKey: C.revenuecatKey });
  function owned(res) {
    var ci = (res && res.customerInfo) || res;
    return !!(ci && ci.entitlements && ci.entitlements.active && ci.entitlements.active[ENT]);
  }

  window.KokoroStore = {
    isOwned: function () { return ready.then(function () { return P.getCustomerInfo(); }).then(owned); },
    purchase: function () {
      return ready
        .then(function () { return P.getProducts({ productIdentifiers: [PRODUCT], type: 'NON_SUBSCRIPTION' }); })
        .then(function (r) {
          var prod = (r && r.products || [])[0];
          if (!prod) throw new Error('商品 ' + PRODUCT + ' が見つかりません');
          return P.purchaseStoreProduct({ product: prod });   // 購入の承認（acknowledge）は RevenueCat が自動で行う
        })
        .then(owned)
        .catch(function (e) { if (e && (e.userCancelled || e.code === '1' || e.code === 1)) return false; throw e; });
    },
    restore: function () { return ready.then(function () { return P.restorePurchases(); }).then(owned); },
  };
})();
