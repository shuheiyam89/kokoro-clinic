// 台本（FLOWS）を進める。画面に依存しない（node のテストからも使う）
var Story = (function () {
  function L(who, text, face) { return { who: who, text: text, face: face }; }

  function start(p) { return { p: p, flow: FLOWS[p.id], st: Engine.newState(p), idx: 0, miss: 0 }; }
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
  function run(g) {
    var out = [];
    while (g.idx < g.flow.length) {
      if (g.st.phase === 'left') return { lines: out, waiting: null };
      var s = g.flow[g.idx];
      if (s.type === 'auto') { out = out.concat(s.lines); g.idx++; continue; }
      if (s.type === 'say') {
        out.push(L('me', s.text));
        out = out.concat(Engine.ask(g.p, g.st, s.text, { noHint: true }).lines);
        g.idx++; continue;
      }
      if (s.type === 'ask' && seenAll(g, s)) { g.idx++; continue; } // もう聞き出していたら飛ばす
      g.miss = 0;
      if (s.type === 'ask') ensureTrust(g, s);
      out.push(L('think', s.prompt));
      return { lines: out, waiting: s };
    }
    return { lines: out, waiting: null, done: true };
  }

  function exec(g, s, text) {
    if (s.type === 'ask') {
      var r = Engine.ask(g.p, g.st, text, { noHint: true });
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
    var r = exec(g, s, text), out = r.lines.slice();
    if (r.ok) { g.idx++; return { lines: out, ev: r.ev, ok: true }; }
    if (g.st.phase === 'left') return { lines: out, ev: r.ev };
    g.miss++;
    if (g.miss === 2) {
      out.push(L('nurse', s.hint));
      out.push(L('think', s.prompt));
    } else if (g.miss >= 3) {
      out.push(L('nurse', '先生、こんなふうに言ってみてはどうでしょう？'));
      out.push(L('me', s.example));
      var r2 = exec(g, s, s.example);
      out = out.concat(r2.lines);
      g.idx++;
      return { lines: out, ev: r2.ev, ok: true, assisted: true };
    } else {
      out.push(L('think', s.prompt));
    }
    return { lines: out, ev: r.ev };
  }

  function hint(g) {
    var s = current(g);
    if (!s || !s.hint) return [];
    return [L('nurse', s.hint), L('think', s.prompt)];
  }

  return { start: start, run: run, answer: answer, hint: hint, current: current };
})();
if (typeof module !== 'undefined') module.exports = Story;
