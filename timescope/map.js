// Offline world map (equirectangular) with drag-to-pan, pinch/wheel zoom and tap-to-pin.
// Country outlines come from world.js (window.WORLD: flat [lon,lat,...] rings).
window.WorldMap = (() => {
  'use strict';
  const LAT_TOP = 84, LAT_SPAN = 142, MAX_Z = 14, TAU = Math.PI * 2;

  return class WorldMap {
    constructor(canvas, { onTap = () => {} } = {}) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.onTap = onTap;
      this.W = 0; this.H = 0; this.dpr = 1; this.z = 1; this.ox = 0; this.oy = 0;
      this.pins = []; this.line = null; this.enabled = true;
      this.ptrs = new Map(); this.drag = null; this.pinch = null;

      this.path = new Path2D();
      for (const r of window.WORLD) {
        this.path.moveTo(r[0] + 180, LAT_TOP - r[1]);
        for (let i = 2; i < r.length; i += 2) this.path.lineTo(r[i] + 180, LAT_TOP - r[i + 1]);
        this.path.closePath();
      }

      canvas.style.touchAction = 'none';
      canvas.addEventListener('pointerdown', e => this.down(e));
      canvas.addEventListener('pointermove', e => this.move(e));
      canvas.addEventListener('pointerup', e => this.up(e));
      canvas.addEventListener('pointercancel', e => { if (this.drag) this.drag.moved = true; this.up(e); });
      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const p = this.pt(e);
        this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });
      new ResizeObserver(() => this.resize()).observe(canvas);
      matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => this.render());
    }

    get k() { return this.W * this.z / 360; }   // canvas px per degree
    get minZ() { return this.W ? Math.max(1, this.H * 360 / (this.W * LAT_SPAN)) : 1; }   // never show empty bands above/below
    toXY(lon, lat) { return [this.ox + (lon + 180) * this.k, this.oy + (LAT_TOP - lat) * this.k]; }
    toLonLat(x, y) { return [(x - this.ox) / this.k - 180, LAT_TOP - (y - this.oy) / this.k]; }
    pt(e) { const b = this.cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * this.W / b.width, y: (e.clientY - b.top) * this.H / b.height }; }
    css(n) { return getComputedStyle(this.cv).getPropertyValue(n).trim(); }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const W = Math.round(this.cv.clientWidth * dpr), H = Math.round(this.cv.clientHeight * dpr);
      if (!W || !H) return;
      const center = this.W ? this.toLonLat(this.W / 2, this.H / 2) : [10, 20];
      this.cv.width = this.W = W; this.cv.height = this.H = H; this.dpr = dpr;
      this.centerOn(center[0], center[1], this.z);
      if (this.pending) { const p = this.pending; this.pending = null; this.fit(p); }
    }
    clamp() {
      const ww = 360 * this.k, wh = LAT_SPAN * this.k;
      this.ox = ww <= this.W ? (this.W - ww) / 2 : Math.min(0, Math.max(this.W - ww, this.ox));
      this.oy = wh <= this.H ? (this.H - wh) / 2 : Math.min(0, Math.max(this.H - wh, this.oy));
    }
    zoomAt(x, y, f) {
      const [lon, lat] = this.toLonLat(x, y);
      this.z = Math.min(MAX_Z, Math.max(this.minZ, this.z * f));
      this.ox = x - (lon + 180) * this.k; this.oy = y - (LAT_TOP - lat) * this.k;
      this.clamp(); this.render();
    }
    zoomBy(f) { this.zoomAt(this.W / 2, this.H / 2, f); }
    centerOn(lon, lat, z) {
      this.z = Math.min(MAX_Z, Math.max(this.minZ, z));
      this.ox = this.W / 2 - (lon + 180) * this.k; this.oy = this.H / 2 - (LAT_TOP - lat) * this.k;
      this.clamp(); this.render();
    }
    reset() { this.pending = null; this.centerOn(10, 20, 1); }
    fit(points) {   // zoom so every [lon, lat] is comfortably in view
      if (!this.W) { this.pending = points; return; }
      const lons = points.map(p => p[0]), lats = points.map(p => p[1]);
      const dLon = Math.max(10, Math.max(...lons) - Math.min(...lons)), dLat = Math.max(6, Math.max(...lats) - Math.min(...lats));
      const z = Math.min(360 / (dLon * 1.7), (this.H * 360) / (this.W * dLat * 2));
      this.centerOn((Math.max(...lons) + Math.min(...lons)) / 2, (Math.max(...lats) + Math.min(...lats)) / 2, z);
    }
    setPins(pins, line = null) { this.pins = pins; this.line = line; this.render(); }

    down(e) {
      try { this.cv.setPointerCapture(e.pointerId); } catch {}
      const p = this.pt(e);
      this.ptrs.set(e.pointerId, p);
      if (this.ptrs.size === 1) this.drag = { ...p, ox: this.ox, oy: this.oy, moved: false };
      else { if (this.drag) this.drag.moved = true; this.pinch = this.pinchInfo(); }
    }
    move(e) {
      if (!this.ptrs.has(e.pointerId)) return;
      const p = this.pt(e);
      this.ptrs.set(e.pointerId, p);
      if (this.ptrs.size >= 2) {
        const n = this.pinchInfo();
        if (this.pinch) {
          this.zoomAt(n.x, n.y, n.d / this.pinch.d);
          this.ox += n.x - this.pinch.x; this.oy += n.y - this.pinch.y;
          this.clamp(); this.render();
        }
        this.pinch = n;
        return;
      }
      const d = this.drag;
      if (!d) return;
      const dx = p.x - d.x, dy = p.y - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 6 * this.dpr) d.moved = true;
      if (d.moved) { this.ox = d.ox + dx; this.oy = d.oy + dy; this.clamp(); this.render(); }
    }
    up(e) {
      if (!this.ptrs.has(e.pointerId)) return;
      const p = this.ptrs.get(e.pointerId);
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size === 0) {
        if (this.drag && !this.drag.moved && this.enabled) {
          const [lon, lat] = this.toLonLat(p.x, p.y);
          if (lon >= -180 && lon <= 180 && lat <= LAT_TOP && lat >= LAT_TOP - LAT_SPAN) this.onTap(lon, lat);
        }
        this.drag = null; this.pinch = null;
      } else if (this.ptrs.size === 1) {
        const q = [...this.ptrs.values()][0];
        this.drag = { ...q, ox: this.ox, oy: this.oy, moved: true }; this.pinch = null;
      }
    }
    pinchInfo() {
      const [a, b] = [...this.ptrs.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
    }

    render() {
      const { ctx, W, H, dpr } = this;
      if (!W) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.css('--ocean'); ctx.fillRect(0, 0, W, H);
      const k = this.k;
      ctx.setTransform(k, 0, 0, k, this.ox, this.oy);
      ctx.fillStyle = this.css('--land'); ctx.fill(this.path, 'evenodd');
      ctx.lineWidth = dpr * 0.8 / k; ctx.lineJoin = 'round';
      ctx.strokeStyle = this.css('--border'); ctx.stroke(this.path);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      if (this.line) {
        const A = this.toXY(...this.line[0]), B = this.toXY(...this.line[1]);
        ctx.setLineDash([6 * dpr, 5 * dpr]); ctx.lineWidth = 2 * dpr; ctx.strokeStyle = this.css('--ink');
        ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const p of this.pins) {
        const [x, y] = this.toXY(p.lon, p.lat), r = 8 * dpr, cy = y - r * 1.6;
        ctx.beginPath(); ctx.arc(x, cy, r, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(x, y); ctx.closePath();
        ctx.fillStyle = p.color; ctx.fill();
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, cy, r * 0.38, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
      }
    }
  };
})();
