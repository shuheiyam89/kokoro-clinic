// Google Play 版の Web 部分（Capacitor の www）を作る。課金ゲートを有効にした index.html を書き出す。
//   node tools/build-play.js [出力先] [--config 設定ファイル.json]
//   既定の出力先：../kokoro-clinic-play/www、既定の設定：../kokoro-clinic-play/play.config.json（無ければ既定値）
// 設定ファイルの形：{ "productId": "unlock_all_patients", "entitlement": "full_unlock", "revenuecatKey": "goog_…" }
// Web 公開版（このリポジトリの index.html）はそのまま。課金ゲートは無効のまま、全員遊べる。
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var args = process.argv.slice(2);
var ci = args.indexOf('--config');
var cfgPath = ci >= 0 ? path.resolve(args[ci + 1]) : path.join(root, '..', 'kokoro-clinic-play', 'play.config.json');
if (ci >= 0) args.splice(ci, 2);
var out = path.resolve(args[0] || path.join(root, '..', 'kokoro-clinic-play', 'www'));
var COPY = ['index.html', 'version.txt', 'privacy.html', 'css', 'js', 'img'];

var cfg = { productId: 'unlock_all_patients', entitlement: 'full_unlock', revenuecatKey: 'REPLACE_ME' };
if (fs.existsSync(cfgPath)) Object.assign(cfg, JSON.parse(fs.readFileSync(cfgPath, 'utf8')));

function copy(src, dst) {
  var st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    fs.readdirSync(src).forEach(function (n) { copy(path.join(src, n), path.join(dst, n)); });
  } else fs.copyFileSync(src, dst);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
COPY.forEach(function (n) { if (fs.existsSync(path.join(root, n))) copy(path.join(root, n), path.join(out, n)); });

// 課金ゲートを有効にし、RevenueCat の橋渡しを paywall.js より前に読み込む
var html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
var m = html.match(/<script src="js\/paywall\.js(\?v=\d+)?"><\/script>/);
if (!m) throw new Error('index.html に js/paywall.js がありません');
var flag = '<script>window.KOKORO_PAYWALL = ' + JSON.stringify({ enabled: true, productId: cfg.productId, entitlement: cfg.entitlement, revenuecatKey: cfg.revenuecatKey }) + ';</script>\n' +
  '<script src="js/store-revenuecat.js' + (m[1] || '') + '"></script>\n';
html = html.replace(m[0], flag + m[0]);
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('Play版の www を作りました：' + out + '（課金ゲート：有効／RevenueCat キー：' + (/REPLACE/.test(cfg.revenuecatKey) ? '未設定＝モック' : '設定済み') + '）');
