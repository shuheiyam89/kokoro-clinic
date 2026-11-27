// ゆったりしたBGM（音声ファイルを使わず、ブラウザの音源でその場で演奏する）
var BGM = (function () {
  var KEY = 'kokoro_clinic_bgm';
  var ctx = null, master = null, bus = null, timer = null, nextTime = 0, step = 0;
  var muted = false;
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) {}
  var BPM = 64, BEAT = 60 / BPM, VOL = 0.55;

  // Fmaj7 → Em7 → Dm7 → Cmaj7（ふんわりした進行）各2小節
  var CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  // オルゴール風のメロディ（16拍×4和音、null は休み）
  var MEL = [
    [76, null, null, 72, null, null, 69, null, 72, null, null, null, 76, null, 77, null],
    [74, null, null, 71, null, null, 67, null, 71, null, null, null, 74, null, null, null],
    [72, null, null, 69, null, 74, null, null, 72, null, 69, null, null, null, 65, null],
    [67, null, null, 71, null, null, 72, null, 76, null, null, 74, null, 72, null, null]
  ];

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function init() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : VOL; master.connect(ctx.destination);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.connect(master);
    bus = ctx.createGain(); bus.connect(lp);
    // やわらかい残響（ディレイ）
    var dl = ctx.createDelay(2); dl.delayTime.value = BEAT * 0.75;
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
  function pad(note, t, dur, fast) {
    [[0, 'triangle', 0.028], [7, 'sine', 0.03]].forEach(function (v) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = v[1]; o.frequency.value = mtof(note); o.detune.value = v[0];
      env(g, t, fast ? 0.12 : 1.6, v[2], Math.max(0.1, dur - 2.4), 2.2);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 2.5);
    });
  }
  function bass(note, t, dur) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = mtof(note - 12);
    env(g, t, 0.4, 0.09, Math.max(0.1, dur - 1.4), 1.2);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 1.5);
  }
  function bell(note, t) {
    [[1, 0.05], [2, 0.012], [3, 0.006]].forEach(function (h) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = mtof(note) * h[0];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(h[1], t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 / h[0]);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 2.8);
    });
  }

  function tick() {
    while (nextTime < ctx.currentTime + 0.6) {
      var bar = Math.floor(step / 16) % 4, b = step % 16, t = nextTime;
      if (b === 0) {
        CHORDS[bar].forEach(function (n) { pad(n, t, BEAT * 8, step === 0); }); // 最初の和音はすぐ鳴らす
        bass(CHORDS[bar][0], t, BEAT * 8);
      }
      // 2周目以降、たまにメロディを休ませて変化をつける
      var round = Math.floor(step / 64);
      var m = MEL[bar][b];
      if (m && !(round % 3 === 2 && b > 8)) bell(m, t + (b % 2 ? 0.02 : 0));
      nextTime += BEAT / 2;
      step++;
    }
  }

  function start() {
    if (!ctx && !init()) return;
    if (ctx.state !== 'running') {
      // 音の再生が許可されていない間は、予定だけ進めないようにして、許可された瞬間から鳴らす
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

  return { start: start, setMuted: setMuted, isMuted: function () { return muted; }, running: running, sfx: sfx };
})();
