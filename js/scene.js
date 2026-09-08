/**
 * Canvas-Szene im Graffiti-Look: Backsteinwand mit Tags, Bürgersteig,
 * Radweg und Straße. Zeichnet Dealer, Kundschaft und Effekte.
 */
import { CUSTOMER_TYPES } from './config.js';

const TAGS = ['DDS', 'OG', '420', 'BLOCK', 'HAZE', 'REAL ONES', 'KUSH', 'CITY', 'FRESH', 'PLUG'];
const NEON = ['#7cff3f', '#ff2e9a', '#00e5ff', '#ffe600', '#b96bff', '#ff6b35'];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Scene {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.time = 0;
    this.floaters = [];
    this.particles = [];
    this.dealerPunch = 0;
    this.shake = 0;
    this.flash = 0;
    this.bg = null;

    game.on('spawn', (c) => this.placeCustomer(c));
    game.on('sold', ({ customer, revenue, partial }) => this.onSold(customer, revenue, partial));
    game.on('missed', (c) => this.floatText(c.x, this.laneY(c.lane) - 92 * this.s, 'weg!', '#ff5c5c'));
    game.on('raid', () => { this.shake = 1; this.flash = 1; });

    this.resize();
  }

  // --- Geometrie ----------------------------------------------------------
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = Math.max(280, rect.width);
    this.h = Math.max(240, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.bg = this.buildBackground();
    for (const c of this.game.customers) this.placeCustomer(c, true);
  }

  laneY(lane) {
    // 0 = Straße (Auto), 1 = Radweg, 2 = Bürgersteig
    const base = [0.93, 0.72, 0.52];
    return this.h * base[lane];
  }

  /** Figuren wachsen mit dem Display mit, damit sie auf großen Handys nicht verloren wirken. */
  get s() {
    return Math.max(0.9, Math.min(1.8, Math.min(this.w / 360, this.h / 620)));
  }

  get dealerX() { return this.w * 0.5; }
  get dealerY() { return this.h * 0.53; }

  stopX(c) {
    return this.dealerX + (c.stopOffset || 0);
  }

  placeCustomer(c, keep = false) {
    if (!keep) {
      // Von links kommend links vom Dealer halten und umgekehrt - so steht
      // niemand im Dealer drin.
      const gap = rnd(0.11, 0.40) * this.w + 48 * this.s;
      const margin = 66 * this.s;
      const raw = this.dealerX + (c.dir > 0 ? -gap : gap);
      const clamped = Math.max(margin, Math.min(this.w - margin, raw));
      c.stopOffset = clamped - this.dealerX;
      c.x = c.dir > 0 ? -80 : this.w + 80;
    }
    c.y = this.laneY(c.lane);
  }

  // --- Hintergrund (einmal pro Resize gerendert) --------------------------
  buildBackground() {
    const cv = document.createElement('canvas');
    cv.width = Math.round(this.w * this.dpr);
    cv.height = Math.round(this.h * this.dpr);
    const g = cv.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const W = this.w;
    const H = this.h;
    const wallH = H * 0.40;

    // Nachthimmel über der Wand
    const sky = g.createLinearGradient(0, 0, 0, wallH);
    sky.addColorStop(0, '#191426');
    sky.addColorStop(1, '#241b33');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, wallH);

    // Backsteine
    const bh = 18;
    const bw = 44;
    for (let y = 0, row = 0; y < wallH; y += bh, row++) {
      for (let x = (row % 2 ? -bw / 2 : 0); x < W; x += bw) {
        const shade = rnd(-8, 8);
        g.fillStyle = `rgb(${44 + shade},${38 + shade},${52 + shade})`;
        g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    }
    // Verwaschene Flecken
    for (let i = 0; i < 26; i++) {
      const r = rnd(20, 90);
      const grd = g.createRadialGradient(rnd(0, W), rnd(0, wallH), 0, rnd(0, W), rnd(0, wallH), r);
      grd.addColorStop(0, 'rgba(0,0,0,0.18)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, wallH);
    }

    // Graffiti-Tags auf die Wand sprühen
    const count = Math.max(4, Math.round((W * wallH) / 30000));
    const placed = [];
    for (let i = 0; i < count; i++) {
      const text = pick(TAGS);
      let scale = rnd(0.85, 1.5);
      const measure = (sc) => {
        g.font = `700 ${Math.round(26 * sc)}px "Permanent Marker", Impact, "Arial Black", sans-serif`;
        return g.measureText(text).width;
      };
      // Zu breite Tags schrumpfen, damit nichts über den Rand läuft.
      let tw = measure(scale);
      const maxW = W * 0.72;
      if (tw > maxW) { scale *= maxW / tw; tw = measure(scale); }
      const halfW = tw / 2 + 8;
      const halfH = 30 * scale;

      // Ein paar Plätze durchprobieren, bis einer frei ist.
      for (let attempt = 0; attempt < 16; attempt++) {
        const x = rnd(halfW + 6, W - halfW - 6);
        const y = rnd(halfH + 10, wallH - halfH - 10);
        const box = { x0: x - halfW, x1: x + halfW, y0: y - halfH, y1: y + halfH };
        const clash = placed.some((b) => box.x0 < b.x1 + 14 && box.x1 > b.x0 - 14
          && box.y0 < b.y1 + 14 && box.y1 > b.y0 - 14);
        if (clash && attempt < 15) continue;
        if (clash) break;
        placed.push(box);
        this.sprayTag(g, x, y, text, pick(NEON), scale);
        break;
      }
    }

    // Bürgersteig
    const walkTop = wallH;
    const walkBot = H * 0.66;
    g.fillStyle = '#3a3646';
    g.fillRect(0, walkTop, W, walkBot - walkTop);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 2;
    for (let x = 0; x < W; x += 56) {
      g.beginPath();
      g.moveTo(x, walkTop);
      g.lineTo(x, walkBot);
      g.stroke();
    }
    g.fillStyle = '#4a4558';
    g.fillRect(0, walkTop - 4, W, 5);

    // Radweg
    g.fillStyle = '#2f3b34';
    g.fillRect(0, walkBot, W, H * 0.79 - walkBot);
    g.strokeStyle = 'rgba(124,255,63,0.25)';
    g.setLineDash([16, 14]);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, (walkBot + H * 0.79) / 2);
    g.lineTo(W, (walkBot + H * 0.79) / 2);
    g.stroke();
    g.setLineDash([]);

    // Straße
    g.fillStyle = '#22212b';
    g.fillRect(0, H * 0.79, W, H - H * 0.79);
    g.strokeStyle = 'rgba(255,230,0,0.55)';
    g.setLineDash([26, 20]);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, H * 0.955);
    g.lineTo(W, H * 0.955);
    g.stroke();
    g.setLineDash([]);

    // Gullideckel + Müll für Straßenfeeling
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(W * 0.18, H * 0.87, 16, 6, 0, 0, Math.PI * 2);
    g.fill();

    return cv;
  }

  /** Ein Tag mit Outline, Spray-Körnung und Nasen. */
  sprayTag(g, x, y, text, color, scale) {
    g.save();
    g.translate(x, y);
    g.rotate(rnd(-0.16, 0.16));
    g.scale(scale, scale);
    g.font = '700 26px "Permanent Marker", Impact, "Arial Black", sans-serif';
    g.textBaseline = 'middle';
    g.globalAlpha = 0.85;

    g.lineJoin = 'round';
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.strokeText(text, 0, 0);
    g.fillStyle = color;
    g.fillText(text, 0, 0);
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.strokeText(text, 0, 0);

    // Farbnasen
    const width = g.measureText(text).width;
    g.globalAlpha = 0.5;
    g.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const dx = rnd(0, width);
      g.fillRect(dx, 6, 2, rnd(6, 20));
    }
    // Sprühnebel
    g.globalAlpha = 0.12;
    for (let i = 0; i < 60; i++) {
      g.fillRect(rnd(-12, width + 12), rnd(-20, 20), 1.5, 1.5);
    }
    g.restore();
  }

  // --- Effekte ------------------------------------------------------------
  floatText(x, y, text, color, size = 20) {
    this.floaters.push({ x, y, text, color, size, life: 1.2, vy: -42 });
  }

  burst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = rnd(0, Math.PI * 2);
      const sp = rnd(60, 190);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: rnd(0.4, 0.9), color, size: rnd(2, 5),
      });
    }
  }

  onSold(customer, revenue, partial) {
    const y = this.laneY(customer.lane) - 92 * this.s;
    this.floatText(customer.x, y, `+${formatShort(revenue)} €`, partial ? '#ffe600' : '#7cff3f', 22);
    this.burst(customer.x, y + 10, partial ? '#ffe600' : '#7cff3f');
    this.dealerPunch = 1;
  }

  // --- Interaktion --------------------------------------------------------
  /** Findet den Kunden unter dem Finger. */
  hit(px, py) {
    let best = null;
    let bestDist = 46 * this.s;
    for (const c of this.game.customers) {
      if (c.done) continue;
      const w = (c.type === 'car' ? 52 : 32) * this.s;
      const dx = Math.abs(px - c.x);
      const dy = Math.abs(py - (c.y - 28 * this.s));
      if (dx < w && dy < 58 * this.s) {
        const d = dx + dy;
        if (d < bestDist || !best) { best = c; bestDist = d; }
      }
    }
    return best;
  }

  // --- Update + Zeichnen --------------------------------------------------
  update(dt) {
    this.time += dt;
    this.dealerPunch = Math.max(0, this.dealerPunch - dt * 3);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 1.6);

    for (const c of this.game.customers) {
      if (c.phase === 'arriving') {
        const target = this.stopX(c);
        c.x += c.speed * c.dir * dt;
        if ((c.dir > 0 && c.x >= target) || (c.dir < 0 && c.x <= target)) {
          c.x = target;
          c.phase = 'waiting';
        }
      } else if (c.phase === 'leaving') {
        c.x += c.speed * 1.35 * c.dir * dt;
        if (c.x < -140 || c.x > this.w + 140) c.remove = true;
      } else {
        c.bounce = Math.sin(this.time * 6 + c.id) * 2;
      }
    }

    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy += 30 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw() {
    const g = this.ctx;
    g.save();
    if (this.shake > 0) {
      g.translate(rnd(-6, 6) * this.shake, rnd(-4, 4) * this.shake);
    }
    if (this.bg) {
      g.drawImage(this.bg, 0, 0, this.w, this.h);
    }

    this.drawDealer(g);

    const sorted = [...this.game.customers].sort((a, b) => a.lane - b.lane);
    for (const c of sorted) this.drawCustomer(g, c);

    for (const p of this.particles) {
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = p.color;
      g.fillRect(p.x, p.y, p.size, p.size);
    }
    g.globalAlpha = 1;

    for (const f of this.floaters) {
      g.save();
      g.globalAlpha = Math.min(1, f.life);
      g.font = `700 ${f.size}px "Permanent Marker", Impact, "Arial Black", sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 5;
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.strokeText(f.text, f.x, f.y);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
      g.restore();
    }

    if (this.flash > 0) {
      g.fillStyle = `rgba(0,120,255,${this.flash * 0.35})`;
      g.fillRect(0, 0, this.w, this.h);
    }
    g.restore();
  }

  /** Der Spieler: Hoodie-Typ mit Bauchtasche, lehnt an der Wand. */
  drawDealer(g) {
    const x = this.dealerX;
    const y = this.dealerY;
    const bob = Math.sin(this.time * 2) * 2;
    const punch = this.dealerPunch;

    g.save();
    g.translate(x, y + bob);
    g.scale(this.s, this.s);

    // Schatten
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.ellipse(0, 4, 22, 6, 0, 0, Math.PI * 2);
    g.fill();

    // Beine
    g.fillStyle = '#2c2f3d';
    g.fillRect(-11, -26, 9, 27);
    g.fillRect(3, -26, 9, 27);
    g.fillStyle = '#f2f2f2';
    g.fillRect(-13, -3, 12, 5);
    g.fillRect(2, -3, 12, 5);

    // Hoodie
    g.fillStyle = '#7cff3f';
    roundRect(g, -18, -60, 36, 36, 8);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(g, -10, -40, 20, 10, 4);
    g.fill();

    // Arm reicht nach vorne, wenn gerade gedealt wurde
    g.strokeStyle = '#7cff3f';
    g.lineWidth = 8;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(14, -52);
    g.lineTo(20 + punch * 12, -44 + punch * 6);
    g.stroke();

    // Kopf mit Kapuze
    g.fillStyle = '#6ae02f';
    g.beginPath();
    g.arc(0, -70, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1a22';
    g.beginPath();
    g.arc(0, -68, 10, 0, Math.PI * 2);
    g.fill();
    // Augen
    g.fillStyle = '#ffe600';
    g.fillRect(-6, -71, 4, 3);
    g.fillRect(2, -71, 4, 3);

    g.restore();
  }

  drawCustomer(g, c) {
    const type = CUSTOMER_TYPES[c.type];
    g.save();
    g.translate(c.x, c.y);
    g.scale(c.dir < 0 ? -this.s : this.s, this.s);

    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(0, 2, c.type === 'car' ? 34 : 16, 5, 0, 0, Math.PI * 2);
    g.fill();

    if (c.type === 'car') this.drawCar(g, c);
    else if (c.type === 'bike') this.drawBike(g, c);
    else this.drawPed(g, c);

    g.restore();

    if (c.phase === 'waiting' && !c.done) this.drawBubble(g, c);
  }

  drawPed(g, c) {
    const step = c.phase === 'waiting' ? 0 : Math.sin(c.anim * 9) * 6;
    const bounce = c.phase === 'waiting' ? c.bounce || 0 : 0;
    g.translate(0, bounce);
    g.strokeStyle = '#2b2f3f';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, -22); g.lineTo(step * 0.5, -2);
    g.moveTo(0, -22); g.lineTo(-step * 0.5, -2);
    g.stroke();

    g.fillStyle = c.color || (c.color = pick(['#ff2e9a', '#00e5ff', '#ffe600', '#b96bff', '#ff6b35']));
    roundRect(g, -10, -46, 20, 26, 6);
    g.fill();

    g.strokeStyle = g.fillStyle;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(8, -40); g.lineTo(14, -28 + step * 0.3);
    g.stroke();

    g.fillStyle = '#e8c39a';
    g.beginPath();
    g.arc(0, -54, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1a22';
    g.fillRect(-9, -62, 18, 6);          // Cap
    g.fillRect(-11, -58, 8, 3);
  }

  drawBike(g, c) {
    const spin = c.anim * 8;
    g.strokeStyle = '#cfd6e4';
    g.lineWidth = 3;
    for (const wx of [-14, 14]) {
      g.beginPath();
      g.arc(wx, -10, 11, 0, Math.PI * 2);
      g.stroke();
      g.save();
      g.translate(wx, -10);
      g.rotate(spin);
      g.beginPath();
      g.moveTo(-11, 0); g.lineTo(11, 0);
      g.moveTo(0, -11); g.lineTo(0, 11);
      g.stroke();
      g.restore();
    }
    g.strokeStyle = '#00e5ff';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-14, -10); g.lineTo(0, -10); g.lineTo(6, -24); g.lineTo(14, -10);
    g.moveTo(0, -10); g.lineTo(6, -24);
    g.stroke();

    // Fahrer
    g.fillStyle = c.color || (c.color = pick(['#ff2e9a', '#ffe600', '#b96bff']));
    roundRect(g, -4, -46, 17, 22, 6);
    g.fill();
    g.strokeStyle = g.fillStyle;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(4, -28); g.lineTo(-2, -14);
    g.moveTo(10, -40); g.lineTo(16, -26);
    g.stroke();
    g.fillStyle = '#e8c39a';
    g.beginPath();
    g.arc(6, -54, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ff2e9a';
    g.beginPath();
    g.arc(6, -56, 10, Math.PI, 0);
    g.fill();
  }

  drawCar(g, c) {
    const color = c.color || (c.color = pick(['#ff2e9a', '#00e5ff', '#ffe600', '#ff3b3b', '#b96bff']));
    const wob = c.phase === 'waiting' ? Math.sin(c.anim * 10) * 1.2 : 0;
    g.translate(0, wob);

    g.fillStyle = color;
    roundRect(g, -34, -30, 68, 22, 6);
    g.fill();
    roundRect(g, -20, -44, 38, 18, 7);
    g.fill();

    g.fillStyle = 'rgba(15,20,35,0.9)';
    roundRect(g, -16, -41, 15, 12, 3);
    g.fill();
    roundRect(g, 2, -41, 14, 12, 3);
    g.fill();

    // Felgen
    g.fillStyle = '#15161d';
    for (const wx of [-20, 20]) {
      g.beginPath();
      g.arc(wx, -8, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#8a90a6';
      g.beginPath();
      g.arc(wx, -8, 3.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#15161d';
    }

    // Scheinwerfer
    g.fillStyle = '#fff6b0';
    g.fillRect(32, -24, 5, 6);
    g.fillStyle = 'rgba(255,246,176,0.15)';
    g.beginPath();
    g.moveTo(37, -21); g.lineTo(85, -34); g.lineTo(85, -6); g.closePath();
    g.fill();

    // Unterbodenneon
    g.fillStyle = 'rgba(124,255,63,0.35)';
    g.fillRect(-30, -7, 60, 4);
  }

  /** Sprechblase mit Wunschsorte und Menge + Geduldsbalken. */
  drawBubble(g, c) {
    const strain = this.game.unlockedStrains().find((s) => s.id === c.strainId)
      || { emoji: '🌿', color: '#7cff3f' };
    const have = (this.game.state.stock[c.strainId] || 0) >= c.grams;
    const sc = this.s;
    const x = c.x;   // wird unten am Rand noch begrenzt
    const y = c.y - (c.type === 'car' ? 56 : 70) * sc;
    const text = `${strain.emoji} ${c.grams}g`;

    g.save();
    g.font = `700 ${Math.round(15 * sc)}px "Permanent Marker", Impact, "Arial Black", sans-serif`;
    const w = Math.max(64 * sc, g.measureText(text).width + 22 * sc);
    const h = 30 * sc;

    const bx = Math.max(w / 2 + 4, Math.min(this.w - w / 2 - 4, x));
    g.fillStyle = 'rgba(12,12,18,0.92)';
    g.strokeStyle = have ? strain.color : '#ff5c5c';
    g.lineWidth = 3;
    roundRect(g, bx - w / 2, y - h, w, h, 9);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(x - 6 * sc, y);
    g.lineTo(x + 6 * sc, y);
    g.lineTo(x, y + 9 * sc);
    g.closePath();
    g.fillStyle = 'rgba(12,12,18,0.92)';
    g.fill();
    g.stroke();

    g.fillStyle = have ? '#ffffff' : '#ff9c9c';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, bx, y - h / 2 + 1);

    // Geduld
    const p = Math.max(0, c.patience / c.maxPatience);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(bx - w / 2 + 4, y - 4 * sc, w - 8, 3 * sc);
    g.fillStyle = p > 0.5 ? '#7cff3f' : p > 0.25 ? '#ffe600' : '#ff3b3b';
    g.fillRect(bx - w / 2 + 4, y - 4 * sc, (w - 8) * p, 3 * sc);
    g.restore();
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Deutsche Kurzschreibweise: 7,70 · 1.250 · 3,4 Mio */
export function formatShort(n) {
  n = Number(n) || 0;
  if (n < 1000) {
    const dec = Number.isInteger(n) ? 0 : n < 10 ? 2 : n < 100 ? 1 : 0;
    return n.toFixed(dec).replace('.', ',');
  }
  if (n < 100000) return Math.round(n).toLocaleString('de-DE');
  const units = ['k', 'Mio', 'Mrd', 'Bio', 'Brd', 'Trd'];
  let u = -1;
  let v = n;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  const text = v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace('.', ',');
  return `${text.includes(',') ? text.replace(/,?0+$/, '') : text} ${units[u]}`;
}
