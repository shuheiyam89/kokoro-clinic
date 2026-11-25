// ドット絵の手続き描画（宇宙ステーションの診察室＋チビ宇宙人）
// キャラは参考画像に合わせて紺色の輪郭線つき。背景は輪郭なしのやわらかい色。
var Pixel = (function () {
  var W = 160, H = 120;
  var LINE = '#1f2347';

  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function P(c, x, y, col) { R(c, x, y, 1, 1, col); }
  function E(c, cx, cy, rx, ry, col) {
    c.fillStyle = col;
    for (var y = -ry; y <= ry; y++) {
      var w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.5) * (ry + 0.5)))));
      c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  }
  function poly(c, pts, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath(); c.fill();
  }

  // ---------- 背景：宇宙ステーションの診察室 ----------
  var bgCache = null;
  function drawRoom(c, night) {
    // 壁パネル
    R(c, 0, 0, W, 80, '#ebe7f7');
    R(c, 0, 0, W, 6, '#d3cced'); R(c, 0, 6, W, 1, '#c3bbe4');
    for (var x = 0; x < W; x += 32) { R(c, x, 7, 1, 73, '#d9d3ef'); R(c, x + 1, 7, 1, 73, '#f6f4fc'); }
    for (x = 6; x < W; x += 32) { P(c, x, 11, '#c9c1e6'); P(c, x + 20, 11, '#c9c1e6'); }
    // 腰のライン
    R(c, 0, 62, W, 18, '#d6d0ee'); R(c, 0, 62, W, 1, '#f6f4fc'); R(c, 0, 66, W, 1, '#8ee8ff'); R(c, 0, 79, W, 1, '#b9b0de');
    // 丸窓（宇宙）
    E(c, 30, 32, 19, 19, '#b4add6'); E(c, 30, 32, 17, 17, '#d8d3ee'); E(c, 30, 32, 15, 15, '#171a45');
    E(c, 34, 38, 11, 9, '#20255a');
    [[22, 22], [37, 21], [19, 36], [41, 33], [27, 44], [33, 27], [24, 30]].forEach(function (s, i) { P(c, s[0], s[1], i % 2 ? '#ffffff' : '#fff3a8'); });
    E(c, 34, 27, 5, 5, '#e48ac8'); E(c, 33, 26, 4, 4, '#f3a8da'); R(c, 31, 25, 3, 1, '#ffd0ee');
    R(c, 26, 28, 17, 1, '#c8b6ff'); R(c, 27, 29, 15, 1, '#9f8cf0');
    E(c, 21, 40, 3, 1, '#9fe9ff'); R(c, 20, 38, 3, 2, '#d6f7ff'); P(c, 19, 41, '#fff3a8'); P(c, 23, 41, '#fff3a8');
    P(c, 23, 21, '#ffffff'); P(c, 24, 20, 'rgba(255,255,255,.6)');
    // デジタル時計
    R(c, 70, 13, 20, 9, '#2a2d5c'); R(c, 71, 14, 18, 7, '#1b1e47');
    var dg = '#7fe8ff';
    R(c, 73, 15, 1, 5, dg); R(c, 76, 15, 3, 1, dg); R(c, 78, 15, 1, 5, dg); R(c, 76, 17, 3, 1, dg); R(c, 76, 19, 3, 1, dg);
    P(c, 80, 16, dg); P(c, 80, 18, dg);
    R(c, 82, 15, 3, 5, dg); R(c, 83, 16, 1, 3, '#1b1e47'); R(c, 86, 15, 3, 5, dg); R(c, 87, 16, 1, 3, '#1b1e47');
    // ポスター（惑星）
    R(c, 96, 22, 18, 22, '#ffffff'); R(c, 97, 23, 16, 20, '#2b2f6b');
    E(c, 105, 31, 5, 5, '#8fdc8a'); E(c, 104, 30, 3, 3, '#bdf0a8'); R(c, 98, 31, 14, 1, '#f5c56b');
    R(c, 99, 39, 12, 1, '#c9c4f0'); R(c, 101, 41, 8, 1, '#c9c4f0');
    // 棚（光るビンとガジェット）
    R(c, 124, 14, 32, 64, '#cfc8ea'); R(c, 126, 16, 28, 60, '#bdb5e0');
    for (var s = 0; s < 3; s++) {
      var sy = 16 + s * 20; R(c, 124, sy + 18, 32, 2, '#a79ed6'); R(c, 124, sy + 18, 32, 1, '#e7e3f7');
    }
    // 上段：ビン
    [['#7fe8ff', 128], ['#f59ad0', 136], ['#b6f27a', 144]].forEach(function (j) {
      R(c, j[1], 24, 6, 10, '#e9f9ff'); R(c, j[1] + 1, 27, 4, 7, j[0]); R(c, j[1] + 1, 22, 4, 2, '#8d86b8'); P(c, j[1] + 1, 25, '#ffffff');
    });
    // 中段：本
    var books = ['#8f7fe0', '#f5b04a', '#5fc6e8', '#f27f9a', '#7bd08a', '#b38cf0'];
    for (var b = 0, bx = 128; b < 6; b++) { var bw = 3 + (b % 2), bh = 11 + (b % 3); R(c, bx, 54 - bh, bw, bh, books[b]); R(c, bx, 54 - bh, 1, bh, 'rgba(255,255,255,.3)'); bx += bw + 1; }
    // 下段：ロボット
    R(c, 133, 64, 10, 8, '#e6e9f5'); R(c, 135, 66, 2, 2, '#5fd8ff'); R(c, 139, 66, 2, 2, '#5fd8ff'); R(c, 137, 61, 1, 3, '#8d86b8'); P(c, 137, 60, '#ff7a9a');
    R(c, 146, 66, 6, 8, '#f5c56b'); R(c, 147, 67, 4, 3, '#fff0c0');
    // 宇宙植物
    R(c, 16, 72, 16, 12, '#8d86b8'); R(c, 16, 72, 16, 2, '#b4add6'); R(c, 16, 76, 16, 1, '#7fe8ff');
    R(c, 22, 58, 2, 14, '#4fae8a'); R(c, 19, 62, 2, 10, '#4fae8a'); R(c, 27, 60, 2, 12, '#4fae8a');
    E(c, 23, 57, 3, 3, '#7fe8ff'); E(c, 20, 61, 2, 2, '#f59ad0'); E(c, 28, 59, 2, 2, '#b6f27a');
    P(c, 22, 56, '#ffffff'); P(c, 19, 60, '#ffffff'); P(c, 27, 58, '#ffffff');
    E(c, 18, 67, 4, 2, '#5fc99a'); E(c, 29, 67, 4, 2, '#5fc99a');
    // 床
    R(c, 0, 80, W, 40, '#3d3f78');
    for (var y = 86; y < H; y += 8) R(c, 0, y, W, 1, '#35376c');
    for (x = 0; x < W; x += 20) R(c, x + ((y / 8) % 2) * 10, 80, 1, 40, '#35376c');
    R(c, 0, 80, W, 1, '#7fe8ff'); R(c, 0, 81, W, 1, '#5a5da0');
    // 丸いマット（光る）
    E(c, 80, 103, 52, 10, '#6c63b8'); E(c, 80, 103, 46, 8, '#8d84d6'); E(c, 80, 103, 38, 5, '#a59cf0');
    c.save(); c.globalAlpha = 0.35; E(c, 80, 103, 52, 10, '#7fe8ff'); E(c, 80, 103, 51, 9, '#6c63b8'); c.restore();
    // 窓の光
    c.save(); c.globalAlpha = night ? 0.05 : 0.10; c.fillStyle = '#d6f7ff';
    c.beginPath(); c.moveTo(14, 50); c.lineTo(46, 50); c.lineTo(80, 118); c.lineTo(30, 118); c.closePath(); c.fill(); c.restore();
  }
  function sofaBack(c) {
    R(c, 44, 56, 72, 24, '#7a6fd0'); E(c, 80, 57, 36, 3, '#9b91ea'); R(c, 46, 56, 68, 2, '#b3aaf5');
    R(c, 79, 59, 2, 18, '#6c61c2');
  }
  function sofaFront(c) {
    R(c, 44, 80, 72, 10, '#6a5fc0'); R(c, 44, 80, 72, 2, '#8f85e3');
    R(c, 36, 64, 12, 28, '#635ab6'); E(c, 42, 64, 6, 2, '#857ade');
    R(c, 112, 64, 12, 28, '#635ab6'); E(c, 118, 64, 6, 2, '#857ade');
    R(c, 44, 88, 72, 1, '#7fe8ff');
    R(c, 40, 92, 3, 3, '#2a2d5c'); R(c, 117, 92, 3, 3, '#2a2d5c');
    c.save(); c.globalAlpha = 0.25; E(c, 80, 96, 46, 3, '#1b1e47'); c.restore();
  }

  // ---------- 顔パーツ（アニメ調の大きな目） ----------
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function m(v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  // 目は幅4・高さ5。ex = 目の中心(左寄り), sd = -1 左目 / 1 右目
  function eye(c, ex, y, o, expr, sd) {
    var iris = o.eye, dk = shade(iris, -0.45), lt = shade(iris, 0.45), inner = -sd;
    var x0 = ex - 2, innerX = inner > 0 ? ex + 1 : ex - 2, outerX = inner > 0 ? ex - 2 : ex + 1;
    var brow = o.brow || LINE;
    if (expr === 'sad' || expr === 'cry') { P(c, outerX, y - 2, brow); P(c, ex - 1 + (inner > 0 ? 1 : 0), y - 3, brow); P(c, innerX, y - 3, brow); }
    if (expr === 'angry') { P(c, outerX, y - 3, brow); P(c, ex - 1 + (inner > 0 ? 1 : 0), y - 2, brow); P(c, innerX, y - 1, brow); }
    if (expr === 'surprise') { R(c, x0, y - 3, 4, 1, brow); }
    if (o.blink && expr !== 'happy') { R(c, x0, y + 5, 4, 1, LINE); return; }
    if (expr === 'happy') {
      P(c, x0, y + 5, LINE); P(c, x0 + 1, y + 4, LINE); P(c, x0 + 2, y + 4, LINE); P(c, x0 + 3, y + 5, LINE);
      return;
    }
    var top = (expr === 'sad' || expr === 'cry' || expr === 'angry') ? 1 : 0;
    // まつげ（上を丸く）
    if (top) { R(c, x0, y + 1, 4, 1, LINE); if (expr === 'angry') P(c, innerX, y + 2, LINE); else P(c, innerX, y, LINE); }
    else { R(c, x0 + 1, y, 2, 1, LINE); R(c, x0, y + 1, 4, 1, LINE); }
    // 瞳（縦長）
    R(c, x0, y + 2, 4, 5, iris); P(c, x0, y + 6, shade(iris, -0.2)); P(c, x0 + 3, y + 6, shade(iris, -0.2));
    if (o.slit) R(c, ex, y + 2, 1, 5, o.slit);
    else R(c, ex - 1, y + 3, 2, 3, dk);
    if (expr === 'surprise') { R(c, x0, y + 2, 4, 5, '#ffffff'); R(c, ex - 1, y + 3, 2, 3, iris); P(c, ex - 1, y + 3, dk); }
    else { R(c, x0, y + 2, 2, 2, '#ffffff'); P(c, x0 + 3, y + 5, '#ffffff'); R(c, x0 + 1, y + 6, 2, 1, lt); }
    if (expr === 'cry') {
      var ty = y + 7 + ((o.t / 200 | 0) % 4);
      P(c, outerX, ty, '#6fc8ff'); P(c, outerX, y + 7, '#a8e2ff'); P(c, outerX, ty + 1, '#a8e2ff');
    }
  }
  function face(c, o, expr) {
    eye(c, o.cx - o.dx, o.ey, o, expr, -1);
    eye(c, o.cx + o.dx, o.ey, o, expr, 1);
    if (expr === 'happy' || o.blush) {
      R(c, o.cx - o.dx - 3, o.ey + 7, 2, 1, '#f49aaa'); R(c, o.cx + o.dx + 3, o.ey + 7, 2, 1, '#f49aaa');
    }
    var mx = o.cx, my = o.my, mc = o.mouth || '#5a2a3a';
    if (o.talk && ((o.t / 110) | 0) % 2 === 0) { R(c, mx - 1, my, 3, 2, mc); P(c, mx, my + 1, '#f08a9a'); return; }
    if (expr === 'happy') { R(c, mx - 1, my, 3, 1, mc); R(c, mx - 1, my + 1, 3, 1, '#f08a9a'); P(c, mx - 2, my, mc); P(c, mx + 2, my, mc); }
    else if (expr === 'sad' || expr === 'cry') { P(c, mx - 2, my + 1, mc); R(c, mx - 1, my, 3, 1, mc); P(c, mx + 2, my + 1, mc); }
    else if (expr === 'surprise') { R(c, mx - 1, my, 2, 2, mc); }
    else if (expr === 'angry') { R(c, mx - 2, my, 4, 1, mc); P(c, mx - 2, my - 1, mc); }
    else { R(c, mx - 1, my, 2, 1, mc); }
  }
  function antenna(c, x0, y0, x1, y1, stalk, ball) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (var i = 0; i <= n; i++) P(c, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), stalk);
    E(c, x1, y1 - 2, 2, 2, ball); P(c, x1 - 1, y1 - 3, '#ffffff');
  }

  // ---------- キャラクター ----------
  // プルル：ひざを抱えた緑のゼリー星人
  function pururu(c, st) {
    var G = '#8fdc5a', GS = '#62b84a', GL = '#c4f08a', GD = '#3f8a3a';
    var wob = Math.round(Math.sin(st.t / 320) * 0.7), hy = 60 + wob;
    antenna(c, 73, hy - 12, 68, hy - 20, GD, '#a8ec6a');
    antenna(c, 87, hy - 12, 92, hy - 20, GD, '#a8ec6a');
    E(c, 80, 77, 11, 7, GS);
    E(c, 75, 78, 4, 5, G); E(c, 85, 78, 4, 5, G);
    R(c, 71, 83, 7, 3, GS); R(c, 82, 83, 7, 3, GS);
    R(c, 70, 74, 20, 3, G); R(c, 70, 76, 20, 1, GS);
    E(c, 81, hy + 1, 15, 13, GS); E(c, 80, hy, 15, 13, G);
    E(c, 73, hy - 7, 4, 2, GL); P(c, 70, hy - 8, '#ffffff'); P(c, 90, hy + 3, GL); P(c, 88, hy + 6, GL);
    // パン屋の白いバンダナ
    R(c, 72, hy - 13, 16, 3, '#fffdf5'); R(c, 72, hy - 11, 16, 1, '#e4ddca'); R(c, 88, hy - 12, 2, 2, '#fffdf5');
    face(c, { cx: 80, ey: hy - 3, dx: 6, eye: '#2f4f86', mouth: '#2f5a2a', brow: GD, my: hy + 6, blink: st.blink, talk: st.talk, t: st.t, blush: true }, st.expr);
  }

  // リュミエ：青い肌・ラベンダー髪のルミナ星人
  function lumie(c, st) {
    var SK = '#8fb8f0', SKS = '#6f93d8', H = '#b9a0f0', HS = '#8f74d8', HL = '#e4d8ff', SU = '#f6f5ff', SUS = '#cfcaf0';
    var b = Math.round(Math.sin(st.t / 700) * 0.6), hy = 57 + b;
    antenna(c, 74, hy - 9, 69, hy - 20, SKS, '#6fe0ff');
    antenna(c, 86, hy - 9, 91, hy - 20, SKS, '#6fe0ff');
    // 後ろ髪
    E(c, 80, hy + 1, 17, 15, HS); R(c, 63, hy + 1, 34, 14, HS); E(c, 65, hy + 15, 3, 2, HS); E(c, 95, hy + 15, 3, 2, HS);
    // 体（宇宙服ワンピース）
    poly(c, [[72, 68 + b], [88, 68 + b], [94, 87], [66, 87]], SUS);
    poly(c, [[72, 68 + b], [87, 68 + b], [91, 87], [66, 87]], SU);
    R(c, 70, 74, 20, 1, '#c9b8f6'); R(c, 79, 70 + b, 2, 16, '#c9e8ff');
    E(c, 80, 71 + b, 2, 2, '#5fd8ff'); P(c, 79, 70 + b, '#ffffff');
    E(c, 72, 80, 2, 2, SK); E(c, 88, 80, 2, 2, SK);
    R(c, 78, hy + 9, 4, 3, SKS);
    // 顔
    E(c, 80, hy, 12, 11, SK);
    // 前髪
    E(c, 80, hy - 9, 15, 5, H);
    for (var i = -12; i <= 10; i += 4) R(c, 80 + i, hy - 6, 3, 2 + ((i + 12) % 8 === 0 ? 1 : 0), H);
    R(c, 66, hy - 8, 4, 20, H); R(c, 90, hy - 8, 4, 20, H);
    // とがった耳（髪の上に出す）
    poly(c, [[68, hy], [59, hy - 5], [68, hy + 4]], SK);
    poly(c, [[92, hy], [101, hy - 5], [92, hy + 4]], SK);
    R(c, 72, hy - 11, 8, 1, HL); P(c, 71, hy - 10, HL); P(c, 86, hy - 10, HL);
    if (st.flower) { E(c, 93, hy - 10, 2, 2, '#f48fb1'); P(c, 93, hy - 10, '#fff3a0'); }
    face(c, { cx: 80, ey: hy - 3, dx: 5, eye: '#7a5fd8', brow: HS, mouth: '#6a3060', my: hy + 6, blink: st.blink, talk: st.talk, t: st.t, blush: true }, st.expr);
  }

  // ガルド：マントを着た青いトカゲ型の竜星人
  function gald(c, st) {
    var B = '#4f86d8', BS = '#3a66b0', BL = '#7fb0f0', BE = '#a8d4f8', CL = '#2e3366', CLS = '#22264d', GOLD = '#f0a830';
    var b = Math.round(Math.sin(st.t / 800) * 0.6), hy = 47 + b;
    // しっぽ
    [[106, 84, 4], [111, 82, 4], [115, 78, 3], [117, 73, 3], [116, 69, 2]].forEach(function (p) { E(c, p[0], p[1] + 1, p[2], p[2], BS); E(c, p[0], p[1], p[2], p[2], B); });
    antenna(c, 75, hy - 9, 71, hy - 19, CLS, '#f5a623');
    antenna(c, 85, hy - 9, 89, hy - 19, CLS, '#f5a623');
    // マント
    E(c, 80, 65 + b, 21, 7, CLS); R(c, 59, 65 + b, 42, 23, CLS); R(c, 61, 65 + b, 38, 23, CL);
    R(c, 76, 62 + b, 8, 26, '#1b1f40'); R(c, 76, 62 + b, 1, 26, GOLD); R(c, 83, 62 + b, 1, 26, GOLD);
    R(c, 61, 78, 38, 2, '#4a3a2a'); R(c, 78, 77, 4, 4, GOLD); P(c, 79, 78, '#1b1f40');
    R(c, 63, 55 + b, 7, 11, CL); R(c, 90, 55 + b, 7, 11, CL); R(c, 63, 55 + b, 7, 1, GOLD); R(c, 90, 55 + b, 7, 1, GOLD);
    E(c, 70, 80, 4, 3, BS); E(c, 70, 79, 4, 3, B); E(c, 90, 80, 4, 3, BS); E(c, 90, 79, 4, 3, B);
    // 頭
    E(c, 80, hy + 1, 12, 10, BS); E(c, 80, hy, 12, 10, B);
    [-6, -2, 2, 6].forEach(function (i, k) { R(c, 80 + i - 1, hy - 12 + (k % 3 === 0 ? 2 : 0), 3, 3, BL); });
    E(c, 75, hy - 6, 5, 2, BL);
    P(c, 71, hy + 1, BS); P(c, 89, hy + 1, BS); P(c, 73, hy + 4, BS); P(c, 87, hy + 4, BS);
    // 鼻づら
    E(c, 80, hy + 7, 8, 5, BS); E(c, 80, hy + 6, 8, 4, B); E(c, 80, hy + 5, 6, 2, BL);
    P(c, 77, hy + 4, CLS); P(c, 83, hy + 4, CLS);
    R(c, 75, hy + 10, 10, 2, BE);
    // 白い眉とあごひげ
    R(c, 71, hy - 5, 5, 1, '#f4f1ea'); R(c, 84, hy - 5, 5, 1, '#f4f1ea');
    R(c, 77, hy + 11, 6, 3, '#efece4'); R(c, 78, hy + 14, 4, 2, '#e1ddd2');
    face(c, { cx: 80, ey: hy - 3, dx: 6, eye: '#f5b030', slit: '#7a3a12', brow: '#f4f1ea', mouth: CLS, my: hy + 8, blink: st.blink, talk: st.talk, t: st.t }, st.expr);
  }

  var SPRITES = { slime: pururu, elf: lumie, dragon: gald };

  // ---------- 輪郭線つきで描く ----------
  var spCv, spCtx, olCv, olCtx;
  function drawOutlined(c, fn, st) {
    if (!spCv) {
      spCv = document.createElement('canvas'); spCv.width = W; spCv.height = H; spCtx = spCv.getContext('2d', { willReadFrequently: true });
      olCv = document.createElement('canvas'); olCv.width = W; olCv.height = H; olCtx = olCv.getContext('2d');
    }
    spCtx.setTransform(1, 0, 0, 1, 0, 0); spCtx.clearRect(0, 0, W, H);
    var s = st.scale || 1;
    if (s !== 1) { spCtx.translate(80, 87); spCtx.scale(s, s); spCtx.translate(-80, -87); }
    spCtx.imageSmoothingEnabled = false;
    fn(spCtx, st);
    spCtx.setTransform(1, 0, 0, 1, 0, 0);
    var src = spCtx.getImageData(0, 0, W, H).data, out = olCtx.createImageData(W, H), d = out.data;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = (y * W + x) * 4;
      if (src[i + 3] > 127) continue;
      if ((x > 0 && src[i - 1] > 127) || (x < W - 1 && src[i + 7] > 127) || (y > 0 && src[i - W * 4 + 3] > 127) || (y < H - 1 && src[i + W * 4 + 3] > 127)) {
        d[i] = 0x1f; d[i + 1] = 0x23; d[i + 2] = 0x47; d[i + 3] = 255;
      }
    }
    olCtx.putImageData(out, 0, 0);
    c.drawImage(olCv, 0, 0); c.drawImage(spCv, 0, 0);
  }

  function smoke(c, st) {
    if (st.sprite !== 'dragon' || !(st.expr === 'sad' || st.expr === 'cry' || st.expr === 'angry')) return;
    for (var i = 0; i < 3; i++) {
      var ph = ((st.t / 40) + i * 30) % 90;
      c.save(); c.globalAlpha = Math.max(0, 0.55 - ph / 160);
      E(c, 77 - ph / 9 + (i % 2) * 6, 50 - ph / 3, 1 + ph / 30, 1 + ph / 30, '#d8d8e8');
      c.restore();
    }
  }

  function render(c, st) {
    if (!bgCache || bgCache.night !== !!st.night) {
      bgCache = document.createElement('canvas'); bgCache.width = W; bgCache.height = H; bgCache.night = !!st.night;
      drawRoom(bgCache.getContext('2d'), st.night);
    }
    c.drawImage(bgCache, 0, 0);
    sofaBack(c);
    if (st.sprite && SPRITES[st.sprite] && st.visible !== false) {
      c.save();
      if (st.alpha != null) c.globalAlpha = st.alpha;
      drawOutlined(c, SPRITES[st.sprite], st);
      c.restore();
      smoke(c, st);
    }
    sofaFront(c);
    if (st.night) { c.save(); c.globalAlpha = 0.14; c.fillStyle = '#2b2f8f'; c.fillRect(0, 0, W, H); c.restore(); }
  }

  // 助手ミケ（触角つきの猫型宇宙人）24x24
  function nurse(c, t) {
    R(c, 0, 0, 24, 24, '#e9e4fb');
    var ab = ((t / 400) | 0) % 2;
    R(c, 9, 2, 1, 4, '#3f8a3a'); R(c, 14, 2, 1, 4, '#3f8a3a'); E(c, 9, 1 + ab, 1, 1, '#6fe08a'); E(c, 14, 1 + ab, 1, 1, '#6fe08a');
    poly(c, [[3, 11], [5, 2], [11, 7]], '#f0a35c'); poly(c, [[21, 11], [19, 2], [13, 7]], '#f0a35c');
    P(c, 5, 6, '#f7c2c7'); P(c, 18, 6, '#f7c2c7');
    E(c, 12, 15, 8, 7, '#ffe2c6'); E(c, 12, 9, 8, 3, '#f0a35c'); R(c, 4, 9, 3, 7, '#f0a35c'); R(c, 17, 9, 3, 7, '#f0a35c');
    var bl = (t % 2600) < 140;
    if (bl) { R(c, 7, 15, 3, 1, LINE); R(c, 14, 15, 3, 1, LINE); }
    else { R(c, 7, 13, 3, 3, '#2fb8a0'); R(c, 14, 13, 3, 3, '#2fb8a0'); R(c, 7, 12, 3, 1, LINE); R(c, 14, 12, 3, 1, LINE); P(c, 7, 13, '#ffffff'); P(c, 14, 13, '#ffffff'); }
    P(c, 11, 18, '#c26a5a'); P(c, 12, 18, '#c26a5a');
    R(c, 5, 17, 2, 1, '#f4a3a8'); R(c, 17, 17, 2, 1, '#f4a3a8');
  }

  // ---------- オープニング：宇宙とステーション ----------
  var STARS = [];
  (function () { var s = 7; function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; } for (var i = 0; i < 90; i++) STARS.push([rnd() * W, rnd() * H, rnd()]); })();
  function station(c, cx, cy, t) {
    var i, a;
    // ソーラーパネル
    R(c, cx - 44, cy - 4, 14, 8, '#3a64c8'); R(c, cx + 30, cy - 4, 14, 8, '#3a64c8');
    for (i = 0; i < 14; i += 3) { R(c, cx - 44 + i, cy - 4, 1, 8, '#6f9cf0'); R(c, cx + 30 + i, cy - 4, 1, 8, '#6f9cf0'); }
    R(c, cx - 30, cy - 1, 8, 2, '#8a90b8'); R(c, cx + 22, cy - 1, 8, 2, '#8a90b8');
    // リング（奥側）
    for (a = Math.PI; a < Math.PI * 2; a += 0.02) R(c, cx + Math.cos(a) * 30, cy + 3 + Math.sin(a) * 8, 2, 2, '#7d86c0');
    // 本体ドーム
    E(c, cx + 1, cy + 1, 15, 12, '#8f96c8'); E(c, cx, cy, 15, 12, '#d6dbf5'); E(c, cx - 4, cy - 5, 6, 3, '#f4f6ff');
    R(c, cx - 15, cy + 2, 30, 3, '#aab0dc');
    // 窓の明かり
    for (i = -12; i <= 12; i += 4) {
      var on = ((t / 900 + i * 7) | 0) % 5 !== 0;
      R(c, cx + i - 1, cy + 2, 2, 2, on ? (i % 8 === 0 ? '#7fe8ff' : '#ffe9a0') : '#5a6090');
    }
    // 診療所のピンクの窓
    E(c, cx, cy - 3, 3, 2, '#ff9ac0'); P(c, cx - 1, cy - 4, '#ffffff');
    // アンテナ
    R(c, cx, cy - 20, 1, 8, '#8a90b8'); if (((t / 600) | 0) % 2) E(c, cx, cy - 21, 1, 1, '#ff5a7e');
    // リング（手前側）
    for (a = 0; a < Math.PI; a += 0.02) R(c, cx + Math.cos(a) * 30, cy + 3 + Math.sin(a) * 8, 2, 2, '#b9c0ee');
  }
  function renderSpace(c, t, zoom) {
    R(c, 0, 0, W, 40, '#0b0d2a'); R(c, 0, 40, W, 40, '#11143b'); R(c, 0, 80, W, 40, '#171b4c');
    c.save(); c.globalAlpha = 0.22; E(c, 30, 34, 34, 14, '#7a3fb0'); E(c, 128, 70, 40, 16, '#2f63b8'); c.restore();
    STARS.forEach(function (s, i) {
      var tw = 0.5 + 0.5 * Math.sin(t / 600 + i * 1.7);
      c.save(); c.globalAlpha = 0.35 + tw * 0.65 * s[2]; P(c, s[0], s[1], i % 7 === 0 ? '#ffe9a0' : '#ffffff'); c.restore();
    });
    // 流れ星
    var ph = (t % 7000) / 7000;
    if (ph < 0.12) { var sx = 150 - ph * 900, sy = 8 + ph * 260; for (var k = 0; k < 8; k++) { c.save(); c.globalAlpha = 1 - k / 8; P(c, sx + k * 2, sy - k, '#ffffff'); c.restore(); } }
    // 大きな惑星
    E(c, 146, 122, 46, 34, '#3e3590'); E(c, 140, 116, 40, 26, '#5a4fc0'); E(c, 128, 104, 18, 6, '#7d70e0');
    c.save();
    var z = zoom || 1, bob = Math.sin(t / 1400) * 1.5;
    c.translate(80, 52 + bob); c.scale(z, z); c.translate(-80, -52);
    station(c, 80, 52, t);
    c.restore();
  }

  return { W: W, H: H, render: render, nurse: nurse, renderSpace: renderSpace };
})();
