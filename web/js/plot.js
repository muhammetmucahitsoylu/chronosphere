// Minimal scatter plot on a canvas: axes, error bars, hover tooltip, click-to-select.

function niceTicks(lo, hi, target = 5) {
  const span = hi - lo || 1, raw = span / target, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= target + 1) || raw;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  return { ticks: out, step };
}
const fmtNum = (v, step) => {
  const d = Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));
  return Math.abs(v) >= 1e6 ? v.toExponential(1) : v.toFixed(step < 1 ? d : 0);
};

export class Plot {
  constructor(canvas, tip) {
    this.cv = canvas; this.tip = tip; this.pts = []; this.opt = {};
    canvas.addEventListener('pointermove', e => this.hover(e));
    canvas.addEventListener('pointerleave', () => { this.tip.hidden = true; });
    canvas.addEventListener('click', e => { const p = this.nearest(e); if (p && this.opt.onPick) this.opt.onPick(p); });
    new ResizeObserver(() => this.draw()).observe(canvas);
  }
  set(pts, opt) { this.pts = pts; this.opt = opt; this.draw(); }

  nearest(e) {
    const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 18 * 18;
    for (const p of this.pts) {
      if (p._x === undefined) continue;
      const d = (p._x - mx) ** 2 + (p._y - my) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  hover(e) {
    const p = this.nearest(e);
    if (!p) { this.tip.hidden = true; return; }
    this.tip.hidden = false;
    this.tip.textContent = this.opt.tipText ? this.opt.tipText(p) : `${p.x}, ${p.y}`;
    const r = this.cv.getBoundingClientRect();
    this.tip.style.left = Math.min(r.width - 170, Math.max(0, p._x + 10)) + 'px';
    this.tip.style.top = Math.max(0, p._y - 30) + 'px';
  }

  draw() {
    const cv = this.cv, dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const o = this.opt, pts = this.pts, css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink-2').trim() || '#9aa', grid = css.getPropertyValue('--line').trim() || '#333';
    const L = 52, R = 10, T = 10, B = 34, pw = W - L - R, ph = H - T - B;
    c.font = '12px system-ui, sans-serif';
    if (!pts.length) {
      c.fillStyle = ink; c.textAlign = 'center';
      c.fillText(o.empty || 'No data', W / 2, H / 2); return;
    }
    let [x0, x1] = o.xlim || [Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.x))];
    let [y0, y1] = o.ylim || [Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.y))];
    if (x0 === x1) { x0 -= 1; x1 += 1; }
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    const xp = (x1 - x0) * 0.03, yp = (y1 - y0) * 0.06;
    if (!o.xlim) { x0 -= xp; x1 += xp; } if (!o.ylim) { y0 -= yp; y1 += yp; }
    const X = v => L + (v - x0) / (x1 - x0) * pw, Y = v => T + ph - (v - y0) / (y1 - y0) * ph;

    c.strokeStyle = grid; c.fillStyle = ink; c.lineWidth = 1;
    const yt = niceTicks(y0, y1, 4);
    c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const v of yt.ticks) { c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(W - R, Y(v)); c.stroke(); c.fillText(fmtNum(v, yt.step), L - 6, Y(v)); }
    c.textAlign = 'center'; c.textBaseline = 'top';
    if (o.xTicks) { const tk = o.xTicks(x0, x1), every = Math.max(1, Math.ceil(tk.length * 58 / pw)); tk.forEach((t, i) => { if (i % every) return; c.beginPath(); c.moveTo(X(t.v), T + ph); c.lineTo(X(t.v), T + ph + 4); c.stroke(); c.fillText(t.label, X(t.v), T + ph + 6); }); }
    else { const xt = niceTicks(x0, x1, 6); for (const v of xt.ticks) { c.beginPath(); c.moveTo(X(v), T + ph); c.lineTo(X(v), T + ph + 4); c.stroke(); c.fillText(fmtNum(v, xt.step), X(v), T + ph + 6); } }
    c.strokeRect(L, T, pw, ph);
    if (o.xlabel) c.fillText(o.xlabel, L + pw / 2, H - 14);
    if (o.ylabel) { c.save(); c.translate(11, T + ph / 2); c.rotate(-Math.PI / 2); c.textBaseline = 'middle'; c.fillText(o.ylabel, 0, 0); c.restore(); }
    if (o.band) { c.fillStyle = o.band.color || '#ffffff14'; const ya = Y(o.band.y1), yb = Y(o.band.y0); c.fillRect(L, ya, pw, yb - ya); }
    if (o.hline !== undefined) { c.setLineDash([4, 4]); c.beginPath(); c.moveTo(L, Y(o.hline)); c.lineTo(W - R, Y(o.hline)); c.stroke(); c.setLineDash([]); }
    for (const s of o.shade || []) {
      const xa = X(Math.max(s.x0, x0)), xb = X(Math.min(s.x1, x1));
      c.fillStyle = s.color; c.fillRect(xa, T, xb - xa, ph);
      if (s.label) { c.fillStyle = ink; c.font = '10px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(s.label, (xa + xb) / 2, T + 3 + (s.row || 0) * 11); c.font = '12px system-ui, sans-serif'; }
    }

    c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
    for (const p of pts) {
      p._x = X(p.x); p._y = Y(p.y);
      c.globalAlpha = p.dim ? 0.35 : 0.9; c.strokeStyle = c.fillStyle = p.color || '#4cc9f0';
      if (p.err && o.errors !== false && !p.hollow) { c.beginPath(); c.moveTo(p._x, Y(p.y - p.err)); c.lineTo(p._x, Y(p.y + p.err)); c.stroke(); }
      c.beginPath(); c.arc(p._x, p._y, p.big ? 5 : 2.6, 0, 7);
      if (p.hollow && !p.big) { c.lineWidth = 1.2; c.stroke(); } else c.fill();      // hollow = approximate level
    }
    c.globalAlpha = 1;
    for (const p of pts) if (p.big) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(p._x, p._y, 7, 0, 7); c.stroke(); }
    c.restore();
  }
}

// One formatter for all labels: making a new one for every label is slow enough to be felt.
const MONTH = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' });
export function dateTicks(x0, x1) {
  // x in MJD; label every N months
  const d0 = new Date((x0 - 40587) * 864e5), d1 = new Date((x1 - 40587) * 864e5);
  const months = (d1.getUTCFullYear() - d0.getUTCFullYear()) * 12 + d1.getUTCMonth() - d0.getUTCMonth();
  const step = months > 30 ? 6 : months > 14 ? 3 : months > 6 ? 2 : 1, out = [];
  const d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1));
  while (d <= d1) {
    if (d.getUTCMonth() % step === 0) out.push({ v: d.getTime() / 864e5 + 40587, label: MONTH.format(d) });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  if (!out.length) out.push({ v: (x0 + x1) / 2, label: new Date(((x0 + x1) / 2 - 40587) * 864e5).toISOString().slice(0, 10) });
  return out;
}
