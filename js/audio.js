// BGMと効果音（音声ファイルを使わず、ブラウザの音源でその場で演奏する）
// 曲は患者ごとに変わる：BGM.setTheme('pururu' | 'lumie' | 'gald' | 'default')
var BGM = (function () {
  var KEY = 'kokoro_clinic_bgm';
  var ctx = null, master = null, bus = null, dl = null, timer = null, nextTime = 0, step = 0;
  var muted = false;
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) {}
  var VOL = 0.55;

  // ---------- 曲（テーマ）----------
  // 8分音符を1ステップ、16ステップで1つの和音。和音とメロディは4つで1周。0 は休み。
  var THEMES = {
    // タイトル・オープニング：ふんわりしたオルゴール
    default: {
      bpm: 64, pad: 'soft', bass: 'soft', lead: 'bell',
      chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
      mel: [
        [76, 0, 0, 72, 0, 0, 69, 0, 72, 0, 0, 0, 76, 0, 77, 0],
        [74, 0, 0, 71, 0, 0, 67, 0, 71, 0, 0, 0, 74, 0, 0, 0],
        [72, 0, 0, 69, 0, 74, 0, 0, 72, 0, 69, 0, 0, 0, 65, 0],
        [67, 0, 0, 71, 0, 0, 72, 0, 76, 0, 0, 74, 0, 72, 0, 0]]
    },
    // プルル（気弱で素直な男の子）：ぽんぽんはずむ、かわいい長調
    pururu: {
      bpm: 92, pad: 'thin', bass: 'pluck', lead: 'box', bounce: true,
      chords: [[48, 52, 55, 60], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]],
      mel: [
        [72, 0, 76, 0, 79, 0, 76, 0, 77, 76, 74, 0, 72, 0, 0, 0],
        [69, 0, 72, 0, 76, 0, 72, 0, 74, 72, 71, 0, 69, 0, 0, 0],
        [65, 0, 69, 0, 72, 0, 77, 0, 76, 0, 74, 0, 72, 0, 69, 0],
        [67, 0, 71, 0, 74, 0, 79, 0, 77, 0, 76, 0, 74, 0, 0, 0]]
    },
    // リュミエ（上品な星の歌い手、秘めた恋）：ゆっくりしたハープと、せつない短調
    lumie: {
      bpm: 54, pad: 'air', bass: 'soft', lead: 'glass', arp: true,
      chords: [[45, 52, 59, 60], [41, 48, 52, 57], [48, 52, 55, 59], [40, 47, 50, 55]],
      mel: [
        [76, 0, 0, 0, 0, 0, 74, 0, 72, 0, 0, 0, 71, 0, 0, 0],
        [72, 0, 0, 0, 0, 0, 69, 0, 72, 0, 76, 0, 0, 0, 0, 0],
        [79, 0, 0, 0, 77, 0, 76, 0, 74, 0, 0, 0, 72, 0, 0, 0],
        [71, 0, 0, 0, 72, 0, 74, 0, 71, 0, 0, 0, 0, 0, 0, 0]]
    },
    // ガルド（頑固な老竜、元・隊長）：低いホルンとティンパニの、おごそかな短調
    gald: {
      bpm: 58, pad: 'dark', bass: 'deep', lead: 'horn', drum: true,
      chords: [[38, 50, 53, 57], [34, 46, 50, 53], [43, 46, 50, 55], [33, 45, 49, 52]],
      mel: [
        [62, 0, 0, 0, 65, 0, 64, 0, 62, 0, 0, 0, 57, 0, 0, 0],
        [58, 0, 0, 0, 62, 0, 65, 0, 63, 0, 62, 0, 0, 0, 0, 0],
        [55, 0, 0, 0, 58, 0, 62, 0, 60, 0, 58, 0, 57, 0, 0, 0],
        [57, 0, 0, 0, 61, 0, 64, 0, 0, 0, 61, 0, 57, 0, 0, 0]]
    }
  };
  // コノハ（明るいキツネ星人）：ぽんぽん弾む、お祭りのような五音音階
  THEMES.konoha = { bpm: 104, pad: 'thin', bass: 'pluck', lead: 'box', bounce: true,
    chords: [[41, 45, 48, 53], [38, 45, 50, 53], [46, 50, 53, 58], [48, 52, 55, 60]],
    mel: [[72, 0, 74, 0, 77, 0, 74, 72, 69, 0, 72, 0, 74, 0, 0, 0], [74, 0, 77, 0, 81, 0, 79, 77, 74, 0, 77, 0, 74, 0, 0, 0],
      [70, 0, 74, 0, 77, 0, 79, 0, 77, 74, 72, 0, 70, 0, 0, 0], [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0, 0, 0]] };
  // ミィ（人見知りの女の子）：オルゴールのアルペジオと、少しさみしいメロディ
  THEMES.mii = { bpm: 76, pad: 'soft', bass: 'soft', lead: 'bell', arp: true,
    chords: [[43, 47, 50, 55], [40, 47, 52, 55], [36, 48, 52, 55], [38, 50, 54, 57]],
    mel: [[79, 0, 0, 0, 78, 0, 76, 0, 74, 0, 0, 0, 71, 0, 0, 0], [76, 0, 0, 0, 74, 0, 71, 0, 72, 0, 74, 0, 0, 0, 0, 0],
      [72, 0, 0, 0, 74, 0, 76, 0, 79, 0, 0, 0, 76, 0, 0, 0], [74, 0, 0, 0, 72, 0, 71, 0, 69, 0, 0, 0, 0, 0, 0, 0]] };
  // ノア（古いロボット、亡き博士の子守歌）：ゆっくりした子守歌
  THEMES.noa = { bpm: 52, pad: 'air', bass: 'soft', lead: 'glass', arp: true,
    chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 52, 55, 60], [43, 50, 55, 59]],
    mel: [[76, 0, 0, 0, 74, 0, 72, 0, 74, 0, 0, 0, 76, 0, 0, 0], [77, 0, 0, 0, 76, 0, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0],
      [72, 0, 0, 0, 74, 0, 76, 0, 79, 0, 0, 0, 77, 0, 76, 0], [74, 0, 0, 0, 72, 0, 71, 0, 72, 0, 0, 0, 0, 0, 0, 0]] };
  var themeName = 'default', T = THEMES[themeName], BEAT = 60 / T.bpm;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function init() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : VOL; master.connect(ctx.destination);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(master);
    bus = ctx.createGain(); bus.connect(lp);
    // やわらかい残響（ディレイ）
    dl = ctx.createDelay(2); dl.delayTime.value = BEAT * 0.75;
    var fb = ctx.createGain(); fb.gain.value = 0.38;
    var wet = ctx.createGain(); wet.gain.value = 0.32;
    bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(lp);
    return true;
  }

  function env(g, t, a, peak, hold, r) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
  }
  function osc(type, freq, t, a, peak, hold, r, detune, filt) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; if (detune) o.detune.value = detune;
    env(g, t, a, peak, hold, r);
    if (filt) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); f.connect(g); }
    else o.connect(g);
    g.connect(bus); o.start(t); o.stop(t + a + hold + r + 0.1);
  }
  // 和音のうしろで鳴る音
  function pad(note, t, dur, fast) {
    var a = fast ? 0.12 : 1.6, hold = Math.max(0.1, dur - 2.4);
    if (T.pad === 'thin') { osc('triangle', mtof(note), t, fast ? 0.1 : 0.5, 0.014, hold, 1.4); return; }
    if (T.pad === 'air') { osc('sine', mtof(note + 12), t, a, 0.018, hold, 2.6, 4); osc('sine', mtof(note), t, a, 0.022, hold, 2.6, -4); return; }
    if (T.pad === 'dark') { osc('sawtooth', mtof(note), t, a, 0.012, hold, 2.2, 0, 700); osc('triangle', mtof(note), t, a, 0.02, hold, 2.2, 5); return; }
    osc('triangle', mtof(note), t, a, 0.028, hold, 2.2); osc('sine', mtof(note), t, a, 0.03, hold, 2.2, 7);
  }
  function bass(note, t, dur) {
    if (T.bass === 'deep') { osc('sine', mtof(note - 12), t, 0.6, 0.12, Math.max(0.1, dur - 1.6), 1.4); return; }
    osc('sine', mtof(note - 12), t, 0.4, 0.09, Math.max(0.1, dur - 1.4), 1.2);
  }
  function pluck(note, t, vol) { osc('triangle', mtof(note), t, 0.005, vol, 0.02, 0.28); }
  function harp(note, t) { osc('triangle', mtof(note), t, 0.004, 0.035, 0.02, 1.3); osc('sine', mtof(note) * 2, t, 0.004, 0.008, 0.01, 0.6); }
  function timpani(note, t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(mtof(note - 12) * 1.5, t); o.frequency.exponentialRampToValueAtTime(mtof(note - 12), t + 0.12);
    env(g, t, 0.01, 0.16, 0.02, 0.9); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 1.1);
  }
  // メロディの楽器
  function lead(note, t) {
    if (T.lead === 'horn') { osc('sawtooth', mtof(note), t, 0.14, 0.035, BEAT * 0.9, 0.6, 0, 1100); osc('triangle', mtof(note), t, 0.12, 0.03, BEAT * 0.9, 0.6, 4); return; }
    if (T.lead === 'glass') { [[1, 0.045], [2, 0.012], [4, 0.005]].forEach(function (h) { osc('sine', mtof(note) * h[0], t, 0.02, h[1], 0.05, 3.2 / h[0]); }); return; }
    if (T.lead === 'box') { [[1, 0.05], [3, 0.008]].forEach(function (h) { osc('sine', mtof(note) * h[0], t, 0.005, h[1], 0.01, 0.9 / h[0]); }); pluck(note, t, 0.018); return; }
    [[1, 0.05], [2, 0.012], [3, 0.006]].forEach(function (h) { osc('sine', mtof(note) * h[0], t, 0.01, h[1], 0.001, 2.6 / h[0]); });
  }

  function tick() {
    while (nextTime < ctx.currentTime + 0.6) {
      var bar = Math.floor(step / 16) % 4, b = step % 16, t = nextTime, ch = T.chords[bar];
      if (b === 0) {
        ch.forEach(function (n) { pad(n, t, BEAT * 8, step === 0); }); // 最初の和音はすぐ鳴らす
        if (T.bass !== 'pluck') bass(ch[0], t, BEAT * 8);
      }
      if (T.bounce) {
        // ぽん、ぽん、と弾むベースと、裏拍の和音
        if (b % 4 === 0) pluck(ch[0] - 12 + (b % 8 ? 7 : 0), t, 0.07);
        if (b % 4 === 2) ch.slice(1).forEach(function (n) { pluck(n + 12, t, 0.012); });
      }
      if (T.arp) harp(ch[[0, 1, 2, 3, 2, 1][b % 6]] + 12, t);
      if (T.drum && (b === 0 || b === 8 || (b === 14 && bar % 2))) timpani(ch[0], t);
      // 2周目以降、たまにメロディを休ませて変化をつける
      var round = Math.floor(step / 64), m = T.mel[bar][b];
      if (m && !(round % 3 === 2 && b > 8)) lead(m, t + (b % 2 ? 0.02 : 0));
      nextTime += BEAT / 2;
      step++;
    }
  }

  // 曲を切りかえる（いったん音を小さくしてから、新しい曲の頭から）
  var switchTimer = null;
  function applyTheme() {
    T = THEMES[themeName]; BEAT = 60 / T.bpm; step = 0;
    if (dl) dl.delayTime.value = BEAT * 0.75;
  }
  function setTheme(name) {
    if (!THEMES[name]) name = 'default';
    if (name === themeName) return;
    themeName = name;
    if (!ctx || !timer) { applyTheme(); return; }
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.18);
    clearTimeout(switchTimer);
    switchTimer = setTimeout(function () {
      applyTheme();
      nextTime = ctx.currentTime + 0.05;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(muted ? 0 : VOL, ctx.currentTime, 0.25);
    }, 700);
  }

  function start() {
    if (!ctx && !init()) return;
    if (ctx.state !== 'running') {
      // 音の再生が許可されていない間は予定を進めず、許可された瞬間から鳴らす
      ctx.resume().then(function () { if (!timer) begin(); });
      return;
    }
    if (!timer) begin();
  }
  function begin() {
    nextTime = ctx.currentTime + 0.03;
    timer = setInterval(tick, 120);
    tick();
  }

  // 効果音「ピキーン」（手がかりを見つけたとき）。BGMのフィルターを通さず、明るく鳴らす
  var sfxOut = null;
  function sfx(name) {
    if (muted) return;
    if (!ctx && !init()) return;
    if (ctx.state !== 'running') ctx.resume();
    if (!sfxOut) { sfxOut = ctx.createGain(); sfxOut.gain.value = 0.32; sfxOut.connect(ctx.destination); }
    var t = ctx.currentTime + 0.01;
    if (name === 'pikiin') {
      // 「ピッ」と上がって「キーン」と伸びる2音
      [[1568, 2093, 0, 0.18, 0.5], [2637, 2637, 0.06, 0.2, 0.9]].forEach(function (v) {
        ['triangle', 'sine'].forEach(function (type, k) {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.type = type; o.detune.value = k ? 6 : -6;
          o.frequency.setValueAtTime(v[0], t + v[2]);
          o.frequency.exponentialRampToValueAtTime(v[1], t + v[2] + 0.05);
          g.gain.setValueAtTime(0.0001, t + v[2]);
          g.gain.linearRampToValueAtTime(v[3], t + v[2] + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t + v[2] + v[4]);
          o.connect(g); g.connect(sfxOut); o.start(t + v[2]); o.stop(t + v[2] + v[4] + 0.05);
        });
      });
      // きらきら
      [4186, 3520, 4699, 5274].forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain(), s = t + 0.1 + i * 0.05;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.05, s + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.25);
        o.connect(g); g.connect(sfxOut); o.start(s); o.stop(s + 0.3);
      });
    }
  }
  function running() { return !!(ctx && ctx.state === 'running' && timer); }
  // ブラウザは、画面にふれるまで音を出させてくれない。最初にふれた瞬間（指が触れたとき）に鳴らす
  function unlock() {
    if (muted) return;
    start();
    if (running()) ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach(function (ev) { document.removeEventListener(ev, unlock, true); });
  }
  ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach(function (ev) { document.addEventListener(ev, unlock, true); });
  // 許可されている環境（PCで何度も遊んでいるときなど）では、ふれる前から流す
  if (!muted) setTimeout(start, 0);
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch (e) {}
    if (ctx) master.gain.setTargetAtTime(m ? 0 : VOL, ctx.currentTime, 0.3);
    if (!m) start();
  }
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (timer) { ctx.resume(); nextTime = Math.max(nextTime, ctx.currentTime + 0.1); }
  });

  return { start: start, setMuted: setMuted, setTheme: setTheme, isMuted: function () { return muted; }, running: running, sfx: sfx, theme: function () { return themeName; },
    // 確認用：曲を音声データにして返す（OfflineAudioContext）
    _themes: THEMES };
})();
