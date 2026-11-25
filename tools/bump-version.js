// 公開前に実行: node tools/bump-version.js
// index.html の ?v= と version.txt の番号を1つ上げ、スマホに古い版が残らないようにする
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var v = String(parseInt(fs.readFileSync(path.join(root, 'version.txt'), 'utf8'), 10) + 1);
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/\?v=\d+"/g, '?v=' + v + '"')
  .replace(/var V = '\d+';/, "var V = '" + v + "';");
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'version.txt'), v + '\n');
console.log('version ' + v);
