// 会話エンジンのテスト: node tests/test.js
var fs = require('fs'), vm = require('vm'), path = require('path');
var ctx = { console: console };
vm.createContext(ctx);
['data-patients.js', 'data-flow.js', 'engine.js', 'story.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
var P = vm.runInContext('PATIENTS', ctx), E = vm.runInContext('Engine', ctx), S = vm.runInContext('Story', ctx);
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
E.ask(g, st, 'さっさと言え'); E.ask(g, st, 'さっさと言え');
var notYet = st.phase !== 'left' && st.anger === 4;
E.ask(g, st, 'さっさと言え');
console.log((notYet && st.phase === 'left' ? 'OK  ' : 'NG  ') + '失礼な言葉で怒りメーターが満タンになり帰る');
if (!(notYet && st.phase === 'left')) fails++;
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

// 台本の通しプレイ：mode=example は模範の言葉、mode=miss は毎回でたらめ（3回目で助手が代わりに進める）
function flowPlay(p, mode) {
  var g = S.start(p), steps = 0, assisted = 0;
  var r = S.run(g);
  while (r.waiting && steps < 200) {
    steps++;
    var a = null;
    if (mode === 'example') a = S.answer(g, r.waiting.example);
    else if (p.difficulty > 1) {
      // リュミエ以降：外しても自動のヒントは出ない。💡を2回押すと言い方の例が出るので、それで進める
      var ls = [];
      ['ほげほげ', 'ふがふが', 'もにゃもにゃ'].forEach(function (x) { if (!a || !a.ok) { a = S.answer(g, x); ls = ls.concat(a.lines); } });
      if (!a.ok) {
        var leak = ls.filter(function (l) { return l.who === 'nurse' && l.text.indexOf('💡') < 0; });
        if (leak.length) { console.log('NG  自動ヒントが出た ' + p.name + '：' + leak[0].text); fails++; }
        S.hint(g); var h2 = S.hint(g), ex = (h2[0].text.match(/「(.+)」/) || [])[1];
        a = S.answer(g, ex || r.waiting.example); if (a.ok) assisted++;
      }
    }
    else { a = S.answer(g, 'ほげほげ'); if (!a.ok) a = S.answer(g, 'ふがふが'); if (!a.ok) a = S.answer(g, 'もにゃもにゃ'); }
    if (a.assisted) assisted++;
    if (!a.ok) break;
    r = S.run(g);
  }
  return { done: !!r.done && g.st.phase === 'done', assisted: assisted, clues: g.st.clues.length, trust: g.st.trust };
}
P.forEach(function (p) {
  ['example', 'miss'].forEach(function (mode) {
    var res = flowPlay(p, mode);
    var ok = res.done && (mode === 'miss' || res.assisted === 0);
    console.log((ok ? 'OK  ' : 'NG  ') + '台本 ' + p.name + ' [' + mode + '] クリア=' + res.done + ' 代行' + res.assisted + '回 手がかり' + res.clues + ' 信頼' + res.trust);
    if (!ok) fails++;
  });
});
// 寄り道の質問でエピソードが起き、結末が「best」に変わるか
var EPQ = { pururu: ['お仕事は何をしているの？', '通信機が鳴ってるみたいだけど？'],
  lumie: ['里に言い伝えはありますか？', 'その手帳の青い押し花はなんですか？'],
  gald: ['懐の紙はなんですか？', '奥さんはどんな方でしたか？'] };
P.forEach(function (p) {
  var g = S.start(p), r = S.run(g), left = EPQ[p.id].slice(), shown = 0, steps = 0, missed = false;
  while (r.waiting && steps++ < 200) {
    var a, adv = false;
    for (var i = 0; i < left.length && !adv; i++) {
      if (r.waiting.type !== 'ask') break;
      a = S.answer(g, left[i]);
      if (a.ok) adv = true;
      var ep = a.lines.filter(function (l) { return l.episode; }).length;
      if (ep) { shown += ep; left.splice(i, 1); i--; if (g.miss) missed = true; }
    }
    if (!adv) { a = S.answer(g, r.waiting.example); if (!a.ok) break; }
    r = S.run(g);
  }
  var rt = E.route(p, g.st), endTxt = E.endingLines(p, g.st).length;
  var ok = g.st.phase === 'done' && rt.key === 'best' && shown === 2 && !missed && endTxt > p.ending.length;
  console.log((ok ? 'OK  ' : 'NG  ') + 'エピソード ' + p.name + ' 発見' + shown + ' ルート=' + rt.key + '「' + rt.name + '」 残り:' + left.join(','));
  if (!ok) fails++;
  // 寄り道しなければ normal
  var g2 = S.start(p), r2 = S.run(g2); while (r2.waiting) { S.answer(g2, r2.waiting.example); r2 = S.run(g2); }
  if (E.route(p, g2.st).key !== 'normal') { console.log('NG  寄り道なしで normal にならない ' + p.name); fails++; }
});
console.log(fails ? fails + '件失敗' : 'すべて成功');
process.exit(fails ? 1 : 0);
