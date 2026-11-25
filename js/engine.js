// 会話エンジン（画面に依存しない。node のテストからも使う）
var Engine = (function () {
  var MAX_TRUST = 5;
  var EMPATHY_CAP = 3; // 寄り添いで上がる信頼の上限回数

  function norm(s) {
    s = String(s || '').normalize('NFKC').toLowerCase();
    // カタカナ → ひらがな
    s = s.replace(/[ァ-ヶ]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0x60); });
    s = s.replace(/[\s、。，．,.!?！？「」『』…・〜~ーっ]/g, '');
    // まぎらわしい語を先に置き換え（「きもち」の中の「もち」など）
    s = s.replace(/きもち/g, '気持ち');
    return s;
  }
  function hasAny(t, list) {
    for (var i = 0; i < list.length; i++) { var k = norm(list[i]); if (k && t.indexOf(k) >= 0) return true; }
    return false;
  }
  function matchAll(t, groups) {
    for (var i = 0; i < groups.length; i++) if (!hasAny(t, groups[i])) return false;
    return true;
  }
  function countMatch(t, groups) {
    var n = 0; for (var i = 0; i < groups.length; i++) if (hasAny(t, groups[i])) n++; return n;
  }
  function pick(list, n) { return list[n % list.length]; }

  function newState(p) {
    return { pid: p.id, trust: p.startTrust, seen: {}, clues: [], phase: 'talk',
      fallbacks: 0, empathyGiven: 0, cycle: 0, turns: 0 };
  }

  function L(who, text, face) { return { who: who, text: text, face: face }; }
  function needsOk(st, t) {
    if (!t.needs) return true;
    for (var i = 0; i < t.needs.length; i++) if (!st.seen[t.needs[i]]) return false;
    return true;
  }
  function addClue(st, c) { if (c && st.clues.indexOf(c) < 0) { st.clues.push(c); return true; } return false; }
  function changeTrust(st, d) { st.trust = Math.max(0, Math.min(MAX_TRUST, st.trust + d)); }

  function leaveLines(p, st) {
    st.phase = 'left';
    return p.leave.map(function (x, i) { return L(i === 0 ? 'p' : 'narr', x, 'angry'); });
  }

  function hintLine(p, st) {
    for (var i = 0; i < p.topics.length; i++) {
      var t = p.topics[i];
      if (t.hint && !st.seen[t.id] && needsOk(st, t)) {
        if (t.minTrust && st.trust < t.minTrust) return L('nurse', 'まだ心をひらいていないみたい。まずは気持ちに寄り添う言葉をかけてみて。');
        return L('nurse', t.hint);
      }
    }
    if (st.clues.length >= 3) return L('nurse', '手がかりはそろってきたよ。「真実をつげる」で、隠していることを言いあててみて！');
    return L('nurse', 'カルテを見なおしてみよう。気になる言葉があるはず。');
  }

  // 質問する
  function ask(p, st, input, opts) {
    opts = opts || {};
    var t = norm(input), out = [], ev = { trust: 0, clue: null, topic: null };
    if (!t || st.phase !== 'talk') return { lines: out, ev: ev };
    st.turns++;
    var before = st.trust;

    if (hasAny(t, COMMON_RUDE)) {
      changeTrust(st, -2);
      out.push(L('p', pick(p.rude, st.cycle++), 'angry'));
      if (st.trust <= 0) out = out.concat(leaveLines(p, st));
      ev.trust = st.trust - before;
      return { lines: out, ev: ev };
    }

    var empathic = hasAny(t, COMMON_EMPATHY);
    if (empathic && st.empathyGiven < EMPATHY_CAP) { st.empathyGiven++; changeTrust(st, 1); }

    // 一致する話題をさがす
    var cands = [];
    p.topics.forEach(function (tp, idx) {
      if (needsOk(st, tp) && matchAll(t, tp.keys)) cands.push({ tp: tp, idx: idx });
    });
    cands.sort(function (a, b) {
      var sa = st.seen[a.tp.id] ? 1 : 0, sb = st.seen[b.tp.id] ? 1 : 0;
      if (sa !== sb) return sa - sb;
      var la = a.tp.minTrust && st.trust < a.tp.minTrust ? 1 : 0, lb = b.tp.minTrust && st.trust < b.tp.minTrust ? 1 : 0;
      if (la !== lb) return la - lb;
      var na = (a.tp.needs || []).length, nb = (b.tp.needs || []).length;
      if (na !== nb) return nb - na;
      return b.idx - a.idx;
    });

    // もう聞いた話題で、寄り添う言葉が入っているなら、同じ話をくり返さずお礼を返す
    if (cands.length && empathic && st.seen[cands[0].tp.id]) cands = [];

    if (cands.length) {
      var tp = cands[0].tp;
      st.fallbacks = 0;
      if (tp.minTrust && st.trust < tp.minTrust) {
        out.push(L('p', pick(p.locked, st.cycle++), 'sad'));
        out.push(L('nurse', '（まだ話してくれないみたい。もっと寄り添ってみよう）'));
      } else {
        var first = !st.seen[tp.id];
        var rep = (!first && tp.again) ? tp.again : tp.reply;
        rep.forEach(function (x) { out.push(L('p', x, tp.face || 'normal')); });
        ev.topic = tp.id;
        if (first) {
          st.seen[tp.id] = true;
          if (tp.trust) changeTrust(st, tp.trust);
          if (addClue(st, tp.clue)) ev.clue = tp.clue;
        }
      }
    } else if (empathic) {
      st.fallbacks = 0;
      out.push(L('p', pick(p.empathy, st.cycle++), 'happy'));
    } else {
      st.fallbacks++;
      out.push(L('p', pick(p.fallback, st.cycle++), 'normal'));
      if (st.fallbacks >= 2 && !opts.noHint) { out.push(hintLine(p, st)); st.fallbacks = 0; }
    }
    ev.trust = st.trust - before;
    return { lines: out, ev: ev };
  }

  // 真実をつげる
  function diagnose(p, st, input, opts) {
    opts = opts || {};
    var t = norm(input), out = [], ev = { trust: 0 };
    if (!t || st.phase !== 'talk') return { lines: out, ev: ev, ok: false };
    var before = st.trust;
    if (matchAll(t, p.truth.groups)) {
      st.phase = 'counsel';
      out = p.truth.success.slice();
      out.push(L('nurse', '真実にたどりついた！ さいごに、どんな言葉で背中を押してあげる？'));
      return { lines: out, ev: ev, ok: true };
    }
    if (countMatch(t, p.truth.groups) > 0) {
      out.push(L('p', pick(p.truth.partial, st.cycle++), 'surprise'));
      if (!opts.noHint) out.push(L('nurse', '（おしい！ だれが・何を・どうしたのか、もう少しくわしく言ってみよう）'));
    } else {
      if (!opts.noPenalty) changeTrust(st, -1);
      out.push(L('p', pick(p.truth.wrong, st.cycle++), 'angry'));
      if (st.trust <= 0) out = out.concat(leaveLines(p, st));
    }
    ev.trust = st.trust - before;
    return { lines: out, ev: ev, ok: false };
  }

  // さいごの声かけ
  function counsel(p, st, input, opts) {
    opts = opts || {};
    var t = norm(input), out = [];
    if (!t || st.phase !== 'counsel') return { lines: out, ok: false };
    if (hasAny(t, COMMON_RUDE)) { out.push(L('p', pick(p.rude, st.cycle++), 'angry')); return { lines: out, ok: false }; }
    for (var i = 0; i < p.counsel.good.length; i++) {
      var g = p.counsel.good[i];
      if (matchAll(t, g.groups)) {
        st.phase = 'done';
        out = g.reply.concat(p.ending);
        return { lines: out, ok: true };
      }
    }
    if (matchAll(t, p.counsel.bad.groups)) {
      p.counsel.bad.reply.forEach(function (x) { out.push(L('p', x, 'sad')); });
    } else {
      out.push(L('p', pick(p.counsel.neutral, st.cycle++), 'sad'));
    }
    st.counselMiss = (st.counselMiss || 0) + 1;
    if (st.counselMiss >= 2 && !opts.noHint) {
      out.push(L('nurse', '（この人が本当に望んでいることは何だろう？ 聞き出した手がかりを思い出して）'));
    }
    return { lines: out, ok: false };
  }

  return { norm: norm, newState: newState, ask: ask, diagnose: diagnose, counsel: counsel, MAX_TRUST: MAX_TRUST };
})();
if (typeof module !== 'undefined') module.exports = Engine;
