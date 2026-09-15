(() => {
'use strict';

// ---- Config ----
const SITE_URL = (location.protocol.startsWith('http') ? location.origin + location.pathname : 'https://peekmoji.com').replace(/index\.html$/, '');
const EPOCH = [2026, 8, 15];   // Sept 15, 2026 = puzzle #1 (month is 0-based)
const RADIUS = 0.1;            // peek circle radius, as a fraction of the board
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const STORE_KEY = 'peekmoji:v1';

// ---- Helpers ----
const $ = s => document.querySelector(s);
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const dayIndex = (d = new Date()) => Math.max(0, Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(...EPOCH)) / 864e5));

const CATS = window.PEEKMOJI_CATS.map(c => ({
  ...c,
  items: c.list.split(';').map(s => {
    s = s.trim(); const i = s.indexOf(' ');
    const names = s.slice(i + 1).split(',').map(n => n.trim()).filter(Boolean);
    return { e: s.slice(0, i), name: names[0], names: names.map(norm) };
  })
}));

function dailyItem(cat, day) {
  const n = cat.items.length, cycle = Math.floor(day / n);
  const order = [...cat.items.keys()], r = rng(hash(cat.id + ':' + cycle));
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return cat.items[order[day % n]];
}
const makeXf = r => ({ rot: (r() - 0.5) * 0.6, zoom: 1.1 + r() * 0.3, dx: (r() - 0.5) * 0.14, dy: (r() - 0.5) * 0.14 });

// ---- Storage (safe if blocked) ----
function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { g: {} }; } catch { return { g: {} }; } }
function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {} }
const pref = (k, v) => { try { return v === undefined ? localStorage.getItem('peekmoji:' + k) : localStorage.setItem('peekmoji:' + k, v); } catch { return null; } };
const store = load();

// ---- State ----
let today = dayIndex();
let cat = CATS[0];
let game = null;

const peeksOf = g => (g.log.match(/p/g) || []).length;
const missesOf = g => (g.log.match(/x/g) || []).length;
const scoreOf = g => peeksOf(g) + missesOf(g);
const rankOf = s => s <= 1 ? '🤯 Psychic' : s <= 3 ? '🔥 Eagle eye' : s <= 5 ? '😎 Sharp' : s <= 8 ? '👍 Solid' : s <= 12 ? '😅 Got there' : '🐢 Persistent';

function startDaily(c) {
  cat = c; pref('cat', c.id);
  const key = today + ':' + c.id;
  const rec = store.g[key] || (store.g[key] = { p: [], w: [], log: '', s: 'play' });
  game = { ...rec, key, practice: false, item: dailyItem(c, today), xf: makeXf(rng(hash(c.id + '#' + today))) };
  afterStart();
}
function startPractice() {
  const daily = dailyItem(cat, today);
  const pool = cat.items.filter(i => i !== daily);
  game = { p: [], w: [], log: '', s: 'play', practice: true, item: pool[Math.floor(Math.random() * pool.length)], xf: makeXf(Math.random) };
  afterStart();
}
function save() {
  if (game.practice) return;
  store.g[game.key] = { p: game.p, w: game.w, log: game.log, s: game.s };
  persist();
}
function afterStart() {
  anim = null; buildLayer(); draw(); renderUI(); setMsg('');
  $('#guessInput').value = ''; hideSuggest();
}

// ---- Canvas ----
const cv = $('#board'), ctx = cv.getContext('2d');
const layer = document.createElement('canvas');
let colors = {}, pattern = null, anim = null;

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  colors = { cover: cs.getPropertyValue('--cover').trim(), dot: cs.getPropertyValue('--dot').trim(), reveal: cs.getPropertyValue('--reveal').trim() };
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const S = Math.round(cv.clientWidth * dpr);
  if (!S) return;
  cv.width = cv.height = S;
  readColors();
  const t = document.createElement('canvas'), ts = Math.max(8, Math.round(S / 14));
  t.width = t.height = ts;
  const tc = t.getContext('2d');
  tc.fillStyle = colors.cover; tc.fillRect(0, 0, ts, ts);
  tc.fillStyle = colors.dot; tc.beginPath(); tc.arc(ts / 2, ts / 2, ts * 0.14, 0, Math.PI * 2); tc.fill();
  pattern = ctx.createPattern(t, 'repeat');
  buildLayer(); draw();
}
function buildLayer() {
  const S = cv.width; if (!S || !game) return;
  layer.width = layer.height = S;
  const c = layer.getContext('2d');
  c.fillStyle = colors.reveal; c.fillRect(0, 0, S, S);
  // Render the glyph at a capped size, then scale — some browsers refuse huge emoji fonts.
  const fs = S * 0.8 * game.xf.zoom, G = Math.min(Math.ceil(fs * 1.3), 520), gfs = G / 1.3;
  const g = document.createElement('canvas'); g.width = g.height = G;
  const gc = g.getContext('2d');
  gc.font = `${gfs}px ${EMOJI_FONT}`; gc.textAlign = 'center'; gc.textBaseline = 'alphabetic';
  const m = gc.measureText(game.item.e);
  const asc = m.actualBoundingBoxAscent || gfs * 0.8, desc = m.actualBoundingBoxDescent || gfs * 0.1;
  gc.fillText(game.item.e, G / 2, G / 2 + (asc - desc) / 2);
  c.save();
  c.translate(S / 2 + game.xf.dx * S, S / 2 + game.xf.dy * S);
  c.rotate(game.xf.rot);
  c.imageSmoothingQuality = 'high';
  const D = fs * 1.3; c.drawImage(g, -D / 2, -D / 2, D, D);
  c.restore();
}
function draw() {
  const S = cv.width; if (!S) return;
  ctx.fillStyle = pattern || colors.cover; ctx.fillRect(0, 0, S, S);
  if (!game) return;
  if (game.s !== 'play' && !anim) { ctx.drawImage(layer, 0, 0); return; }
  const r = RADIUS * S;
  ctx.save(); ctx.beginPath();
  for (const [x, y] of game.p) { ctx.moveTo(x * S + r, y * S); ctx.arc(x * S, y * S, r, 0, Math.PI * 2); }
  if (anim) { const R = anim.t * S * 0.75; ctx.moveTo(S / 2 + R, S / 2); ctx.arc(S / 2, S / 2, R, 0, Math.PI * 2); }
  ctx.clip(); ctx.drawImage(layer, 0, 0); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(2, S * 0.006);
  for (const [x, y] of game.p) { ctx.beginPath(); ctx.arc(x * S, y * S, r, 0, Math.PI * 2); ctx.stroke(); }
}
function revealAll(done) {
  const t0 = performance.now();
  anim = { t: 0 };
  const step = now => {
    anim.t = Math.min(1, (now - t0) / 650);
    anim.t = 1 - Math.pow(1 - anim.t, 3);
    draw();
    if (anim.t < 1) requestAnimationFrame(step); else { anim = null; draw(); done && done(); }
  };
  requestAnimationFrame(step);
}

cv.addEventListener('pointerdown', e => {
  if (!game || game.s !== 'play' || anim) return;
  const b = cv.getBoundingClientRect();
  const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
  game.p.push([+x.toFixed(3), +y.toFixed(3)]);
  game.log += 'p';
  save(); draw(); renderUI(); bump('#peeks'); setMsg('');
});

// ---- Guessing ----
const input = $('#guessInput'), sug = $('#suggest');
let sugItems = [], sugOn = -1;

function submitGuess(text) {
  if (!game || game.s !== 'play') return;
  const g = norm(text);
  if (!g) return;
  if (!game.p.length) { setMsg('Peek at least once first 👆', 'bad'); shake(); return; }
  hideSuggest();
  if (game.item.names.includes(g)) return win();
  const match = cat.items.find(i => i.names.includes(g));
  if (!match) { setMsg(`"${text.trim()}" isn't in ${cat.label}. Pick a suggestion.`, 'bad'); return; }
  if (game.w.includes(match.name)) { setMsg(`You already tried ${match.name}.`, 'bad'); return; }
  game.w.push(match.name); game.log += 'x';
  save(); renderUI(); bump('#misses'); shake();
  setMsg(`Nope, not ${match.name}!`, 'bad');
  input.value = '';
}
function win() {
  game.s = 'won'; game.log += 'w'; save(); input.value = ''; input.blur();
  renderUI(); setMsg(`Got it! ${game.item.e} ${game.item.name}`, 'good');
  revealAll(() => setTimeout(showResult, 250));
}
function giveUp() {
  if (!game || game.s !== 'play') return;
  if (!confirm('Give up and reveal the answer?')) return;
  game.s = 'lost'; game.log += 'g'; save(); renderUI();
  setMsg(`It was ${game.item.e} ${game.item.name}.`);
  revealAll(() => setTimeout(showResult, 250));
}

function showSuggest() {
  const q = norm(input.value);
  if (!q || game.s !== 'play') return hideSuggest();
  const starts = [], has = [];
  for (const it of cat.items) {
    if (game.w.includes(it.name)) continue;
    if (it.names.some(n => n.startsWith(q))) starts.push(it);
    else if (it.names.some(n => n.includes(q))) has.push(it);
  }
  sugItems = [...starts, ...has].slice(0, 6);
  sugOn = -1;
  if (!sugItems.length) return hideSuggest();
  sug.innerHTML = '';
  sugItems.forEach((it, i) => {
    const li = document.createElement('li');
    li.textContent = it.name;
    li.addEventListener('pointerdown', e => { e.preventDefault(); submitGuess(it.name); });
    sug.appendChild(li);
  });
  sug.hidden = false;
}
function hideSuggest() { sug.hidden = true; sugItems = []; sugOn = -1; }
function markSuggest() { [...sug.children].forEach((li, i) => li.classList.toggle('on', i === sugOn)); }

input.addEventListener('input', showSuggest);
input.addEventListener('blur', () => setTimeout(hideSuggest, 100));
function submitInput() {
  const pick = sugOn >= 0 ? sugItems[sugOn].name : (sugItems.length === 1 ? sugItems[0].name : input.value);
  submitGuess(pick);
}
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); submitInput(); return; }
  if (sug.hidden) return;
  if (e.key === 'ArrowDown') { sugOn = (sugOn + 1) % sugItems.length; markSuggest(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sugOn = (sugOn - 1 + sugItems.length) % sugItems.length; markSuggest(); e.preventDefault(); }
  else if (e.key === 'Escape') hideSuggest();
});
$('#guessForm').addEventListener('submit', e => { e.preventDefault(); submitInput(); });
$('#giveUp').addEventListener('click', giveUp);

// ---- UI ----
function renderUI() {
  $('#sub').innerHTML = game.practice
    ? `🎲 Practice round · <a id="backDaily">back to daily</a>`
    : `Puzzle #${today + 1} · ${cat.icon} ${cat.label} · 🔥 ${stats().streak}`;
  if (game.practice) $('#backDaily').onclick = () => startDaily(cat);
  const nav = $('#cats'); nav.innerHTML = '';
  for (const c of CATS) {
    const rec = store.g[today + ':' + c.id];
    const st = !rec ? '' : rec.s === 'won' ? ' ✅' : rec.s === 'lost' ? ' 🏳️' : rec.log ? ' …' : '';
    const b = document.createElement('button');
    b.className = 'cat'; b.type = 'button';
    b.setAttribute('aria-pressed', !game.practice && c === cat);
    b.textContent = `${c.icon} ${c.label}${st}`;
    b.onclick = () => startDaily(c);
    nav.appendChild(b);
  }
  $('#peeks').textContent = peeksOf(game);
  $('#misses').textContent = missesOf(game);
  $('#score').textContent = scoreOf(game);
  $('#hint').hidden = game.p.length > 0 || game.s !== 'play';
  const playing = game.s === 'play';
  input.disabled = $('#guessBtn').disabled = !playing;
  $('#giveUp').hidden = !playing;
  $('#tried').innerHTML = game.w.map(n => `<span>${n}</span>`).join('');
}
function setMsg(t, cls = '') { const m = $('#msg'); m.textContent = t; m.className = 'msg ' + cls; }
function bump(sel) { const el = $(sel); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function shake() { const el = $('#guessForm'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800); }

// ---- Results & sharing ----
function shareText() {
  const p = peeksOf(game), x = missesOf(game);
  let row = game.log.replace(/p/g, '👆').replace(/x/g, '❌').replace(/w/g, '✅').replace(/g/g, '🏳️');
  if (game.log.length > 16) row = `👆×${p}` + (x ? ` ❌×${x}` : '') + (game.s === 'won' ? ' ✅' : ' 🏳️');
  const head = game.practice ? `Peekmoji practice · ${cat.icon} ${cat.label}` : `Peekmoji #${today + 1} · ${cat.icon} ${cat.label}`;
  const line = game.s === 'won' ? `Score ${scoreOf(game)} · ${rankOf(scoreOf(game))}` : 'Stumped! 🏳️';
  return `${head}\n${row}\n${line}\n${SITE_URL}`;
}
function nextUnplayed() { return CATS.find(c => !store.g[today + ':' + c.id] || store.g[today + ':' + c.id].s === 'play'); }
function showResult() {
  const won = game.s === 'won', p = peeksOf(game), x = missesOf(game);
  $('#resEmoji').textContent = game.item.e;
  const cap = game.item.name.replace(/^./, c => c.toUpperCase());
  $('#resTitle').textContent = won ? `${cap}! 🎉` : `It was: ${cap}`;
  $('#resRank').textContent = won ? rankOf(scoreOf(game)) : 'Better luck tomorrow';
  $('#resDetail').textContent = `${p} peek${p === 1 ? '' : 's'} + ${x} miss${x === 1 ? '' : 'es'}` + (won ? ` = score ${scoreOf(game)}` : '');
  $('#resShare').textContent = shareText();
  const nxt = game.practice ? null : nextUnplayed();
  $('#nextBtn').hidden = !nxt;
  if (nxt) $('#nextBtn').textContent = `Next: ${nxt.icon} ${nxt.label}`;
  $('#practiceBtn').textContent = game.practice ? 'Play again 🎲' : 'Practice 🎲';
  $('#resultDlg').showModal();
}
$('#shareBtn').addEventListener('click', async () => {
  const text = shareText();
  if (navigator.share && matchMedia('(pointer:coarse)').matches) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); toast('Copied! Paste it anywhere 📋'); }
  catch { toast('Copy failed. Select the text above.'); }
});
$('#nextBtn').addEventListener('click', () => { $('#resultDlg').close(); const n = nextUnplayed(); if (n) startDaily(n); });
$('#practiceBtn').addEventListener('click', () => { $('#resultDlg').close(); startPractice(); });

// ---- Stats ----
function stats() {
  let played = 0, won = 0, sum = 0;
  const wonDays = new Set();
  for (const [k, v] of Object.entries(store.g)) {
    if (v.s === 'play') continue;
    played++;
    if (v.s === 'won') { won++; sum += scoreOf(v); wonDays.add(+k.split(':')[0]); }
  }
  let streak = 0, d = wonDays.has(today) ? today : today - 1;
  while (wonDays.has(d)) { streak++; d--; }
  let best = 0, run = 0, prev = null;
  for (const day of [...wonDays].sort((a, b) => a - b)) { run = prev !== null && day === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = day; }
  return { played, won, avg: won ? (sum / won).toFixed(1) : '–', streak, best };
}
$('#statsBtn').addEventListener('click', () => {
  const s = stats();
  $('#statsGrid').innerHTML = [[s.played, 'Played'], [s.avg, 'Avg score'], [s.streak, 'Streak 🔥'], [s.best, 'Best streak']]
    .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  $('#statsToday').innerHTML = CATS.map(c => {
    const r = store.g[today + ':' + c.id];
    const v = !r || !r.log ? '—' : r.s === 'won' ? `✅ ${scoreOf(r)}` : r.s === 'lost' ? '🏳️' : '…';
    return `<span>${c.icon} ${c.label}</span><b>${v}</b>`;
  }).join('');
  $('#statsDlg').showModal();
});
$('#helpBtn').addEventListener('click', () => $('#helpDlg').showModal());

// ---- Countdown / day rollover ----
function tick() {
  if (dayIndex() !== today) { location.reload(); return; }
  const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const s = Math.max(0, Math.floor((next - now) / 1000));
  const t = [s / 3600, s / 60 % 60, s % 60].map(n => String(Math.floor(n)).padStart(2, '0')).join(':');
  document.querySelectorAll('.countdown').forEach(el => el.textContent = t);
}

// ---- Boot ----
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', resize);
new ResizeObserver(resize).observe(cv);
const saved = CATS.find(c => c.id === pref('cat'));
const savedRec = saved && store.g[today + ':' + saved.id];
startDaily(savedRec && savedRec.s === 'play' ? saved : (nextUnplayed() || saved || CATS[0]));
resize();
tick(); setInterval(tick, 1000);
if (!pref('seenHelp')) { pref('seenHelp', '1'); $('#helpDlg').showModal(); }
})();
