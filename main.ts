import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];
type Glyph = readonly string[];

const FONT: Record<string, Glyph> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "01100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
};

const COLOR = {
  bg: [10, 14, 28] as RGB,
  panel: [18, 26, 46] as RGB,
  panelAlt: [22, 32, 56] as RGB,
  border: [44, 62, 96] as RGB,
  white: [240, 244, 252] as RGB,
  dim: [150, 166, 196] as RGB,
  faint: [96, 112, 144] as RGB,
  cyan: [86, 214, 226] as RGB,
  amber: [246, 186, 84] as RGB,
  coral: [240, 122, 132] as RGB,
  green: [126, 216, 158] as RGB,
  violet: [178, 150, 240] as RGB,
  ink: [8, 12, 24] as RGB,
};

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  const row = y * (1 + W * 3);
  raw[row] = 0;
  for (let x = 0; x < W; x++) {
    const i = row + 1 + x * 3;
    raw[i] = COLOR.bg[0];
    raw[i + 1] = COLOR.bg[1];
    raw[i + 2] = COLOR.bg[2];
  }
}

function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * (1 + W * 3) + 1 + x * 3;
  raw[i] = c[0];
  raw[i + 1] = c[1];
  raw[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) px(xx, yy, c);
  }
}

function frame(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

function text(str: string, x: number, y: number, scale: number, c: RGB, tracking = 1): number {
  let cursor = x;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch] ?? FONT[" "];
    for (let gy = 0; gy < 7; gy++) {
      const row = g[gy];
      for (let gx = 0; gx < 5; gx++) {
        if (row[gx] === "1") {
          rect(cursor + gx * scale, y + gy * scale, scale, scale, c);
        }
      }
    }
    cursor += (5 + tracking) * scale;
  }
  return cursor - tracking * scale;
}

function textWidth(str: string, scale: number, tracking = 1): number {
  return str.length * (5 + tracking) * scale - tracking * scale;
}

function textCenter(str: string, cx: number, y: number, scale: number, c: RGB, tracking = 1): void {
  text(str, Math.round(cx - textWidth(str, scale, tracking) / 2), y, scale, c, tracking);
}

const STORIES = [
  { tag: "DIPLOMACY", cat: "GLOBAL", body: "LEADERS MEET IN GENEVA FOR CEASEFIRE TALKS", color: COLOR.cyan },
  { tag: "CLIMATE", cat: "EARTH", body: "NEW EMISSIONS PLEDGE SIGNED BY 40 STATES", color: COLOR.green },
  { tag: "MARKETS", cat: "ECONOMY", body: "CENTRAL BANKS HOLD RATES AS INFLATION EASES", color: COLOR.amber },
  { tag: "TECHNOLOGY", cat: "TECH", body: "AI SAFETY FRAMEWORK RELEASED FOR PUBLIC REVIEW", color: COLOR.violet },
  { tag: "HEALTH", cat: "SCIENCE", body: "WHO EXPANDS VACCINATION DRIVE ACROSS REGIONS", color: COLOR.coral },
  { tag: "CULTURE", cat: "ARTS", body: "HERITAGE CITY REOPENS AFTER RESTORATION", color: COLOR.white },
  { tag: "HORMUZ", cat: "ENERGY", body: "HORMUZ TANKER MINE", color: COLOR.coral },
  { tag: "ARIANE6", cat: "SPACE", body: "ARIANE6 LAUNCHES 36 AMAZON SATS", color: COLOR.violet },
  { tag: "FED", cat: "RATES", body: "FED BEIGE BOOK", color: COLOR.amber },
] as const;

const seed = createHash("sha256").update("make.fun|news-image|2026-11-26|world-brief").digest();
const checksum = seed.subarray(0, 6).toString("hex").toUpperCase();

rect(0, 0, W, 10, COLOR.cyan);
rect(0, H - 10, W, 10, COLOR.amber);

rect(48, 24, W - 96, 190, COLOR.panel);
rect(48, 32, 10, 10, COLOR.amber);
text("THE DAILY WORLD BRIEF", 68, 34, 2, COLOR.amber, 2);
text("NO. 20261126", W - 48 - textWidth("NO. 20261126", 2, 1), 34, 2, COLOR.faint, 1);
textCenter("WORLD NEWS", W / 2, 66, 9, COLOR.white, 2);

rect(48, 144, W - 96, 2, COLOR.border);
rect(48, 144, 196, 2, COLOR.cyan);
rect(W - 244, 144, 196, 2, COLOR.amber);
rect(506, 139, 12, 12, COLOR.panel);
rect(508, 141, 8, 8, COLOR.white);

textCenter("THURSDAY 26 NOVEMBER 2026", W / 2, 162, 3, COLOR.cyan, 2);
text("GLOBAL BRIEF / 09 STORIES", 48, 194, 2, COLOR.dim, 2);
text("#" + checksum, W - 48 - textWidth("#" + checksum, 2, 1), 194, 2, COLOR.faint, 1);
rect(48, 224, W - 96, 2, COLOR.border);

const cardW = 298;
const cardH = 208;
const gapX = 17;
const gapY = 20;
const startX = 48;
const startY = 248;
const bodyScale = 3;
const bodyTracking = 1;

for (let i = 0; i < STORIES.length; i++) {
  const s = STORIES[i];
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = startX + col * (cardW + gapX);
  const y = startY + row * (cardH + gapY);

  rect(x, y, cardW, cardH, COLOR.panelAlt);
  frame(x, y, cardW, cardH, COLOR.border);
  rect(x, y, 6, cardH, s.color);

  text(String(i + 1).padStart(2, "0"), x + 18, y + 14, 4, s.color, 1);
  text(s.tag, x + 68, y + 18, 2, s.color, 2);
  text(s.cat, x + cardW - 16 - textWidth(s.cat, 2, 1), y + 18, 2, COLOR.faint, 1);

  rect(x + 18, y + 52, 64, 2, s.color);
  rect(x + 82, y + 52, cardW - 100, 2, COLOR.border);

  const words = s.body.split(" ");
  const lines: string[] = [];
  let line = "";
  const maxWidth = cardW - 40;
  for (const w of words) {
    const trial = line ? line + " " + w : w;
    if (textWidth(trial, bodyScale, bodyTracking) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);

  for (let li = 0; li < lines.length; li++) {
    text(lines[li], x + 20, y + 68 + li * 26, bodyScale, COLOR.white, bodyTracking);
  }

  rect(x + 18, y + cardH - 30, cardW - 36, 2, COLOR.border);
  text("MAKE.FUN", x + 20, y + cardH - 20, 2, COLOR.faint, 1);
  text("2026-11-26", x + cardW - 16 - textWidth("2026-11-26", 2, 1), y + cardH - 20, 2, COLOR.faint, 1);
}

const tickerY = 930;
rect(48, tickerY, W - 96, 2, COLOR.border);
rect(48, tickerY, 148, 2, COLOR.amber);
text("LIVE WIRE / 09 STORIES", 48, tickerY + 14, 2, COLOR.dim, 1);
text("DETERMINISTIC EDITION", W - 48 - textWidth("DETERMINISTIC EDITION", 2, 1), tickerY + 14, 2, COLOR.dim, 1);
text("WORLD NEWS / 26 NOV 2026", 48, tickerY + 42, 2, COLOR.faint, 1);
text("SHA256:" + checksum, W - 48 - textWidth("SHA256:" + checksum, 2, 1), tickerY + 42, 2, COLOR.faint, 1);
rect(48, tickerY + 64, W - 96, 1, COLOR.border);

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// PNG chunks protect their type and data with a CRC32 trailer.
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");
mkdirSync(outputDir, { recursive: true });
const outPath = resolve(outputDir, "entry.png");
writeFileSync(outPath, png);
process.stdout.write(`Wrote ${outPath} (${png.length} bytes)\n`);
