// 画面の描画。絵は img/ のドット絵（ChatGPTで作った絵を tools/make-art.py で 320x240 用に整えたもの）
var Pixel = (function () {
  var W = 320, H = 240;
  var S = 3; // 絵は S 倍の高画質（tools/make-art.py と同じ）。なめらかに縮めて描く
  var V = (document.currentScript && (document.currentScript.src.match(/\?v=\w+/) || [''])[0]) || '';
  var FACES = ['normal', 'happy', 'sad', 'surprise', 'angry', 'cry'];
  // sprite名 → 画像の名前・座ったときの下端(y)
  var CHARS = { slime: { name: 'pururu', bottom: 184 }, elf: { name: 'lumie', bottom: 170, front: true }, dragon: { name: 'gald', bottom: 188 },
    fox: { name: 'konoha', bottom: 186 }, cat: { name: 'mii', bottom: 184 }, robot: { name: 'noa', bottom: 186, noBlink: true } };
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
  ['room', 'room_night', 'room_front', 'room_night_front', 'space', 'space_tile', 'logo'].forEach(load);
  var BLINK = { normal: 1, sad: 1, surprise: 1 };
  Object.keys(CHARS).forEach(function (k) {
    FACES.forEach(function (f) { load(CHARS[k].name + '_' + f); if (BLINK[f] && !CHARS[k].noBlink) load(CHARS[k].name + '_' + f + '_blink'); });
  });
  ['normal', 'happy', 'worry'].forEach(function (f) { load('nurse_icon_' + f); });
  // 物語に出てくる人たち（となりに登場）と、エピソードの品物、結末の1枚絵
  var COMP = { moti: { x: 208, bottom: 184, faces: ['pout', 'happy', 'weak'] }, thomas: { x: 232, bottom: 216, faces: ['smile', 'shy', 'surprise'] }, rino: { x: 226, bottom: 214, faces: ['happy', 'surprise', 'sad'] },
    mother: { x: 232, bottom: 214, faces: ['smile'] }, pipi: { x: 228, bottom: 214, faces: ['smile'] }, harumo: { x: 232, bottom: 214, faces: ['smile'], alpha: 0.85 } };
  Object.keys(COMP).forEach(function (k) { COMP[k].faces.forEach(function (f) { load(k + '_' + f); }); });
  ['bread', 'comm', 'flower', 'drawing', 'photo', 'inari', 'misanga', 'letter', 'spanner', 'musicbox'].forEach(function (k) { load('item_' + k); });
  ['end_pururu', 'end_lumie', 'end_gald', 'end_konoha', 'end_mii', 'end_noa'].forEach(load);

  function draw(c, key, x, y) { var i = load(key); if (ready(i)) c.drawImage(i, x, y, i.lw, i.lh); return i; }

  // ---------- 反応エフェクト ----------
  var ICONS = {
    excl: ['.ooo.', 'oyyyo', 'oyyyo', 'oyyyo', '.oyo.', '.oyo.', '..o..', '.ooo.', 'oyyyo', '.ooo.'],
    heart: ['.oo.oo.', 'oppoppo', 'opwpppo', 'opppppo', '.opppo.', '..opo..', '...o...'],
    vein: ['.rrr.rrr.', 'rr.r.r.rr', 'r..r.r..r', 'rrr...rrr', '.........', 'rrr...rrr', 'r..r.r..r', 'rr.r.r.rr', '.rrr.rrr.']
  };
  var ICOL = { o: '#3a2430', y: '#ffd84a', p: '#ff7a9c', w: '#ffffff', r: '#e8364a' };
  function icon(c, name, x, y, k) {
    var g = ICONS[name];
    for (var j = 0; j < g.length; j++) for (var i = 0; i < g[j].length; i++) {
      var ch = g[j].charAt(i); if (ch === '.') continue;
      c.fillStyle = ICOL[ch]; c.fillRect(Math.round(x + i * k), Math.round(y + j * k), k, k);
    }
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
  function star(c, x, y, r, col) {
    c.fillStyle = col;
    c.fillRect(Math.round(x - r), Math.round(y), Math.round(r * 2 + 1), 1);
    c.fillRect(Math.round(x), Math.round(y - r), 1, Math.round(r * 2 + 1));
    var d = Math.round(r * 0.35);
    c.fillRect(Math.round(x - d), Math.round(y - d), d * 2 + 1, d * 2 + 1);
  }
  // cx, top = キャラの中心と頭のてっぺん, w = 幅
  function drawFx(c, cx, top, w) {
    var now = performance.now();
    fxList = fxList.filter(function (f) { return now - f.t0 < FX_LEN[f.type]; });
    fxList.forEach(function (f) {
      var e = now - f.t0, p = e / FX_LEN[f.type], hx = cx + w * 0.4, hy = top + 2;
      c.save();
      if (f.type === 'surprise') {
        var pop = e < 120 ? -6 + e / 20 : 0; // ぴょこっと飛び出す
        c.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1;
        icon(c, 'excl', hx, hy - 6 + pop, 3);
      } else if (f.type === 'angry') {
        var k = 3 + (((e / 160) | 0) % 2); // ぴくぴく脈打つ
        c.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1;
        icon(c, 'vein', hx - (k - 3) * 4, hy - (k - 3) * 4, k);
      } else if (f.type === 'happy') {
        for (var i = 0; i < 3; i++) {
          var q = Math.max(0, Math.min(1, (e - i * 220) / 1100));
          if (q <= 0 || q >= 1) continue;
          c.globalAlpha = q > 0.7 ? (1 - q) / 0.3 : 1;
          icon(c, 'heart', cx - 10 + (i - 1) * w * 0.36 + Math.sin(q * 6 + i) * 3, top + 8 - q * 30, 3);
        }
      } else if (f.type === 'sad' || f.type === 'cry') {
        c.globalAlpha = Math.min(1, e / 200) * (p > 0.75 ? (1 - p) * 4 : 1) * 0.85;
        c.fillStyle = '#5560c0';
        for (var j = 0; j < 4; j++) {
          var lx = cx - w * 0.3 + j * 7, ly = top - 6 + ((e / 90 + j * 3) % 6);
          for (var s = 0; s < 5; s++) c.fillRect(Math.round(lx), Math.round(ly + s * 5), 2, 3);
        }
      } else if (f.type === 'pikiin') {
        // 画面がぴかっと光り、きらきらの星がはじける
        if (e < 140) { c.globalAlpha = 0.55 * (1 - e / 140); c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); }
        c.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
        var sx = cx - w * 0.42, sy = top + 4, grow = Math.min(1, e / 160);
        star(c, sx, sy, 5 + grow * 12, '#ffe36a');
        star(c, sx, sy, 3 + grow * 6, '#ffffff');
        for (var n = 0; n < 8; n++) {
          var a = n / 8 * Math.PI * 2 + 0.3, rr = 8 + p * 34;
          star(c, sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 2 + (1 - p) * 2, n % 2 ? '#ffe36a' : '#ffffff');
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
    c.fillStyle = '#e9e4fb'; c.fillRect(0, 0, W, H);
    draw(c, night ? 'room_night' : 'room', 0, 0);
    var ch = st.sprite && CHARS[st.sprite];
    if (!ch && st.companion) drawCompanion(c, st);
    if (ch && st.visible !== false) {
      var face = FACES.indexOf(st.expr) >= 0 ? st.expr : 'normal';
      var i = load(ch.name + '_' + face);
      if (!ready(i)) i = load(ch.name + '_normal');
      // まばたき（閉じ目の絵がある表情だけ）
      if (st.blink && BLINK[face] && !ch.noBlink) { var bi = load(ch.name + '_' + face + '_blink'); if (ready(bi)) i = bi; }
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
        if (ch.front) draw(c, night ? 'room_night_front' : 'room_front', 0, 0);
        smoke(c, st, top, i.lh);
        if (st.companion) drawCompanion(c, st);
        if (st.fx) drawFx(c, cx, top, i.lw);
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
    c.save(); c.globalAlpha = 0.45 * a; c.fillStyle = '#1a1640'; c.fillRect(0, 0, W, H);
    c.globalAlpha = a;
    var w = i.lw * k, h = i.lh * k, x = 160 - w / 2, y = 108 - h / 2 + Math.sin(e / 500) * 2 - (1 - a) * 10;
    smooth(c); c.drawImage(i, x, y, w, h);
    for (var n = 0; n < 4; n++) {
      var ph = (e / 900 + n / 4) % 1, ang = n * 1.7;
      c.globalAlpha = a * (1 - Math.abs(ph - 0.5) * 2);
      star(c, 160 + Math.cos(ang) * (w * 0.6), 108 + Math.sin(ang) * (h * 0.55), 2 + ph * 2, n % 2 ? '#ffe36a' : '#ffffff');
    }
    c.restore();
  }
  // 結末の1枚絵（ふわっと出す）
  function drawCg(c, st) {
    var i = load(st.cg); if (!ready(i)) return;
    c.save(); c.globalAlpha = Math.min(1, (performance.now() - (st.cgT0 || 0)) / 900); c.drawImage(i, 0, 0, W, H); c.restore();
  }

  // 予約リスト用の顔の絵。locked なら黒いシルエット。絵がまだ読みこまれていなければ false
  var PORTRAIT_BG = { slime: ['#d9f5d0', '#b7e6a8'], elf: ['#e6defa', '#cbbcf2'], dragon: ['#2d3270', '#1e2250'],
    fox: ['#ffe3c2', '#ffcf99'], cat: ['#dff0ff', '#c2e0fb'], robot: ['#232a4f', '#171c3a'] };
  function portrait(c, sprite, locked) {
    var ch = CHARS[sprite]; if (!ch) return true;
    var i = load(ch.name + '_normal'); if (!ready(i)) return false;
    var side = Math.min(i.naturalWidth, i.naturalHeight), size = c.canvas.width;
    var bg = PORTRAIT_BG[sprite] || ['#eee', '#ddd'];
    c.fillStyle = locked ? '#4a3d66' : bg[0]; c.fillRect(0, 0, size, size);
    c.fillStyle = locked ? '#3a2f55' : bg[1];
    for (var y = 0; y < size; y += 8) for (var x = (y / 8) % 2 ? 4 : 0; x < size; x += 8) c.fillRect(x, y, 4, 4);
    var tmp = document.createElement('canvas'); tmp.width = side; tmp.height = side;
    var tc = tmp.getContext('2d');
    tc.drawImage(i, Math.round((i.naturalWidth - side) / 2), 0, side, side, 0, 0, side, side);
    if (locked) { tc.globalCompositeOperation = 'source-atop'; tc.fillStyle = '#1b1530'; tc.fillRect(0, 0, side, side); }
    smooth(c);
    c.drawImage(tmp, 0, 0, side, side, 0, 0, size, size);
    return true;
  }

  // 看護師ミケの顔（56x56）。mood = normal / happy / worry
  function nurse(c, t, mood) {
    smooth(c);
    var n = c.canvas.width, i = load('nurse_icon_' + (mood || 'normal'));
    c.fillStyle = '#e9e4fb'; c.fillRect(0, 0, n, n);
    if (ready(i)) c.drawImage(i, 0, 0, n, n);
  }

  // オープニング：宇宙とステーション
  var STARS = [];
  (function () { var s = 7; function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; } for (var i = 0; i < 40; i++) STARS.push([rnd() * W, rnd() * H, rnd()]); })();
  function renderSpace(c, t, zoom) {
    smooth(c);
    c.fillStyle = '#0b0d2a'; c.fillRect(0, 0, W, H);
    var i = load('space');
    if (ready(i)) {
      // 縦長の画面でもステーション全体が入るよう引きで描き、まわりは星空を鏡うつしで敷きつめる
      var z = 0.5 * (zoom || 0.62) / 0.62, cx = 160, cy = 120 + Math.sin(t / 1400) * 1.5;
      c.save(); c.translate(cx, cy); c.scale(z, z); c.translate(-160, -112);
      var tile = load('space_tile'), th = 40;
      if (ready(tile)) for (var ty = -12; ty <= 14; ty++) for (var tx = -2; tx <= 2; tx++) {
        c.save(); c.translate(tx * W + (tx & 1 ? W : 0), ty * th + (ty & 1 ? th : 0));
        c.scale(tx & 1 ? -1 : 1, ty & 1 ? -1 : 1); c.drawImage(tile, 0, 0, W, th); c.restore();
      }
      c.drawImage(i, 0, 0, W, H);
      c.restore();
    }
    // またたく星
    STARS.forEach(function (s, k) {
      var tw = 0.5 + 0.5 * Math.sin(t / 500 + k * 1.7);
      if (tw < 0.75) return;
      c.save(); c.globalAlpha = (tw - 0.75) * 4 * s[2]; c.fillStyle = k % 5 ? '#ffffff' : '#fff3a8';
      c.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1);
      if (s[2] > 0.7) { c.fillRect(Math.round(s[0]) - 1, Math.round(s[1]), 3, 1); c.fillRect(Math.round(s[0]), Math.round(s[1]) - 1, 1, 3); }
      c.restore();
    });
    // 流れ星
    var ph = (t % 7000) / 7000;
    if (ph < 0.12) { var sx = 300 - ph * 1800, sy = 16 + ph * 520; for (var q = 0; q < 14; q++) { c.save(); c.globalAlpha = 1 - q / 14; c.fillStyle = '#fff'; c.fillRect(Math.round(sx + q * 2), Math.round(sy - q), 1, 1); c.restore(); } }
  }

  return { W: W, H: H, fx: fx, portrait: portrait, render: render, nurse: nurse, renderSpace: renderSpace };
})();
