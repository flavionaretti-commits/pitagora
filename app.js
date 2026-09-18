(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  const RATIOS = [
    {a:1,b:1,name:'Unisono', short:'UNISONO', note:'stessa altezza', desc:'La corda vibra per intero: la frequenza non cambia.'},
    {a:1,b:2,name:'Ottava', short:'OTTAVA', note:'8ª', desc:'Metà lunghezza → frequenza doppia.'},
    {a:2,b:3,name:'Quinta giusta', short:'QUINTA GIUSTA', note:'5ª', desc:'Due terzi della lunghezza → frequenza 3/2.'},
    {a:3,b:4,name:'Quarta giusta', short:'QUARTA GIUSTA', note:'4ª', desc:'Tre quarti della lunghezza → frequenza 4/3.'},
    {a:8,b:9,name:'Tono pitagorico', short:'TONO PITAGORICO', note:'tono', desc:'Otto noni della lunghezza → frequenza 9/8.'},
    {a:64,b:81,name:'Ditono pitagorico', short:'DITONO', note:'3ª magg. pitagorica', desc:'64/81 della lunghezza → frequenza 81/64.'}
  ];

  const state = {
    ratioIndex:1,
    sound:true,
    free:false,
    freeFraction:.5,
    scaleStep:0,
    harmonic:2,
    audio:null,
    challengeIndex:0,
    score:0,
    challenge:null,
    challengeFinished:false,
    experiment:null,
    theme:localStorageSafeGet('pitagora-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light')
  };

  function localStorageSafeGet(k){ try{return localStorage.getItem(k)}catch{return null} }
  function localStorageSafeSet(k,v){ try{localStorage.setItem(k,v)}catch{} }
  function fmt(n,d=2){return Number(n).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function gcd(a,b){while(b){[a,b]=[b,a%b]} return a}
  function fracText(a,b){const g=gcd(a,b);return `${a/g}/${b/g}`}
  function ordinal(n){return n===1?'1ª':`${n}ª`}

  function nearestFraction(x,maxDen=12){
    let best={n:1,d:1,error:Infinity};
    for(let d=1;d<=maxDen;d++) for(let n=1;n<=d;n++){
      const e=Math.abs(x-n/d); if(e<best.error) best={n,d,error:e};
    }
    const g=gcd(best.n,best.d); best.n/=g; best.d/=g; return best;
  }

  function nearestNote(freq){
    const midi=69+12*Math.log2(freq/440);
    const nearest=Math.round(midi); const cents=1200*Math.log2(freq/(440*Math.pow(2,(nearest-69)/12)));
    const names=['DO','DO♯','RE','RE♯','MI','FA','FA♯','SOL','SOL♯','LA','LA♯','SI'];
    const octave=Math.floor(nearest/12)-1;
    return {name:`${names[(nearest%12+12)%12]}${octave}`,cents};
  }

  function initTheme(){document.documentElement.dataset.theme=state.theme; $('#themeBtn').textContent=state.theme==='dark'?'☀':'☾'}

  function setupTabs(){
    $$('.tab').forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.dataset.tab;
      $$('.tab').forEach(b=>b.classList.toggle('is-active',b===btn));
      $$('.tab-panel').forEach(p=>p.classList.toggle('is-active',p.id===`tab-${id}`));
      if(id==='scala') renderScaleLab();
      if(id==='armonici') updateHarmonic();
    }));
  }

  function renderRatioButtons(){
    const strip=$('#ratioStrip'); strip.innerHTML='';
    RATIOS.forEach((r,i)=>{
      const b=document.createElement('button'); b.type='button'; b.className='ratio-btn';
      b.innerHTML=`<strong>${r.a} : ${r.b}</strong><span>${r.name}</span>`;
      b.addEventListener('click',()=>{state.ratioIndex=i;state.free=false;$('#freeLength').value=(r.a/r.b*100).toFixed(1);updateMonochord();});
      strip.appendChild(b);
    });
  }

  function currentBase(){return Number($('#baseNote').value)}
  function currentFraction(){return state.free?state.freeFraction:(RATIOS[state.ratioIndex].a/RATIOS[state.ratioIndex].b)}
  function setFreeFraction(value){
    state.free=true; state.freeFraction=Math.max(.25,Math.min(1,Number(value)));
    $('#freeLength').value=(state.freeFraction*100).toFixed(1); updateMonochord();
  }

  function updateMonochord(){
    const ratio=RATIOS[state.ratioIndex], frac=currentFraction();
    const base=currentBase(); const freq=base/frac; const nn=nearestNote(freq);
    const xR=900,xL=100,w=xR-xL,x=xR-w*frac;
    $('#activeString').setAttribute('x1',x);
    $('#pressGroup').setAttribute('transform',`translate(${x} 0)`);
    $('#measureBrace').setAttribute('d',`M${x} 245 v14 H900 v-14`);
    $('#lengthSvgLabel').setAttribute('x',(x+900)/2);
    const f=nearestFraction(frac,12);
    $('#lengthSvgLabel').textContent=`L' = ${f.n}/${f.d} L`;
    $('#lengthFraction').textContent=`${f.n}/${f.d} L`;
    $('#lengthPercent').textContent=`${fmt(frac*100,1)}% della corda`;
    $('#freqRatio').textContent=`${f.d}/${f.n}`;
    $('#freqMultiplier').textContent=`f' = ${fmt(1/frac,3)} × f`;
    $('#resultFrequency').textContent=`${fmt(freq)} Hz`;
    $('#nearestNote').textContent=`≈ ${nn.name}${Math.abs(nn.cents)>0.2?` (${nn.cents>0?'+':''}${fmt(nn.cents,1)} cent)`:''}`;
    $('#verbalRelation').textContent=frac===.5?'Dimezzo la lunghezza → raddoppio la frequenza':`L' = ${fmt(frac,3)} L → f' = ${fmt(1/frac,3)} f`;
    $('#freeLengthValue').textContent=`${fmt(frac*100,1)}%`;
    $('#approxFraction').textContent=`${f.n}/${f.d}`;
    $('#approxFreq').textContent=`${f.d}/${f.n}`;
    if(!state.free){
      $('#intervalName').textContent=ratio.short; $('#ratioName').textContent=`${ratio.a} : ${ratio.b}`;
      const exact=nearestNote(base*(ratio.b/ratio.a));
      $('#centsBadge').textContent=Math.abs(exact.cents)<0.2?'coincide con il temperamento equabile':`${exact.cents>0?'+':''}${fmt(exact.cents,1)} cent rispetto alla nota temperata`;
    }else{
      $('#intervalName').textContent='ESPLORAZIONE LIBERA'; $('#ratioName').textContent=`≈ ${f.n} : ${f.d}`;
      $('#centsBadge').textContent='ponticello libero';
    }
    $$('.ratio-btn').forEach((b,i)=>b.classList.toggle('is-active',!state.free&&i===state.ratioIndex));
  }

  function audioCtx(){
    if(!state.sound) return null;
    if(!state.audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;state.audio=new AC()}
    if(state.audio.state==='suspended') state.audio.resume(); return state.audio;
  }

  function pluck(freq,when=0,duration=1.65,volume=.48){
    const ac=audioCtx(); if(!ac)return;
    const t=ac.currentTime+when; const master=ac.createGain();
    master.gain.setValueAtTime(.0001,t); master.gain.exponentialRampToValueAtTime(volume,t+.012); master.gain.exponentialRampToValueAtTime(.0001,t+duration);
    master.connect(ac.destination);
    [1,2,3,4,5].forEach((h,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type=i===0?'triangle':'sine';o.frequency.setValueAtTime(freq*h,t);g.gain.setValueAtTime(1/(h*h*1.15),t);o.connect(g);g.connect(master);o.start(t);o.stop(t+duration+.03)});
  }
  function sineTone(freq,when=0,duration=3,volume=.16){
    const ac=audioCtx(); if(!ac)return;
    const t=ac.currentTime+when; const o=ac.createOscillator(),g=ac.createGain();
    o.type='sine'; o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(volume,t+.025); g.gain.setValueAtTime(volume,t+Math.max(.03,duration-.16)); g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+duration+.04);
  }

  function playCurrent(short=true,delay=0){const f=currentBase()/(short?currentFraction():1);pluck(f,delay);animateString(short,delay)}
  function animateString(short=true,delay=0){
    const strings=short?[$('#activeString')]:[$('#wholeString'),$('#activeString')];
    window.setTimeout(()=>{
      strings.forEach(s=>s.classList.remove('string-pluck'));
      void strings[0].getBoundingClientRect();
      strings.forEach(s=>s.classList.add('string-pluck'));
    },delay*1000);
  }

  function setupMonocord(){
    $('#baseNote').addEventListener('change',updateMonochord);
    $('#freeLength').addEventListener('input',e=>setFreeFraction(Number(e.target.value)/100));
    $('#snapRatioBtn').addEventListener('click',()=>{state.free=false;const r=RATIOS[state.ratioIndex];$('#freeLength').value=(100*r.a/r.b).toFixed(1);updateMonochord()});
    $('#playBase').addEventListener('click',()=>playCurrent(false));
    $('#playShort').addEventListener('click',()=>playCurrent(true));
    const pressGroup=$('#pressGroup');
    const stringHit=$('#stringHit');
    const pressString=()=>playCurrent(true);
    const keyboardPluck=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pressString()}};
    const svgPointerX=e=>{
      const svg=$('#monochord'),matrix=svg.getScreenCTM(); if(!matrix)return null;
      const point=svg.createSVGPoint(); point.x=e.clientX; point.y=e.clientY;
      return point.matrixTransform(matrix.inverse()).x;
    };
    let dragPointer=null,dragStartX=0,dragOffsetX=0,dragMoved=false,ignoreClickUntil=0;
    const dragToPointer=e=>{
      const pointerX=svgPointerX(e); if(pointerX===null)return;
      const markerX=Math.max(100,Math.min(700,pointerX-dragOffsetX));
      setFreeFraction((900-markerX)/800);
    };
    pressGroup.addEventListener('click',e=>{if(performance.now()<ignoreClickUntil){e.preventDefault();return}pressString()});
    pressGroup.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pressString()}});
    pressGroup.addEventListener('pointerdown',e=>{
      if(!e.isPrimary||e.button!==0)return;
      const pointerX=svgPointerX(e); if(pointerX===null)return;
      dragPointer=e.pointerId; dragStartX=e.clientX; dragMoved=false;
      dragOffsetX=pointerX-(900-800*currentFraction());
      pressGroup.setPointerCapture?.(e.pointerId);
      pressGroup.classList.add('is-pressed','is-dragging');
    });
    pressGroup.addEventListener('pointermove',e=>{
      if(e.pointerId!==dragPointer)return;
      if(Math.abs(e.clientX-dragStartX)>3)dragMoved=true;
      if(dragMoved){e.preventDefault();dragToPointer(e)}
    });
    const finishDrag=(e,cancelled=false)=>{
      if(e.pointerId!==dragPointer)return;
      if(dragMoved&&!cancelled){dragToPointer(e);ignoreClickUntil=performance.now()+800}
      try{pressGroup.releasePointerCapture?.(e.pointerId)}catch{}
      dragPointer=null; pressGroup.classList.remove('is-pressed','is-dragging');
    };
    pressGroup.addEventListener('pointerup',e=>finishDrag(e));
    pressGroup.addEventListener('pointercancel',e=>finishDrag(e,true));
    stringHit.addEventListener('click',pressString);
    stringHit.addEventListener('keydown',keyboardPluck);
    $('#playTogether').addEventListener('click',()=>{pluck(currentBase(),0,.9,.32);pluck(currentBase()/currentFraction(),0,.9,.32);animateString(false)});
    $('#playSequence').addEventListener('click',()=>{pluck(currentBase());pluck(currentBase()/currentFraction(),.82);animateString(false);animateString(true,.82)});
  }

  function fillCompareSelects(){
    [$('#compareA'),$('#compareB')].forEach(s=>{s.innerHTML='';RATIOS.forEach((r,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${r.a}:${r.b} — ${r.name}`;s.appendChild(o)})});
    $('#compareA').value='1';$('#compareB').value='2';
    $('#compareA').addEventListener('change',updateCompare);$('#compareB').addEventListener('change',updateCompare);
    $('#playA').addEventListener('click',()=>playCompare('A'));$('#playB').addEventListener('click',()=>playCompare('B'));
    $('#playAB').addEventListener('click',()=>{playCompare('A',0,.32);playCompare('B',0,.32)});
    $('#playABSeq').addEventListener('click',()=>{playCompare('A',0);playCompare('B',.82)});
    updateCompare();
  }
  function compareData(which){const i=Number($(`#compare${which}`).value);const r=RATIOS[i];const base=currentBase();return {r,f:base*r.b/r.a}}
  function playCompare(which,delay=0,vol=.48){pluck(compareData(which).f,delay,1.4,vol)}
  function updateCompare(){
    const A=compareData('A'),B=compareData('B');
    $('#compAName').textContent=A.r.name;$('#compARatio').textContent=`${A.r.a} : ${A.r.b}`;$('#compAFreq').textContent=`${fmt(A.f)} Hz`;
    $('#compBName').textContent=B.r.name;$('#compBRatio').textContent=`${B.r.a} : ${B.r.b}`;$('#compBFreq').textContent=`${fmt(B.f)} Hz`;
    $('#miniA').style.width=`${A.r.a/A.r.b*calcMini()}%`;$('#miniB').style.width=`${B.r.a/B.r.b*calcMini()}%`;
    const rel=B.f/A.f; const fr=nearestFraction(rel>1?1/rel:rel,16);
    $('#compareRelationship').innerHTML=`Fra le due frequenze c'è un fattore di <strong>${fmt(rel,4)}</strong>. Ascoltandole insieme puoi percepire quanto semplici rapporti numerici producano relazioni musicali particolari.`;
  }
  function calcMini(){return 100}

  const EXP_BASES=[120,144,180,200,240,256,300,320];
  function newExperiment(){
    const base=EXP_BASES[Math.floor(Math.random()*EXP_BASES.length)];
    const ri=1+Math.floor(Math.random()*4); const r=RATIOS[ri]; const ans=base*r.b/r.a;
    state.experiment={base,r,ans};
    $('#experimentPrompt').textContent=`Una corda vibra a ${base} Hz. La accorci fino a lasciare vibrare ${r.a}/${r.b} della sua lunghezza. Quale sarà la nuova frequenza?`;
    $('#experimentGiven').innerHTML=`<span class="given-chip">f = ${base} Hz</span><span class="given-chip">L' = ${r.a}/${r.b} L</span><span class="given-chip">Intervallo: ${r.name}</span>`;
    $('#experimentAnswer').value='';$('#experimentFeedback').className='feedback';$('#experimentFeedback').textContent='';$('#experimentListen').hidden=true;
  }
  function setupExperiment(){
    $('#newExperiment').addEventListener('click',newExperiment);$('#experimentListen').addEventListener('click',()=>pluck(state.experiment.ans));
    $('#experimentForm').addEventListener('submit',e=>{e.preventDefault();const raw=$('#experimentAnswer').value.replace(',','.');const v=Number(raw);const fb=$('#experimentFeedback');if(!Number.isFinite(v)){fb.className='feedback bad';fb.textContent='Inserisci un numero.';return}const ok=Math.abs(v-state.experiment.ans)<=Math.max(.5,state.experiment.ans*.005);fb.className=`feedback ${ok?'good':'bad'}`;fb.innerHTML=ok?`✓ Esatto! <strong>${fmt(state.experiment.ans)} Hz</strong>. Poiché f è inversamente proporzionale a L: ${state.experiment.base} × ${state.experiment.r.b}/${state.experiment.r.a} = ${fmt(state.experiment.ans)}.`:`Quasi! Il risultato è <strong>${fmt(state.experiment.ans)} Hz</strong>: ${state.experiment.base} × ${state.experiment.r.b}/${state.experiment.r.a}.`;$('#experimentListen').hidden=false});
    newExperiment();
  }

  const FIFTH_NAMES=['DO','SOL','RE','LA','MI','SI','FA♯','DO♯','SOL♯','RE♯','LA♯','MI♯','SI♯'];
  const PYTH_SCALE=[
    {name:'DO',n:1,d:1,semi:0},{name:'RE',n:9,d:8,semi:2},{name:'MI',n:81,d:64,semi:4},{name:'FA',n:4,d:3,semi:5},
    {name:'SOL',n:3,d:2,semi:7},{name:'LA',n:27,d:16,semi:9},{name:'SI',n:243,d:128,semi:11},{name:'DO',n:2,d:1,semi:12}
  ];
  const PYTH_COMMA=531441/524288;

  function scaleBase(){return Number($('#scaleBase').value)}
  function scaleOctave(){return scaleBase()<200?3:4}
  function fifthData(k){
    if(k===0)return {k,name:FIFTH_NAMES[0],n:1,d:1,ratio:1};
    let n=3**k,d=2**k;
    while(n/d>=2)d*=2;
    return {k,name:FIFTH_NAMES[k],n,d,ratio:n/d};
  }
  function renderFifthChain(){
    const box=$('#fifthChain'); box.innerHTML='';
    for(let k=0;k<=state.scaleStep;k++){
      const x=fifthData(k),freq=scaleBase()*x.ratio;
      const b=document.createElement('button');b.type='button';b.className='fifth-card'+(k===12?' is-comma':'');
      b.innerHTML=`<span class="step">${k===0?'Partenza':k+'ª quinta'}</span><strong>${x.name}</strong><span class="frac">${x.n}/${x.d}</span><small>${fmt(freq)} Hz</small>`;
      b.title=`Ascolta ${x.name}`;b.addEventListener('click',()=>pluck(freq));box.appendChild(b);
    }
    const p=$('#fifthProgress');
    if(state.scaleStep===0)p.innerHTML='<strong>0 / 12 quinte.</strong> Premi “+ Una quinta”: DO × 3/2 = SOL.';
    else if(state.scaleStep<12){const x=fifthData(state.scaleStep);p.innerHTML=`<strong>${state.scaleStep} / 12 quinte.</strong> Siamo arrivati a ${x.name}: rapporto nell’ottava = ${x.n}/${x.d}.`;}
    else p.innerHTML='<strong>12 / 12 quinte.</strong> Siamo arrivati a SI♯, equivalente a DO… ma è leggermente più alto: il cerchio delle quinte non si chiude perfettamente.';
    $('#fifthAdd').disabled=state.scaleStep>=12;
  }
  function renderPythKeys(){
    const base=scaleBase(),oct=scaleOctave(),keys=$('#pythKeys'),body=$('#scaleTableBody');keys.innerHTML='';body.innerHTML='';
    PYTH_SCALE.forEach((x,i)=>{
      const ratio=x.n/x.d,freq=base*ratio,cents=1200*Math.log2(ratio)-x.semi*100;
      const label=`${x.name}${i===PYTH_SCALE.length-1?oct+1:oct}`;
      const b=document.createElement('button');b.type='button';b.className='pyth-key';
      b.innerHTML=`<strong>${label}</strong><span class="key-ratio">${x.n}/${x.d}</span><small>${fmt(freq)} Hz<br>${Math.abs(cents)<.005?'0,00':(cents>0?'+':'')+fmt(cents,2)} cent</small>`;
      b.addEventListener('click',()=>pluck(freq));keys.appendChild(b);
      const tr=document.createElement('tr');const cc=Math.abs(cents)<.005?'cent-zero':cents>0?'cent-positive':'cent-negative';
      tr.innerHTML=`<td>${label}</td><td>${x.n}/${x.d}</td><td>${fmt(freq)} Hz</td><td class="${cc}">${Math.abs(cents)<.005?'0,00':(cents>0?'+':'')+fmt(cents,2)} cent</td>`;body.appendChild(tr);
    });
  }
  function renderComma(){
    const base=scaleBase(),sharp=base*PYTH_COMMA,beat=sharp-base;
    $('#commaCents').textContent=`${fmt(1200*Math.log2(PYTH_COMMA),2)} cent`;
    $('#commaBaseFreq').textContent=`${fmt(base)} Hz`;
    $('#commaSharpFreq').textContent=`${fmt(sharp)} Hz`;
    $('#commaBeatFreq').textContent=`${fmt(beat,2)} al secondo`;
  }
  function renderScaleLab(){renderFifthChain();renderPythKeys();renderComma()}
  function setupScale(){
    $('#scaleBase').addEventListener('change',renderScaleLab);
    $('#fifthReset').addEventListener('click',()=>{state.scaleStep=0;renderFifthChain()});
    $('#fifthAdd').addEventListener('click',()=>{state.scaleStep=Math.min(12,state.scaleStep+1);renderFifthChain();const x=fifthData(state.scaleStep);pluck(scaleBase()*x.ratio)});
    $('#fifthAll').addEventListener('click',()=>{state.scaleStep=12;renderFifthChain()});
    $('#playLastFifth').addEventListener('click',()=>{const x=fifthData(state.scaleStep);pluck(scaleBase()*x.ratio)});
    $('#playFifthJourney').addEventListener('click',()=>{for(let k=0;k<=state.scaleStep;k++){const x=fifthData(k);pluck(scaleBase()*x.ratio,k*.46,.78,.30)}});
    $('#playPythScale').addEventListener('click',()=>{PYTH_SCALE.forEach((x,i)=>pluck(scaleBase()*x.n/x.d,i*.42,.72,.34))});
    $('#playCommaBase').addEventListener('click',()=>sineTone(scaleBase(),0,2.3,.18));
    $('#playCommaSharp').addEventListener('click',()=>sineTone(scaleBase()*PYTH_COMMA,0,2.3,.18));
    $('#playCommaTogether').addEventListener('click',()=>{sineTone(scaleBase(),0,4,.12);sineTone(scaleBase()*PYTH_COMMA,0,4,.12)});
    renderScaleLab();
  }

  function renderHarmonicButtons(){const box=$('#harmonicButtons');for(let n=1;n<=8;n++){const b=document.createElement('button');b.type='button';b.className='harmonic-btn';b.textContent=n;b.addEventListener('click',()=>{state.harmonic=n;updateHarmonic()});box.appendChild(b)}$('#harmonicBase').addEventListener('change',updateHarmonic);$('#playHarmonic').addEventListener('click',()=>pluck(Number($('#harmonicBase').value)*state.harmonic));updateHarmonic()}
  function updateHarmonic(){
    const n=state.harmonic;$$('.harmonic-btn').forEach((b,i)=>b.classList.toggle('is-active',i+1===n));
    const left=80,right=920,width=840,mid=160,amp=105;let d='';const pts=240;
    for(let i=0;i<=pts;i++){const x=left+width*i/pts;const y=mid-amp*Math.sin(n*Math.PI*i/pts);d+=(i?' L':'M')+x.toFixed(2)+' '+y.toFixed(2)}$('#wavePath').setAttribute('d',d);
    const g=$('#nodesGroup');g.innerHTML='';for(let k=0;k<=n;k++){const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',left+width*k/n);c.setAttribute('cy',mid);c.setAttribute('r',8);c.setAttribute('class','node-dot');g.appendChild(c)}
    const base=Number($('#harmonicBase').value);$('#harmonicN').textContent=ordinal(n);$('#harmonicLength').textContent=`1/${n} L`;$('#harmonicFreq').textContent=`${fmt(base*n,n*base%1?2:0)} Hz`;
  }

  function buildChallenge(){
    const types=['name','ratio','frequency','inverse']; const type=types[Math.floor(Math.random()*types.length)]; const r=RATIOS[1+Math.floor(Math.random()*4)];let q,correct,options;
    if(type==='name'){q=`Quale intervallo ottieni lasciando vibrare ${r.a}/${r.b} della corda?`;correct=r.name;options=shuffle([correct,...pickOtherNames(r.name,3)])}
    else if(type==='ratio'){q=`Quale parte della corda deve vibrare per ottenere ${r.name.toLowerCase()}?`;correct=`${r.a}/${r.b}`;options=shuffle([correct,...pickOtherRatios(`${r.a}/${r.b}`,3)])}
    else if(type==='frequency'){const base=[120,160,200,240][Math.floor(Math.random()*4)];const ans=base*r.b/r.a;q=`La corda intera vibra a ${base} Hz. Con rapporto ${r.a}:${r.b}, quale frequenza ottieni?`;correct=`${fmt(ans,ans%1?1:0)} Hz`;options=shuffle([correct,`${fmt(base*r.a/r.b,1)} Hz`,`${fmt(base+40,1)} Hz`,`${fmt(base*2,1)} Hz`])}
    else {q='Se accorcio una corda mantenendo uguali tensione e densità, che cosa succede alla frequenza?';correct='Aumenta';options=['Aumenta','Diminuisce','Resta uguale','Diventa zero']}
    state.challenge={q,correct,options,r};renderChallenge();
  }
  function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
  function pickOtherNames(ex,n){return shuffle(RATIOS.slice(1,5).map(r=>r.name).filter(x=>x!==ex)).slice(0,n)}
  function pickOtherRatios(ex,n){return shuffle(RATIOS.slice(1,5).map(r=>`${r.a}/${r.b}`).filter(x=>x!==ex)).slice(0,n)}
  function renderChallenge(){
    const c=state.challenge;$('#challengeCount').textContent=`${state.challengeIndex+1} / 10`;$('#challengeBar').style.width=`${(state.challengeIndex+1)*10}%`;$('#challengeQuestion').textContent=c.q;const box=$('#challengeAnswers');box.innerHTML='';
    c.options.forEach(o=>{const b=document.createElement('button');b.type='button';b.className='answer-btn';b.textContent=o;b.addEventListener('click',()=>answerChallenge(b,o));box.appendChild(b)});$('#challengeFeedback').className='feedback';$('#challengeFeedback').textContent='';$('#challengeNext').hidden=true;$('#challengeListen').hidden=true;
  }
  function answerChallenge(btn,value){if($('#challengeNext').hidden===false)return;const ok=value===state.challenge.correct;$$('.answer-btn',$('#challengeAnswers')).forEach(b=>{b.disabled=true;if(b.textContent===state.challenge.correct)b.classList.add('good')});if(!ok)btn.classList.add('bad');if(ok){state.score++;$('#scoreValue').textContent=state.score}const fb=$('#challengeFeedback');fb.className=`feedback ${ok?'good':'bad'}`;fb.textContent=ok?'✓ Corretto!':'La risposta corretta è: '+state.challenge.correct;$('#challengeNext').hidden=false;if(state.challenge.r){$('#challengeListen').hidden=false}}
  function setupChallenges(){
    buildChallenge();
    $('#challengeListen').addEventListener('click',()=>{const r=state.challenge.r;if(r)pluck(currentBase()*r.b/r.a)});
    $('#challengeNext').addEventListener('click',()=>{
      if(state.challengeFinished){
        state.challengeFinished=false; state.challengeIndex=0; state.score=0;
        $('#scoreValue').textContent='0'; $('#challengeNext').textContent='Prossima →';
        buildChallenge(); return;
      }
      state.challengeIndex++;
      if(state.challengeIndex>=10){
        state.challengeFinished=true;
        $('#challengeQuestion').textContent=`Sfida conclusa: ${state.score} punti su 10.`;
        $('#challengeAnswers').innerHTML='';
        $('#challengeFeedback').className='feedback';
        $('#challengeFeedback').textContent=state.score>=8?'Ottima padronanza dei rapporti!':'Riprova: ascoltare e visualizzare insieme aiuta molto.';
        $('#challengeListen').hidden=true; $('#challengeNext').textContent='Ricomincia'; $('#challengeNext').hidden=false;
        return;
      }
      buildChallenge();
    });
  }

  function setupGlobal(){
    $('#themeBtn').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';localStorageSafeSet('pitagora-theme',state.theme);initTheme()});
    $('#soundBtn').addEventListener('click',()=>{state.sound=!state.sound;$('#soundBtn').textContent=state.sound?'🔊':'🔇';$('#soundBtn').setAttribute('aria-pressed',String(state.sound))});
    $('#infoBtn').addEventListener('click',()=>$('#infoDialog').showModal());$('#closeInfo').addEventListener('click',()=>$('#infoDialog').close());
    $('#projectionBtn').addEventListener('click',async()=>{const on=!document.body.classList.contains('projection');document.body.classList.toggle('projection',on);$('#projectionBtn').setAttribute('aria-pressed',String(on));if(on&&document.documentElement.requestFullscreen){try{await document.documentElement.requestFullscreen()}catch{}}else if(!on&&document.fullscreenElement){try{await document.exitFullscreen()}catch{}}});
  }

  function registerSW(){if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}))}}

  initTheme();setupTabs();renderRatioButtons();setupMonocord();fillCompareSelects();setupExperiment();setupScale();renderHarmonicButtons();setupChallenges();setupGlobal();updateMonochord();registerSW();
})();
