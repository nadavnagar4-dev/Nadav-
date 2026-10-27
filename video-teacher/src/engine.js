/* ================= PLAYER — do not edit below this line ================= */
// Slide images: every entry without its own html card gets s/p-NN.jpg (entry 0 = intro, last = exam tip)
for(let i=1;i<S.length-1;i++) if(!S[i].html && !S[i].img) S[i].img=`s/p-${String(i).padStart(2,'0')}.jpg`;
// optional parts of the content block
const SAYM=typeof SAY!=='undefined'?SAY:{}, FIXM=typeof FIX!=='undefined'?FIX:{}, TSM=typeof TS!=='undefined'?TS:{};
// AUDIO: the narration was recorded with a neural voice (a/SS-LL.mp3 per subtitle line); lips = loudness per 50 ms
const AUD=typeof AUDIO!=='undefined'?AUDIO:null;
if(typeof TOPIC!=='undefined'){ document.querySelector('h1 .topic').textContent=TOPIC; }

const $=id=>document.getElementById(id);
const synth=window.speechSynthesis||null;
const T=$('teacher'), mouth=$('mouth');
const HE=LANG==='he';
let cur=0, seg=0, playing=false, run=0, timer=null, watchdog=null, timers=[];
const pref=(k,v)=>{ try{ if(v===undefined) return localStorage.getItem('vt2.'+k); localStorage.setItem('vt2.'+k,v); }catch(e){ return null; } };
const later=(fn,ms)=>{ const id=setTimeout(fn,Math.max(0,ms)); timers.push(id); return id; };
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function hash(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

/* ---------- voices: the most human-sounding voice on the device ---------- */
// iPad/iPhone list a downloaded Enhanced/Premium voice under the same name as the basic one,
// so look at the internal ID (voiceURI) too, e.g. com.apple.voice.enhanced.he-IL.Carmit
const vid=v=>`${v.name} ${v.voiceURI||''}`;
// robotic novelty and Eloquence voices (Bells, Zarvox, Eddy, Grandma...) always go to the end
const NOVELTY=/novelty|bad news|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|bahh|fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|eddy|flo\b|reed|sandy|eloquence|espeak/i;
function quality(v){ if(v.isDef) return 9; const n=vid(v); let s=0;
  if(/natural|neural/i.test(n)) s+=14;                 // Edge: Microsoft Avri / Hila / Andrew Online (Natural)
  if(/premium/i.test(n)) s+=11; if(/enhanced/i.test(n)) s+=8; if(/siri/i.test(n)) s+=9;
  if(/google/i.test(n)) s+=4; if(v.localService===false) s+=1;
  if(/compact|super-compact/i.test(n)) s-=6; if(NOVELTY.test(v.name)) s-=40; return s; }
const isHuman=v=>!!v && quality(v)>=6;
const DEF_HE={name:UI.defHe,lang:'he-IL',voiceURI:'__default_he__',isDef:true};
const DEF_EN={name:UI.defEn,lang:'en-US',voiceURI:'__default_en__',isDef:true};
// a default pseudo-voice only sets the language, so the device uses the voice chosen in Settings
function useVoice(u,v,lang){ u.lang=v?v.lang:lang; if(v && !v.isDef) u.voice=v; }
function label(v){ if(v.isDef) return v.name; const n=vid(v); let l=v.name;
  if(/premium/i.test(n)&&!/premium/i.test(v.name)) l+=' (Premium)';
  else if(/enhanced/i.test(n)&&!/enhanced/i.test(v.name)) l+=' (Enhanced)';
  return l+(quality(v)>=12?UI.natural:isHuman(v)?UI.good:''); }
let heV=null, enV=null, heList=[], enList=[];
function fillSelect(sel,list,key){ let keep=sel.value||pref(key)||''; sel.innerHTML='';
  list.forEach(x=>{ const o=document.createElement('option'); o.value=x.voiceURI||x.name; o.textContent=label(x)+(x.isDef?'':'  ('+x.lang.replace('_','-')+')'); sel.appendChild(o); });
  sel.value=list.some(x=>(x.voiceURI||x.name)===keep)?keep:(list[0]?(list[0].voiceURI||list[0].name):''); }
function rank(list,def){ const sorted=list.slice().sort((a,b)=>quality(b)-quality(a));
  // a real neural voice (Edge "Natural") beats everything; otherwise the device default comes first
  return sorted.length && quality(sorted[0])>=12 ? [sorted[0],def,...sorted.slice(1)] : [def,...sorted]; }
function loadVoices(){ if(!synth) return false; const v=synth.getVoices(); if(!v.length) return false;
  heList=rank(v.filter(x=>/^(he|iw)/i.test(x.lang)),DEF_HE);
  const en=v.filter(x=>/^en/i.test(x.lang));
  enList=rank(en.sort((a,b)=>(/en[-_]US/i.test(b.lang)?1:0)-(/en[-_]US/i.test(a.lang)?1:0)),DEF_EN);
  if(HE) fillSelect($('voice'),heList,'voiceURI');
  fillSelect($('envoice'),enList,'enURI');
  const all=v.filter(x=>/^(he|iw|en)/i.test(x.lang)).sort((a,b)=>a.lang.localeCompare(b.lang)||quality(b)-quality(a));
  $('vlist').textContent=`${v.length} voices. Hebrew + English (best first):\n`+all.map(x=>`${x.lang}  ${x.name}  [${x.voiceURI}]  q=${quality(x)}`).join('\n');
  pickVoices(); return true; }
function pickVoices(){
  heV=HE?(heList.find(x=>(x.voiceURI||x.name)===$('voice').value)||heList[0]||DEF_HE):DEF_HE;
  enV=enList.find(x=>(x.voiceURI||x.name)===$('envoice').value)||enList[0]||DEF_EN;
  const main=HE?heV:enV;
  $('note').textContent=UI.noteNow(label(main).replace(UI.natural,'').replace(UI.good,''), HE&&!IL()?enV.name:'');
}
if(synth){ synth.onvoiceschanged=loadVoices;
  // Safari sometimes fills the voice list late without firing the event, so keep checking for a few seconds
  let tries=0; (function poll(){ loadVoices(); if(++tries<12) setTimeout(poll,500); })(); }
else $('note').textContent=UI.noSpeech;

// Hebrew lessons: one voice for the whole sentence (English terms said with an Israeli accent from SAY),
// the way a lecturer in Israel says them. Switching to a second voice mid-sentence is what sounds robotic.
function IL(){ return !HE || $('termmode').value==='il'; }
if(HE){ const tm=pref('termmode'); if(tm) $('termmode').value=tm; $('envoice').hidden=IL(); }
const restart=()=>{ if(playing){ stopAudio(); later(speakSeg,120); } };
if(HE){
  $('termmode').onchange=()=>{ $('envoice').hidden=IL(); pref('termmode',$('termmode').value); pickVoices(); restart(); };
  $('voice').onchange=()=>{ pref('voiceURI',$('voice').value); pickVoices(); restart(); };
}
$('envoice').onchange=()=>{ pref('enURI',$('envoice').value); pickVoices(); restart(); };
{ const sp=pref('speed'); if(sp && [...$('speed').options].some(o=>o.value===sp)) $('speed').value=sp; }
$('speed').onchange=()=>{ pref('speed',$('speed').value); restart(); };
$('breath').checked=pref('breath')!=='0';
$('breath').onchange=()=>{ pref('breath',$('breath').checked?'1':'0'); if($('breath').checked){ initAudio(); breathe(320); } };
$('testv').onclick=()=>{ if(!synth) return; pause(); synth.cancel(); initAudio();
  setTimeout(()=>{ speakPlan([{chunks:[{l:HE?'h':'e',t:UI.sample,at:0}],...shape(UI.sample,0,2),pause:0}],0,()=>stopTalk()); },80); };

/* ---------- turning slide text into speech a person would say ---------- */
const ABBR_WORDS=/^(NOT|AND|THE|ALL|YES|NO|BUT|OR|ONLY|NEVER|ALWAYS|VERY|BOTH|WOW|OK|AIDS|ELISA|SARS|MERS|COVID|LASER|NASA|NATO|UNICEF|HAART|TORCH|SOAP|CREST|MALT|SIADH|CHARGE|VACTERL|HELLP)$/;
const ABBR_SAY={MRSA:'mersa',NSAID:'en-said',NSAIDs:'en-saids',CABG:'cabbage',HEENT:'heent',PERRLA:'perla',GERD:'gerd',ARDS:'ards',SIDS:'sids',CAT:'cat',COPD:'C O P D'};
const ROMAN={II:'two',III:'three',IV:'four',VI:'six',VII:'seven',VIII:'eight',IX:'nine',XI:'eleven',XII:'twelve',XIII:'thirteen'};
const DIG_EN=['zero','one','two','three','four','five','six','seven','eight','nine'];
function replaceMap(t,map){ const keys=Object.keys(map).sort((a,b)=>b.length-a.length); if(!keys.length) return t;
  const esc=k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return t.replace(new RegExp(keys.map(k=>/^\w/.test(k)&&/\w$/.test(k)?`\\b${esc(k)}\\b`:esc(k)).join('|'),'g'),m=>map[m]); }
function common(t){
  return t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu,'')
    .replace(/["“”«»](?=[\s.,!?:;]|$)|(^|[\s(])["“”«»]/g,'$1').replace(/[“”«»]/g,'').replace(/[*_#`]/g,'')
    .replace(/\s*\(([^()]*)\)\s*/g,', $1, ')              // brackets: say them as a short aside
    .replace(/\s+[–—]\s+/g,', ').replace(/\s*;\s*/g,'. ')
    .replace(/,\s*([.?!:])/g,'$1').replace(/,(\s*,)+/g,',').replace(/^\s*,\s*/,'')
    .replace(/!{2,}/g,'!').replace(/\?{2,}/g,'?').replace(/\s{2,}/g,' ');
}
function speakEN(t){
  t=common(t);
  t=t.replace(/\be\.g\.,?/gi,'for example,').replace(/\bi\.e\.,?/gi,'that is,').replace(/\bvs\.?(?=\s)/gi,'versus').replace(/\betc\./gi,'et cetera.')
     .replace(/\bapprox\.?/gi,'about').replace(/\bDr\./g,'Doctor').replace(/\bno\.\s*(?=\d)/gi,'number ')
     .replace(/\s*(?:→|->|⇒|⟶)\s*/g,' leads to ').replace(/\s*(?:←|<-)\s*/g,' comes from ')
     .replace(/\s*↑\s*/g,' high ').replace(/\s*↓\s*/g,' low ')
     .replace(/(\d)\s*[-–]\s*(\d)/g,'$1 to $2').replace(/(\d)\s*%/g,'$1 percent').replace(/~\s*(?=\d)/g,'about ')
     .replace(/≥\s*/g,'at least ').replace(/≤\s*/g,'at most ').replace(/>\s*(?=\d)/g,'more than ').replace(/<\s*(?=\d)/g,'less than ')
     .replace(/(\d)\s*[x×]\s*(\d)/g,'$1 by $2').replace(/\s*&\s*/g,' and ').replace(/\s*\+\s*(?=[A-Za-z])/g,' plus ')
     .replace(/(\d)\s*°\s*C\b/g,'$1 degrees').replace(/(\d)\s*mg\b/g,'$1 milligrams').replace(/(\d)\s*kg\b/g,'$1 kilos')
     .replace(/(\d)\s*m[lL]\b/g,'$1 milliliters').replace(/(\d)\s*mm\b/g,'$1 millimeters').replace(/(\d)\s*[µμ]m\b/g,'$1 microns')
     .replace(/([A-Za-z])\/([A-Za-z])/g,'$1 or $2');
  // Roman numerals after "type / class / factor..." are numbers, not letters
  t=t.replace(/\b(type|class|stage|grade|phase|factor|group|degree|nerve|CN|level|step)\s+(II|III|IV|VI|VII|VIII|IX|XI|XII|XIII)\b/gi,(m,a,r)=>a+' '+ROMAN[r.toUpperCase()]);
  // abbreviations are spelled out (H S V one), unless they are said as a word (AIDS, ELISA)
  t=t.replace(/\b([A-Z][A-Z0-9]{1,5}s?)(?:-(\d))?\b/g,(m,w,d)=>{
    if(ABBR_SAY[w]) return ABBR_SAY[w]+(d?' '+DIG_EN[+d]:'');
    if(ROMAN[w]&&w.length>1&&w!=='IV') return m; if(ABBR_WORDS.test(w)||!/[A-Z]{2}/.test(w)) return m;
    const plural=/[A-Z]s$/.test(w); const core=plural?w.slice(0,-1):w;
    return core.split('').map(c=>/\d/.test(c)?DIG_EN[+c]:c).join(' ')+(plural?"'s":'')+(d?' '+DIG_EN[+d]:''); });
  return t.replace(/\s{2,}/g,' ').trim();
}
function speakHE(t){
  t=common(t);
  return t.replace(/\s*(?:→|->|⇒|⟶)\s*/g,' ואז ').replace(/\s*↑\s*/g,' עלייה ב').replace(/\s*↓\s*/g,' ירידה ב')
    .replace(/(\d)\s*[-–]\s*(\d)/g,'$1 עד $2').replace(/(\d)\s*%/g,'$1 אחוז').replace(/~\s*(?=\d)/g,'בערך ')
    .replace(/≥\s*/g,'לפחות ').replace(/≤\s*/g,'לכל היותר ').replace(/\s*&\s*/g,' ו').replace(/\s*\+\s*/g,' ועוד ')
    .replace(/([֐-׿])\/([֐-׿])/g,'$1 או $2').replace(/\s{2,}/g,' ').trim();
}
function spoken(t,l){ t=replaceMap(t,FIXM); if(!HE) t=replaceMap(t,SAYM); return l==='e'?speakEN(t):speakHE(t); }

/* ---------- how a real teacher talks: pace, melody and pauses per sentence ---------- */
// Hebrew has no \b, so a word must not touch other Hebrew letters ("חשוב" but not "נחשוב")
const EMPH=HE?/(?<![\u05D0-\u05EA])(חשוב|חשובה|תזכור|זכור|שים לב|במבחן|למבחן|הכי|קלאסי|תמיד|אף פעם|בדיוק|המפתח)(?![\u05D0-\u05EA])/:/\b(important|remember|key|exam|classic|always|never|notice|look at|the trick|high.yield|memori[sz]e)\b/i;
const ASIDE=HE?/^(אגב|דרך אגב|בקיצור|סתם|כמובן|נו,)(?![\u05D0-\u05EA])/:/^(by the way|anyway|just so you know|of course|fun fact)/i;
const WARM=HE?/(נדב|בהצלחה|כל הכבוד|יופי|מעולה|ברוך)/:/(Nadav|good luck|well done|great|awesome|nice)/i;
function shape(t,i,n){
  t=t.trim(); const words=t.split(/\s+/).length;
  const q=/[?]$/.test(t), ex=/!$/.test(t), ell=/(\.\.\.|…)$/.test(t);
  let rate=1, pitch=1, pause;
  if(q){ pitch=1.03; pause=560; }                      // a question: brighter, then a beat to think
  else if(ell){ pause=620; }                            // "..." = dramatic pause
  else if(ex){ pitch=1.03; pause=340; }
  else pause=200+Math.min(words,28)*7;                  // longer sentence, longer breath after it
  if(words<=3 && !q && !ell){ rate*=1.05; pitch*=1.02; pause=Math.min(pause,260); } // quick reactions: "Easy." "יופי."
  if(/\d/.test(t)) rate*=0.95;                          // numbers are said carefully
  if(EMPH.test(t)){ rate*=0.94; pause+=80; }            // the important bit: slower
  if(ASIDE.test(t)){ rate*=1.05; pitch*=0.98; }         // asides go by quicker and lower
  if(WARM.test(t)) pitch*=1.02;
  if(words>=20) rate*=1.03;                             // long explanations flow faster
  if(i===0) pitch*=1.02;                                // a new slide starts a little brighter...
  if(i===n-1){ pitch*=0.985; pause+=120; }              // ...and the last thought winds down
  const h=hash(t); rate*=1+((h%7)-3)/160; pitch*=1+(((h>>>3)%5)-2)/160; // small human variation, same on every replay
  rate=clamp(rate,.88,1.1); pitch=clamp(pitch,.95,1.07);
  return {rate,pitch,pause,q,ex,ell,emph:EMPH.test(t),words};
}

/* ---------- breathing between sentences ---------- */
let actx=null;
function initAudio(){ try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==='suspended') actx.resume(); }catch(e){ actx=null; } }
function breathe(ms){
  if(!actx||!$('breath').checked) return;
  try{ const d=clamp(ms/1000*.75,.2,.42), sr=actx.sampleRate, n=Math.floor(sr*d);
    const buf=actx.createBuffer(1,n,sr), ch=buf.getChannelData(0); let b0=0,b1=0,b2=0;
    for(let i=0;i<n;i++){ const w=Math.random()*2-1; b0=.99765*b0+w*.099046; b1=.963*b1+w*.2965164; b2=.57*b2+w*1.0526913;
      const x=i/n, env=x<.6?Math.sin(x/.6*Math.PI/2):Math.cos((x-.6)/.4*Math.PI/2); ch[i]=(b0+b1+b2+w*.1848)*.2*env*env; }
    const src=actx.createBufferSource(); src.buffer=buf;
    const hp=actx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=380;
    const bp=actx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1500; bp.Q.value=.55;
    const g=actx.createGain(); g.gain.value=.09;
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(actx.destination); src.start();
  }catch(e){}
}

/* ---------- teacher animation: the mouth follows the words ---------- */
// 0 = closed smile (the picture itself); 1 = slightly open, 2 = open, 3 = round "o", 4 = wide "a"
const MOUTH_SHAPE=[[0,0],[.45,1],[.85,1],[.65,.85],[1,1]];
let talking=false, mouthT=null, lipQ=[], lastBoundary=0;
function setMouth(i){ const [sy,sx]=MOUTH_SHAPE[i]; mouth.style.opacity=sy?1:0; mouth.style.transform=`scale(${sx},${sy})`; }
function clearLips(){ lipQ.forEach(clearTimeout); lipQ=[]; }
// syllables of a word -> mouth shapes (Hebrew is written without vowels, so guess from letters)
function syllables(w){
  if(/[֐-׿]/.test(w)){ const L=w.replace(/[^֐-׿]/g,''); const n=Math.max(1,Math.round(L.length/2)); const out=[];
    for(let k=0;k<n;k++){ const c=L[Math.min(L.length-1,k*2+1)]||''; out.push(/[ו]/.test(c)?3:/[אהע]/.test(c)?4:/[י]/.test(c)?1:2); } return out; }
  const g=w.toLowerCase().match(/[aeiouy]+/g)||['a']; return g.map(v=>/[ou]/.test(v[0])?3:/a/.test(v[0])?4:/[ei]/.test(v[0])?(Math.random()<.5?1:2):2);
}
function lipWord(word,rate){
  clearLips(); const sy=syllables(word), per=clamp((word.length*58+70)/rate/sy.length,90,240);
  sy.forEach((s,k)=>{ lipQ.push(setTimeout(()=>{ if(talking) setMouth(s); },k*per)); lipQ.push(setTimeout(()=>{ if(talking) setMouth(1); },k*per+per*.62)); });
  lipQ.push(setTimeout(()=>{ if(talking) setMouth(0); },sy.length*per+30));
}
// if the voice sends no word events, keep a natural syllable rhythm instead
function flap(){ if(!talking){ setMouth(0); return; }
  if(Date.now()-lastBoundary>450){ const r=Math.random(); setMouth(r<.14?0:r<.4?1:r<.68?2:r<.84?3:4); }
  mouthT=setTimeout(flap,95+Math.random()*95); }
function startTalk(){ if(talking) return; talking=true; clearTimeout(mouthT); flap(); }
function stopTalk(){ talking=false; clearTimeout(mouthT); clearLips(); setMouth(0); }
function blink(){ T.classList.add('blink'); setTimeout(()=>T.classList.remove('blink'),130);
  if(Math.random()<.2) setTimeout(()=>{T.classList.add('blink');setTimeout(()=>T.classList.remove('blink'),120)},260);
  setTimeout(blink,2200+Math.random()*3800); }
setTimeout(blink,1500);
function pulse(cls,ms){ T.classList.remove(cls); void T.offsetWidth; T.classList.add(cls); setTimeout(()=>T.classList.remove(cls),ms); }
function lookSlide(on){ T.classList.toggle('look',on); T.classList.toggle('lookme',!on); T.classList.toggle('point',on); }
function gesture(p){
  if(p.q){ pulse('brow',900); lookSlide(false); }
  else if(p.ell){ T.classList.add('tilt'); setTimeout(()=>T.classList.remove('tilt'),1400); }
  else if(p.emph){ pulse('nod',700); }
  else if(Math.random()<.25) pulse('nod',700);
}
function idleLook(){ if(!talking && Math.random()<.5){ T.classList.toggle('look'); T.classList.toggle('lookme'); } setTimeout(idleLook,3000+Math.random()*3000); }
idleLook();

/* ---------- the lesson flow ---------- */
// Hebrew that starts a new sentence after an English term (otherwise the sentence goes on after the term)
const STARTER=/^(אז |ועכשיו|עכשיו|זה |זאת |זו |יש |אין |אם |כש|למה|מה |ומה |איך|ואיך|הנה|תזכור|זכור|שים לב|טוב|אוקיי|יופי|במבחן|בקיצור|אבל |ולפני|קודם|עוד |גם |כלומר|תחשוב|נכון|ומי |מי )/;
function afterTerm(next,colonBefore){
  const t=next.trim(), first=t.split(/[.?!,:]/)[0];
  if(colonBefore || STARTER.test(t)) return '. ';           // "הטיפול: Metronidazole. אז..."
  if(/^עושה/.test(t) || first.split(/\s+/).length<=2) return ' '; // "ופריטין נמוך?"
  return ', ';                                               // "Giardia, שגורם לשלשול..."
}
// Build the rest of the slide as one text, remembering where each subtitle line starts
function buildFlow(x,from){
  let text='', starts=[], colonBefore=false;
  for(let i=from;i<x.s.length;i++){
    const [l,t]=x.s[i];
    if(text){
      // a lone Hebrew prefix letter (ב, ו, ל, ה, מ, ש, כ) joins the term: בטוקסופלזמה / ב-Toxoplasma
      if(l==='e' && /(^|\s)(?:[בולהמשכ]|מה|וב|וה|ול|שה|כש)$/.test(text)) text+= IL()?'':'-';
      // after an English term inside Hebrew: a comma if the Hebrew goes on with the same sentence, else a full stop
      else if(HE && l==='h' && x.s[i-1] && x.s[i-1][0]==='e' && !/[.?!,:]$/.test(text)) text+=afterTerm(t,colonBefore);
      else text+=' ';
    }
    if(l==='h') colonBefore=/:\s*$/.test(t);
    starts.push({i,at:text.length});
    text+= (HE && l==='e' && IL() && SAYM[t]) ? SAYM[t] : t;
  }
  return {text,starts};
}
function segAt(starts,pos){ let s=starts[0].i; for(const st of starts){ if(st.at<=pos) s=st.i; else break; } return s; }
// sentences: split after . ? ! … — but not inside 1.5, after E. coli / e.g., and keep "..." with its sentence
function splitSentences(text){
  const out=[]; let st=0, m; const re=/(\.\.\.|…|[.?!]+)(?=\s|$)/g;
  const push=(a,b)=>{ const raw=text.slice(a,b), lead=raw.match(/^\s*/)[0].length, t=raw.trim(); if(t) out.push({t,at:a+lead}); };
  while((m=re.exec(text))){ const end=m.index+m[0].length, before=text.slice(Math.max(0,m.index-8),m.index+1);
    if(m[0]==='.' && (/(^|[\s(])(e\.g|i\.e|vs|etc|Dr|approx|no|St)\.$/i.test(before) ||
      (/(^|[\s(])[A-Za-z]\.$/.test(before) && /^\s+[a-z]/.test(text.slice(end))))) continue;   // E. coli, but "P C R. And..." ends
    push(st,end); st=end; }
  push(st,text.length);
  // a very long sentence is said in two breaths, split at the comma nearest the middle
  const res=[]; for(const s of out){ if(s.t.length<210){ res.push(s); continue; }
    const mid=s.t.length/2; let best=-1; s.t.replace(/, /g,(mm,off)=>{ if(best<0||Math.abs(off-mid)<Math.abs(best-mid)) best=off; return mm; });
    if(best<40){ res.push(s); continue; }
    res.push({t:s.t.slice(0,best+1),at:s.at,breath:true}); res.push({t:s.t.slice(best+2),at:s.at+best+2}); }
  return res;
}
const PREFIX_SOUND={'ב':'beh','ו':'veh','ל':'leh','ה':'ha','מ':'mi','ש':'sheh','כ':'keh','מה':'meh-ha','וב':'oo-veh','וה':'veh-ha','ול':'veh-leh','שה':'sheh-ha','כש':'keh-sheh'};
function chunksOf(x,text,starts,sn){
  const ranges=starts.map((st,j)=>({i:st.i,l:x.s[st.i][0],raw:x.s[st.i][1],a:st.at,b:j+1<starts.length?starts[j+1].at:text.length}));
  const A=sn.at, B=sn.at+sn.t.length, out=[];
  for(const r of ranges){ const a=Math.max(A,r.a), b=Math.min(B,r.b); if(a>=b) continue;
    let t=text.slice(a,b), at=a;
    // Hebrew lessons: an English term is said by the Hebrew voice (from SAY) unless the viewer chose an English voice for terms
    let l=r.l==='h'?'h':(!HE?'e':(IL()&&SAYM[r.raw]?'h':'e'));
    if(l==='e' && HE){ t=t.replace(/^[-\s]+/,''); if(!t.trim()) continue;
      const prev=out[out.length-1];
      if(prev && prev.l==='h'){ const pm=prev.t.match(/(^|\s)(מה|וב|וה|ול|שה|כש|[בולהמשכ])-?\s*$/);
        if(pm){ prev.t=prev.t.slice(0,prev.t.length-pm[0].length+pm[1].length); t=PREFIX_SOUND[pm[2]]+' '+t; if(!prev.t.trim()) out.pop(); } } }
    const last=out[out.length-1];
    if(last && last.l===l) last.t+=t; else out.push({l,t,at});
  }
  return out.filter(c=>c.t.replace(/[\s.,:;!?-]/g,''));
}
function planSlide(x,from){
  const {text,starts}=buildFlow(x,from);
  const sents=splitSentences(text), lineStarts=new Set(starts.map(s=>s.at));
  return {starts,plan:sents.map((s,i)=>{ const p=shape(s.t,i,sents.length);
    if(s.breath) p.pause=170;
    const nx=sents[i+1]; if(nx && lineStarts.has(nx.at)) p.pause+=90;   // a new subtitle line = a new thought
    return {...p,chunks:chunksOf(x,text,starts,s)}; })};
}

/* ---------- speaking ---------- */
function speakPlan(plan,k,done,onPos){
  const my=run, base=+$('speed').value;
  if(k>=plan.length){ done(); return; }
  const p=plan[k]; let ci=0, spokeAny=false;
  const next=()=>{ if(my!==run) return; clearTimeout(watchdog); ci++;
    if(ci<p.chunks.length){ const gap=/:\s*$/.test(p.chunks[ci-1].t)?200:20; later(()=>{ if(my===run) say(); },gap/base); return; }
    stopTalk();
    const pause=p.pause/base;
    if(k+1<plan.length && pause>=260 && (p.words>=10 || k%3===2)) later(()=>{ if(my===run) breathe(pause); },pause-clamp(pause*.75,200,420)-40);
    later(()=>{ if(my===run) speakPlan(plan,k+1,done,onPos); },pause);
  };
  const say=()=>{
    const c=p.chunks[ci]; if(onPos) onPos(c.at);
    const txt=spoken(c.t,c.l); if(!txt.replace(/[\s.,:;!?-]/g,'')) return next();
    const u=new SpeechSynthesisUtterance(txt);
    if(c.l==='e') useVoice(u,enV,'en-US'); else useVoice(u,heV,'he-IL');
    const termInHebrew=HE&&c.l==='e';
    u.rate=clamp(base*p.rate*(termInHebrew?.95:1),.5,2); u.pitch=clamp(p.pitch,.5,2); u.volume=1;
    const ratio=c.t.length/Math.max(1,txt.length);
    u.onstart=()=>{ if(my!==run) return; startTalk(); if(!spokeAny){ spokeAny=true; gesture(p); } if(termInHebrew) lookSlide(true); };
    u.onboundary=(ev)=>{ if(my!==run||ev.name==='sentence') return; lastBoundary=Date.now();
      const w=(txt.slice(ev.charIndex).match(/^[^\s,.;:!?]+/)||[''])[0]; if(w) lipWord(w,u.rate);
      if(onPos) onPos(c.at+Math.floor(ev.charIndex*ratio)); };
    u.onend=()=>{ if(termInHebrew) lookSlide(false); next(); };
    u.onerror=(ev)=>{ if(ev.error==='interrupted'||ev.error==='canceled') return; next(); };
    watchdog=setTimeout(()=>{ if(my===run) next(); },(txt.length*(c.l==='e'?75:85))/u.rate*2+5000);
    startTalk(); synth.speak(u);
  };
  say();
}
function speakSeg(){
  const my=++run; const x=S[cur];
  if(seg>=x.s.length){ stopTalk();
    if(cur<S.length-1){ const r=+$('speed').value;
      // finish the thought, turn to the next slide, look at it for a moment, then talk
      later(()=>{ if(my!==run||!playing) return; cur++; seg=0; render(); pulse('wave',1100); lookSlide(true);
        later(()=>{ if(my===run&&playing){ lookSlide(false); speakSeg(); } },800/r); },500/r); }
    else { playing=false; updPlay(); }
    return; }
  markSeg();
  if(AUD){ speakAudio(my); return; }
  if(!synth){ // no speech engine: just run the subtitles at reading speed
    later(()=>{ if(my===run&&playing){ seg++; speakSeg(); } },x.s[seg][1].length*70/(+$('speed').value)+600); return; }
  const {starts,plan}=planSlide(x,seg);
  speakPlan(plan,0,()=>{ if(my===run&&playing){ seg=x.s.length; speakSeg(); } },
    pos=>{ const ns=segAt(starts,pos); if(ns!==seg && ns>seg){ seg=ns; markSeg(); } });
}

/* ---------- recorded narration ---------- */
const aud=new Audio(); aud.preload='auto'; aud.setAttribute('playsinline','');
const pad2=n=>String(n).padStart(2,'0'), afile=(i,j)=>`a/${pad2(i)}-${pad2(j)}.mp3`;
let lipRAF=0, audStarted=false;
const LEVEL_SHAPE=[0,1,2,3,4];
function lipFollow(key){ const env=(AUD.lips||{})[key]; cancelAnimationFrame(lipRAF);
  const tick=()=>{ if(aud.paused||aud.ended){ setMouth(0); return; }
    const v=env? (+env[Math.floor(aud.currentTime*20)]||0) : (Math.random()*5|0); setMouth(LEVEL_SHAPE[v]); lipRAF=requestAnimationFrame(tick); };
  tick(); }
function speakAudio(my){
  const x=S[cur], line=x.s[seg], rate=+$('speed').value, key=`${pad2(cur)}-${pad2(seg)}`;
  audStarted=true; aud.src=afile(cur,seg); aud.playbackRate=rate; aud.defaultPlaybackRate=rate;
  const p=shape(line[1],seg,x.s.length);
  aud.onplaying=()=>{ if(my!==run) return; talking=true; clearTimeout(mouthT); lipFollow(key); gesture(p); };
  const next=(ms)=>{ if(my!==run) return; talking=false; setMouth(0); seg++; later(()=>{ if(my===run&&playing) speakSeg(); },ms/rate); };
  aud.onended=()=>{ const t=line[1].trim(); next(/\?$/.test(t)?520:/(\.\.\.|…)$/.test(t)?620:/!$/.test(t)?360:300); };
  aud.onerror=()=>{ if(my!==run) return; // a missing file: say this line with the device voice instead
    if(synth){ const u=new SpeechSynthesisUtterance(spoken(line[1],line[0])); useVoice(u,line[0]==='e'?enV:heV,line[0]==='e'?'en-US':'he-IL'); u.rate=rate;
      u.onend=()=>next(300); u.onerror=()=>next(300); startTalk(); synth.speak(u); } else next(300); };
  const pr=aud.play(); if(pr&&pr.catch) pr.catch(e=>{ if(my===run && e && e.name==='NotAllowedError') pause(); });
  // fetch the next line early so there is no gap
  const nx=x.s[seg+1]?afile(cur,seg+1):(S[cur+1]?afile(cur+1,0):null); if(nx){ const pre=new Audio(); pre.preload='auto'; pre.src=nx; }
}
if(AUD){ ['voice','termmode','envoice','testv'].forEach(id=>{ if($(id)) $(id).hidden=true; }); $('breath').parentNode.hidden=true;
  $('vdiag').hidden=true; setTimeout(()=>{ $('note').textContent=UI.recorded; },0); }

/* ---------- player ---------- */
const jump=$('jump');
S.forEach((x,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i===0||i===S.length-1)?x.t:`${i}. ${x.t}`;jump.appendChild(o)});
let vidReady=false; const vEl=$('vid');
const hasVid=()=>Object.keys(TSM).length>0;
if(hasVid()) $('vload').hidden=false;
function seekTo(t){ if(!vidReady) return; try{ vEl.pause(); vEl.currentTime=Math.min(t,(vEl.duration||t)-0.5); }catch(e){} }
document.querySelector('label.vbtn').addEventListener('click',e=>{ e.preventDefault(); $('vfile').click(); });
$('vfile').addEventListener('change',e=>{
  const f=e.target.files&&e.target.files[0]; if(!f) return;
  vEl.src=URL.createObjectURL(f); vEl.muted=true; $('vstate').textContent=UI.vLoading;
  vEl.addEventListener('loadedmetadata',()=>{
    // iPad shows a frame only after the video has played once
    const p=vEl.play(); const done=()=>{ vEl.pause(); vidReady=true; render(); $('vstate').textContent=UI.vReady; document.querySelector('label.vbtn').textContent=UI.vSwap; };
    if(p&&p.then) p.then(done).catch(done); else done();
  },{once:true});
  vEl.addEventListener('error',()=>{ $('vstate').textContent=UI.vError; },{once:true});
});
function render(){
  const x=S[cur], useVid=vidReady && TSM[cur]!=null && cur!==0 && cur!==S.length-1;
  if(x.img){ const im=$('slideImg'); im.hidden=true; im.src=x.img; im.alt=x.t; void im.offsetWidth; im.hidden=false; $('card').hidden=true; }
  else if(useVid){
    // the picture from the viewer's own video, with the fact as a caption strip
    $('card').hidden=true; $('slideImg').hidden=true; vEl.hidden=false; seekTo(TSM[cur]);
    const tmp=document.createElement('div'); tmp.innerHTML=x.html||'';
    const term=tmp.querySelector('.fterm'), he=tmp.querySelector('.fhe'), ex=tmp.querySelector('.fextra'), cap=$('vcap');
    if(term){ cap.innerHTML=`<span class="t">${term.textContent}</span> · ${he?he.innerHTML:''}${ex?'<br>'+ex.innerHTML:''}`; cap.hidden=false; } else cap.hidden=true;
  }
  else { $('card').innerHTML=x.html||''; $('card').hidden=false; $('slideImg').hidden=true; }
  if(!useVid){ vEl.hidden=true; $('vcap').hidden=true; }
  $('counter').textContent=UI.counter(cur,S.length);
  $('prog').style.width=(cur/(S.length-1)*100)+'%';
  jump.value=cur;
  const subs=$('subs'); subs.innerHTML='';
  const ti=document.createElement('div'); ti.className='ti'; ti.textContent=x.t; subs.appendChild(ti);
  x.s.forEach(([l,t],i)=>{const d=document.createElement('div');d.className=l==='e'?'e':'h';d.textContent=t;d.dataset.i=i;
    d.onclick=()=>{ seg=i; stopAudio(); if(!playing) play(); else later(speakSeg,120); }; subs.appendChild(d)});
  markSeg();
  const n=S[cur+1]; if(n&&n.img){const p=new Image(); p.src=n.img;}
}
function updateCC(){
  const x=S[cur], seg_=x&&x.s[seg], cc=$('cc');
  if(!playing||!seg_){ cc.hidden=true; return; }
  const [l,t]=seg_, sp=$('ccText');
  sp.textContent=t; sp.dir=(l==='e'?'ltr':'rtl'); cc.hidden=false;
  if(sp.dataset.k!==cur+':'+seg){ sp.dataset.k=cur+':'+seg; T.classList.remove('lean'); void T.offsetWidth; T.classList.add('lean'); }
}
function markSeg(){ updateCC();
  document.querySelectorAll('#subs [data-i]').forEach(d=>{const i=+d.dataset.i;
    d.classList.toggle('past',playing&&i<seg); d.classList.toggle('now',i===seg&&playing);
    if(i===seg&&playing) d.scrollIntoView({block:'nearest',behavior:'smooth'});});
}
function stopAudio(){ run++; clearTimeout(watchdog); timers.forEach(clearTimeout); timers=[]; if(synth) synth.cancel();
  if(AUD){ aud.onended=aud.onerror=aud.onplaying=null; aud.pause(); cancelAnimationFrame(lipRAF); } stopTalk(); }
function updPlay(){ $('play').textContent=playing?UI.pause:UI.play; if(!playing) stopTalk(); markSeg(); }
function play(){ const first=!$('startBtn').hidden; $('startBtn').hidden=true; playing=true; updPlay(); stopAudio(); initAudio();
  // iPad: speech must start inside the tap, so say a silent word right away
  if(synth && !AUD){ try{ const u=new SpeechSynthesisUtterance(' '); u.volume=0; synth.speak(u); }catch(e){} }
  // iPad: audio must start inside the tap, so start the first file now (speakAudio takes over right after)
  if(AUD){ audStarted=false; aud.src=afile(cur,Math.min(seg,S[cur].s.length-1)); const pr=aud.play(); if(pr&&pr.then) pr.then(()=>{ if(!audStarted) aud.pause(); }).catch(()=>{}); }
  if(first){ pulse('wave',1100); later(()=>{ if(playing) speakSeg(); },700); } else later(speakSeg,150); }
function pause(){ playing=false; stopAudio(); updPlay(); }
function go(i){ cur=Math.max(0,Math.min(S.length-1,i)); seg=0; stopAudio(); render(); if(playing) later(speakSeg,250); }

$('startBtn').onclick=play;
$('play').onclick=()=>playing?pause():play();
$('next').onclick=()=>go(cur+1);
$('prev').onclick=()=>go(cur-1);
jump.onchange=()=>{ $('startBtn').hidden=true; go(+jump.value); };
document.addEventListener('keydown',e=>{ if(e.target.tagName==='SELECT'||e.target.tagName==='INPUT') return;
  if(e.key===' '){e.preventDefault(); playing?pause():play();}
  if(e.key===UI.keyNext) go(cur+1); if(e.key===UI.keyPrev) go(cur-1); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&playing) pause(); });
render();
