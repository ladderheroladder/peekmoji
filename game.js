(() => {
'use strict';
const { $, hash, rng, dayIndex, dailyPick, storage, pref, share, startCountdown, siteUrl, secs } = PK;

// ---- Config ----
const EPOCH = [2026, 8, 15];   // Sept 15, 2026 = puzzle #1 (month is 0-based)
const MISS_MS = 5000;          // penalty per wrong guess
const GIVEUP_MS = 60000;       // a give-up counts as this much time
const ADVANCE_MS = 1400;       // pause on the revealed emoji before moving on
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const SITE_URL = siteUrl('https://ladderheroladder.github.io/peekmoji/');

// ---- Data ----
const STOP = new Set(['of', 'and', 'the', 'in', 'on', 'an']);
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const wordsOf = s => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w));
const cap = s => s.replace(/^./, c => c.toUpperCase());

const CATS = window.PEEKMOJI_CATS.map(c => ({
  ...c,
  items: c.list.split(';').map(s => {
    s = s.trim(); const i = s.indexOf(' ');
    const names = s.slice(i + 1).split(',').map(n => n.trim()).filter(Boolean);
    return { e: s.slice(0, i), name: names[0], full: names.map(norm), words: [...new Set(names.flatMap(wordsOf))] };
  })
}));

// ---- Fuzzy guess matching ----
// Optimal-string-alignment edit distance with an early exit once it exceeds `max`.
function dist(a, b, max) {
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v; rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
const isPrefix = (q, k) => q.length >= 3 && k.startsWith(q) && q.length >= k.length * 0.6;          // "coconu" → coconut
const isTypo = (q, k) => {                                                                              // "cocnut" → coconut
  const tol = k.length >= 8 ? 2 : k.length >= 4 ? 1 : 0;
  return tol > 0 && q[0] === k[0] && Math.abs(q.length - k.length) <= tol && dist(q, k, tol) <= tol;
};
// 4 = exact name, 3 = prefix or a whole word ("pepper" → chili pepper), 2 = partial word, 1 = typo, 0 = no match
function matchScore(raw, item) {
  const q = norm(raw), qw = wordsOf(raw);
  if (!q) return 0;
  if (item.full.includes(q)) return 4;
  let best = 0;
  for (const f of item.full) best = Math.max(best, isPrefix(q, f) ? 3 : isTypo(q, f) ? 1 : 0);
  for (const w of item.words) {
    if (q === w || qw.includes(w)) best = Math.max(best, 3);
    else if (isPrefix(q, w) || qw.some(x => isPrefix(x, w))) best = Math.max(best, 2);
    else if (isTypo(q, w) || qw.some(x => isTypo(x, w))) best = Math.max(best, 1);
  }
  return best;
}
function judge(raw, cat, answer) {
  const a = matchScore(raw, answer);
  let best = a, other = null;
  for (const it of cat.items) {
    if (it === answer) continue;
    const s = matchScore(raw, it);
    if (s > best) { best = s; other = it; }
  }
  if (!best) return { result: 'unknown' };
  return a === best ? { result: 'win' } : { result: 'miss', item: other };   // ties go to the player
}

// ---- State ----
const today = dayIndex(EPOCH);
const db = storage('peekmoji:v2', () => ({ days: {} }));
const store = db.load();
const day = store.days[today] || (store.days[today] = {});   // catId -> { ms, w: [wrong names], s: play|won|lost }
let game = null, advanceTimer = null, lastSave = 0;

const roundMs = r => !r ? 0 : r.s === 'lost' ? GIVEUP_MS : r.ms + r.w.length * MISS_MS;
const isDone = r => r && r.s !== 'play';
function dayTotal(liveMs) {
  return CATS.reduce((sum, c) => {
    const r = day[c.id];
    if (!r) return sum;
    const live = liveMs != null && game && !game.practice && game.cat === c;
    return sum + roundMs(live ? { ...r, ms: liveMs } : r);
  }, 0);
}
function save() { if (!game.practice) db.save(store); }
function nextUnplayed(from) {
  const i0 = from ? CATS.indexOf(from) : -1;
  for (let k = 1; k <= CATS.length; k++) {
    const c = CATS[(i0 + k) % CATS.length];
    if (!isDone(day[c.id])) return c;
  }
  return null;
}

// ---- Board ----
const makeXf = r => ({ rot: (r() - 0.5) * 0.6, zoom: 1.1 + r() * 0.3, dx: (r() - 0.5) * 0.14, dy: (r() - 0.5) * 0.14 });
function paintEmoji(item, xf) {
  return (c, W, H) => {
    const S = Math.min(W, H), fs = S * 0.8 * xf.zoom;
    // Render the glyph at a capped size, then scale: some browsers refuse huge emoji fonts.
    const G = Math.min(Math.ceil(fs * 1.3), 520), gfs = G / 1.3;
    const g = document.createElement('canvas'); g.width = g.height = G;
    const gc = g.getContext('2d');
    gc.font = `${gfs}px ${EMOJI_FONT}`; gc.textAlign = 'center'; gc.textBaseline = 'alphabetic';
    const m = gc.measureText(item.e);
    const asc = m.actualBoundingBoxAscent || gfs * 0.8, desc = m.actualBoundingBoxDescent || gfs * 0.1;
    gc.fillText(item.e, G / 2, G / 2 + (asc - desc) / 2);
    c.save();
    c.translate(W / 2 + xf.dx * S, H / 2 + xf.dy * S); c.rotate(xf.rot);
    c.imageSmoothingQuality = 'high';
    const D = fs * 1.3; c.drawImage(g, -D / 2, -D / 2, D, D);
    c.restore();
  };
}

const sg = new PK.Spyglass($('#board'), {
  lens: 0.17, zoom: 1.6,
  onStart() { $('#hint').hidden = true; setMsg(''); },
  onTick(ms) {
    $('#looked').textContent = secs(ms);
    if (!game.practice) $('#total').textContent = secs(dayTotal(ms));
    if (performance.now() - lastSave > 300) { game.rec.ms = Math.round(ms); save(); lastSave = performance.now(); }
  },
  onRelease(ms) { game.rec.ms = Math.round(ms); save(); renderUI(); }
});

function begin(cat, item, xf, rec, practice) {
  clearTimeout(advanceTimer);
  game = { cat, item, xf, rec, practice };
  sg.load({ paint: paintEmoji(item, xf), heldMs: rec.ms, revealed: isDone(rec) });
  input.value = ''; hideSuggest(); setMsg('');
  if (isDone(rec)) setMsg(rec.s === 'won' ? `✅ ${item.e} ${cap(item.name)} · ${secs(roundMs(rec))}` : `🏳️ It was ${item.e} ${item.name}`, rec.s === 'won' ? 'good' : '');
  renderUI();
}
function startDaily(cat) {
  pref('cat', cat.id);
  const rec = day[cat.id] || (day[cat.id] = { ms: 0, w: [], s: 'play' });
  begin(cat, dailyPick(cat.items, cat.id, today)[0], makeXf(rng(hash(cat.id + '#' + today))), rec, false);
}
function startPractice() {
  const cat = CATS[Math.floor(Math.random() * CATS.length)];
  const item = cat.items[Math.floor(Math.random() * cat.items.length)];
  begin(cat, item, makeXf(Math.random), { ms: 0, w: [], s: 'play' }, true);
}

// ---- Guessing ----
const input = $('#guessInput'), sug = $('#suggest');
let sugItems = [], sugOn = -1;

function submitGuess(text) {
  if (!game || game.rec.s !== 'play' || !text.trim()) return;
  hideSuggest();
  if (sg.held() < 50) { setMsg('Look first: press & hold the board 🔭', 'bad'); shake(); return; }
  const j = judge(text, game.cat, game.item);
  if (j.result === 'win') return finish('won');
  if (j.result === 'unknown') { setMsg(`"${text.trim()}" isn't one of the ${game.cat.label} answers.`, 'bad'); return; }
  if (game.rec.w.includes(j.item.name)) { setMsg(`You already tried ${j.item.name}.`, 'bad'); return; }
  game.rec.w.push(j.item.name);
  save(); renderUI(); bump('#misses'); shake();
  setMsg(`Nope, not ${j.item.name}! +5s`, 'bad');
  input.value = '';
}
function finish(status) {
  game.rec.ms = Math.round(sg.held());
  game.rec.s = status;
  save();
  input.value = ''; input.blur(); hideSuggest();
  renderUI();
  const { item, rec } = game;
  setMsg(status === 'won' ? `✅ ${item.e} ${cap(item.name)}! ${secs(roundMs(rec))}` : `🏳️ It was ${item.e} ${item.name}`, status === 'won' ? 'good' : '');
  sg.reveal(() => { advanceTimer = setTimeout(advance, ADVANCE_MS); });
}
function advance() {
  if (game.practice) return startPractice();
  const next = nextUnplayed(game.cat);
  if (next) startDaily(next); else showDone();
}
function giveUp() {
  if (!game || game.rec.s !== 'play') return;
  if (confirm('Give up? It counts as 60 seconds.')) finish('lost');
}

function showSuggest() {
  const q = norm(input.value);
  if (!q || game.rec.s !== 'play') return hideSuggest();
  const starts = [], has = [];
  for (const it of game.cat.items) {
    if (game.rec.w.includes(it.name)) continue;
    const keys = [...it.full, ...it.words];
    if (keys.some(k => k.startsWith(q))) starts.push(it);
    else if (keys.some(k => k.includes(q))) has.push(it);
  }
  sugItems = [...starts, ...has].slice(0, 6);
  sugOn = -1;
  if (!sugItems.length) return hideSuggest();
  sug.innerHTML = '';
  for (const it of sugItems) {
    const li = document.createElement('li');
    li.textContent = it.name;
    li.addEventListener('pointerdown', e => { e.preventDefault(); submitGuess(it.name); });
    sug.appendChild(li);
  }
  sug.hidden = false;
}
function hideSuggest() { sug.hidden = true; sugItems = []; sugOn = -1; }
function markSuggest() { [...sug.children].forEach((li, i) => li.classList.toggle('on', i === sugOn)); }
function submitInput() { submitGuess(sugOn >= 0 ? sugItems[sugOn].name : input.value); }

input.addEventListener('input', showSuggest);
input.addEventListener('blur', () => setTimeout(hideSuggest, 100));
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
  const { cat, rec, practice } = game;
  const solved = CATS.filter(c => isDone(day[c.id])).length;
  $('#sub').innerHTML = practice
    ? `🎲 Practice · ${cat.icon} ${cat.label} · <a id="backDaily">back to daily</a>`
    : `Puzzle #${today + 1} · ${cat.icon} ${cat.label} · ${solved}/${CATS.length} done`;
  if (practice) $('#backDaily').onclick = () => { const n = nextUnplayed(null); if (n) startDaily(n); else { startDaily(CATS[0]); showDone(); } };

  const nav = $('#cats'); nav.innerHTML = '';
  for (const c of CATS) {
    const r = day[c.id];
    const st = !r ? '' : r.s === 'won' ? ` ✅ ${secs(roundMs(r))}` : r.s === 'lost' ? ' 🏳️' : (r.ms || r.w.length) ? ' …' : '';
    const b = document.createElement('button');
    b.className = 'cat'; b.type = 'button';
    b.setAttribute('aria-pressed', !practice && c === cat);
    b.textContent = `${c.icon} ${c.label}${st}`;
    b.onclick = () => startDaily(c);
    nav.appendChild(b);
  }
  nav.querySelector('[aria-pressed=true]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

  $('#looked').textContent = secs(rec.ms);
  $('#misses').textContent = rec.w.length;
  $('#total').textContent = secs(dayTotal());
  $('#hint').hidden = rec.ms > 0 || isDone(rec);
  const playing = rec.s === 'play';
  input.disabled = $('#guessBtn').disabled = !playing;
  $('#giveUp').hidden = !playing;
  $('#tried').innerHTML = rec.w.map(n => `<span>${n}</span>`).join('');
}
function setMsg(t, cls = '') { const m = $('#msg'); m.textContent = t; m.className = 'msg ' + cls; }
function bump(sel) { const el = $(sel); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function shake() { const el = $('#guessForm'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

// ---- Daily summary & sharing ----
const rankOf = s => s <= 6 ? '🤯 Psychic' : s <= 12 ? '🔥 Eagle eye' : s <= 20 ? '😎 Sharp' : s <= 35 ? '👍 Solid' : s <= 60 ? '😅 Got there' : '🐢 Persistent';
function shareText() {
  const lines = CATS.map(c => {
    const r = day[c.id];
    if (!isDone(r)) return `${c.icon} —`;
    if (r.s === 'lost') return `${c.icon} 🏳️`;
    return `${c.icon} ${secs(r.ms)} ${'❌'.repeat(r.w.length)}✅`;
  });
  return `Peekmoji #${today + 1} 🔭 ${secs(dayTotal())}\n${lines.join('\n')}\n${SITE_URL}`;
}
function showDone() {
  const total = dayTotal() / 1000;
  const won = CATS.filter(c => day[c.id]?.s === 'won').length;
  const misses = CATS.reduce((a, c) => a + (day[c.id]?.w.length || 0), 0);
  $('#doneRank').textContent = rankOf(total);
  $('#doneDetail').textContent = `Total ${total.toFixed(1)}s · ${won}/${CATS.length} solved · ${misses} miss${misses === 1 ? '' : 'es'}`;
  $('#doneShare').textContent = shareText();
  if (!$('#doneDlg').open) $('#doneDlg').showModal();
}
$('#shareBtn').addEventListener('click', () => share(shareText()));
$('#practiceBtn').addEventListener('click', () => { $('#doneDlg').close(); startPractice(); });

// ---- Stats ----
function stats() {
  const done = Object.entries(store.days)
    .filter(([, v]) => CATS.every(c => isDone(v[c.id])))
    .map(([d, v]) => ({ d: +d, t: CATS.reduce((a, c) => a + roundMs(v[c.id]), 0) }))
    .sort((a, b) => a.d - b.d);
  const days = new Set(done.map(x => x.d));
  let streak = 0, d = days.has(today) ? today : today - 1;
  while (days.has(d)) { streak++; d--; }
  return {
    played: done.length,
    best: done.length ? secs(Math.min(...done.map(x => x.t))) : '–',
    avg: done.length ? secs(done.reduce((a, x) => a + x.t, 0) / done.length) : '–',
    streak
  };
}
$('#statsBtn').addEventListener('click', () => {
  const s = stats();
  $('#statsGrid').innerHTML = [[s.played, 'Days'], [s.best, 'Best'], [s.avg, 'Average'], [s.streak, 'Streak 🔥']]
    .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  $('#statsToday').innerHTML = CATS.map(c => {
    const r = day[c.id];
    const v = !r || (!r.ms && !r.w.length) ? '—' : r.s === 'won' ? `✅ ${secs(roundMs(r))}` : r.s === 'lost' ? '🏳️' : '…';
    return `<span>${c.icon} ${c.label}</span><b>${v}</b>`;
  }).join('');
  $('#statsDlg').showModal();
});
$('#helpBtn').addEventListener('click', () => $('#helpDlg').showModal());

// ---- Boot ----
const first = nextUnplayed(null);
if (first) startDaily(first); else { startDaily(CATS[CATS.length - 1]); showDone(); }
startCountdown(EPOCH);
if (!pref('seenHelp2')) { pref('seenHelp2', '1'); $('#helpDlg').showModal(); }
})();
