/**
 * Erzeugt die App-Icons als PNG - ohne externe Abhängigkeiten.
 * Aufruf: node tools/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

const SIZES = [
  { size: 192, file: 'assets/icon-192.png' },
  { size: 512, file: 'assets/icon-512.png' },
  { size: 180, file: 'assets/icon-180.png' },
];

class Bitmap {
  constructor(size) {
    this.size = size;
    this.data = new Uint8Array(size * size * 4);
  }

  set(x, y, [r, g, b], alpha = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const i = (y * this.size + x) * 4;
    const d = this.data;
    d[i] = d[i] * (1 - alpha) + r * alpha;
    d[i + 1] = d[i + 1] * (1 - alpha) + g * alpha;
    d[i + 2] = d[i + 2] * (1 - alpha) + b * alpha;
    d[i + 3] = 255;
  }

  fill(color) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) this.set(x, y, color);
    }
  }

  rect(x0, y0, w, h, color, alpha = 1) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) this.set(x, y, color, alpha);
    }
  }

  circle(cx, cy, r, color, alpha = 1) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) this.set(x, y, color, alpha * Math.min(1, r - d + 1));
      }
    }
  }

  /** Scanline-Füllung für beliebige Polygone. */
  polygon(points, color, alpha = 1) {
    const ys = points.map((p) => p[1]);
    const yMin = Math.max(0, Math.floor(Math.min(...ys)));
    const yMax = Math.min(this.size - 1, Math.ceil(Math.max(...ys)));
    for (let y = yMin; y <= yMax; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) this.set(x, y, color, alpha);
      }
    }
  }

  toPNG() {
    const s = this.size;
    const raw = Buffer.alloc((s * 4 + 1) * s);
    for (let y = 0; y < s; y++) {
      raw[y * (s * 4 + 1)] = 0;                       // Filter "none"
      Buffer.from(this.data.buffer, y * s * 4, s * 4).copy(raw, y * (s * 4 + 1) + 1);
    }
    const chunk = (type, body) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length);
      const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(typed) >>> 0);
      return Buffer.concat([len, typed, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(s, 0);
    ihdr.writeUInt32BE(s, 4);
    ihdr[8] = 8;    // bit depth
    ihdr[9] = 6;    // RGBA
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

/** Ein Blatt aus sieben Fingern, mittig auf der Fläche. */
function leaf(bmp, cx, cy, scale, color, alpha = 1) {
  const fingers = [
    { angle: 0, len: 1.0, width: 0.20 },
    { angle: 0.55, len: 0.88, width: 0.18 },
    { angle: -0.55, len: 0.88, width: 0.18 },
    { angle: 1.15, len: 0.66, width: 0.15 },
    { angle: -1.15, len: 0.66, width: 0.15 },
    { angle: 1.75, len: 0.44, width: 0.12 },
    { angle: -1.75, len: 0.44, width: 0.12 },
  ];
  for (const f of fingers) {
    const len = f.len * scale;
    const w = f.width * scale;
    const dx = Math.sin(f.angle);
    const dy = -Math.cos(f.angle);
    const px = -dy;
    const py = dx;
    const tipX = cx + dx * len;
    const tipY = cy + dy * len;
    const pts = [
      [tipX, tipY],
      [cx + dx * len * 0.55 + px * w, cy + dy * len * 0.55 + py * w],
      [cx + dx * len * 0.22 + px * w * 0.5, cy + dy * len * 0.22 + py * w * 0.5],
      [cx, cy + scale * 0.06],
      [cx + dx * len * 0.22 - px * w * 0.5, cy + dy * len * 0.22 - py * w * 0.5],
      [cx + dx * len * 0.55 - px * w, cy + dy * len * 0.55 - py * w],
    ];
    bmp.polygon(pts, color, alpha);
  }
  // Stiel
  bmp.polygon([
    [cx - scale * 0.035, cy],
    [cx + scale * 0.035, cy],
    [cx + scale * 0.02, cy + scale * 0.42],
    [cx - scale * 0.02, cy + scale * 0.42],
  ], color, alpha);
}

function render(size) {
  const bmp = new Bitmap(size);
  const u = size / 512;
  bmp.fill([18, 17, 26]);

  // Betonstruktur
  for (let i = 0; i < size * size * 0.05; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    bmp.set(x, y, [255, 255, 255], 0.03);
  }
  // Backsteinfugen
  for (let y = 0; y < size; y += 46 * u) {
    bmp.rect(0, Math.round(y), size, Math.max(1, Math.round(2 * u)), [0, 0, 0], 0.35);
  }

  // Spraydosen-Schwung im Hintergrund
  for (let t = 0; t <= 1; t += 0.002) {
    const x = size * (0.06 + t * 0.88);
    const y = size * (0.84 - Math.sin(t * Math.PI) * 0.07);
    bmp.circle(x, y, 13 * u, [255, 46, 154], 0.06);
  }

  // Blatt: erst schwarzer Rand, dann Neon
  leaf(bmp, size * 0.5, size * 0.42, size * 0.34, [0, 0, 0], 1);
  leaf(bmp, size * 0.5, size * 0.42, size * 0.30, [124, 255, 63], 1);
  leaf(bmp, size * 0.5, size * 0.415, size * 0.22, [190, 255, 150], 0.35);

  // Farbnasen, die vom Blatt runterlaufen
  for (const [dx, top, len] of [[-0.26, 0.47, 0.13], [-0.06, 0.56, 0.16], [0.13, 0.5, 0.1], [0.28, 0.44, 0.09]]) {
    bmp.rect(
      Math.round(size * (0.5 + dx)), Math.round(size * top),
      Math.max(2, Math.round(6 * u)), Math.round(size * len),
      [124, 255, 63], 0.8,
    );
    bmp.circle(size * (0.5 + dx) + 3 * u, size * (top + len), 4 * u, [124, 255, 63], 0.8);
  }

  // Rahmen wie ein getaggtes Schild
  const b = Math.max(2, Math.round(10 * u));
  bmp.rect(0, 0, size, b, [255, 46, 154], 0.9);
  bmp.rect(0, size - b, size, b, [255, 46, 154], 0.9);
  bmp.rect(0, 0, b, size, [255, 46, 154], 0.9);
  bmp.rect(size - b, 0, b, size, [255, 46, 154], 0.9);

  return bmp;
}

for (const { size, file } of SIZES) {
  writeFileSync(file, render(size).toPNG());
  console.log('geschrieben:', file, `(${size}x${size})`);
}
