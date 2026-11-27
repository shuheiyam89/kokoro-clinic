// AIの返事を取りに行く（使えないときは null を返し、キーワードの返事に切り替える）
var AI = (function () {
  var URL = 'https://kokoro-clinic-api.netlify.app/api/talk';
  var disabledUntil = 0;
  function talk(payload) {
    if (Date.now() < disabledUntil || !window.fetch) return Promise.resolve(null);
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    return fetch(URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      if (r.status === 429) { disabledUntil = Date.now() + 10 * 60 * 1000; return null; } // 回数上限：しばらくキーワードで
      if (!r.ok) return null;
      return r.json();
    }).then(function (j) {
      if (!j || !j.lines || !j.lines.length) return null;
      return j;
    }).catch(function () { clearTimeout(timer); return null; });
  }
  return { talk: talk };
})();
