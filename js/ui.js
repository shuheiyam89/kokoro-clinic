// 画面まわり
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var SAVE_KEY = 'kokoro_clinic_v1';
  var save = load();
  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { cleared: {}, tutorial: false }; } catch (e) { return { cleared: {}, tutorial: false }; } }
  function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

  // ---------- スマホの画面高さ（キーボード対応） ----------
  var app = $('app');
  function fitHeight() {
    var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    app.style.setProperty('--app-h', h + 'px');
    app.classList.toggle('kb', document.activeElement === $('inp') && h < window.innerHeight * 0.8 || h < 480 && document.activeElement === $('inp'));
    window.scrollTo(0, 0);
    sizeCanvases();
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitHeight);
  window.addEventListener('resize', fitHeight);

  // ---------- キャンバス ----------
  var cvScene = $('cv-scene'), cvTitle = $('cv-title'), cvNurse = $('cv-nurse');
  function sizeCanvas(cv) {
    var dpr = window.devicePixelRatio || 1;
    var cssW = cv.parentNode.clientWidth || 360;
    var k = Math.max(1, Math.round(cssW * dpr / Pixel.W));
    if (cv.width !== Pixel.W * k) { cv.width = Pixel.W * k; cv.height = Pixel.H * k; }
    var c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); c.imageSmoothingEnabled = false;
    return c;
  }
  var ctxScene, ctxTitle;
  function sizeCanvases() { ctxScene = sizeCanvas(cvScene); ctxTitle = sizeCanvas(cvTitle); }

  var scene = { sprite: null, expr: 'normal', talk: false, blink: false, t: 0, alpha: 1, scale: 1 };
  var nextBlink = 2000, blinkEnd = 0;
  var titleIdx = 0;
  function loop(ts) {
    scene.t = ts;
    if (ts > nextBlink) { blinkEnd = ts + 130; nextBlink = ts + 2200 + Math.random() * 2500; }
    scene.blink = ts < blinkEnd;
    if ($('scr-session').classList.contains('active')) {
      if (scene.targetScale != null) scene.scale += (scene.targetScale - scene.scale) * 0.03;
      if (scene.fade) { scene.alpha += scene.fade; if (scene.alpha >= 1) { scene.alpha = 1; scene.fade = 0; } if (scene.alpha <= 0) { scene.alpha = 0; scene.fade = 0; } }
      Pixel.render(ctxScene, scene);
      if (cvNurse.offsetParent) Pixel.nurse(cvNurse.getContext('2d'), ts);
    } else if ($('scr-title').classList.contains('active')) {
      var p = PATIENTS[((ts / 3500) | 0) % PATIENTS.length];
      Pixel.render(ctxTitle, { sprite: p.sprite, expr: 'happy', t: ts, blink: scene.blink, scale: 1, night: false });
    }
    requestAnimationFrame(loop);
  }

  // ---------- 画面切りかえ ----------
  function show(id) {
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
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- タイトル ----------
  $('btn-start').onclick = function () { buildList(); show('scr-select'); };
  $('btn-howto').onclick = howto;
  function howto() {
    openModal('<h3>あそびかた</h3><ol class="howto">' +
      '<li>あなたは「こころ診療所」のカウンセラー。いろいろな星のお客様が悩みを話しにきます。</li>' +
      '<li>選択肢はありません。下の入力欄に<b>自分の言葉で質問</b>を書いて送信しましょう。<br>例：「いつから眠れないんですか？」「お友達のことを教えて」</li>' +
      '<li>お客様は何かを<b>隠しています</b>。📋カルテの気になる記述や、話の中の言いよどみがヒントです。</li>' +
      '<li>♥は信頼度。やさしく寄り添う言葉をかけると上がり、心をひらいて本当のことを話してくれます。失礼な言葉で0になると帰ってしまいます。</li>' +
      '<li>手がかりが3つ集まると<b>🔍真実をつげる</b>が使えます。隠していることを言いあてて、さいごに背中を押す言葉をかけたらクリア！</li>' +
      '<li>行き詰まったら、助手のミケがヒントをくれます。</li></ol>');
  }

  // ---------- 予約リスト ----------
  $('btn-sel-back').onclick = function () { show('scr-title'); };
  function unlocked(i) { return i === 0 || !!save.cleared[PATIENTS[i - 1].id] || !!save.cleared[PATIENTS[i].id]; }
  function buildList() {
    var ul = $('patient-list'); ul.innerHTML = '';
    PATIENTS.forEach(function (p, i) {
      var li = document.createElement('li'), open = unlocked(i);
      if (!open) li.className = 'locked';
      var cv = document.createElement('canvas'); cv.width = 80; cv.height = 60;
      var full = document.createElement('canvas'); full.width = Pixel.W; full.height = Pixel.H;
      Pixel.render(full.getContext('2d'), { sprite: p.sprite, expr: 'normal', t: 0, scale: 1, night: p.id === 'gald' });
      var cc = cv.getContext('2d'); cc.imageSmoothingEnabled = false; cc.drawImage(full, 40, 20, 80, 60, 0, 0, 80, 60);
      li.appendChild(cv);
      var chief = p.karte.filter(function (k) { return k[0] === '主訴'; })[0][1];
      var info = document.createElement('div'); info.className = 'info';
      info.innerHTML = open
        ? '<b>' + esc(p.name) + '</b>（' + esc(p.species) + '）<br>「' + esc(chief) + '」<br><span class="stars">' + '★'.repeat(p.difficulty) + '☆'.repeat(3 - p.difficulty) + '</span>'
        : '<b>？？？</b><br>前のお客様の悩みを解決すると予約が入ります';
      li.appendChild(info);
      if (save.cleared[p.id]) { var s = document.createElement('span'); s.className = 'stamp'; s.textContent = '解決'; li.appendChild(s); }
      if (open) li.onclick = function () { startSession(p); };
      ul.appendChild(li);
    });
  }

  // ---------- 診察 ----------
  var P = null, ST = null, mode = 'ask', log = [], newClues = 0, busy = false;
  var queue = [], typing = null, curLine = null, onQueueEnd = null;

  function startSession(p) {
    P = p; ST = Engine.newState(p); mode = 'ask'; log = []; newClues = 0;
    scene.sprite = p.sprite; scene.expr = 'normal'; scene.alpha = 0; scene.fade = 0.03;
    scene.scale = 1; scene.targetScale = null; scene.flower = false; scene.night = p.id === 'gald';
    $('s-name').textContent = p.name; $('s-species').textContent = p.species;
    setMode('ask'); renderTrust(0); updateBadge();
    show('scr-session');
    $('d-text').textContent = ''; $('d-name').textContent = '';
    var lines = p.arrive.slice();
    if (!save.tutorial) {
      lines.push({ who: 'nurse', text: '助手のミケです！ 下の入力欄に、あなたの言葉で質問を書いてね。' });
      lines.push({ who: 'nurse', text: 'まずは「どうしましたか？」と聞いてみよう。📋カルテも見てみてね！' });
      save.tutorial = true; store();
    }
    setTimeout(function () { play(lines); }, 500);
  }

  function setMode(m) {
    mode = m;
    var bar = $('form'), tag = $('phase-tag'), inp = $('inp'), tb = $('btn-truth');
    bar.className = 'inputbar' + (m === 'ask' ? '' : ' ' + m);
    tag.className = 'phase-tag' + (m === 'counsel' ? ' counsel' : '');
    if (m === 'ask') { inp.placeholder = '質問を入力…'; tag.textContent = ''; tb.textContent = '🔍 真実をつげる'; }
    if (m === 'diagnose') { inp.placeholder = 'あなたが隠しているのは…'; tag.textContent = '🔍 真実をつげる'; tb.textContent = '✕ やめる'; }
    if (m === 'counsel') { inp.placeholder = 'さいごに声をかける…'; tag.textContent = '💗 背中を押す言葉をかけよう'; tb.textContent = '🔍 真実をつげる'; }
    updateTruthBtn();
  }
  function updateTruthBtn() {
    var tb = $('btn-truth');
    var ready = ST && ST.phase === 'talk' && ST.clues.length >= 3;
    tb.disabled = !(ready || mode === 'diagnose');
    tb.classList.toggle('ready', ready && mode === 'ask');
  }
  $('btn-truth').onclick = function () {
    if (busy) return;
    if (mode === 'diagnose') { setMode('ask'); return; }
    setMode('diagnose');
    play([{ who: 'nurse', text: 'お客様が隠していることを、ズバリ言ってみよう。だれが・何を・どうしたのか、くわしく書くと伝わりやすいよ。' }]);
    $('inp').focus();
  };

  function renderTrust(delta) {
    var el = $('s-trust'), h = '';
    for (var i = 0; i < Engine.MAX_TRUST; i++) h += i < ST.trust ? '♥' : '<span class="off">♥</span>';
    el.innerHTML = h;
    el.classList.remove('pulse', 'down'); void el.offsetWidth;
    if (delta > 0) el.classList.add('pulse'); if (delta < 0) el.classList.add('down');
  }
  function updateBadge() { var b = $('karte-badge'); b.textContent = newClues; b.classList.toggle('on', newClues > 0); }

  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // セリフを順に表示する
  function play(lines, done) {
    queue = lines.slice(); onQueueEnd = done || null; busy = true;
    $('btn-send').disabled = true;
    nextLine();
  }
  function nextLine() {
    var dlg = $('dialog');
    if (!queue.length) {
      busy = false; $('btn-send').disabled = false; dlg.classList.remove('more'); scene.talk = false;
      var f = onQueueEnd; onQueueEnd = null; if (f) f();
      return;
    }
    curLine = queue.shift();
    var who = curLine.who;
    dlg.className = 'dialog ' + who;
    $('d-name').textContent = who === 'p' ? P.name : who === 'nurse' ? '助手ミケ' : '';
    if (who === 'p' && curLine.face) scene.expr = curLine.face;
    log.push({ who: who, text: curLine.text });
    var text = curLine.text, i = 0, el = $('d-text');
    el.textContent = '';
    scene.talk = who === 'p';
    clearInterval(typing);
    typing = setInterval(function () {
      i++; el.textContent = text.slice(0, i);
      if (i >= text.length) finishTyping();
    }, 32);
  }
  function finishTyping() {
    clearInterval(typing); typing = null; scene.talk = false;
    $('d-text').textContent = curLine.text;
    if (queue.length) $('dialog').classList.add('more');
    else nextLine();
  }
  $('dialog').onclick = function () {
    if (typing) { finishTyping(); return; }
    if (queue.length) { $('dialog').classList.remove('more'); nextLine(); }
  };

  $('form').onsubmit = function (e) {
    e.preventDefault();
    var inp = $('inp'), text = inp.value.trim();
    if (!text || busy || !ST) return;
    inp.value = '';
    log.push({ who: 'me', text: text });
    var r;
    if (mode === 'ask') r = Engine.ask(P, ST, text);
    else if (mode === 'diagnose') r = Engine.diagnose(P, ST, text);
    else r = Engine.counsel(P, ST, text);
    if (r.ev) {
      if (r.ev.trust) renderTrust(r.ev.trust);
      if (r.ev.clue) { newClues++; updateBadge(); setTimeout(function () { toast('📋 カルテに追記：' + r.ev.clue); }, 400); }
    }
    if (mode === 'diagnose' && !r.ok && ST.phase === 'talk') setMode('ask');
    if (!r.lines.length) return;
    play(r.lines, afterTurn);
    updateTruthBtn();
  };
  $('inp').addEventListener('focus', function () { setTimeout(fitHeight, 300); });
  $('inp').addEventListener('blur', function () { setTimeout(fitHeight, 100); });

  function afterTurn() {
    updateTruthBtn();
    if (ST.phase === 'counsel' && mode !== 'counsel') setMode('counsel');
    if (ST.phase === 'left') {
      scene.fade = -0.03; $('inp').blur();
      setTimeout(function () {
        openModal('<div class="result"><h3>' + esc(P.name) + 'は帰ってしまった…</h3><p>信頼をなくしてしまったようだ。<br>もう一度、やさしく話を聞いてみよう。</p></div>', 'もう一度', function () { startSession(P); });
      }, 900);
    }
    if (ST.phase === 'done') {
      $('inp').blur();
      if (P.id === 'pururu') scene.targetScale = 1;
      if (P.id === 'lumie') scene.flower = true;
      scene.expr = 'happy';
      save.cleared[P.id] = true; store();
      var total = P.topics.filter(function (t) { return t.clue; }).length;
      setTimeout(function () {
        var next = PATIENTS.indexOf(P) + 1 < PATIENTS.length ? '<p>あたらしい予約が入りました！</p>' : '<p>本日の予約はすべて終わりました。おつかれさまでした！</p>';
        openModal('<div class="result"><h3>カウンセリング成功！</h3><p class="big">' + esc(P.name) + 'の悩みが晴れた</p>' +
          '<p>集めた手がかり：' + ST.clues.length + ' / ' + total + '<br>質問した回数：' + ST.turns + '回<br>信頼度：' + '<span style="color:#ff5a7e">' + '♥'.repeat(ST.trust) + '</span>' + '</p>' + next + '</div>',
          '予約リストへ', function () { buildList(); show('scr-select'); });
      }, 1200);
    }
  }

  $('btn-karte').onclick = function () {
    var rows = P.karte.map(function (k) { return '<tr><th>' + esc(k[0]) + '</th><td>' + esc(k[1]) + '</td></tr>'; }).join('');
    var n = ST.clues.length, start = n - newClues;
    var clues = n ? ST.clues.map(function (c, i) { return '<li class="' + (i >= start ? 'new' : '') + '">' + esc(c) + '</li>'; }).join('') : '<li>まだ手がかりはない。質問して聞き出そう。</li>';
    var need = ST.phase === 'talk' && n < 3 ? '<p style="font-size:13px;color:#8a6a4a">あと' + (3 - n) + 'つ手がかりを集めると「真実をつげる」が使えます</p>' : '';
    openModal('<h3>📋 カルテ</h3><table class="karte">' + rows + '</table><h4>聞き出した手がかり</h4><ul class="clues">' + clues + '</ul>' + need);
    newClues = 0; updateBadge();
  };
  $('btn-log').onclick = function () {
    var h = log.map(function (l) {
      var name = l.who === 'me' ? 'あなた' : l.who === 'p' ? P.name : l.who === 'nurse' ? 'ミケ' : '';
      return '<p class="' + l.who + '">' + (name ? '<b>' + esc(name) + '</b>：' : '') + esc(l.text) + '</p>';
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
})();
