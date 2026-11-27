// 本物のAIで通しプレイして、会話の全文を書き出す（噛み合わない所を探す用）
// node tests/ai-playthrough.mjs [pururu|lumie|gald] > 結果.txt   ※1人あたり約1円
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console };
vm.createContext(ctx);
for (const f of ['data-patients.js', 'data-flow.js', 'data-stage2.js', 'engine.js', 'story.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx);
const PATIENTS = vm.runInContext('PATIENTS', ctx), Story = vm.runInContext('Story', ctx);
const API = process.env.API || 'https://kokoro-clinic-api.netlify.app/api/talk';

// プレイヤーが言いそうなこと（台本の例文とは違う言い方）。足りなければ台本の例文を使う
const PLAYER = {
  pururu: [['体がしぼむって、どんな感じなの？'], ['それっていつ頃から？'], ['夜は出かけてるの？どこへ？'], ['その友達ってどんな子？'], ['モチくん、どこが悪いの？'],
    ['モチくんに自分のゼリーをあげてたから小さくなったんだね'], ['モチくんと一緒に病院に来てくれる？ひとりで抱えないで']],
  lumie: [['歌が聞こえないって、どういうこと？'], ['いつ頃からそうなったんですか？'], ['商業区にはよく行くんですか？'], ['その花屋さんって、どんな人がいるの？'],
    ['トマスさんのこと、好きなんですね'], ['一緒にいられる時間を大事にしてほしいです']],
  gald: [['昔はどんなお仕事を？'], ['夜中に起きるとき、夢を見たりしますか？'], ['のどの具合はどうですか？'], ['火って今でも吹けるんですか？'], ['お祭りで何か約束したんですか？'],
    ['火が出なくなってしまったんですね'], ['リノくんに本当のことを話してみませんか']],
  konoha: [['しっぽ、どうしたんですか？'], ['いつから抜けはじめたの？'], ['ご家族が来るんですか？'], ['夜は何のお仕事を？'], ['家族には仕事のこと何て言ってるの？'],
    ['家族にシェフだってうそをついてるんですね'], ['正直に話して、食堂に招待してみたら？']],
  mii: [['どこか痛いの？'], ['いつから？'], ['ピピってだれ？'], ['ピピと何かあったの？'], ['ピピとけんかしちゃったんだね'], ['ピピにごめんねって言ってみようよ']],
  noa: [['何か困っていることがあるんですか？'], ['それはいつからですか？'], ['博士って、どんな人？'], ['博士は今どこにいるんですか？'], ['博士は本当に旅に出ているの？'],
    ['博士に会えなくて、さみしいんですね'], ['さみしいと感じていいんですよ。歌っていいんです']]
};

// 「散らかった」遊び方：順番どおりに聞かない・関係ない質問・先回りの質問
const MESSY = {
  pururu: [['好きな食べ物は？'], ['ごはんは食べてる？'], ['夜は何してるの？'], ['お仕事はなに？'], ['モチって誰？'], ['なんで小さくなったの？'],
    ['友達にゼリーを分けてるんでしょ'], ['病院にモチくんを連れておいでよ']],
  lumie: [['こんにちは！今日はいい天気ですね'], ['その花のにおい、どこの？'], ['好きな人いるの？'], ['花屋のお兄さんのこと？'], ['なんで歌えないの？'],
    ['地球人の男の人に恋してるのね'], ['気持ちに正直になっていいと思います']],
  gald: [['おじいさん、何歳？'], ['眠れないのはいつから？'], ['リノくんって可愛いですね'], ['お祭りが楽しみですね'], ['今も火、吹けます？見せてください'],
    ['本当は火が吹けないんじゃないですか'], ['松明でリノくんと一緒に灯籠をともしたら？']]
};
if (process.env.MESSY) Object.assign(PLAYER, MESSY);
const L = (who, text) => ({ who, text });
const names = { me: 'あなた', nurse: 'ミケ', narr: '　', think: '💭' };
async function talk(payload) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8781' }, body: JSON.stringify(payload) });
  if (!r.ok) { console.log(`  !! API ${r.status}`); return null; }
  return r.json();
}

async function play(p) {
  const g = Story.start(p), log = [];
  const show = (lines) => lines.forEach(l => { log.push(l); console.log(`${l.who === 'p' ? p.name : l.who === 'c' ? l.name : names[l.who] || l.who}：${l.text}`); });
  const hist = () => log.filter(l => l.who === 'me' || l.who === 'p').slice(-24).map(l => ({ who: l.who, text: l.text }));
  const qs = (PLAYER[p.id] || []).map(a => a.slice());
  let qi = 0, guard = 0;
  console.log(`\n======== ${p.name} ========`);
  while (guard++ < 60) {
    const r = Story.run(g, { ai: true });
    show(r.lines);
    if (g.st.phase === 'left') { console.log('（帰ってしまった）'); break; }
    if (r.say) {
      const text = r.sayText || r.say.text;
      show([L('me', text)]);
      const res = await talk(Story.aiPayload(g, 'say', text, hist()));
      show((res ? Story.applyAI(g, text, res, true) : Story.localSay(g)).lines);
      continue;
    }
    if (!r.waiting) break;
    const s = r.waiting;
    let tries = 0, ok = false;
    while (!ok && tries < 3) {
      const text = (tries === 0 && qs[qi] && qs[qi][0]) || s.example;
      tries++;
      show([L('me', text)]);
      const res = await talk(Story.aiPayload(g, s.type, text, hist()));
      const a = res ? Story.applyAI(g, text, res, false) : Story.answer(g, text);
      show(a.lines);
      ok = !!a.ok;
      if (g.st.phase === 'left') break;
    }
    qi++;
    if (g.st.phase === 'left' || g.st.phase === 'done') break;
  }
  console.log(`--- 結果: ${g.st.phase} 信頼${g.st.trust} 怒り${g.st.anger || 0}`);
}

const only = process.argv[2];
for (const p of PATIENTS) if (!only || p.id === only) await play(p);
