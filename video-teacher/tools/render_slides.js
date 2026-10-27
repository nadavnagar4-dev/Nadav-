// Render a Slides artifact deck (project/deck.json + slides/*.html + blob .jpgs, read with the Artifact tool) to s/p-NN.jpg.
// Set D to the folder the Artifact tool saved the deck into; run from the lesson output folder's parent.
const {chromium}=require('playwright');const fs=require('fs');
const D='/tmp/claude-0/-home-user/ee417d31-3353-504d-86e4-a4a1a210a728/scratchpad/artifact-files/9d657157-d06a-487c-aa57-96883d9730ca';
const deck=JSON.parse(fs.readFileSync(D+'/project/deck.json'));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2/3});
for(const [i,id] of deck.order.entries()){
 let h=fs.readFileSync(`${D}/project/slides/${id}.html`,'utf8');
 h=h.replace(/<aside>[\s\S]*?<\/aside>/,'').replace(/<x-shape kind="ellipse" style="/g,'<div style="border-radius:50%;').replace(/<\/x-shape>/g,'</div>')
  .replace(/\/_blob\/([0-9a-f]+)/g,`file://${D}/$1.jpg`).replace(/style="/,'style="position:relative;box-sizing:border-box;width:1920px;height:1080px;overflow:hidden;');
 const page=`<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400..800&display=swap" rel="stylesheet"><link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400..800&display=swap" rel="stylesheet"><style>*{margin:0;box-sizing:border-box}body{width:1920px;height:1080px}table{border-collapse:collapse}th,td{padding:10px 18px;border-bottom:1px solid #E4E0D3}h1,h2,h3,p{margin:0}</style></head><body>${h}</body></html>`;
 fs.writeFileSync('/tmp/slide.html',page);await p.goto('file:///tmp/slide.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
 await p.screenshot({path:`lesson/s/p-${String(i).padStart(2,'0')}.jpg`,type:'jpeg',quality:72});
}
await b.close();console.log('done',deck.order.length)})();
