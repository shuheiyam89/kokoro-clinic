// 会話エンジンのテスト: node tests/test.js
var fs = require('fs'), vm = require('vm'), path = require('path');
var ctx = { console: console };
vm.createContext(ctx);
['data-patients.js', 'engine.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
var P = vm.runInContext('PATIENTS', ctx), E = vm.runInContext('Engine', ctx);
var fails = 0;
function play(pid, qs, truth, advice) {
  var p = P.filter(function (x) { return x.id === pid; })[0], st = E.newState(p);
  qs.forEach(function (q) {
    var r = E.ask(p, st, q);
    console.log('  Q:' + q + ' → [' + st.trust + '] ' + r.lines.map(function (l) { return l.text; }).join(' / ').slice(0, 70));
  });
  var d = E.diagnose(p, st, truth);
  var c = d.ok ? E.counsel(p, st, advice) : { ok: false };
  var ok = d.ok && c.ok;
  console.log((ok ? 'OK  ' : 'NG  ') + p.name + ' 手がかり' + st.clues.length + '個 phase=' + st.phase);
  if (!ok) fails++;
}
play('pururu', ['こんにちは', 'どうしましたか？', 'いつから小さくなったの？', '夜は眠れてる？', 'つらかったね、大丈夫だよ',
  '夜はどこに出かけてるの？', '友達はどんな子？', 'モチは何の病気なの？'], 'モチにゼリーを分けてあげているんだね', 'モチを病院に連れてきて');
play('lumie', ['今日はどうしましたか', 'いつから？', '大変でしたね', '花屋で何を買ったの？', '花屋には誰がいるの？',
  '安心して話してください', 'トマスさんのことが好きなの？'], '人間のトマスさんに恋をしているんですね', '今の時間を大切にしてください');
play('gald', ['眠れないんですね', '昔は隊長だったんですか？すごい', '大変でしたね', '喉の調子は？', '火は吹けますか？',
  'お孫さんのこと教えて', 'お祭りの約束って？', '心配ですよね', '本当は火が出ないんじゃないですか'], '火が吹けなくなったんですね', 'リノくんに正直に話してみては');

// 乱暴な言葉で帰ってしまうか
var g = P[2], st = E.newState(g);
E.ask(g, st, 'さっさと言え');
console.log((st.phase === 'left' ? 'OK  ' : 'NG  ') + '失礼な言葉で帰る');
if (st.phase !== 'left') fails++;
// きもち が もち に誤反応しないか
var pr = P[0], s2 = E.newState(pr); s2.trust = 5;
var r = E.ask(pr, s2, 'いまのきもちは？');
var bad = !!s2.seen.friend;
console.log((bad ? 'NG  ' : 'OK  ') + '「きもち」で友達の話題に誤反応しない');
if (bad) fails++;
// 意味のない入力でヒントが出るか
var s3 = E.newState(pr); E.ask(pr, s3, 'あいうえお'); var r3 = E.ask(pr, s3, 'かきくけこ');
var hinted = r3.lines.some(function (l) { return l.who === 'nurse'; });
console.log((hinted ? 'OK  ' : 'NG  ') + '行き詰まるとヒントが出る');
if (!hinted) fails++;
console.log(fails ? fails + '件失敗' : 'すべて成功');
process.exit(fails ? 1 : 0);
