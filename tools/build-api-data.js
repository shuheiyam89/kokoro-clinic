// サーバー用に台本データを書き出す: node tools/build-api-data.js
var fs = require('fs'), vm = require('vm'), path = require('path');
var root = path.join(__dirname, '..'), ctx = {};
vm.createContext(ctx);
['data-patients.js', 'data-flow.js', 'data-stage2.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx); });
var P = vm.runInContext('PATIENTS', ctx);
var out = {};
P.forEach(function (p) {
  out[p.id] = {
    id: p.id, name: p.name, species: p.species, karte: p.karte,
    topics: p.topics.map(function (t) { return { id: t.id, fact: t.reply.join(''), minTrust: t.minTrust || 0, needs: t.needs || [] }; }),
    samples: [].concat(p.arrive.filter(function (l) { return l.who === 'p'; }).map(function (l) { return l.text; }), p.locked, p.empathy, p.rude)
  };
});
fs.writeFileSync(path.join(root, 'server', 'lib', 'patients.mjs'), '// 自動生成（tools/build-api-data.js）\nexport default ' + JSON.stringify(out, null, 1) + ';\n');
console.log('patients:', Object.keys(out).join(', '));
