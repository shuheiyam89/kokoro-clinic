// 画面の描画。絵は img/ のドット絵（ChatGPTで作った絵を tools/make-art.py で 320x240 用に整えたもの）
var Pixel = (function () {
  var W = 320, H = 240;
  var V = (document.currentScript && (document.currentScript.src.match(/\?v=\w+/) || [''])[0]) || '';
  var FACES = ['normal', 'happy', 'sad', 'surprise', 'angry', 'cry'];
  // sprite名 → 画像の名前・座ったときの下端(y)
  var CHARS = { slime: { name: 'pururu', bottom: 184 }, elf: { name: 'lumie', bottom: 170, front: true }, dragon: { name: 'gald', bottom: 188 } };
  var img = {};
  function load(key) {
    if (img[key]) return img[key];
    var i = new Image(); i.src = 'img/' + key + '.png' + V; img[key] = i; return i;
  }
  function ready(i) { return i && i.complete && i.naturalWidth > 0; }
  // 先に読みこんでおく
  ['room', 'room_night', 'room_front', 'room_night_front', 'space', 'space_tile', 'logo'].forEach(load);
  var BLINK = { normal: 1, sad: 1, surprise: 1 };
  Object.keys(CHARS).forEach(function (k) {
    FACES.forEach(function (f) { load(CHARS[k].name + '_' + f); if (BLINK[f]) load(CHARS[k].name + '_' + f + '_blink'); });
  });
  ['normal', 'happy', 'worry'].forEach(function (f) { load('nurse_icon_' + f); });

  function draw(c, key, x, y) { var i = load(key); if (ready(i)) c.drawImage(i, Math.round(x), Math.round(y)); return i; }

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
    var night = !!st.night;
    c.fillStyle = '#e9e4fb'; c.fillRect(0, 0, W, H);
    draw(c, night ? 'room_night' : 'room', 0, 0);
    var ch = st.sprite && CHARS[st.sprite];
    if (ch && st.visible !== false) {
      var face = FACES.indexOf(st.expr) >= 0 ? st.expr : 'normal';
      var i = load(ch.name + '_' + face);
      if (!ready(i)) i = load(ch.name + '_normal');
      // まばたき（閉じ目の絵がある表情だけ）
      if (st.blink && BLINK[face]) { var bi = load(ch.name + '_' + face + '_blink'); if (ready(bi)) i = bi; }
      if (ready(i)) {
        var t = st.t || 0;
        // 話している間は小さくはずみ、ふだんはゆっくり息をする
        var bob = st.talk ? ((t / 140) | 0) % 2 : (((t / 1100) | 0) % 2);
        var top = ch.bottom - i.height + bob;
        c.save();
        c.globalAlpha = st.alpha != null ? st.alpha : 1;
        c.drawImage(i, Math.round(160 - i.width / 2), Math.round(top));
        c.restore();
        if (ch.front) draw(c, night ? 'room_night_front' : 'room_front', 0, 0);
        smoke(c, st, top, i.height);
      }
    }
  }

  // 看護師ミケの顔（56x56）。mood = normal / happy / worry
  function nurse(c, t, mood) {
    c.clearRect(0, 0, 56, 56);
    c.fillStyle = '#e9e4fb'; c.fillRect(0, 0, 56, 56);
    draw(c, 'nurse_icon_' + (mood || 'normal'), 0, 0);
  }

  // オープニング：宇宙とステーション
  var STARS = [];
  (function () { var s = 7; function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; } for (var i = 0; i < 40; i++) STARS.push([rnd() * W, rnd() * H, rnd()]); })();
  function renderSpace(c, t, zoom) {
    c.fillStyle = '#0b0d2a'; c.fillRect(0, 0, W, H);
    var i = load('space');
    if (ready(i)) {
      // 縦長の画面でもステーション全体が入るよう引きで描き、まわりは星空を鏡うつしで敷きつめる
      var z = 0.5 * (zoom || 0.62) / 0.62, cx = 160, cy = 120 + Math.sin(t / 1400) * 1.5;
      c.save(); c.translate(cx, cy); c.scale(z, z); c.translate(-160, -112);
      var tile = load('space_tile'), th = 40;
      if (ready(tile)) for (var ty = -12; ty <= 14; ty++) for (var tx = -2; tx <= 2; tx++) {
        c.save(); c.translate(tx * W + (tx & 1 ? W : 0), ty * th + (ty & 1 ? th : 0));
        c.scale(tx & 1 ? -1 : 1, ty & 1 ? -1 : 1); c.drawImage(tile, 0, 0); c.restore();
      }
      c.drawImage(i, 0, 0);
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

  return { W: W, H: H, render: render, nurse: nurse, renderSpace: renderSpace };
})();
