// Shared helpers for Peekmoji + Timescope.
window.PK = (() => {
  'use strict';
  const $ = s => document.querySelector(s);

  const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  // Days since `epoch` ([y, monthIndex, d]) in the player's local calendar. Day 0 = puzzle #1.
  const dayIndex = (epoch, d = new Date()) =>
    Math.max(0, Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(...epoch)) / 864e5));

  function shuffled(n, seedKey) {
    const order = [...Array(n).keys()], r = rng(hash(seedKey));
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return order;
  }
  // Pick `count` items for a day from a pool; walks a seeded shuffle so nothing repeats until the pool is used up.
  function dailyPick(items, seedKey, day, count = 1) {
    const n = items.length, out = [];
    for (let k = 0; k < count; k++) {
      const p = day * count + k;
      out.push(items[shuffled(n, seedKey + ':' + Math.floor(p / n))[p % n]]);
    }
    return out;
  }

  function storage(key, fallback) {
    return {
      load() { try { return JSON.parse(localStorage.getItem(key)) || fallback(); } catch { return fallback(); } },
      save(v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }
    };
  }
  const pref = (k, v) => { try { return v === undefined ? localStorage.getItem('pk:' + k) : localStorage.setItem('pk:' + k, v); } catch { return null; } };

  function toast(t) {
    const el = $('#toast'); if (!el) return;
    el.textContent = t; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
  }
  async function share(text) {
    if (navigator.share && matchMedia('(pointer:coarse)').matches) {
      try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); toast('Copied! Paste it anywhere 📋'); }
    catch { toast('Copy failed. Select the text instead.'); }
  }

  // Updates every .countdown element with time until local midnight; reloads when the day rolls over.
  function startCountdown(epoch) {
    const today = dayIndex(epoch);
    const tick = () => {
      if (dayIndex(epoch) !== today) return location.reload();
      const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const s = Math.max(0, Math.floor((next - now) / 1000));
      const t = [s / 3600, s / 60 % 60, s % 60].map(n => String(Math.floor(n)).padStart(2, '0')).join(':');
      document.querySelectorAll('.countdown').forEach(el => el.textContent = t);
    };
    tick(); setInterval(tick, 1000);
  }

  const siteUrl = fallback => location.protocol.startsWith('http')
    ? (location.origin + location.pathname).replace(/index\.html$/, '')
    : fallback;
  const secs = ms => (ms / 1000).toFixed(1) + 's';

  return { $, hash, rng, dayIndex, dailyPick, storage, pref, toast, share, startCountdown, siteUrl, secs };
})();
