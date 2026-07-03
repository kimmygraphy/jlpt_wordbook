/* ============ 상태 저장 ============ */
const LS_KEY = 'n4_study_state_v1';
let studyState = {}; // { [id]: {level:0-3, hard:bool} }

function loadState(){
  try{ const s = localStorage.getItem(LS_KEY); if(s) studyState = JSON.parse(s); }catch(e){}
}
function saveState(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(studyState)); }catch(e){}
}
function getState(id){
  return studyState[id] || { level:0, hard:false };
}
function setState(id, patch){
  const cur = getState(id);
  studyState[id] = { ...cur, ...patch };
  if(studyState[id].level===0 && !studyState[id].hard) delete studyState[id];
  saveState();
}
function cycleLevel(id){
  const cur = getState(id);
  const next = (cur.level + 1) % 4;
  setState(id, { level: next });
}
function toggleHard(id){
  const cur = getState(id);
  setState(id, { hard: !cur.hard });
}
function dotsHtml(level){
  let h='';
  for(let i=0;i<3;i++) h += `<span class="dot${i<level?' filled':''}"></span>`;
  return h;
}
function getCardColor(pos){
  return {
    '명사':'var(--accent)', '동사':'var(--green)', 'い형용사':'var(--yellow)',
    'な형용사':'var(--purple)', '부사':'var(--teal)', '외래어':'var(--orange)', '표현':'var(--pink)',
    '문형':'var(--red)'
  }[pos] || 'var(--border)';
}
function getTagColor(tag){
  const map = { '독해빈출':'var(--pink)', '청해빈출':'var(--teal)', '필수문형':'var(--purple)' };
  return map[tag] || 'var(--accent)';
}
function tagBadgesHtml(tags){
  if(!tags || !tags.length) return '';
  return tags.map(t=>`<span class="tag-badge" style="--tag-color:${getTagColor(t)}">#${t}</span>`).join('');
}

/* ============ 필터 상태 ============ */
const activeFilters = {
  pos: new Set(POS_OPTIONS),
  day: new Set(DAY_OPTIONS),
  status: new Set(), // 'unmemorized' | 'memorized' | 'hard' — 비어있으면 전체 표시
  tag: new Set()      // '독해빈출' 등 — 비어있으면 전체 표시
};

function passesStatus(wid){
  if(activeFilters.status.size === 0) return true;
  const st = getState(wid);
  let ok = false;
  if(activeFilters.status.has('unmemorized') && st.level === 0) ok = true;
  if(activeFilters.status.has('memorized') && st.level === 3) ok = true;
  if(activeFilters.status.has('hard') && st.hard) ok = true;
  return ok;
}
function passesTag(tags){
  if(activeFilters.tag.size === 0) return true;
  if(!tags || !tags.length) return false;
  return tags.some(t=>activeFilters.tag.has(t));
}

function toggleFilter(el){
  const group = el.dataset.filterGroup;
  const val = el.dataset.value;
  if(val === '__all__'){
    if(group === 'day') activeFilters.day = new Set(DAY_OPTIONS);
    else if(group === 'status') activeFilters.status = new Set();
    else if(group === 'tag') activeFilters.tag = new Set();
    else if(group === 'pos') activeFilters.pos = new Set(POS_OPTIONS);
  } else {
    const set = activeFilters[group];
    const v = group === 'day' ? parseInt(val,10) : val;
    if(set.has(v)) set.delete(v); else set.add(v);
  }
  syncFilterUI(group);
  applyListFilters();
  buildFlashQueue();
  renderFlashCard();
}

function syncFilterUI(group){
  document.querySelectorAll(`[data-filter-group="${group}"]`).forEach(el=>{
    const val = el.dataset.value;
    let active;
    if(val === '__all__'){
      if(group === 'day') active = activeFilters.day.size === DAY_OPTIONS.length;
      else if(group === 'status') active = activeFilters.status.size === 0;
      else if(group === 'tag') active = activeFilters.tag.size === 0;
      else if(group === 'pos') active = activeFilters.pos.size === POS_OPTIONS.length;
    } else {
      const v = group === 'day' ? parseInt(val,10) : val;
      active = activeFilters[group].has(v);
    }
    el.classList.toggle('active', active);
  });
}

function renderChipRow(containerId, group, items){
  const el = document.getElementById(containerId);
  if(!el) return;
  const allBtn = `<button class="chip" data-filter-group="${group}" data-value="__all__" onclick="toggleFilter(this)">전체</button>`;
  const rest = items.map(it=>{
    const extraClass = group==='day' ? ' day-chip' : (group==='status' ? ' status-'+it.value : (group==='tag' ? ' tag-chip' : ''));
    const style = group==='tag' ? ` style="--tag-color:${getTagColor(it.value)}"` : '';
    return `<button class="chip${extraClass}" data-filter-group="${group}" data-value="${it.value}"${style} onclick="toggleFilter(this)">${it.label}</button>`;
  }).join('');
  el.innerHTML = allBtn + rest;
}

function initFilterChips(){
  const posItems = POS_OPTIONS.map(p=>({value:p,label:p}));
  const dayItems = DAY_OPTIONS.map(d=>({value:String(d),label:d+'일'}));
  const statusItems = [
    {value:'unmemorized', label:'미암기'},
    {value:'memorized', label:'암기완료'},
    {value:'hard', label:'📍 잘 안외워짐'},
  ];
  const tagItems = TAG_OPTIONS.map(t=>({value:t,label:'#'+t}));
  renderChipRow('list-pos-row','pos',posItems);
  renderChipRow('list-day-row','day',dayItems);
  renderChipRow('list-status-row','status',statusItems);
  renderChipRow('list-tag-row','tag',tagItems);
  renderChipRow('flash-pos-row','pos',posItems);
  renderChipRow('flash-day-row','day',dayItems);
  renderChipRow('flash-status-row','status',statusItems);
  renderChipRow('flash-tag-row','tag',tagItems);
  syncFilterUI('pos'); syncFilterUI('day'); syncFilterUI('status'); syncFilterUI('tag');
}

/* ============ 헤더 ============ */
function updateDday(){
  const t = new Date(); t.setHours(0,0,0,0);
  const d = Math.ceil((new Date('2026-07-05') - t) / 864e5);
  const el = document.getElementById('dday-counter');
  el.textContent = d>0 ? `D-${d} | 7/5 JLPT` : d===0 ? '🎌 오늘이 시험일!' : `D+${Math.abs(d)} | 시험 후`;
}
function updateProgress(){
  const total = VOCAB.length;
  const done = VOCAB.filter(w=>getState(w.id).level===3).length;
  const pct = total ? (done/total*100).toFixed(1) : 0;
  document.getElementById('progress-fill').style.width = pct+'%';
  document.getElementById('progress-text').textContent = `${done} / ${total}`;
}

/* ============ 목록 뷰 ============ */
function buildWordCard(word){
  const card = document.createElement('div');
  card.className = 'word-card';
  card.dataset.pos = word.pos;
  card.dataset.wid = word.id;
  card.dataset.word = word.japanese;
  card.dataset.reading = word.furigana;
  card.dataset.meaning = word.korean;
  card.dataset.tags = (word.tags||[]).join(';');
  card.style.setProperty('--card-color', getCardColor(word.pos));
  const st = getState(word.id);
  card.classList.toggle('memorized', st.level===3);
  card.classList.toggle('hard', st.hard);
  const dayTags = word.day.map(d=>`<span class="day-tag">#${d}일</span>`).join('');
  card.innerHTML = `
    <div class="check-dots card-dots">${dotsHtml(st.level)}</div>
    <button class="pin-btn${st.hard?' active':''}" onclick="event.stopPropagation();handlePinClick(${word.id})" title="잘 안외워짐 표시">📍</button>
    <div class="word-jp">${word.japanese}</div>
    <div class="word-reading">${word.furigana}</div>
    <div class="word-meaning">${word.korean}</div>
    <div>${`<span class="pos-badge pos-${word.pos}">${word.pos}</span>`}${dayTags}${tagBadgesHtml(word.tags)}</div>
  `;
  card.onclick = ()=>handleCardClick(word.id);
  return card;
}

function renderList(){
  const c = document.getElementById('list-content');
  c.innerHTML = '';
  DAY_OPTIONS.forEach(d=>{
    const wordsForDay = VOCAB.filter(w=>w.day.includes(d));
    if(wordsForDay.length===0) return;
    const sec = document.createElement('div');
    sec.className = 'day-section';
    sec.dataset.day = d;
    sec.innerHTML = `<div class="day-section-header" onclick="toggleDaySection(this)">
        <span class="day-section-num">${d}일</span>
        <span class="day-section-title">Day ${d}</span>
        <span class="day-section-count">${wordsForDay.length}</span>
        <span class="day-section-toggle open">▶</span>
      </div><div class="words-grid"></div>`;
    const grid = sec.querySelector('.words-grid');
    wordsForDay.forEach(word=>grid.appendChild(buildWordCard(word)));
    c.appendChild(sec);
  });
  applyListFilters();
}

function toggleDaySection(header){
  const grid = header.nextElementSibling;
  const t = header.querySelector('.day-section-toggle');
  if(grid.style.display === 'none'){ grid.style.display=''; t.classList.add('open'); }
  else { grid.style.display='none'; t.classList.remove('open'); }
}

function applyListFilters(){
  const searchEl = document.getElementById('search-input');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  document.querySelectorAll('.day-section').forEach(sec=>{
    const d = parseInt(sec.dataset.day,10);
    if(!activeFilters.day.has(d)){ sec.style.display='none'; return; }
    let vis=0;
    sec.querySelectorAll('.word-card').forEach(card=>{
      const wid = parseInt(card.dataset.wid,10);
      const posOk = activeFilters.pos.has(card.dataset.pos);
      const statusOk = passesStatus(wid);
      const tagOk = passesTag(card.dataset.tags ? card.dataset.tags.split(';').filter(Boolean) : []);
      const searchOk = !q ||
        card.dataset.word.toLowerCase().includes(q) ||
        card.dataset.reading.toLowerCase().includes(q) ||
        card.dataset.meaning.toLowerCase().includes(q);
      const ok = posOk && statusOk && tagOk && searchOk;
      card.style.display = ok ? '' : 'none';
      if(ok) vis++;
    });
    sec.style.display = vis>0 ? '' : 'none';
    const cnt = sec.querySelector('.day-section-count');
    if(cnt) cnt.textContent = vis;
  });
  const anyVisible = Array.from(document.querySelectorAll('.day-section')).some(s=>s.style.display!=='none');
  const list = document.getElementById('list-content');
  let emptyEl = document.getElementById('list-empty-state');
  if(!anyVisible){
    if(!emptyEl){
      emptyEl = document.createElement('div');
      emptyEl.id = 'list-empty-state';
      emptyEl.className = 'empty-state';
      emptyEl.textContent = '조건에 맞는 단어가 없어요. 필터를 조정해보세요.';
      list.appendChild(emptyEl);
    }
  } else if(emptyEl){ emptyEl.remove(); }
}

function refreshCardUI(id){
  const st = getState(id);
  document.querySelectorAll(`.word-card[data-wid="${id}"]`).forEach(card=>{
    card.classList.toggle('memorized', st.level===3);
    card.classList.toggle('hard', st.hard);
    const dotsEl = card.querySelector('.check-dots');
    if(dotsEl) dotsEl.innerHTML = dotsHtml(st.level);
    const pinBtn = card.querySelector('.pin-btn');
    if(pinBtn) pinBtn.classList.toggle('active', st.hard);
  });
  applyListFilters();
}

function handleCardClick(id){
  cycleLevel(id);
  refreshCardUI(id);
  updateProgress();
  if(flashQueue.length && flashQueue[flashIndex] && flashQueue[flashIndex].id===id) renderFlashCard();
}
function handlePinClick(id){
  toggleHard(id);
  refreshCardUI(id);
  if(flashQueue.length && flashQueue[flashIndex] && flashQueue[flashIndex].id===id) renderFlashCard();
}

/* ============ 플래시카드 뷰 ============ */
let flashQueue = [], flashIndex = 0, isFlipped = false, furiganaOn = false;

function buildFlashQueue(){
  flashQueue = VOCAB.filter(w=>
    activeFilters.pos.has(w.pos) &&
    w.day.some(d=>activeFilters.day.has(d)) &&
    passesStatus(w.id) &&
    passesTag(w.tags)
  );
  flashIndex = 0;
}

function renderFlashCard(){
  const cardEl = document.getElementById('flash-card');
  cardEl.classList.remove('flipped'); isFlipped=false;
  const total = flashQueue.length;
  document.getElementById('flash-counter').textContent = total ? `${flashIndex+1} / ${total}` : '0 / 0';
  const memCount = flashQueue.filter(w=>getState(w.id).level===3).length;
  document.getElementById('flash-stat').textContent = `${memCount} 암기완료 / ${total} 전체`;

  const wordEl = document.getElementById('f-word');
  const pinIndicator = document.getElementById('f-pin-indicator');
  const memBtn = document.getElementById('memorize-btn');
  const pinBtn = document.getElementById('pin-toggle-btn');

  if(!total){
    wordEl.textContent = '—';
    document.getElementById('f-pos').innerHTML = '';
    document.getElementById('f-day-tags').innerHTML = '';
    document.getElementById('f-reading').textContent = '—';
    document.getElementById('f-meaning').textContent = '조건에 맞는 단어가 없어요';
    document.getElementById('f-related').textContent = '';
    pinIndicator.classList.remove('active');
    pinBtn.classList.remove('active');
    memBtn.innerHTML = `<span class="check-dots">${dotsHtml(0)}</span><span>☆ 체크하기</span>`;
    return;
  }

  const w = flashQueue[flashIndex];
  const st = getState(w.id);

  if(furiganaOn && w.furigana && w.furigana !== w.japanese){
    wordEl.innerHTML = `<ruby>${w.japanese}<rt>${w.furigana}</rt></ruby>`;
  } else {
    wordEl.textContent = w.japanese;
  }
  wordEl.style.fontSize = w.japanese.length > 12 ? '24px' : (w.japanese.length > 7 ? '32px' : '');
  document.getElementById('f-pos').innerHTML = `<span class="pos-badge pos-${w.pos}">${w.pos}</span>`;
  document.getElementById('f-day-tags').innerHTML =
    w.day.map(d=>`<span class="flash-day-tag">#${d}일</span>`).join('') + tagBadgesHtml(w.tags);
  document.getElementById('f-reading').textContent = w.furigana;
  document.getElementById('f-meaning').textContent = w.korean;

  const related = VOCAB.filter(x=>x.id!==w.id && x.japanese[0]===w.japanese[0]).slice(0,4);
  document.getElementById('f-related').textContent = related.length ? '관련어: '+related.map(x=>x.japanese).join(' / ') : '';

  pinIndicator.classList.toggle('active', st.hard);
  pinBtn.classList.toggle('active', st.hard);

  const labelMap = ['☆ 체크하기','● 1/3 체크됨','●● 2/3 체크됨','✓ 암기완료'];
  memBtn.innerHTML = `<span class="check-dots">${dotsHtml(st.level)}</span><span>${labelMap[st.level]}</span>`;
}

function flipCard(){
  isFlipped = !isFlipped;
  document.getElementById('flash-card').classList.toggle('flipped', isFlipped);
}
function nextCard(){ if(flashQueue.length){ flashIndex=(flashIndex+1)%flashQueue.length; renderFlashCard(); } }
function prevCard(){ if(flashQueue.length){ flashIndex=(flashIndex-1+flashQueue.length)%flashQueue.length; renderFlashCard(); } }

function cycleFlashMemorize(){
  if(!flashQueue.length) return;
  const w = flashQueue[flashIndex];
  cycleLevel(w.id);
  refreshCardUI(w.id);
  updateProgress();
  renderFlashCard();
}
function togglePinFlash(){
  if(!flashQueue.length) return;
  const w = flashQueue[flashIndex];
  toggleHard(w.id);
  refreshCardUI(w.id);
  renderFlashCard();
}
function shuffleFlash(){
  for(let i=flashQueue.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [flashQueue[i],flashQueue[j]] = [flashQueue[j],flashQueue[i]];
  }
  flashIndex = 0;
  renderFlashCard();
}
function toggleFurigana(){
  furiganaOn = !furiganaOn;
  document.getElementById('furigana-toggle').classList.toggle('active', furiganaOn);
  renderFlashCard();
}

/* ============ 탭 전환 ============ */
function switchTab(name, btn){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  btn.classList.add('active');
  if(name==='flash'){ buildFlashQueue(); renderFlashCard(); }
}

/* ============ 초기화 ============ */
loadState();
updateDday();
initFilterChips();
renderList();
updateProgress();
buildFlashQueue();
renderFlashCard();
