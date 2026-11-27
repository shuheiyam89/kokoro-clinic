// 台本（FLOWS）を進める。画面に依存しない（node のテストからも使う）
var Story = (function () {
  function L(who, text, face) { return { who: who, text: text, face: face }; }

  function start(p) { return { p: p, flow: FLOWS[p.id], st: Engine.newState(p), idx: 0, miss: 0, epDone: {} }; }

  // 質問しだいで起きる「エピソード」。聞き出した話題にエピソードがあれば、その場面を流す
  function episodes(g) {
    var out = [];
    g.p.topics.forEach(function (tp) {
      if (!tp.episode || !g.st.seen[tp.id] || g.epDone[tp.id]) return;
      g.epDone[tp.id] = true;
      out.push({ who: 'narr', text: '✦ エピソード「' + tp.episode.title + '」', episode: tp.episode.title, item: tp.episode.item });
      out = out.concat(tp.episode.scene);
    });
    return out;
  }
  function current(g) { return g.flow[g.idx] || null; }

  // ask の前に、聞き出す話題に必要な信頼度を下回っていたら補う（行き詰まり防止）
  function ensureTrust(g, s) {
    s.expect.forEach(function (id) {
      var tp = g.p.topics.filter(function (t) { return t.id === id; })[0];
      if (tp && tp.minTrust && g.st.trust < tp.minTrust) g.st.trust = tp.minTrust;
    });
  }
  function seenAll(g, s) { return s.expect.every(function (id) { return g.st.seen[id]; }); }

  // 自動で進むところを進め、入力待ちの場所で止まる
  function run(g, opts) {
    opts = opts || {};
    var out = [];
    while (g.idx < g.flow.length) {
      if (g.st.phase === 'left') return { lines: out, waiting: null };
      var s = g.flow[g.idx];
      // unless の話題をもう聞いていたら、その地の文は出さない（話の順番が変わっても矛盾しないように）
      if (s.type === 'auto') { out = out.concat(s.lines.filter(function (l) { return !(l.unless && g.st.seen[l.unless]); })); g.idx++; continue; }
      if (s.type === 'say' && s.topic && g.st.seen[s.topic]) { g.idx++; continue; } // もう聞いた話なら、声かけを飛ばす
      if (s.type === 'say' && opts.ai) return { lines: out, say: s, sayText: (g.bridge && g.bridge[g.idx]) || s.text };
      if (s.type === 'say') {
        out.push(L('me', s.text));
        out = out.concat(Engine.ask(g.p, g.st, s.text, { noHint: true }).lines).concat(episodes(g));
        g.idx++; continue;
      }
      if (s.type === 'ask' && seenAll(g, s)) { g.idx++; continue; } // もう聞き出していたら飛ばす
      g.miss = 0;
      if (s.type === 'ask') ensureTrust(g, s);
      out.push(think(g, s));
      return { lines: out, waiting: s };
    }
    return { lines: out, waiting: null, done: true };
  }

  function exec(g, s, text) {
    if (s.type === 'ask') {
      var r = Engine.ask(g.p, g.st, text, { noHint: true, quiet: !autoHint(g) });
      return { lines: r.lines, ev: r.ev, ok: seenAll(g, s) };
    }
    if (s.type === 'truth') { var d = Engine.diagnose(g.p, g.st, text, { noHint: true, noPenalty: true }); return { lines: d.lines, ev: d.ev, ok: d.ok }; }
    var c = Engine.counsel(g.p, g.st, text, { noHint: true });
    return { lines: c.lines, ev: {}, ok: c.ok };
  }

  // プレイヤーの入力
  function answer(g, text) {
    var s = current(g);
    if (!s) return { lines: [], ev: {} };
    var r = exec(g, s, text), out = r.lines.slice(), ep = episodes(g);
    out = out.concat(ep);
    if (r.ok) { g.idx++; return { lines: out, ev: r.ev, ok: true }; }
    if (g.st.phase === 'left') return { lines: out, ev: r.ev };
    if (ep.length) { out.push(think(g, s)); return { lines: out, ev: r.ev }; } // 寄り道はミスに数えない
    var m = miss(g, s, out);
    return m || { lines: out, ev: r.ev };
  }

  // プルル（最初の患者）だけは練習なので、自動でヒントを出す。リュミエ以降はヒントボタンを押したときだけ
  function autoHint(g) { return (g.p.difficulty || 1) <= 1; }
  var THINK = ['（なにを聞いてみよう…？）', '（もう少し、話を聞いてみよう）', '（次は、なにを聞こう…）'];
  function think(g, s) {
    if (s.type !== 'ask' || autoHint(g)) return L('think', s.prompt);
    g.thinkN = (g.thinkN || 0) + 1;
    return L('think', THINK[g.thinkN % THINK.length]);
  }
  // 外したとき。プルルは2回目でヒント、3回目で助手が代わりに聞く。リュミエ以降は何も教えない
  function miss(g, s, out) {
    g.miss++;
    if (!autoHint(g)) {
      if (g.miss === 3 && !g.toldButton) { g.toldButton = true; out.push(L('nurse', '先生、困ったら💡ヒントを押してくださいね。')); }
      out.push(think(g, s));
      return null;
    }
    if (g.miss === 2) {
      out.push(L('nurse', s.hint));
      out.push(L('think', s.prompt));
    } else if (g.miss >= 3) {
      out.push(L('nurse', '先生、こんなふうに言ってみてはどうでしょう？'));
      out.push(L('me', s.example));
      var r2 = exec(g, s, s.example);
      g.idx++;
      return { lines: out.concat(r2.lines), ev: r2.ev, ok: true, assisted: true };
    } else out.push(L('think', s.prompt));
    return null;
  }

  // 💡ヒントボタン：1回目は考えるヒント、2回目からは言い方の例
  function hint(g) {
    var s = current(g);
    if (!s || !s.hint) return [];
    g.hintAt = g.hintAt || {};
    var n = g.hintAt[g.idx] = (g.hintAt[g.idx] || 0) + 1;
    if (n >= 2 && s.example) return [L('nurse', '先生、こんなふうに言ってみてはどうでしょう？「' + s.example + '」'), L('think', s.prompt)];
    return [L('nurse', s.hint), L('think', s.prompt)];
  }

  // ---- AIの返事を使う ----
  function topicById(g, id) { return g.p.topics.filter(function (t) { return t.id === id; })[0]; }
  function canReveal(g, tp) {
    if (!tp) return false;
    if (tp.needs && !tp.needs.every(function (n) { return g.st.seen[n]; })) return false;
    return !(tp.minTrust && g.st.trust < tp.minTrust);
  }
  // キーワードでも正解とみなせるか（AIの判定が厳しすぎたときの保険）
  function keyMatch(text, groups) {
    var t = Engine.norm(text);
    return groups.every(function (gr) { return gr.some(function (k) { return t.indexOf(Engine.norm(k)) >= 0; }); });
  }
  // サーバーに送る今の状態
  // この発言のあとに来る「あなた」の決まった声かけ（AIに、聞いた言葉をふまえた言い方へ書きかえてもらう）
  function nextSay(g) {
    for (var i = g.idx + 1; i < g.flow.length; i++) {
      var t = g.flow[i].type;
      if (t === 'say') return i;
      if (t !== 'auto') return -1;
    }
    return -1;
  }
  function aiPayload(g, kind, text, history) {
    var s = current(g), ns = nextSay(g);
    g.bridgeFor = ns;
    return {
      next_say: ns >= 0 ? g.flow[ns].text : '',
      pid: g.p.id, kind: kind, utterance: text,
      history: history, trust: g.st.trust, anger: g.st.anger || 0,
      seen: Object.keys(g.st.seen),
      goal: s && s.type === 'ask' ? s.expect : []
    };
  }
  // AIの返事を状態に反映する。say のときは必ず次へ進む
  function applyAI(g, text, res, isSay) {
    var s = current(g), st = g.st, out = [], ev = { clue: null };
    if (st.phase !== 'talk' && st.phase !== 'counsel') return { lines: [], ok: false };
    st.turns++;
    if (res.bridge && g.bridgeFor >= 0) { g.bridge = g.bridge || {}; g.bridge[g.bridgeFor] = res.bridge; }
    st.trust = Math.max(0, Math.min(5, st.trust + (res.trust_change || 0)));
    var fresh = false, revealed = (res.revealed || []).slice();
    // AIが話したのに「話した」と記録し忘れたときの保険：今聞き出したい話題を、プレイヤーがはっきり聞いていれば記録する
    if (!isSay && s && s.type === 'ask') s.expect.forEach(function (id) {
      var tp = topicById(g, id);
      if (tp && !st.seen[id] && revealed.indexOf(id) < 0 && keyMatch(text, tp.keys) && canReveal(g, tp)) revealed.push(id);
    });
    revealed.forEach(function (id) {
      var tp = topicById(g, id);
      if (!st.seen[id] && canReveal(g, tp)) { st.seen[id] = true; fresh = true; if (tp.clue && st.clues.indexOf(tp.clue) < 0) { st.clues.push(tp.clue); ev.clue = tp.clue; } }
    });
    // 新しい手がかりを話していないのに赤字（【】）になっていたら、ただの言葉にもどす
    (res.lines || []).forEach(function (l) { out.push(L('p', fresh ? l.text : String(l.text).replace(/[【】]/g, ''), l.face)); });
    // 怒りメーター（古いサーバーで anger_change がないときは、信頼の下がり方から決める）
    var da = typeof res.anger_change === 'number' ? res.anger_change : Math.max(0, -(res.trust_change || 0));
    out = out.concat(Engine.changeAnger(g.p, st, da));
    if (st.phase === 'left') return { lines: out, ev: ev };
    var ep = episodes(g); out = out.concat(ep);
    if (isSay) { g.idx++; return { lines: out, ev: ev, ok: true }; }
    var ok = false;
    if (s.type === 'ask') ok = seenAll(g, s);
    else if (s.type === 'truth') {
      if (res.truth !== 'correct' && keyMatch(text, g.p.truth.groups)) { res.truth = 'correct'; out = g.p.truth.success.slice(0, 1); }
      if (res.truth === 'correct') {
        // 告白は台本の言葉で語るので、AIの返事は最初の「図星の一言」だけにする（同じ告白が2回にならないように）
        out = out.slice(0, 1).map(function (l) { return L('p', String(l.text).replace(/[【】]/g, ''), l.face); });
        ok = true; st.phase = 'counsel';
        out = out.concat(g.p.truth.success.slice(1));
        out.push(L('nurse', '真実にたどりついた！ さいごに、どんな言葉で背中を押してあげる？'));
      } else if (res.truth === 'partial' && autoHint(g)) {
        out.push(L('nurse', '（おしい！ だれが・何を・どうしたのか、もう少しくわしく言ってみよう）'));
      }
    } else if (s.type === 'counsel') {
      if (!res.counsel_ok && g.p.counsel.good.some(function (c) { return keyMatch(text, c.groups); })) res.counsel_ok = true;
      if (res.counsel_ok) { ok = true; st.phase = 'done'; out = out.concat(Engine.endingLines(g.p, st)); }
    }
    if (ok) { g.idx++; return { lines: out, ev: ev, ok: true }; }
    if (ep.length) { out.push(think(g, s)); return { lines: out, ev: ev }; }
    var m = miss(g, s, out);
    return m || { lines: out, ev: ev };
  }
  // AIが使えないときの say（キーワードの返事）
  function localSay(g) {
    var s = current(g), out = Engine.ask(g.p, g.st, s.text, { noHint: true }).lines.concat(episodes(g));
    g.idx++;
    return { lines: out, ok: true };
  }

  return { start: start, run: run, answer: answer, hint: hint, current: current, aiPayload: aiPayload, applyAI: applyAI, localSay: localSay };
})();
if (typeof module !== 'undefined') module.exports = Story;
