// Spyglass: press & hold a canvas to look at a hidden scene through a moving, magnifying lens.
// Total hold time (ms) is tracked — that's the player's "looking time".
PK.Spyglass = class {
  constructor(canvas, opts = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.layer = document.createElement('canvas');
    this.opts = { lens: 0.17, zoom: 1.6, onTick() {}, onStart() {}, onRelease() {}, ...opts };
    this.paint = null; this.heldMs = 0; this.holding = null; this.pos = null;
    this.enabled = false; this.revealT = 0; this.pattern = null;

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, () => this.up());
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('blur', () => this.up());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.up(); });
    new ResizeObserver(() => this.resize()).observe(canvas);
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => this.resize());
  }

  // paint(ctx, W, H) draws the hidden scene. Call again for every new round.
  load({ paint, heldMs = 0, revealed = false }) {
    this.up(true);
    this.paint = paint; this.heldMs = heldMs;
    this.revealT = revealed ? 1 : 0; this.enabled = !revealed;
    this.refresh();
  }
  refresh() { this.buildLayer(); this.render(); }   // e.g. after an image finishes loading
  held() { return this.heldMs + (this.holding ? performance.now() - this.holding.t0 : 0); }
  setEnabled(v) { this.enabled = v; if (!v) this.up(); }

  css(name) { return getComputedStyle(this.cv).getPropertyValue(name).trim(); }
  radius() { return Math.min(this.cv.width, this.cv.height) * this.opts.lens; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = Math.round(this.cv.clientWidth * dpr), H = Math.round(this.cv.clientHeight * dpr);
    if (!W || !H) return;
    this.cv.width = W; this.cv.height = H;
    const t = document.createElement('canvas'), ts = Math.max(8, Math.round(Math.min(W, H) / 14));
    t.width = t.height = ts;
    const tc = t.getContext('2d');
    tc.fillStyle = this.css('--cover'); tc.fillRect(0, 0, ts, ts);
    tc.fillStyle = this.css('--dot'); tc.beginPath(); tc.arc(ts / 2, ts / 2, ts * 0.14, 0, Math.PI * 2); tc.fill();
    this.pattern = this.ctx.createPattern(t, 'repeat');
    this.refresh();
  }

  point(e) {
    const b = this.cv.getBoundingClientRect(), k = this.cv.width / b.width;
    const p = { x: (e.clientX - b.left) * k, y: (e.clientY - b.top) * k };
    if (e.pointerType === 'touch') p.y -= this.radius() * 1.3;   // keep the lens visible above the finger
    return p;
  }
  down(e) {
    if (!this.enabled || this.holding || !this.paint) return;
    e.preventDefault();
    try { this.cv.setPointerCapture(e.pointerId); } catch {}
    this.holding = { t0: performance.now(), id: e.pointerId };
    this.pos = this.point(e);
    this.opts.onStart();
    this.loop();
  }
  move(e) { if (this.holding && e.pointerId === this.holding.id) this.pos = this.point(e); }
  up(silent) {
    if (!this.holding) return;
    this.heldMs += performance.now() - this.holding.t0;
    this.holding = null;
    this.render();
    if (!silent) this.opts.onRelease(this.heldMs);
  }
  loop() {
    if (!this.holding) return;
    this.render();
    this.opts.onTick(this.held());
    requestAnimationFrame(() => this.loop());
  }

  reveal(done) {
    this.up(true); this.enabled = false;
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / 700);
      this.revealT = 1 - Math.pow(1 - t, 3);
      this.render();
      if (t < 1) requestAnimationFrame(step); else if (done) done();
    };
    requestAnimationFrame(step);
  }

  buildLayer() {
    const { width: W, height: H } = this.cv;
    if (!W || !this.paint) return;
    this.layer.width = W; this.layer.height = H;
    const c = this.layer.getContext('2d');
    c.fillStyle = this.css('--reveal'); c.fillRect(0, 0, W, H);
    this.paint(c, W, H);
  }

  render() {
    const { ctx } = this, { width: W, height: H } = this.cv;
    if (!W) return;
    ctx.fillStyle = this.pattern || this.css('--cover');
    ctx.fillRect(0, 0, W, H);
    if (!this.paint) return;
    if (this.revealT >= 1) { ctx.drawImage(this.layer, 0, 0); return; }
    if (this.revealT > 0) {
      ctx.save(); ctx.beginPath();
      ctx.arc(W / 2, H / 2, this.revealT * Math.hypot(W, H) / 2, 0, Math.PI * 2);
      ctx.clip(); ctx.drawImage(this.layer, 0, 0); ctx.restore();
      return;
    }
    if (!this.holding || !this.pos) return;

    const r = this.radius(), { x, y } = this.pos, z = this.opts.zoom, TAU = Math.PI * 2;
    // magnified view
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.translate(x, y); ctx.scale(z, z); ctx.translate(-x, -y);
    ctx.drawImage(this.layer, 0, 0);
    ctx.restore();
    // glass shading
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
    // brass rim
    const rim = r * 0.14, rg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    rg.addColorStop(0, '#ffe7a8'); rg.addColorStop(0.5, '#c98b2b'); rg.addColorStop(1, '#6e4510');
    ctx.lineWidth = rim; ctx.strokeStyle = rg;
    ctx.beginPath(); ctx.arc(x, y, r + rim / 2, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(1, rim * 0.2); ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.arc(x, y, r + rim, 0, TAU); ctx.stroke();
  }
};
