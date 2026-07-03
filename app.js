let memorized={},flashQueue=[],flashIndex=0,flashFilter='all',flashDayFilter=0,isFlipped=false,furiganaOn=false;
const activeFilters={level:new Set(['S','A','B','기타한자','히라가나','부사','외래어']),pos:new Set(['명사','동사','い형','な형','부사','외래어'])};

function loadMemorized(){try{const s=localStorage.getItem('n4_memorized');if(s)memorized=JSON.parse(s);}catch(e){}}
function saveMemorized(){try{localStorage.setItem('n4_memorized',JSON.stringify(memorized));}catch(e){}}
function getWordId(w){return w.w+'|'+w.r;}
function getMemLevel(wid){return memorized[wid]||0;}
function cycleMemLevel(wid){
  const next=((memorized[wid]||0)+1)%4;
  if(next===0)delete memorized[wid];else memorized[wid]=next;
  saveMemorized();
  return next;
}
function dotsSpans(lvl){
  let h='';
  for(let i=0;i<3;i++)h+=`<span class="dot${i<lvl?' filled':''}"></span>`;
  return h;
}

function updateDday(){
  const t=new Date();t.setHours(0,0,0,0);
  const d=Math.ceil((new Date('2026-07-05')-t)/(864e5));
  const el=document.getElementById('dday-counter');
  el.textContent=d>0?`D-${d} | 7/5 JLPT`:d===0?'🎌 오늘이 시험일!':`D+${Math.abs(d)} | 시험 후`;
}

function updateProgress(){
  let total=0,done=0;
  GROUPS.forEach(g=>g.words.forEach(w=>{total++;if(getMemLevel(getWordId(w))===3)done++;}));
  const pct=total?(done/total*100).toFixed(1):0;
  document.getElementById('progress-fill').style.width=pct+'%';
  document.getElementById('progress-text').textContent=`${done} / ${total}`;
}

function toggleFilter(btn){
  const g=btn.dataset.filterGroup,v=btn.dataset.value;
  const on=!activeFilters[g].has(v);
  if(on)activeFilters[g].add(v);else activeFilters[g].delete(v);
  document.querySelectorAll(`[data-filter-group="${g}"][data-value="${v}"]`).forEach(b=>b.classList.toggle('active',on));
  applyFilters();
  buildFlashQueue();renderFlashCard();
}

function applyFilters(){
  const q=document.getElementById('search-input').value.trim().toLowerCase();
  document.querySelectorAll('.group-section').forEach(sec=>{
    const lv=sec.dataset.level;
    if(!activeFilters.level.has(lv)){sec.style.display='none';return;}
    let vis=0;
    sec.querySelectorAll('.word-card').forEach(card=>{
      const ok=activeFilters.pos.has(card.dataset.pos)&&(!q||card.dataset.word.toLowerCase().includes(q)||card.dataset.meaning.toLowerCase().includes(q)||card.dataset.reading.toLowerCase().includes(q));
      card.style.display=ok?'':'none';
      if(ok)vis++;
    });
    sec.style.display=vis>0?'':'none';
    const cnt=sec.querySelector('.group-count');
    if(cnt)cnt.textContent=vis;
  });
}

function getCardColor(pos){return{'명사':'var(--accent)','동사':'var(--green)','い형':'var(--yellow)','な형':'var(--purple)','부사':'var(--teal)','외래어':'var(--orange)'}[pos]||'var(--border)';}

function renderList(){
  const c=document.getElementById('list-content');c.innerHTML='';
  GROUPS.forEach(group=>{
    const sec=document.createElement('div');sec.className='group-section';sec.dataset.level=group.level;
    const lc={'S':'level-S','A':'level-A','B':'level-B','기타한자':'level-기타','히라가나':'level-히라','부사':'level-부사','외래어':'level-외래'}[group.level]||'level-기타';
    const lt={'S':'S급','A':'A급','B':'B급','기타한자':'기타한자','히라가나':'히라가나','부사':'부사','외래어':'외래어'}[group.level]||group.level;
    const isSp=['기타한자','히라가나','부사','외래어'].includes(group.level);
    const hk=isSp?(group.level==='히라가나'?'ひら':group.level==='부사'?'副':group.level==='외래어'?'カタ':'他'):group.id;
    sec.innerHTML=`<div class="group-header" onclick="toggleGroup(this)"><div class="group-kanji">${hk}</div><div><div style="font-size:13px;font-weight:600">${isSp?group.level:group.id+' · '+group.label}</div>${!isSp?`<div class="group-label">${group.label}</div>`:''}</div><span class="level-badge ${lc}">${lt}</span><span class="group-count">${group.words.length}</span><span class="group-toggle open">▶</span></div><div class="words-grid"></div>`;
    const grid=sec.querySelector('.words-grid');
    group.words.forEach(word=>{
      const wid=getWordId(word),lvl=getMemLevel(wid);
      const card=document.createElement('div');card.className='word-card'+(lvl===3?' memorized':'');
      card.dataset.pos=word.pos;card.dataset.word=word.w;card.dataset.meaning=word.m;card.dataset.reading=word.r;card.dataset.wid=wid;
      card.style.setProperty('--card-color',getCardColor(word.pos));
      // ★ day tag
      const dayHtml=word.day?`<span class="day-tag">#${word.day}일</span>`:'';
      card.innerHTML=`<div class="check-dots card-dots">${dotsSpans(lvl)}</div><div class="word-jp">${word.w}</div><div class="word-reading">${word.r}</div><div class="word-meaning">${word.m}</div><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:5px"><span class="pos-badge pos-${word.pos}">${word.pos}</span>${dayHtml}</div>`;
      card.onclick=()=>toggleWordMemorize(card,wid);grid.appendChild(card);
    });
    c.appendChild(sec);
  });
  applyFilters();
}

function toggleGroup(h){
  const g=h.nextElementSibling,t=h.querySelector('.group-toggle');
  if(g.style.display==='none'){g.style.display='';t.classList.add('open');}
  else{g.style.display='none';t.classList.remove('open');}
}

function toggleWordMemorize(card,wid){
  const lvl=cycleMemLevel(wid);
  card.classList.toggle('memorized',lvl===3);
  const dots=card.querySelector('.check-dots');
  if(dots)dots.innerHTML=dotsSpans(lvl);
  updateProgress();
  if(flashQueue.length&&getWordId(flashQueue[flashIndex])===wid)renderFlashCard();
}

function buildFlashQueue(){
  let all=[];
  GROUPS.forEach(g=>g.words.forEach(w=>all.push({...w,groupId:g.id,groupLabel:g.label,groupLevel:g.level})));
  all=all.filter(w=>activeFilters.level.has(w.groupLevel)&&activeFilters.pos.has(w.pos));
  if(flashFilter==='unmemorized')all=all.filter(w=>getMemLevel(getWordId(w))<3);
  else if(flashFilter==='memorized')all=all.filter(w=>getMemLevel(getWordId(w))===3);
  if(flashDayFilter>0)all=all.filter(w=>w.day===flashDayFilter);
  flashQueue=all;flashIndex=0;
}

function renderDayChips(){
  const row=document.getElementById('flash-day-row');
  row.innerHTML='';
  const allBtn=document.createElement('button');
  allBtn.className='day-chip'+(flashDayFilter===0?' active':'');
  allBtn.textContent='전체';
  allBtn.onclick=()=>{flashDayFilter=0;renderDayChips();buildFlashQueue();renderFlashCard();};
  row.appendChild(allBtn);
  for(let d=1;d<=20;d++){
    const cnt=(() => { let c=0; GROUPS.forEach(g=>g.words.forEach(w=>{if(w.day===d)c++;})); return c; })();
    if(cnt===0) continue;
    const btn=document.createElement('button');
    btn.className='day-chip'+(flashDayFilter===d?' active':'');
    btn.textContent=`${d}일`;
    btn.onclick=(()=>{const day=d;return()=>{flashDayFilter=day;renderDayChips();buildFlashQueue();renderFlashCard();}})();
    row.appendChild(btn);
  }
}

function setFlashFilter(val,btn){
  flashFilter=val;
  document.querySelectorAll('[data-flash-filter]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');buildFlashQueue();renderFlashCard();
}

function toggleFurigana(){
  furiganaOn=!furiganaOn;
  document.getElementById('furigana-toggle').classList.toggle('active',furiganaOn);
  renderFlashCard();
}

function shuffleFlash(){
  for(let i=flashQueue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[flashQueue[i],flashQueue[j]]=[flashQueue[j],flashQueue[i]];}
  flashIndex=0;renderFlashCard();
}

function renderFlashCard(){
  document.getElementById('flash-card').classList.remove('flipped');isFlipped=false;
  const total=flashQueue.length;
  document.getElementById('flash-counter').textContent=total?`${flashIndex+1} / ${total}`:'0 / 0';
  document.getElementById('flash-stat').textContent=`${flashQueue.filter(w=>getMemLevel(getWordId(w))===3).length} 암기 / ${total} 전체`;
  if(!total){['f-word','f-reading','f-meaning','f-related','f-group'].forEach(id=>document.getElementById(id).textContent='');document.getElementById('f-pos-front').innerHTML='';document.getElementById('f-day-tag').style.display='none';document.getElementById('f-mem-dots').innerHTML='';return;}
  const w=flashQueue[flashIndex],wid=getWordId(w);
  const isSp=['기타한자','히라가나','부사','외래어'].includes(w.groupLevel);
  document.getElementById('f-group').textContent=isSp?w.groupLevel:`${w.groupId} 그룹 (${w.groupLabel})`;
  const wordEl=document.getElementById('f-word');
  if(furiganaOn&&w.r&&w.r!==w.w)wordEl.innerHTML=`<ruby>${w.w}<rt>${w.r}</rt></ruby>`;
  else wordEl.textContent=w.w;
  document.getElementById('f-pos-front').innerHTML=`<span class="pos-badge pos-${w.pos}">${w.pos}</span>`;
  // ★ day tag on flash card
  const dayEl=document.getElementById('f-day-tag');
  if(w.day){dayEl.textContent=`#${w.day}일차`;dayEl.style.display='';}
  else{dayEl.style.display='none';}
  document.getElementById('f-reading').textContent=w.r;
  document.getElementById('f-meaning').textContent=w.m;
  const grp=GROUPS.find(g=>g.id===w.groupId);
  document.getElementById('f-related').textContent=grp&&grp.words.length>1?'관련어: '+grp.words.filter(x=>x.w!==w.w).slice(0,4).map(x=>x.w).join(' / '):'';
  const btn=document.getElementById('memorize-btn');
  const lvl=getMemLevel(wid);
  document.getElementById('f-mem-dots').innerHTML=dotsSpans(lvl);
  if(lvl===0){btn.textContent='☆ 체크하기';btn.classList.remove('undone');}
  else if(lvl===3){btn.textContent='✓ 암기완료';btn.classList.remove('undone');}
  else{btn.textContent=`● 체크 ${lvl}/3`;btn.classList.remove('undone');}
}

function flipCard(){isFlipped=!isFlipped;document.getElementById('flash-card').classList.toggle('flipped',isFlipped);}
function nextCard(){if(flashQueue.length){flashIndex=(flashIndex+1)%flashQueue.length;renderFlashCard();}}
function prevCard(){if(flashQueue.length){flashIndex=(flashIndex-1+flashQueue.length)%flashQueue.length;renderFlashCard();}}

function toggleMemorize(){
  if(!flashQueue.length)return;
  const w=flashQueue[flashIndex],wid=getWordId(w);
  cycleMemLevel(wid);
  updateProgress();renderFlashCard();
  const lvl=getMemLevel(wid);
  document.querySelectorAll('.word-card').forEach(card=>{
    if(card.dataset.wid===wid){card.classList.toggle('memorized',lvl===3);const d=card.querySelector('.check-dots');if(d)d.innerHTML=dotsSpans(lvl);}
  });
}

function switchTab(name){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  event.target.classList.add('active');
  if(name==='flash'){buildFlashQueue();renderFlashCard();renderDayChips();}
}

loadMemorized();updateDday();renderList();updateProgress();buildFlashQueue();renderFlashCard();renderDayChips();
