const KEY = 'one-next-thing.v1';
function todayStr(){ return new Date().toISOString().slice(0,10); }

const defaults = () => ({
  tasks: [],
  wildhorses: { text: 'one beat a day', minutes: 25, doneDate: null },
  doneToday: { date: todayStr(), count: 0 },
  timer: { remaining: 0, total: 0, running: false }
});

let state = load();
let timerInterval = null;
const $ = s => document.querySelector(s);

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaults();
    return {...defaults(), ...JSON.parse(raw)};
  }catch{ return defaults(); }
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch{} }

// daily rollovers
if(state.doneToday.date !== todayStr()) state.doneToday = { date: todayStr(), count: 0 };
if(state.timer.running){ state.timer.running = false; save(); }

// ---------- render ----------
function render(){ renderWildhorses(); renderNext(); renderDoneCount(); }

function renderWildhorses(){
  const wh = state.wildhorses;
  const done = wh.doneDate === todayStr();
  $('#wildhorses').classList.toggle('done', done);
  $('#wh-text').textContent = wh.text;
  $('#wh-minutes').textContent = wh.minutes + ' min';
  $('#wh-done').textContent = done ? 'done ✓' : 'done';
}

function nextTask(){ return state.tasks.find(t => !t.done) || null; }

function renderNext(){
  const task = nextTask();
  if(!task){ $('#next-empty').hidden = false; $('#next-body').hidden = true; return; }
  $('#next-empty').hidden = true; $('#next-body').hidden = false;
  $('#task-text').textContent = task.text;
  renderTimer();
}

function renderTimer(){
  const fg = $('#ring-fg'), timeEl = $('#ring-time'), t = state.timer;
  const C = 439.82;
  if(!t.total){ fg.style.strokeDashoffset = 0; timeEl.textContent = '—'; $('#start').textContent = 'start'; return; }
  const frac = Math.max(0, t.remaining / t.total);
  fg.style.strokeDashoffset = C * (1 - frac);
  const m = Math.floor(t.remaining/60), s = t.remaining % 60;
  timeEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
  $('#start').textContent = t.running ? 'pause' : (t.remaining < t.total && t.remaining > 0 ? 'resume' : 'start');
}

function renderDoneCount(){
  const el = $('#done-count'), n = state.doneToday.count;
  if(n > 0){ el.hidden = false; el.textContent = `${n} done today`; }
  else { el.hidden = true; }
}

// ---------- brain dump ----------
$('#breakdown').addEventListener('click', () => {
  const raw = $('#dump').value.trim();
  if(!raw) return;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 10);
  // TODO: replace `lines` with AI-generated 3–10 small steps when you wire one up.
  const steps = lines.map(text => ({ id: crypto.randomUUID(), text, done:false, createdAt: Date.now() }));
  state.tasks.push(...steps);
  save();
  $('#dump').value = '';
  render();
});

// ---------- one next thing ----------
$('#start').addEventListener('click', () => {
  const t = state.timer;
  if(t.running){ clearInterval(timerInterval); t.running = false; save(); renderTimer(); return; }
  if(t.remaining <= 0){ const mins = nextTask()?.estimateMinutes || 10; t.total = mins*60; t.remaining = t.total; }
  t.running = true; save();
  timerInterval = setInterval(tick, 1000);
  renderTimer();
});

function tick(){
  const t = state.timer;
  if(!t.running) return;
  t.remaining--;
  if(t.remaining <= 0){ t.remaining = 0; t.running = false; clearInterval(timerInterval); if(navigator.vibrate) navigator.vibrate([200,100,200]); }
  save(); renderTimer();
}

$('#done').addEventListener('click', () => {
  const task = nextTask(); if(!task) return;
  task.done = true; task.doneAt = Date.now();
  state.doneToday.count++;
  state.timer = { remaining:0, total:0, running:false };
  clearInterval(timerInterval); save(); render();
});

$('#later').addEventListener('click', () => {
  const task = nextTask(); if(!task) return;
  state.tasks = state.tasks.filter(t => t.id !== task.id).concat(task);
  state.timer = { remaining:0, total:0, running:false };
  clearInterval(timerInterval); save(); render();
});

// ---------- wildhorses ----------
$('#wh-edit').addEventListener('click', () => {
  const text = prompt('wildhorses text', state.wildhorses.text);
  if(text !== null) state.wildhorses.text = text.trim() || state.wildhorses.text;
  const mins = prompt('minutes', state.wildhorses.minutes);
  const n = parseInt(mins, 10);
  if(!isNaN(n) && n > 0) state.wildhorses.minutes = n;
  save(); render();
});

$('#wh-done').addEventListener('click', () => {
  state.wildhorses.doneDate = state.wildhorses.doneDate === todayStr() ? null : todayStr();
  save(); render();
});

// ---------- boot ----------
render();
if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
