// 助手ミケのドット絵（32x32）。参考画像：茶色のポニーテール、青いスクラブ、名札のストラップ
var NURSE_ART = {
  pal: {
    o: '#3a2430', h: '#a8673e', H: '#cf8f5c', d: '#7c4528',
    s: '#ffe6d2', S: '#f3c6aa', e: '#5b2f1d', E: '#9a5a34', w: '#ffffff',
    c: '#f6a3a3', m: '#b8433f', t: '#f28c8c',
    b: '#86aef0', B: '#5f86d6', l: '#2f55b0', i: '#f5f7ff', g: '#9aa6c8'
  },
  // 目を開けた顔
  open: [
    '................................',
    '..........oooooooo..............',
    '........oohhhhhhhhoo............',
    '.......ohhhHHHhhhhhhho...oooo...',
    '......ohhHHHhhhhhhhhhhooohhhho..',
    '.....ohhhhhhhhhhhhhhhhhhohhHhho.',
    '.....ohhhhhhhhhhhhhhhhhhhohhhhho',
    '....ohhhhhhhhhhhhhhhhhhhhhohhdho',
    '....ohhhhhdhhhhhhhhdhhhhhhohhhho',
    '....ohhhhdshhhhhhhdshhhhhhohhdho',
    '....ohhhdsshhhhhhdsssshhhhhohhho',
    '....ohhhssssshhhdssssssshhhohhdo',
    '....ohhsooooossssooooosshhhohhho',
    '....ohhsewwEessssewwEeshhhhohhdo',
    '....ohhsewEEessssewEEeshhhoohhho',
    '....ohhseEEEesssseEEEeshhhohhdo.',
    '....ohhseEEwesssseEEweshhhohhho.',
    '....ohhsseeesssssseeesschhohhdo.',
    '.....ohsccssssssssssccshohhho...',
    '.....ohssssssoooossssshohdo.....',
    '......osssssssmttmsssssohhho....',
    '.......osssssssmmssssoohdo......',
    '........oossssssssssssoo..oo....',
    '..........ooSSSSSSSSoo..........',
    '...........obSSSSSSbo...........',
    '........oobbbwlSSlwbbboo........',
    '......oobbbbbbwllwbbbbbbboo.....',
    '.....obbbbbbbbblbblbbbbbbbbo....',
    '....obbBbbbbbbblbblbbbbbBbbbo...',
    '....obbBbbbbbbbbllbbbbbbBbbbo...',
    '...obbbBbbbbbbbiiiibbbbbBbbbbo..',
    '...obbbBbbbbbbbiggibbbbbBbbbbo..'
  ]
};
// まばたき用：目の行を、笑った閉じ目（^^）に差しかえる
NURSE_ART.blink = NURSE_ART.open.slice();
NURSE_ART.blink[12] = '....ohhsssssssssssssssshhhohhho.';
NURSE_ART.blink[13] = '....ohhssssssssssssssssshhhhohhd';
NURSE_ART.blink[14] = '....ohhssooossssssooosshhhoohhho';
NURSE_ART.blink[15] = '....ohhsosssossssosssoshhhohhdo.';
NURSE_ART.blink[16] = '....ohhssssssssssssssssshhhohhho';
