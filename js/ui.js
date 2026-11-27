// 画面まわり
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var SAVE_KEY = 'kokoro_clinic_v1';
  var save = load();
  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { cleared: {} }; } catch (e) { return { cleared: {} }; } }
  function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  if (!save.cleared) save.cleared = {};
  if (!save.stars) save.stars = {};

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
    var k = Math.max(1, Math.round(cssW * dpr / Pixel.W));
    if (cv.width !== Pixel.W * k) { cv.width = Pixel.W * k; cv.height = Pixel.H * k; }
    var c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); c.imageSmoothingEnabled = false;
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
  var reactNext = false, lastFace = 'normal';
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
  $('btn-start').onclick = function () {
    music();
    buildList(); show('scr-select');
  };
  $('btn-opening').onclick = function () { music(); startOpening(); };
  $('btn-howto').onclick = function () {
    openModal('<h3>あそびかた</h3><ol class="howto">' +
      '<li>あなたは宇宙ステーションの「こころ診療所」のカウンセラー。いろいろな星の患者が悩みを話しにきます。</li>' +
      '<li>会話は自動で進みます。画面の会話欄をタップすると次のセリフへ。</li>' +
      '<li><b>💭のところで、あなたが質問を入力</b>します。何を聞けばいいかは💭に書いてあります。自分の言葉でOK！</li>' +
      '<li>患者は何かを<b>隠しています</b>。📋カルテの記述や、話の中の言いよどみがヒントです。</li>' +
      '<li>さいごに、隠している真実を言いあて、背中を押す言葉をかけたらクリア！</li>' +
      '<li>困ったら💡ヒント。3回うまくいかないと、看護師のミケが手伝ってくれます。</li><li>気になったことを自由に聞くと「エピソード」が起きて、結末が変わることも。</li><li>赤い字は大事な手がかり。怒りメーター💢が満タンになると、患者さんは帰ってしまいます。</li></ol>');
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
        : '<b>？？？</b><br>前の患者の悩みを解決すると予約が入ります';
      li.appendChild(info);
      if (save.cleared[p.id]) { var s = document.createElement('span'); s.className = 'stamp'; s.textContent = '解決' + (save.stars[p.id] ? ' ' + '★'.repeat(save.stars[p.id]) : ''); li.appendChild(s); }
      if (open) li.onclick = function () { music(); startSession(p); };
      ul.appendChild(li);
    });
  }

  // ---------- 診察 ----------
  var P = null, G = null, ST = null, log = [], newClues = 0, busy = false, waiting = null;
  var queue = [], typing = null, curLine = null, onQueueEnd = null, lastTrust = 0, lastAnger = 0, knownClues = 0;

  function startSession(p) {
    clearInterval(typing); typing = null; queue = [];
    P = p; G = Story.start(p); ST = G.st; log = []; newClues = 0; waiting = null;
    lastTrust = ST.trust; lastAnger = 0; knownClues = 0; lastFace = 'normal'; reactNext = false;
    scene.sprite = p.sprite; scene.expr = 'normal'; scene.alpha = 0; scene.fade = 0.03;
    scene.flower = false; scene.night = p.id === 'gald';
    $('s-name').textContent = p.name; $('s-species').textContent = p.species;
    setInput(null); renderTrust(0); renderAnger(0); updateBadge();
    show('scr-session');
    $('d-text').textContent = ''; $('d-name').textContent = '';
    setTimeout(advance, 500);
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
    reactNext = true;
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
    tag.className = 'phase-tag' + (type === 'counsel' ? ' counsel' : '');
    tag.textContent = type === 'truth' ? '🔍 真実をつげる' : type === 'counsel' ? '💗 背中を押す言葉をかけよう' : '';
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
      busy = false; dlg.classList.remove('more'); scene.talk = false;
      var f = onQueueEnd; onQueueEnd = null; if (f) f();
      return;
    }
    curLine = queue.shift();
    var who = curLine.who, st = Story.current(G), wt = st ? st.type : null;
    dlg.className = 'dialog ' + who;
    $('d-name').textContent = who === 'p' ? P.name : who === 'nurse' ? '看護師ミケ' : who === 'me' ? 'あなた'
      : who === 'think' ? (wt === 'truth' ? '💭 真実は…？' : wt === 'counsel' ? '💭 どう声をかける？' : '💭 なにを聞こう？') : '';
    if (who === 'p') {
      var face = curLine.face || scene.expr;
      // あなたの言葉への反応や、表情が変わったときにエフェクト
      if (reactNext || face !== lastFace) Pixel.fx(face);
      reactNext = false; lastFace = face;
      if (curLine.face) scene.expr = curLine.face; syncStatus();
    }
    if ((who === 'p' || who === 'narr') && curLine.text.indexOf('【') >= 0) pikiin();
    if (who === 'nurse') nurseMood = moodOf(curLine.text);
    log.push({ who: who, text: curLine.text });
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
    play(Story.hint(G), function () { setInput(s); });
  };
  $('inp').addEventListener('focus', function () { setTimeout(fitHeight, 300); });
  $('inp').addEventListener('blur', function () { setTimeout(fitHeight, 100); });

  function leftPatient() {
    setInput(null); scene.fade = -0.03; $('inp').blur();
    setTimeout(function () {
      openModal('<div class="result gameover"><h3>GAME OVER</h3><p class="big">💢 ' + esc(P.name) + 'は怒って帰ってしまった…</p><p>怒りメーターが満タンになってしまった。<br>相手が嫌がる言い方をしていなかったか、思い出してみよう。</p></div>', 'もう一度', function () { startSession(P); });
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
    setTimeout(function () {
      var next = PATIENTS.indexOf(P) + 1 < PATIENTS.length ? '<p>あたらしい予約が入りました！</p>' : '<p>本日の予約はすべて終わりました。おつかれさまでした！</p>';
      openModal('<div class="result"><h3>カウンセリング成功！</h3><p class="big">' + esc(P.name) + 'の悩みが晴れた</p>' +
        routeHtml() + '<p>集めた手がかり：' + ST.clues.length + ' / ' + total + '<br>信頼度：<span style="color:#ff5a7e">' + '♥'.repeat(ST.trust) + '</span></p>' + next + '</div>',
        '予約リストへ', function () { buildList(); show('scr-select'); });
    }, 1000);
  }

  $('btn-karte').onclick = function () {
    var rows = P.karte.map(function (k) { return '<tr><th>' + esc(k[0]) + '</th><td>' + esc(k[1]) + '</td></tr>'; }).join('');
    var n = ST.clues.length, start = n - newClues;
    var clues = n ? ST.clues.map(function (c, i) { return '<li class="' + (i >= start ? 'new' : '') + '">' + esc(c) + '</li>'; }).join('') : '<li>まだ手がかりはない。話を聞いて集めよう。</li>';
    openModal('<h3>📋 カルテ</h3><table class="karte">' + rows + '</table><h4>聞き出した手がかり</h4><ul class="clues">' + clues + '</ul>');
    newClues = 0; updateBadge();
  };
  $('btn-log').onclick = function () {
    var h = log.filter(function (l) { return l.who !== 'think'; }).map(function (l) {
      var name = l.who === 'me' ? 'あなた' : l.who === 'p' ? P.name : l.who === 'nurse' ? 'ミケ' : '';
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
