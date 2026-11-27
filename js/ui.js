// 画面まわり
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var SAVE_KEY = 'kokoro_clinic_v1';
  var save = load();
  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { cleared: {} }; } catch (e) { return { cleared: {} }; } }
  function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  if (!save.cleared) save.cleared = {};
  if (!save.stars) save.stars = {};
  // 文字サイズ（大きくすると、会話・候補ボタン・入力欄の字が大きくなる）
  function applyFont() {
    document.body.classList.toggle('bigtext', !!save.big);
    var b = document.getElementById('btn-font'); if (b) b.textContent = '🔠 文字：' + (save.big ? '大きい' : 'ふつう');
  }
  applyFont();
  document.getElementById('btn-font').onclick = function () { save.big = !save.big; store(); applyFont(); };

  // ---------- スマホの画面高さ（キーボード対応） ----------
  var app = $('app');
  function fitHeight() {
    var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    app.style.setProperty('--app-h', h + 'px');
    var focused = document.activeElement === $('inp');
    app.classList.toggle('kb', focused && (h < window.innerHeight * 0.8 || h < 480));
    window.scrollTo(0, 0);
    sizeCanvases();
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitHeight);
  window.addEventListener('resize', fitHeight);

  // ---------- BGM ----------
  function updateMusicBtns() {
    document.querySelectorAll('.music-btn').forEach(function (b) { b.classList.toggle('off', BGM.isMuted()); });
  }
  document.querySelectorAll('.music-btn').forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); BGM.setMuted(!BGM.isMuted()); updateMusicBtns(); });
  });
  updateMusicBtns();
  function music() { if (!BGM.isMuted()) BGM.start(); }

  // ---------- キャンバス ----------
  var cvScene = $('cv-scene'), cvTitle = $('cv-title'), cvNurse = $('cv-nurse'), cvOp = $('cv-op');
  function sizeCanvas(cv) {
    var dpr = window.devicePixelRatio || 1;
    var cssW = cv.parentNode.clientWidth || 360;
    var k = Math.max(1, Math.min(4, cssW * dpr / Pixel.W));
    var cw = Math.round(Pixel.W * k), ch = Math.round(Pixel.H * k);
    if (cv.width !== cw) { cv.width = cw; cv.height = ch; }
    var c = cv.getContext('2d'); c.setTransform(cw / Pixel.W, 0, 0, ch / Pixel.H, 0, 0);
    return c;
  }
  var ctxScene, ctxTitle, ctxOp;
  function sizeCanvases() { ctxScene = sizeCanvas(cvScene); ctxTitle = sizeCanvas(cvTitle); ctxOp = sizeCanvas(cvOp); }

  // 看護師ミケの表情：言葉の調子で選ぶ
  var nurseMood = 'normal';
  function moodOf(t) {
    if (/おしい|まだ|大丈夫|気をつけ|怒|帰って/.test(t)) return 'worry';
    if (/！/.test(t) && !/？/.test(t)) return 'happy';
    return 'normal';
  }
  // 手がかりが出たときの「ピキーン」（同じ瞬間に2回鳴らさない）
  var lastPikiin = 0;
  function pikiin() {
    var now = Date.now(); if (now - lastPikiin < 600) return; lastPikiin = now;
    Pixel.fx('pikiin'); BGM.sfx('pikiin');
  }
  var reactNext = false, lastFace = 'normal', trustAtSpeak = 0;
  var scene = { fx: true, sprite: null, expr: 'normal', talk: false, blink: false, t: 0, alpha: 1, scale: 1 };
  var nextBlink = 2000, blinkEnd = 0;
  function active(id) { return $(id).classList.contains('active'); }
  function loop(ts) {
    scene.t = ts;
    if (ts > nextBlink) { blinkEnd = ts + 130; nextBlink = ts + 2200 + Math.random() * 2500; }
    scene.blink = ts < blinkEnd;
    if (active('scr-session')) {
      if (scene.fade) { scene.alpha += scene.fade; if (scene.alpha >= 1) { scene.alpha = 1; scene.fade = 0; } if (scene.alpha <= 0) { scene.alpha = 0; scene.fade = 0; } }
      Pixel.render(ctxScene, scene);
      if (cvNurse.offsetParent) Pixel.nurse(cvNurse.getContext('2d'), ts, nurseMood);
    }
    var opN = $('cv-op-nurse'); if (opN && opN.offsetParent) Pixel.nurse(opN.getContext('2d'), ts, 'happy'); else if (active('scr-title')) {
      var p = PATIENTS[((ts / 3500) | 0) % PATIENTS.length];
      Pixel.render(ctxTitle, { sprite: p.sprite, expr: 'happy', t: ts, blink: scene.blink, scale: 1 });
    } else if (active('scr-opening')) {
      var op = OPENING[Math.min(opIdx, OPENING.length - 1)], el = ts - opStart;
      if (op.scene === 'room') Pixel.render(ctxOp, { sprite: null, t: ts });
      else if (op.scene === 'near') Pixel.renderSpace(ctxOp, ts, Math.min(1.7, 0.75 + el / 3000));
      else Pixel.renderSpace(ctxOp, ts, 0.62 + Math.min(0.12, el / 30000));
    }
    requestAnimationFrame(loop);
  }

  function show(id) {
    if (id !== 'scr-session') BGM.setTheme('default'); // 診察室の外では、いつもの曲
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    setTimeout(fitHeight, 0);
  }

  // ---------- モーダル ----------
  var modalOnClose = null;
  function openModal(html, closeLabel, onClose) {
    $('modal-body').innerHTML = html;
    $('modal-close').textContent = closeLabel || 'とじる';
    modalOnClose = onClose || null;
    $('modal').classList.add('open');
  }
  $('modal-close').onclick = function () {
    $('modal').classList.remove('open');
    var f = modalOnClose; modalOnClose = null; if (f) f();
  };
  // ---------- ♥と💢の説明 ----------
  function metersHelp() {
    return '<h4><span style="color:#ff5a7e">♥</span> 信頼度（5つまで）</h4><p>患者があなたをどれだけ信頼しているか。気持ちに寄り添う言葉や、相手の誇りを認める言葉で上がり、きつい言い方で下がります。<b>信頼が足りないと、心の奥の話はしてくれません。</b></p>' +
      '<h4>💢 怒りメーター</h4><p>患者が嫌だと感じる言い方をするとたまります。<b>満タンになると怒って帰ってしまいます</b>（真実を打ち明けたあとは帰りません）。謝ったり寄り添ったりすると、少し下がります。</p>';
  }
  $('s-meters').onclick = function () { openModal('<h3>メーターの見かた</h3>' + metersHelp()); };

  // ---------- スコア・記録 ----------
  // クリア1000点＋エピソード1つ300点＋信頼♥1つ100点＋質問が少ないほど最大600点－怒り1つ100点－ヒント1回100点
  function scoreOf(p, st, g) {
    var rt = Engine.route(p, st), asked = g.asked || 0, hints = g.hints || 0;
    var parts = [
      ['クリア', 1000],
      ['エピソード ' + rt.found + '個', rt.found * 300],
      ['信頼度 ♥' + st.trust, st.trust * 100],
      ['質問 ' + asked + '回', Math.max(0, 30 - asked) * 20],
      ['怒り 💢' + (st.anger || 0), -(st.anger || 0) * 100],
      ['ヒント ' + hints + '回', -hints * 100]
    ];
    var total = Math.max(0, parts.reduce(function (a, x) { return a + x[1]; }, 0));
    var rank = total >= 2700 ? 'S' : total >= 2200 ? 'A' : total >= 1700 ? 'B' : 'C';
    return { total: total, rank: rank, parts: parts, route: rt };
  }
  function record(p, sc) {
    save.records = save.records || {};
    var r = save.records[p.id] || { best: 0, rank: '', clears: 0, routes: {} };
    r.clears++; r.routes[sc.route.key] = sc.route.name;
    var isBest = sc.total > r.best;
    if (isBest) { r.best = sc.total; r.rank = sc.rank; r.found = sc.route.found; r.total = sc.route.total; }
    save.records[p.id] = r; store();
    return isBest;
  }
  function openRecords() {
    var recs = save.records || {}, sum = 0;
    var rows = PATIENTS.map(function (p, i) {
      var r = recs[p.id];
      if (!r) return '<div class="rec locked"><b>' + (unlocked(i) ? esc(p.name) : '？？？') + '</b><span>まだクリアしていません</span></div>';
      sum += r.best;
      var ends = ['normal', 'good', 'best'].map(function (k, j) { return '<span class="end' + (r.routes[k] ? ' got' : '') + '">' + '★'.repeat(j + 1) + (r.routes[k] ? '「' + esc(r.routes[k]) + '」' : '？') + '</span>'; }).join('');
      return '<div class="rec"><b>' + esc(p.name) + '</b><span class="rank r' + r.rank + '">' + r.rank + '</span><span class="pts">' + r.best + '点</span>' +
        '<div class="ends">' + ends + '</div><small>クリア ' + r.clears + '回　エピソード最高 ' + (r.found || 0) + ' / ' + (r.total || 2) + '</small></div>';
    }).join('');
    openModal('<h3>🏆 記録</h3>' + rows + '<p class="rec-sum">合計スコア <b>' + sum + '</b> 点</p><p class="rec-note">スコアは、クリア＋見つけたエピソード＋信頼度＋質問の少なさ。怒らせたりヒントを使ったりすると下がります。</p>');
  }
  $('btn-records').onclick = openRecords;
  $('btn-records2').onclick = openRecords;

  // ---------- クリア画面のシェア ----------
  var SHARE_URL = 'https://shuheiyam89.github.io/kokoro-clinic/';
  var STARS = { normal: 1, good: 2, best: 3 };
  function shareText(p, sc) {
    return '「こころ診療所」で' + p.name + 'の悩みを解決！ ' + '★'.repeat(STARS[sc.route.key]) + ' エンディング「' + sc.route.name + '」 スコア' + sc.total + '点（' + sc.rank + 'ランク）';
  }
  function shareImage(p, sc, cb) {
    var W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'), sc2 = document.createElement('canvas'); sc2.width = Pixel.W * 4; sc2.height = Pixel.H * 4;
    var s2 = sc2.getContext('2d'); s2.setTransform(4, 0, 0, 4, 0, 0);
    var cg = sc.route.key === 'best' ? 'end_' + p.id : null;
    Pixel.render(s2, { sprite: p.sprite, expr: 'happy', t: 0, alpha: 1, night: (p.night || p.id === 'gald'), cg: cg, cgT0: -1e9 });
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(sc2, 0, 120, 1280, 672, 0, 0, W, 630);
    var gr = x.createLinearGradient(0, 330, 0, H);
    gr.addColorStop(0, 'rgba(255,246,232,0)'); gr.addColorStop(0.35, 'rgba(255,246,232,.9)'); gr.addColorStop(1, 'rgba(255,246,232,.97)');
    x.fillStyle = gr; x.fillRect(0, 330, W, H - 330);
    var font = "bold 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', sans-serif";
    x.textAlign = 'center'; x.fillStyle = '#c0603a'; x.font = font.replace('bold', 'bold 58px');
    x.fillText(p.name + 'の悩みを解決！', W / 2, 470);
    x.fillStyle = '#5a3a28'; x.font = font.replace('bold', 'bold 36px');
    x.fillText('★'.repeat(STARS[sc.route.key]) + '  エンディング「' + sc.route.name + '」', W / 2, 530);
    x.fillStyle = '#e0803a'; x.font = font.replace('bold', 'bold 38px');
    x.fillText('スコア ' + sc.total + ' 点　' + sc.rank + 'ランク', W / 2, 590);
    var logo = new Image();
    logo.onload = function () { x.drawImage(logo, 24, 18, 300, Math.round(logo.height * 300 / logo.width)); done(); };
    logo.onerror = done; logo.src = 'img/logo.png?v=' + (window.V || '');
    function done() { c.toBlob(function (b) { cb(b, c.toDataURL('image/png')); }, 'image/png'); }
  }
  function shareResult(p, sc, after) {
    var text = shareText(p, sc), NL = String.fromCharCode(10);
    shareImage(p, sc, function (blob, url) {
      var file = blob && window.File ? new File([blob], 'kokoro-clinic.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: text + NL + SHARE_URL }).catch(function () {});
        return;
      }
      // 画像つきで共有できない端末：画像を見せて、X・LINE・リンクのコピーを選べるようにする
      var enc = encodeURIComponent;
      openModal('<div class="share"><h3>📣 シェアする</h3><img src="' + url + '" alt="クリア画面"><p class="share-note">画像は長押し（右クリック）で保存できます</p>' +
        '<a class="btn" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + enc(text) + '&url=' + enc(SHARE_URL) + '">Xでシェア</a>' +
        '<a class="btn" target="_blank" rel="noopener" href="https://line.me/R/share?text=' + enc(text + NL + SHARE_URL) + '">LINEで送る</a>' +
        '<button class="btn ghost" id="share-copy">文とリンクをコピー</button></div>', 'とじる', after);
      $('share-copy').onclick = function () {
        var t = text + NL + SHARE_URL;
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $('share-copy').textContent = 'コピーしました！'; }, function () { prompt('コピーしてください', t); });
      };
    });
  }

  // ---------- テストプレイの感想 ----------
  var FB_URL = 'https://kokoro-clinic-api.netlify.app/api/feedback';
  var FB_MAIL = 'kokoroclinic.game@gmail.com'; // 感想・お問い合わせのメールアドレス
  function mailLink() {
    return '<a href="mailto:' + FB_MAIL + '?subject=' + encodeURIComponent('こころ診療所の感想') + '">' + FB_MAIL + '</a>';
  }
  function fbButton() { return '<p class="fb-row"><button class="btn ghost fb-open">📝 感想を送る</button></p>'; }
  function hookFeedback(ctx) {
    var b = document.querySelector('#modal-body .fb-open');
    if (b) b.onclick = function () { openFeedback(ctx); };
  }
  function openFeedback(ctx) {
    ctx = ctx || {};
    var rating = 0;
    openModal('<div class="fb"><h3>📝 感想を送る</h3><p class="fb-lead">テストプレイありがとうございます！ 気づいたことを、なんでも教えてください。</p>' +
      '<div class="fb-stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button data-n="' + n + '">☆</button>'; }).join('') + '</div>' +
      '<textarea id="fb-text" maxlength="1000" rows="5" placeholder="よかったところ、わかりにくかったところ、こまったところ、ふしぎな返事をされた場面…"></textarea>' +
      '<button class="btn" id="fb-send">送る</button><p class="fb-note">送られるのは、この感想・評価・遊んでいた場面・端末の種類だけです。</p><p id="fb-msg"></p>' +
      '<p class="fb-mail">📮 メールでも受け付けています<br>' + mailLink() + '</p></div>',
      'とじる', ctx.after);
    var stars = document.querySelectorAll('.fb-stars button');
    Array.prototype.forEach.call(stars, function (s) {
      s.onclick = function () {
        rating = +s.getAttribute('data-n');
        Array.prototype.forEach.call(stars, function (x) { x.textContent = +x.getAttribute('data-n') <= rating ? '★' : '☆'; });
      };
    });
    $('fb-send').onclick = function () {
      var text = $('fb-text').value.trim();
      if (!text && !rating) { $('fb-msg').textContent = '星をえらぶか、感想を書いてください。'; return; }
      $('fb-send').disabled = true; $('fb-msg').textContent = '送っています…';
      fetch(FB_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, rating: rating, where: ctx.where || '', patient: ctx.patient || '', result: ctx.result || '', version: window.V || '' }) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); })
        .then(function () { $('modal-body').innerHTML = '<div class="result"><h3>ありがとうございました！</h3><p>感想を受け取りました。<br>これからのゲームづくりに役立てます。</p></div>'; })
        .catch(function () { $('fb-send').disabled = false; $('fb-msg').textContent = 'うまく送れませんでした。少し時間をおいて、もう一度お願いします。'; });
    };
  }
  $('btn-feedback').onclick = function () { openFeedback({ where: 'タイトル' }); };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- タイトル ----------
  $('btn-start').onclick = function () {
    music();
    buildList(); show('scr-select');
  };
  $('btn-opening').onclick = function () { music(); startOpening(); };
  $('btn-howto').onclick = function () {
    openModal('<h3>あそびかた</h3><ol class="howto">' +
      '<li>あなたは宇宙ステーションの「こころ診療所」のカウンセラー。いろいろな星の患者が悩みを話しにきます。</li>' +
      '<li>会話は自動で進みます。画面の会話欄をタップすると次のセリフへ。</li>' +
      '<li><b>💭のところで、あなたが質問を入力</b>します。自分の言葉でOK！（最初の患者プルルのときだけ、何を聞けばいいかが💭に出ます）</li>' +
      '<li>患者は何かを<b>隠しています</b>。📋カルテの記述や、話の中の言いよどみがヒントです。</li>' +
      '<li>さいごに、隠している真実を言いあて、背中を押す言葉をかけたらクリア！</li>' +
      '<li>文字を打つのが大変なときは、入力欄の上の<b>候補ボタン</b>をタップ。赤い字の言葉について聞いたり、真実を言うときに言葉を足したりできます。</li><li>困ったら💡ヒント（1回目は考え方、2回目は言い方の例）。使うとスコアは少し下がります。</li><li>気になったことを自由に聞くと「エピソード」が起きて、結末が変わることも。</li><li>赤い字は大事な手がかり。</li></ol>' + metersHelp() + '<h4>📮 感想・お問い合わせ</h4><p>' + mailLink() + '</p>');
  };

  // ---------- オープニング ----------
  var OPENING = [
    { scene: 'space', text: '銀河のはずれに浮かぶ、宇宙ステーション「ハルモニア」。' },
    { scene: 'space', text: 'いくつもの星から、旅人や商人や、ちょっと変わった住人たちが集まる場所。' },
    { scene: 'near', text: 'その片すみに、小さな診療所がある。' },
    { scene: 'room', text: 'あなたは、ここでただひとりの——\n宇宙の、こころのカウンセラー。' },
    { scene: 'room', text: '種族も、星も、ことばもちがう患者たちが、今日も悩みを抱えて来院する。' },
    { scene: 'room', text: 'けれど彼らは、本当の悩みを心の奥に隠している。' },
    { scene: 'room', text: '話を聞き、カルテを読み、隠された真実を見つけ出す。\nそして、そっと背中を押す。' },
    { scene: 'room', text: 'それが、あなたの仕事だ。' },
    { scene: 'room', who: 'nurse', text: 'おはようございます、先生！ 今日も予約が入っていますよ。' },
    { scene: 'room', who: 'nurse', text: '会話の💭のところで、先生の言葉で質問してくださいね。さあ、診察をはじめましょう！' }
  ];
  var opIdx = 0, opStart = 0, opTyping = null;
  function startOpening() { opIdx = 0; show('scr-opening'); showOp(); }
  function showOp() {
    var op = OPENING[opIdx], el = $('op-text'), i = 0;
    if (!op) return endOpening();
    if (opIdx === 0 || OPENING[opIdx - 1].scene !== op.scene) opStart = performance.now();
    $('op-box').className = 'op-box' + (op.who ? ' ' + op.who : '');
    el.textContent = '';
    clearInterval(opTyping);
    opTyping = setInterval(function () { i++; el.textContent = op.text.slice(0, i); if (i >= op.text.length) { clearInterval(opTyping); opTyping = null; } }, 55);
  }
  function endOpening() { clearInterval(opTyping); opTyping = null; opIdx = OPENING.length; show('scr-title'); }
  var lastOpTap = 0;
  $('scr-opening').addEventListener('click', function () {
    var now = Date.now();
    if (now - lastOpTap < 250) return;
    lastOpTap = now;
    music();
    if (opTyping) { clearInterval(opTyping); opTyping = null; $('op-text').textContent = OPENING[opIdx].text; return; }
    opIdx++; showOp();
  });
  $('btn-skip').addEventListener('click', function (e) { e.stopPropagation(); music(); endOpening(); });

  // ---------- 予約リスト ----------
  $('btn-sel-back').onclick = function () { show('scr-title'); };
  // 物語の上で予約が入っているか（前の患者をクリア）。課金のロックとは別に数える
  function reached(i) { return i === 0 || !!save.cleared[PATIENTS[i - 1].id] || !!save.cleared[PATIENTS[i].id]; }
  function unlocked(i) { return reached(i) && !Paywall.locked(i); }

  // ---------- 開放画面（課金ゲート。Play版だけ） ----------
  function openPaywall(after) {
    var rest = PATIENTS.length - Paywall.free;
    openModal('<div class="result paywall"><h3>🔓 続きの患者さんを開放</h3>' +
      '<p>ここまで遊んでくれてありがとうございます！<br>' + (Paywall.free + 1) + '人目〜' + PATIENTS.length + '人目の患者さん（' + rest + '人）の悩みを聞くには、開放が必要です。</p>' +
      '<p class="big">' + Paywall.price + '（税込）・買い切り</p>' +
      '<ul class="pw-points"><li>一度買えば、残りの患者さん' + rest + '人が全員開きます</li><li>追加の支払い・広告・月額料金はありません</li><li>機種変更のときは「購入を復元」で戻せます</li></ul>' +
      '<p class="fb-row"><button class="btn" id="pw-buy">' + Paywall.price + 'で開放する</button></p>' +
      '<p class="fb-row"><button class="btn ghost" id="pw-restore">購入を復元</button></p>' +
      '<p id="pw-msg" class="small"></p></div>', 'あとで', after);
    function done(ok, failMsg) {
      if (ok) {
        $('modal-body').innerHTML = '<div class="result"><h3>開放しました！</h3><p>' + (Paywall.free + 1) + '人目からの患者さんが、予約リストに入りました。</p></div>';
      } else { $('pw-msg').textContent = failMsg; $('pw-buy').disabled = false; $('pw-restore').disabled = false; }
    }
    $('pw-buy').onclick = function () {
      $('pw-buy').disabled = true; $('pw-restore').disabled = true;
      Paywall.buy().then(function (ok) { done(ok, '購入は完了していません。'); }, function () { done(false, 'うまく購入できませんでした。少し時間をおいて、もう一度お願いします。'); });
    };
    $('pw-restore').onclick = function () {
      $('pw-buy').disabled = true; $('pw-restore').disabled = true;
      Paywall.restore().then(function (ok) { done(ok, '購入の記録が見つかりませんでした。'); }, function () { done(false, '復元できませんでした。通信できる場所でもう一度お願いします。'); });
    };
  }
  var listRetry = 0;
  function buildList() {
    var ul = $('patient-list'), allReady = true; ul.innerHTML = '';
    PATIENTS.forEach(function (p, i) {
      var li = document.createElement('li'), open = unlocked(i), paid = reached(i) && Paywall.locked(i);
      if (!open) li.className = 'locked' + (paid ? ' paid' : '');
      var cv = document.createElement('canvas'); cv.width = 96; cv.height = 96;
      if (!Pixel.portrait(cv.getContext('2d'), p.sprite, !open)) allReady = false; // 患者ごとの顔（予約前はシルエット）
      li.appendChild(cv);
      var chief = p.karte.filter(function (k) { return k[0] === '主訴'; })[0][1];
      var info = document.createElement('div'); info.className = 'info';
      info.innerHTML = open
        ? '<b>' + esc(p.name) + '</b>（' + esc(p.species) + '）<br>「' + esc(chief) + '」<br><span class="stars">' + '★'.repeat(p.difficulty) + '☆'.repeat(3 - p.difficulty) + '</span>'
        : Paywall.locked(i)
          ? '<b>？？？</b><br>🔒 ' + Paywall.price + '（買い切り）で' + (Paywall.free + 1) + '人目以降が全員開きます'
          : '<b>？？？</b><br>前の患者の悩みを解決すると予約が入ります';
      li.appendChild(info);
      if (save.cleared[p.id]) { var s = document.createElement('span'); s.className = 'stamp'; s.textContent = '解決' + (save.stars[p.id] ? ' ' + '★'.repeat(save.stars[p.id]) : ''); li.appendChild(s); }
      if (open) li.onclick = function () { music(); startSession(p); };
      else if (Paywall.locked(i)) li.onclick = function () { openPaywall(function () { buildList(); }); };
      ul.appendChild(li);
    });
    // 絵の読みこみが間に合わなかったら、少し待って描きなおす
    if (!allReady && listRetry++ < 20) setTimeout(buildList, 250); else if (allReady) listRetry = 0;
  }

  // ---------- 診察 ----------
  var P = null, G = null, ST = null, log = [], newClues = 0, busy = false, waiting = null;
  var queue = [], typing = null, curLine = null, onQueueEnd = null, lastTrust = 0, lastAnger = 0, knownClues = 0;

  function startSession(p) {
    BGM.setTheme(p.id); // 患者の性格に合わせた曲
    clearInterval(typing); typing = null; queue = [];
    P = p; G = Story.start(p); ST = G.st; log = []; newClues = 0; waiting = null;
    lastTrust = ST.trust; lastAnger = 0; knownClues = 0; lastFace = 'normal'; reactNext = false;
    scene.sprite = p.sprite; scene.expr = 'normal'; scene.alpha = 0; scene.fade = 0.03;
    scene.flower = false; scene.night = (p.night || p.id === 'gald'); scene.companion = null; scene.item = null; scene.cg = null;
    $('s-name').textContent = p.name; $('s-species').textContent = p.species;
    setInput(null); renderTrust(0); renderAnger(0); updateBadge();
    show('scr-session');
    $('d-text').textContent = ''; $('d-name').textContent = '';
    if (!save.tutorial) {
      save.tutorial = true; store();
      setTimeout(function () { openModal(tutorialHtml(), 'はじめる', function () { setTimeout(advance, 300); }); }, 400);
    } else setTimeout(advance, 500);
  }
  function tutorialHtml() {
    return '<h3>はじめての診察</h3><ol class="tut">' +
      '<li><span class="ti">👆</span><span>会話は<b>タップ</b>で進みます。</span></li>' +
      '<li><span class="ti">💭</span><span>💭が出たら、聞きたいことを<b>下の入力欄</b>に書いて「送信」。<br>文字を打つのが大変なら、入力欄の上の<b>候補ボタン</b>をタップするだけでもOK。</span></li>' +
      '<li><span class="ti">❤️</span><span>上の<b>♥信頼度</b>は、やさしい言葉で上がります。<b>💢怒り</b>が満タンになると、患者は帰ってしまいます。</span></li>' +
      '<li><span class="ti">📋</span><span><b>赤い字</b>は大事な手がかり。📋カルテにたまります。気になる持ち物などを聞くと<b>✦エピソード</b>が起き、結末が変わります。</span></li>' +
      '<li><span class="ti">💡</span><span>困ったら<b>💡ヒント</b>。</span></li></ol>' +
      '<p class="tut-note">字が小さいときは、タイトル画面の「🔠 文字」で大きくできます。</p>';
  }

  // 台本を入力待ちまで進める（あなたの声かけ say も、AIが患者の返事を作る）
  function advance() {
    var r = Story.run(G, { ai: true });
    play(r.lines, function () {
      syncStatus();
      if (ST.phase === 'left') return leftPatient();
      if (r.say) return speak(r.sayText || r.say.text, 'say');
      if (r.waiting) setInput(r.waiting);
      else if (r.done || ST.phase === 'done') finish();
    });
  }

  // 会話ログから、AIに渡す直近のやりとりを作る
  function history() {
    return log.filter(function (l) { return l.who === 'me' || l.who === 'p'; }).slice(-24)
      .map(function (l) { return { who: l.who, text: l.text }; });
  }

  // あなたの発言 → AIが患者の返事を作る（だめならキーワードの返事）
  var talkSeq = 0;
  function speak(text, kind) {
    var seq = ++talkSeq;
    var promise = AI.talk(Story.aiPayload(G, kind, text, history()));
    reactNext = true; trustAtSpeak = ST.trust;
    if (kind !== 'say') G.asked = (G.asked || 0) + 1; // スコア用：あなたが入力した回数
    play([{ who: 'me', text: text, auto: kind !== 'say' }], function () {
      waitReply(promise, function (res) {
        if (seq !== talkSeq) return;
        var a;
        if (kind === 'say') a = res ? Story.applyAI(G, text, res, true) : Story.localSay(G);
        else a = res ? Story.applyAI(G, text, res, false) : Story.answer(G, text);
        play(a.lines, function () {
          syncStatus();
          if (ST.phase === 'left') return leftPatient();
          if (kind === 'say' || a.ok) advance();
          else setInput(Story.current(G));
        });
      });
    });
  }
  // 返事を待つあいだ「……」を出す
  function waitReply(promise, cb) {
    var done = false, dots = 0, timer = null;
    promise.then(function (res) { done = true; clearInterval(timer); cb(res); });
    setTimeout(function () {
      if (done) return;
      var dlg = $('dialog');
      dlg.className = 'dialog p'; $('d-name').textContent = P.name; scene.talk = false;
      timer = setInterval(function () { dots = (dots + 1) % 4; $('d-text').textContent = '……'.slice(0, 1 + dots % 2) + '　'; }, 350);
    }, 150);
  }

  function setInput(s) {
    waiting = s;
    var bar = $('form'), tag = $('phase-tag'), inp = $('inp');
    var type = s ? s.type : null;
    bar.className = 'inputbar' + (s ? ' wait' : '') + (type === 'truth' ? ' diagnose' : type === 'counsel' ? ' counsel' : '');
    inp.disabled = !s; $('btn-send').disabled = !s; $('btn-hint').disabled = !s;
    inp.placeholder = !s ? '（会話を聞いています…）' : type === 'truth' ? 'あなたが隠しているのは…' : type === 'counsel' ? 'さいごに声をかける…' : '質問を入力…';
    renderChips(s);
    tag.className = 'phase-tag' + (type === 'counsel' ? ' counsel' : '');
    tag.textContent = type === 'truth' ? '🔍 真実をつげる' : type === 'counsel' ? '💗 背中を押す言葉をかけよう' : '';
  }

  // ---------- 候補ボタン（文字を打たなくても遊べるように） ----------
  // 質問の場面：赤い字の言葉について聞く／ふつうの聞き方。タップでそのまま送る
  // 真実・背中を押す場面：赤い字の言葉を入力欄に足す（文は自分で仕上げる）
  var ASK_CHIPS = ['くわしく教えてください', 'いつからですか？', 'それは、つらかったですね', 'ほかに気になっていることは？', 'ふだんの毎日はどうですか？', 'だれかに話せていますか？'];
  var COUNSEL_CHIPS = ['ひとりで抱えなくていいんですよ', '本当の気持ちを、伝えてみませんか？', 'いっしょに方法を考えましょう'];
  function chip(label, cls, fn) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (cls ? ' ' + cls : ''); b.textContent = label;
    b.onclick = function (e) { e.preventDefault(); if (busy || !waiting) return; fn(); };
    return b;
  }
  function freshWords() {
    return (G.words || []).filter(function (w) { return !(G.usedWords || {})[w]; }).slice(-3).reverse();
  }
  function renderChips(s) {
    var box = $('chips'); box.innerHTML = '';
    box.classList.toggle('on', !!s);
    if (!s) return;
    G.usedChips = G.usedChips || {}; G.usedWords = G.usedWords || {};
    var send = function (t, mark) { return function () { mark(); var k = waiting.type; setInput(null); speak(t, k); }; };
    if (s.type === 'ask') {
      if (s.example && (P.difficulty || 1) <= 1) box.appendChild(chip(s.example, 'rec', send(s.example, function () {})));
      freshWords().slice(0, 2).forEach(function (w) {
        var t = '「' + w + '」について、もう少し教えてください。';
        box.appendChild(chip('「' + w + '」って？', 'word', send(t, function () { G.usedWords[w] = true; })));
      });
      ASK_CHIPS.filter(function (c) { return !G.usedChips[c]; }).slice(0, 3).forEach(function (c) {
        box.appendChild(chip(c, '', send(c, function () { G.usedChips[c] = true; })));
      });
    } else {
      var words = (G.words || []).slice(-4).reverse();
      words.forEach(function (w) {
        box.appendChild(chip('＋' + w, 'word', function () {
          var inp = $('inp'); inp.value = (inp.value ? inp.value + '、' : '') + w; inp.scrollLeft = inp.scrollWidth;
        }));
      });
      if (s.type === 'counsel') COUNSEL_CHIPS.forEach(function (c) { box.appendChild(chip(c, '', send(c, function () {}))); });
    }
    box.scrollLeft = 0;
  }
  // 赤い字の言葉をおぼえておく（候補ボタンに使う）
  function noteWords(text) {
    var m, re = /【([^】]+)】/g;
    G.words = G.words || [];
    while ((m = re.exec(text))) {
      var w = m[1].replace(/[「」『』。、！？…]/g, '').trim();
      if (w && w.length <= 16 && G.words.indexOf(w) < 0) G.words.push(w);
    }
  }

  function renderTrust(delta) {
    var el = $('s-trust'), h = '';
    for (var i = 0; i < Engine.MAX_TRUST; i++) h += i < ST.trust ? '♥' : '<span class="off">♥</span>';
    el.innerHTML = h;
    el.classList.remove('pulse', 'down'); void el.offsetWidth;
    if (delta > 0) el.classList.add('pulse'); if (delta < 0) el.classList.add('down');
  }
  function renderAnger(delta) {
    var el = $('s-anger'), a = ST.anger || 0;
    $('s-anger-fill').style.width = (a / Engine.MAX_ANGER * 100) + '%';
    el.classList.toggle('hot', a > 0);
    el.classList.toggle('danger', a >= Engine.MAX_ANGER - 1 && ST.phase !== 'left');
    el.classList.remove('up'); void el.offsetWidth;
    if (delta > 0) { el.classList.add('up'); Pixel.fx('angry'); }
    if (delta > 0 && a === Engine.MAX_ANGER - 1) toast('💢 ' + P.name + 'は、かなりイライラしている…！');
    else if (delta > 0) toast('💢 ' + P.name + 'は、むっとしたようだ');
    else if (delta < 0) toast('😌 ' + P.name + 'は、少し落ちついたようだ');
  }
  function updateBadge() { var b = $('karte-badge'); b.textContent = newClues; b.classList.toggle('on', newClues > 0); }

  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  // 信頼度と手がかりの表示を、エンジンの状態に合わせる
  function syncStatus() {
    if (ST.trust !== lastTrust) { renderTrust(ST.trust - lastTrust); lastTrust = ST.trust; }
    if ((ST.anger || 0) !== lastAnger) { renderAnger((ST.anger || 0) - lastAnger); lastAnger = ST.anger || 0; }
    if (ST.clues.length > knownClues) {
      newClues += ST.clues.length - knownClues; knownClues = ST.clues.length; updateBadge();
      toast('📋 カルテに追記：' + ST.clues[ST.clues.length - 1]);
      pikiin();
    }
  }

  // セリフを順に表示する
  function play(lines, done) {
    queue = lines.slice(); onQueueEnd = done || null; busy = true;
    nextLine();
  }
  function nextLine() {
    var dlg = $('dialog');
    if (!queue.length) {
      busy = false; dlg.classList.remove('more'); scene.talk = false; scene.item = null;
      if (scene.companion) scene.companion.talk = false;
      var f = onQueueEnd; onQueueEnd = null; if (f) f();
      return;
    }
    curLine = queue.shift();
    var who = curLine.who, st = Story.current(G), wt = st ? st.type : null;
    dlg.className = 'dialog ' + who;
    // 物語の演出：となりに登場する人・品物・結末の絵
    if (curLine.show !== undefined) {
      scene.companion = curLine.show ? { key: curLine.show.key, face: curLine.show.face, t0: performance.now() } : null;
      scene.cg = null;
    }
    if (curLine.item) { scene.item = curLine.item; scene.itemT0 = performance.now(); }
    if (curLine.cg) { scene.cg = curLine.cg; scene.cgT0 = performance.now(); }
    if (scene.companion) scene.companion.talk = who === 'c';
    if (who === 'c' && curLine.cface && scene.companion) scene.companion.face = curLine.cface;
    if (who === 'c') dlg.className = 'dialog p';
    $('d-name').textContent = who === 'c' ? (curLine.name || '') : who === 'p' ? P.name : who === 'nurse' ? '看護師ミケ' : who === 'me' ? 'あなた'
      : who === 'think' ? (wt === 'truth' ? '💭 真実は…？' : wt === 'counsel' ? '💭 どう声をかける？' : '💭 なにを聞こう？') : '';
    if (who === 'p') {
      var face = curLine.face || scene.expr;
      // あなたの言葉への反応や、表情が変わったときにエフェクト
      // ハートは、本当に信頼が上がったときだけ（ほほえんだだけでは出さない）
      if (reactNext || face !== lastFace) { if (face !== 'happy' || ST.trust > trustAtSpeak) Pixel.fx(face); }
      reactNext = false; lastFace = face;
      if (curLine.face) scene.expr = curLine.face; syncStatus();
    }
    if ((who === 'p' || who === 'narr') && curLine.text.indexOf('【') >= 0) { pikiin(); noteWords(curLine.text); }
    if (who === 'nurse') nurseMood = moodOf(curLine.text);
    log.push({ who: who, text: curLine.text, name: curLine.name });
    if (curLine.episode) toast('✦ エピソード発見！ 結末が変わるかも…');
    var text = curLine.text, plain = text.replace(/[【】]/g, ''), i = 0, el = $('d-text');
    el.textContent = '';
    scene.talk = who === 'p';
    clearInterval(typing);
    typing = setInterval(function () {
      i++; el.innerHTML = rich(text, i);
      if (i >= plain.length) finishTyping();
    }, 30);
  }
  // 【】でかこんだ大事なフレーズを赤字にする（n = 表示する文字数）
  function rich(text, n) {
    if (n == null) n = Infinity;
    var html = '', red = false, count = 0;
    for (var k = 0; k < text.length && count < n; k++) {
      var ch = text.charAt(k);
      if (ch === '【') { html += '<em class="key">'; red = true; continue; }
      if (ch === '】') { if (red) html += '</em>'; red = false; continue; }
      html += esc(ch); count++;
    }
    return red ? html + '</em>' : html;
  }
  // 文を出し終えたら、必ずタップを待つ（💭の入力待ちだけはそのまま入力へ）
  function finishTyping() {
    clearInterval(typing); typing = null; scene.talk = false;
    $('d-text').innerHTML = rich(curLine.text);
    if (!queue.length && (curLine.who === 'think' || curLine.auto)) { nextLine(); return; }
    if (queue.length || onQueueEnd) $('dialog').classList.add('more');
    else nextLine();
  }
  var lastTap = 0;
  $('dialog').onclick = function () {
    var now = Date.now();
    if (now - lastTap < 250) return; // 1回のタップが2回分に数えられるのを防ぐ
    lastTap = now;
    if (typing) { finishTyping(); return; }
    if (busy) { $('dialog').classList.remove('more'); nextLine(); }
  };

  $('form').onsubmit = function (e) {
    e.preventDefault();
    var inp = $('inp'), text = inp.value.trim();
    if (!text || busy || !waiting) return;
    inp.value = '';
    var kind = waiting.type;
    setInput(null);
    speak(text, kind);
  };
  $('btn-hint').onclick = function () {
    if (busy || !waiting) return;
    var s = waiting; setInput(null);
    G.hints = (G.hints || 0) + 1; // スコア用
    play(Story.hint(G), function () { setInput(s); });
  };
  $('inp').addEventListener('focus', function () { setTimeout(fitHeight, 300); });
  $('inp').addEventListener('blur', function () { setTimeout(fitHeight, 100); });

  function leftPatient() {
    setInput(null); scene.fade = -0.03; $('inp').blur();
    setTimeout(function () {
      openModal('<div class="result gameover"><h3>GAME OVER</h3><p class="big">💢 ' + esc(P.name) + 'は怒って帰ってしまった…</p><p>怒りメーターが満タンになってしまった。<br>相手が嫌がる言い方をしていなかったか、思い出してみよう。</p></div>' + fbButton(), 'もう一度', function () { startSession(P); });
      var p = P; hookFeedback({ where: '診察', patient: p.name, result: '怒って帰った', after: function () { startSession(p); } });
    }, 900);
  }
  function routeHtml() {
    var r = Engine.route(P, ST), stars = r.key === 'best' ? '★★★' : r.key === 'good' ? '★★☆' : '★☆☆';
    var more = r.found < r.total ? '<br><small>ちがう質問をすると、べつの結末が見られるかも…</small>' : '<br><small>すべてのエピソードを見つけた！</small>';
    return '<p class="route">' + stars + ' エンディング「' + esc(r.name) + '」<br>見つけたエピソード：' + r.found + ' / ' + r.total + more + '</p>';
  }
  function finish() {
    setInput(null); $('inp').blur();
    if (P.id === 'lumie') scene.flower = true;
    scene.expr = 'happy';
    save.cleared[P.id] = true;
    var rk = { normal: 1, good: 2, best: 3 }[Engine.route(P, ST).key];
    save.stars[P.id] = Math.max(save.stars[P.id] || 0, rk); store();
    var total = P.topics.filter(function (t) { return t.clue; }).length;
    var sc = scoreOf(P, ST, G), isBest = record(P, sc), pp = P;
    var scoreHtml = '<div class="score"><span class="rank r' + sc.rank + '">' + sc.rank + '</span><b>' + sc.total + '</b> 点' + (isBest ? ' <em>自己ベスト！</em>' : '') +
      '<table>' + sc.parts.map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td>' + (x[1] >= 0 ? '+' : '') + x[1] + '</td></tr>'; }).join('') + '</table></div>';
    setTimeout(function () {
      var idx = PATIENTS.indexOf(P), gate = idx + 1 < PATIENTS.length && Paywall.locked(idx + 1);
      var next = idx + 1 < PATIENTS.length ? (gate ? '<p>次の患者さんから予約を開放できます！</p>' : '<p>あたらしい予約が入りました！</p>') : '<p>本日の予約はすべて終わりました。おつかれさまでした！</p>';
      openModal('<div class="result"><h3>カウンセリング成功！</h3><p class="big">' + esc(P.name) + 'の悩みが晴れた</p>' +
        routeHtml() + scoreHtml + '<p>集めた手がかり：' + ST.clues.length + ' / ' + total + '</p>' + next + '</div>' +
        '<p class="fb-row"><button class="btn" id="btn-share">📣 シェアする</button></p>' + fbButton(),
        '予約リストへ', function () {
          buildList(); show('scr-select');
          if (gate) setTimeout(function () { openPaywall(function () { buildList(); }); }, 300); // 2人目をクリアしたら開放画面
        });
      var rt = Engine.route(P, ST);
      hookFeedback({ where: '診察', patient: P.name, result: 'クリア ' + rt.key + '「' + rt.name + '」 ' + sc.total + '点', after: function () { buildList(); show('scr-select'); } });
      $('btn-share').onclick = function () { shareResult(pp, sc, function () { buildList(); show('scr-select'); }); };
    }, 1000);
  }

  $('btn-karte').onclick = function () {
    var rows = P.karte.map(function (k) { return '<tr><th>' + esc(k[0]) + '</th><td>' + esc(k[1]) + '</td></tr>'; }).join('');
    var n = ST.clues.length, start = n - newClues;
    var clues = n ? ST.clues.map(function (c, i) { return '<li class="' + (i >= start ? 'new' : '') + '">' + esc(c) + '</li>'; }).join('') : '<li>まだ手がかりはない。話を聞いて集めよう。</li>';
    var ep = Story.episodeCount(G), epHtml = '<h4>✦ エピソード ' + ep.found.length + ' / ' + ep.total + '</h4><ul class="eps">' +
      ep.found.map(function (t) { return '<li class="got">✦ ' + esc(t) + '</li>'; }).join('') +
      new Array(ep.total - ep.found.length + 1).join('<li>？？？</li>') + '</ul>' +
      (ep.found.length < ep.total ? '<p class="ep-tip">持ち物や、話に出てきた気になるものについて聞くと見つかるかも。見つけた数で結末が変わります。</p>' : '');
    openModal('<h3>📋 カルテ</h3><table class="karte">' + rows + '</table><h4>聞き出した手がかり</h4><ul class="clues">' + clues + '</ul>' + epHtml);
    newClues = 0; updateBadge();
  };
  $('btn-log').onclick = function () {
    var h = log.filter(function (l) { return l.who !== 'think'; }).map(function (l) {
      var name = l.who === 'me' ? 'あなた' : l.who === 'p' ? P.name : l.who === 'nurse' ? 'ミケ' : l.who === 'c' ? (l.name || '') : '';
      return '<p class="' + l.who + '">' + (name ? '<b>' + esc(name) + '</b>：' : '') + rich(l.text) + '</p>';
    }).join('');
    openModal('<h3>💬 会話ログ</h3><div class="log">' + (h || '<p>まだ会話はありません</p>') + '</div>');
    setTimeout(function () { var b = $('modal-body'); b.scrollTop = b.scrollHeight; }, 0);
  };
  $('btn-quit').onclick = function () {
    if (ST && ST.phase === 'done') { buildList(); show('scr-select'); return; }
    openModal('<h3>診察を中断する？</h3><p>ここまでの会話は消えてしまいます。</p><button class="btn" id="btn-quit-yes" style="width:100%">中断して予約リストへ</button>', '続ける');
    $('btn-quit-yes').onclick = function () { $('modal').classList.remove('open'); modalOnClose = null; clearInterval(typing); queue = []; busy = false; buildList(); show('scr-select'); };
  };

  sizeCanvases();
  fitHeight();
  requestAnimationFrame(loop);
  // 起動したらオープニングから始める
  startOpening();
})();
