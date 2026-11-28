// 画面の描画。絵は img/ の水彩タッチの絵（ChatGPTで作った絵を tools/make-art-restyle.py で 320x240 用に整えたもの）
var Pixel = (function () {
  var W = 320, H = 240;
  var S = 3; // 絵は S 倍の高画質（tools/make-art-restyle.py と同じ）。なめらかに縮めて描く
  var V = (document.currentScript && (document.currentScript.src.match(/\?v=\w+/) || [''])[0]) || '';
  var FACES = ['normal', 'happy', 'sad', 'surprise', 'angry', 'cry'];
  // sprite名 → 画像の名前・座ったときの下端(y)
  // bottom はソファの座面（ゲーム座標 y≈180）におしり・足先が来る高さ
  var CHARS = { slime: { name: 'pururu', bottom: 180 }, elf: { name: 'lumie', bottom: 184 }, dragon: { name: 'gald', bottom: 182, noBlink: { surprise: 1 } },
    fox: { name: 'konoha', bottom: 186 }, cat: { name: 'mii', bottom: 186 }, robot: { name: 'noa', bottom: 182, noBlink: true } };
  var img = {};
  function load(key) {
    if (img[key]) return img[key];
    var i = new Image();
    i.onload = function () { i.lw = i.naturalWidth / S; i.lh = i.naturalHeight / S; }; // ゲーム座標（320x240）での大きさ
    i.src = 'img/' + key + '.webp' + V; img[key] = i; return i;
  }
  function ready(i) { if (i && i.complete && i.naturalWidth > 0) { if (!i.lw) { i.lw = i.naturalWidth / S; i.lh = i.naturalHeight / S; } return true; } return false; }
  function smooth(c) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; }
  // 先に読みこんでおく
  ['room', 'room_night', 'space', 'logo'].forEach(load);
  ['heart', 'sparkle', 'anger', 'sweat', 'tear', 'bang'].forEach(function (k) { load('fx_' + k); });
  var BLINK = { normal: 1, sad: 1, surprise: 1 };
  function noBlink(ch, f) { return ch.noBlink === true || !!(ch.noBlink && ch.noBlink[f]); }
  Object.keys(CHARS).forEach(function (k) {
    FACES.forEach(function (f) { load(CHARS[k].name + '_' + f); if (BLINK[f] && !noBlink(CHARS[k], f)) load(CHARS[k].name + '_' + f + '_blink'); });
  });
  ['normal', 'happy', 'worry'].forEach(function (f) { load('nurse_icon_' + f); });
  // 物語に出てくる人たち（となりに登場）と、エピソードの品物、結末の1枚絵
  var COMP = { moti: { x: 214, bottom: 180, faces: ['pout', 'happy', 'weak'] }, thomas: { x: 238, bottom: 224, faces: ['smile', 'shy', 'surprise'] }, rino: { x: 232, bottom: 222, faces: ['happy', 'surprise', 'sad'] },
    mother: { x: 238, bottom: 224, faces: ['smile'] }, pipi: { x: 234, bottom: 224, faces: ['smile'] }, harumo: { x: 238, bottom: 224, faces: ['smile'], alpha: 0.85 } };
  Object.keys(COMP).forEach(function (k) { COMP[k].faces.forEach(function (f) { load(k + '_' + f); }); });
  ['bread', 'comm', 'flower', 'drawing', 'photo', 'inari', 'misanga', 'letter', 'spanner', 'musicbox'].forEach(function (k) { load('item_' + k); });
  ['end_pururu', 'end_lumie', 'end_gald', 'end_konoha', 'end_mii', 'end_noa'].forEach(load);

  function draw(c, key, x, y) { var i = load(key); if (ready(i)) c.drawImage(i, x, y, i.lw, i.lh); return i; }

  // ---------- 反応エフェクト（fx_*.webp の水彩アイコン） ----------
  // name のアイコンを、中心 (x, y)・高さ h で描く
  function icon(c, name, x, y, h, rot) {
    var i = load('fx_' + name); if (!ready(i)) return;
    var w = i.lw * h / i.lh;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.drawImage(i, -w / 2, -h / 2, w, h); c.restore();
  }
  var FX_LEN = { surprise: 900, angry: 1300, happy: 1500, sad: 1600, cry: 1600, pikiin: 800 };
  var fxList = [];
  function fx(type) {
    if (!FX_LEN[type]) return;
    var now = performance.now();
    fxList = fxList.filter(function (f) { return f.type !== type && now - f.t0 < FX_LEN[f.type]; });
    fxList.push({ type: type, t0: now });
  }
  function shakeX(now) {
    var off = 0;
    fxList.forEach(function (f) { if (f.type === 'angry' && now - f.t0 < 320) off = Math.round(Math.sin((now - f.t0) / 22) * 2); });
    return off;
  }
  // やわらかい光の粒（中心が明るく、ふちがぼける）
  function star(c, x, y, r, col) {
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  // cx, top = キャラの中心と頭のてっぺん, w・h = 幅と高さ
  function drawFx(c, cx, top, w, h) {
    var now = performance.now();
    fxList = fxList.filter(function (f) { return now - f.t0 < FX_LEN[f.type]; });
    fxList.forEach(function (f) {
      var e = now - f.t0, p = e / FX_LEN[f.type], hx = cx + w * 0.4, hy = top + 2;
      c.save();
      if (f.type === 'surprise') {
        var pop = e < 160 ? 1.3 - e / 160 * 0.3 : 1; // ぽんっと飛び出す
        c.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1;
        icon(c, 'bang', hx + 4, hy + 4, 30 * pop, 0.18);
      } else if (f.type === 'angry') {
        var k = 1 + 0.12 * Math.sin(e / 70); // どくどく脈打つ
        c.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1;
        icon(c, 'anger', hx + 2, hy + 6, 24 * k);
      } else if (f.type === 'happy') {
        for (var i = 0; i < 3; i++) {
          var q = Math.max(0, Math.min(1, (e - i * 220) / 1100));
          if (q <= 0 || q >= 1) continue;
          c.globalAlpha = q > 0.7 ? (1 - q) / 0.3 : Math.min(1, q * 6);
          icon(c, 'heart', cx + (i - 1) * w * 0.38 + Math.sin(q * 6 + i) * 3, top + 14 - q * 30, 16 + i % 2 * 4, (i - 1) * 0.25);
        }
      } else if (f.type === 'sad') {
        // 汗のしずくが、ほほをつたう
        c.globalAlpha = Math.min(1, e / 200) * (p > 0.75 ? (1 - p) * 4 : 1);
        icon(c, 'sweat', hx - 2, hy + 14 + p * 10, 18);
      } else if (f.type === 'cry') {
        // 涙のしずくが2つ、左右に落ちる
        c.globalAlpha = Math.min(1, e / 200) * (p > 0.75 ? (1 - p) * 4 : 1);
        for (var j = 0; j < 2; j++) {
          var d = ((e / 700) + j * 0.5) % 1;
          icon(c, 'tear', cx + (j ? 1 : -1) * w * 0.2, top + h * 0.4 + d * 22, 12 * (1 - d * 0.3));
        }
      } else if (f.type === 'pikiin') {
        // 画面がふわっと光り、きらきらがはじける
        if (e < 180) { c.globalAlpha = 0.5 * (1 - e / 180); c.fillStyle = '#fffbea'; c.fillRect(0, 0, W, H); }
        c.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
        var sx = cx - w * 0.42, sy = top + 4, grow = Math.min(1, e / 160);
        icon(c, 'sparkle', sx, sy, 14 + grow * 18, e / 900);
        for (var n = 0; n < 8; n++) {
          var a = n / 8 * Math.PI * 2 + 0.3, rr = 8 + p * 34;
          star(c, sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 3 + (1 - p) * 3, n % 2 ? '#ffe9a0' : '#ffd1dc');
        }
      }
      c.restore();
    });
  }

  // ガルドの、火のかわりに出る煙
  function smoke(c, st, top, h) {
    if (st.sprite !== 'dragon' || !(st.expr === 'sad' || st.expr === 'cry' || st.expr === 'angry')) return;
    for (var i = 0; i < 3; i++) {
      var ph = ((st.t / 40) + i * 30) % 90, r = 2 + ph / 18;
      c.save(); c.globalAlpha = Math.max(0, 0.5 - ph / 180); c.fillStyle = '#e4e4f0';
      c.beginPath(); c.arc(166 + (i % 2 ? 6 : -4) - ph / 6, top + h * 0.44 - ph / 2, r, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  function render(c, st) {
    smooth(c);
    var night = !!st.night;
    c.fillStyle = '#fbf3e6'; c.fillRect(0, 0, W, H);
    draw(c, night ? 'room_night' : 'room', 0, 0);
    var ch = st.sprite && CHARS[st.sprite];
    if (!ch && st.companion) drawCompanion(c, st);
    if (ch && st.visible !== false) {
      var face = FACES.indexOf(st.expr) >= 0 ? st.expr : 'normal';
      var i = load(ch.name + '_' + face);
      if (!ready(i)) i = load(ch.name + '_normal');
      // まばたき（閉じ目の絵がある表情だけ）
      if (st.blink && BLINK[face] && !noBlink(ch, face)) { var bi = load(ch.name + '_' + face + '_blink'); if (ready(bi)) i = bi; }
      if (ready(i)) {
        var t = st.t || 0;
        // 話している間は小さくはずみ、ふだんはゆっくり息をする
        var bob = st.talk ? ((t / 140) | 0) % 2 : (((t / 1100) | 0) % 2);
        var top = ch.bottom - i.lh + bob;
        c.save();
        c.globalAlpha = st.alpha != null ? st.alpha : 1;
        var cx = st.companion ? 128 : 160; // となりに誰かいるときは、少し左へ
        c.drawImage(i, cx - i.lw / 2 + (st.fx ? shakeX(performance.now()) : 0), top, i.lw, i.lh);
        c.restore();
        smoke(c, st, top, i.lh);
        if (st.companion) drawCompanion(c, st);
        if (st.fx) drawFx(c, cx, top, i.lw, i.lh);
      }
    }
    if (st.item) drawItem(c, st);
    if (st.cg) drawCg(c, st);
  }

  function drawCompanion(c, st) {
    var cp = COMP[st.companion.key]; if (!cp) return;
    var i = load(st.companion.key + '_' + (st.companion.face || cp.faces[0]));
    if (!ready(i)) i = load(st.companion.key + '_' + cp.faces[0]);
    if (!ready(i)) return;
    var t = st.t || 0, bob = st.companion.talk ? ((t / 140) | 0) % 2 : (((t / 1300) | 0) % 2);
    var a = Math.min(1, (performance.now() - (st.companion.t0 || 0)) / 400);
    c.save(); c.globalAlpha = a * (cp.alpha || 1); c.drawImage(i, cp.x - i.lw / 2, cp.bottom - i.lh + bob, i.lw, i.lh); c.restore();
  }
  // エピソードの品物を大きく見せる
  function drawItem(c, st) {
    var i = load('item_' + st.item); if (!ready(i)) return;
    var e = performance.now() - (st.itemT0 || 0), a = Math.min(1, e / 300), k = 2;
    c.save(); c.globalAlpha = 0.38 * a; c.fillStyle = '#5b4436'; c.fillRect(0, 0, W, H);
    c.globalAlpha = a;
    var w = i.lw * k, h = i.lh * k, x = 160 - w / 2, y = 108 - h / 2 + Math.sin(e / 500) * 2 - (1 - a) * 10;
    smooth(c); c.drawImage(i, x, y, w, h);
    for (var n = 0; n < 4; n++) {
      var ph = (e / 900 + n / 4) % 1, ang = n * 1.7;
      c.globalAlpha = a * (1 - Math.abs(ph - 0.5) * 2);
      star(c, 160 + Math.cos(ang) * (w * 0.6), 108 + Math.sin(ang) * (h * 0.55), 3 + ph * 3, n % 2 ? '#ffe9a0' : '#ffd1dc');
    }
    c.restore();
  }
  // 結末の1枚絵（ふわっと出す）
  function drawCg(c, st) {
    var i = load(st.cg); if (!ready(i)) return;
    c.save(); c.globalAlpha = Math.min(1, (performance.now() - (st.cgT0 || 0)) / 900); c.drawImage(i, 0, 0, W, H); c.restore();
  }

  // 予約リスト用の顔の絵。locked なら影のシルエット。絵がまだ読みこまれていなければ false
  var PORTRAIT_BG = { slime: ['#eefbe3', '#cdeebb'], elf: ['#f3eefe', '#d9cdf6'], dragon: ['#e6f1fb', '#bcd7ef'],
    fox: ['#fff1de', '#ffd6a6'], cat: ['#eef7ff', '#cfe6fb'], robot: ['#fff6e3', '#f4d7a8'] };
  function portrait(c, sprite, locked) {
    var ch = CHARS[sprite]; if (!ch) return true;
    var i = load(ch.name + '_normal'); if (!ready(i)) return false;
    var side = Math.min(i.naturalWidth, i.naturalHeight), size = c.canvas.width;
    var bg = locked ? ['#efe4d6', '#d9c8b4'] : (PORTRAIT_BG[sprite] || ['#fff8ee', '#f2e2cc']);
    var g = c.createRadialGradient(size / 2, size * 0.42, size * 0.08, size / 2, size / 2, size * 0.75);
    g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
    c.fillStyle = g; c.fillRect(0, 0, size, size);
    var tmp = document.createElement('canvas'); tmp.width = side; tmp.height = side;
    var tc = tmp.getContext('2d');
    tc.drawImage(i, Math.round((i.naturalWidth - side) / 2), 0, side, side, 0, 0, side, side);
    if (locked) { tc.globalCompositeOperation = 'source-atop'; tc.fillStyle = '#8a7462'; tc.fillRect(0, 0, side, side); }
    smooth(c);
    c.drawImage(tmp, 0, 0, side, side, 0, 0, size, size);
    return true;
  }

  // 看護師ミケの顔（56x56）。mood = normal / happy / worry
  function nurse(c, t, mood) {
    smooth(c);
    var n = c.canvas.width, i = load('nurse_icon_' + (mood || 'normal'));
    c.fillStyle = '#fff4e6'; c.fillRect(0, 0, n, n);
    if (ready(i)) c.drawImage(i, 0, 0, n, n);
  }

  // オープニング：宇宙とステーション
  var STARS = [];
  (function () { var s = 7; function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; } for (var i = 0; i < 40; i++) STARS.push([rnd() * W, rnd() * H, rnd()]); })();
  function renderSpace(c, t, zoom) {
    smooth(c);
    c.fillStyle = '#fbf3e6'; c.fillRect(0, 0, W, H);   // まわりは絵のふちと同じクリーム色（水彩のにじみで自然につながる）
    var i = load('space'), z = 0.5 * (zoom || 0.62) / 0.62;
    var x0 = 160 - 160 * z * 2, y0 = 120 + Math.sin(t / 1400) * 1.5 - 128 * z * 2, sw = W * z * 2, sh = H * z * 2;
    if (ready(i)) c.drawImage(i, x0, y0, sw, sh);
    // またたく星（絵の中の夜空の部分だけ・やわらかい光）
    STARS.forEach(function (s, k) {
      var tw = 0.5 + 0.5 * Math.sin(t / 500 + k * 1.7);
      if (tw < 0.7) return;
      var x = x0 + sw * (0.12 + s[0] / W * 0.76), y = y0 + sh * (0.12 + s[1] / H * 0.6);
      c.save(); c.globalAlpha = (tw - 0.7) / 0.3 * (0.5 + s[2] * 0.5);
      star(c, x, y, 1.5 + s[2] * 2.5, k % 5 ? '#fffaf0' : '#ffe9a0');
      c.restore();
    });
    // 流れ星（光の尾を引く）
    var ph = (t % 7000) / 7000;
    if (ph < 0.12) {
      var q = ph / 0.12, hx = x0 + sw * (0.85 - q * 0.5), hy = y0 + sh * (0.15 + q * 0.25);
      var gr = c.createLinearGradient(hx, hy, hx + 26, hy - 12);
      gr.addColorStop(0, 'rgba(255,250,230,0.95)'); gr.addColorStop(1, 'rgba(255,250,230,0)');
      c.save(); c.globalAlpha = Math.sin(q * Math.PI); c.strokeStyle = gr; c.lineWidth = 1.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 26, hy - 12); c.stroke();
      star(c, hx, hy, 3, '#fffaf0'); c.restore();
    }
  }

  return { W: W, H: H, fx: fx, portrait: portrait, render: render, nurse: nurse, renderSpace: renderSpace };
})();
