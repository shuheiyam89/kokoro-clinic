// Google Play 版の Web 部分（Capacitor の www）を作る。課金ゲートを有効にした index.html を書き出す。
//   node tools/build-play.js [出力先]   （既定：../kokoro-clinic-play/www）
// Web 公開版（このリポジトリの index.html）はそのまま。課金ゲートは無効のまま、全員遊べる。
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var out = path.resolve(process.argv[2] || path.join(root, '..', 'kokoro-clinic-play', 'www'));
var COPY = ['index.html', 'version.txt', 'css', 'js', 'img'];

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

// 課金ゲートを有効にする（paywall.js より前に置く）
var html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
var flag = '<script>window.KOKORO_PAYWALL = { enabled: true, productId: \'unlock_all_patients\' };</script>\n';
if (!/<script src="js\/paywall\.js/.test(html)) throw new Error('index.html に js/paywall.js がありません');
html = html.replace(/<script src="js\/paywall\.js/, flag + '<script src="js/paywall.js');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('Play版の www を作りました：' + out + '（課金ゲート：有効）');
