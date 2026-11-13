/**
 * Generates the SVG artwork used by the profile README (../assets).
 *
 * Every piece of text is converted to vector outlines. GitHub serves repository
 * SVGs with a strict Content-Security-Policy, and some browsers then refuse
 * fonts embedded in the file, so outlined text is the only way to get the same
 * typography everywhere, including the GitHub mobile app.
 *
 * To change wording or numbers, edit the CONTENT section and run:
 *
 *     cd design
 *     npm ci
 *     npm run build
 *
 * then commit the regenerated files in ../assets. An optional argument sets a
 * different output directory: `node build.mjs ../some/dir`.
 *
 * Fonts: Geist and Geist Mono by Vercel (SIL Open Font License 1.1), installed
 * from npm via @fontsource. Only glyph outlines end up in the artwork.
 */

import * as fontkit from 'fontkit';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? join(here, '..', 'assets'));

/* ─────────────────────────────── CONTENT ─────────────────────────────── */

const PROFILE = {
  name: 'Mohammed Abdulrahman Alomari',
  role: 'Flutter Developer',
  tagline: 'Production-ready mobile apps for iOS and Android.',
  reachLabel: 'Products & teams across',
  reach: ['Saudi Arabia', 'Turkey', 'Germany', 'Syria'],
};

// Clean Architecture layers drawn in the banner, innermost first.
const LAYERS = ['Entities', 'Use cases', 'Adapters', 'Frameworks'];

// Each project gets two cards: a tall tile for phones and tablets, and a wide
// card for desktop. Summaries wrap automatically (3 lines max). In fact labels,
// \n is the line break used on the tile; the wide card re-wraps labels itself.
const PROJECTS = [
  {
    file: 'ashafaq',
    name: 'ASHAFAQ',
    sector: 'Car wash platform',
    region: 'Saudi Arabia',
    summary:
      'Developed all three Flutter apps from scratch — customer, worker and branch management — and keep maintaining, updating and improving them in production.',
    facts: [
      ['15,000+', 'Active users'],
      ['14,000+', 'Completed\noperations'],
      ['11', 'Branches\nin Riyadh'],
    ],
  },
  {
    file: 'fasih',
    name: 'FASIH',
    sector: 'Education platform',
    region: 'Turkey',
    summary:
      'Migrated the native app to Flutter on Clean Architecture with BLoC/Cubit, GetIt, GoRouter and REST APIs, plus Firebase and Crashlytics.',
    facts: [
      ['~25,000', 'Users'],
      ['1,100+', 'Unit + widget\ntests'],
      ['Zoom', 'Meeting SDK for\nonline classes'],
    ],
  },
  {
    file: 'shamfix',
    name: 'ShamFix',
    sector: 'Home & building maintenance',
    region: null,
    summary:
      'Built the customer and technician Flutter apps, implemented and tested AI fault diagnosis, and coordinated with the backend developer on the API.',
    facts: [
      ['Founder', 'Idea originator\n& tech lead'],
      ['8', 'Request statuses\n& approvals'],
      ['Stripe', '+ cash, wallets\n& commissions'],
    ],
  },
  {
    file: 'orangi',
    name: 'ORANGI',
    sector: 'Education app',
    region: 'FASIH organization',
    summary:
      'Developed the Flutter app for a separate education platform: student accounts, learning management, subscriptions and an in-app wallet.',
    facts: [
      ['~25,000', 'Users'],
      ['Live', 'Online lessons\n& recordings'],
      ['Private', 'Lesson\nbooking'],
    ],
  },
  {
    file: 'wassi',
    name: 'Wassi',
    sector: 'Food delivery',
    region: 'Syria',
    summary:
      'Developed the Flutter app collaboratively with a distributed team, on Clean Architecture with BLoC, GoRouter, GetIt and Cloud Firestore.',
    facts: [
      ['Syria', 'Target market'],
      ['Remote', 'Team based\nin Germany'],
      ['2025–26', 'Aug 2025 –\nFeb 2026'],
    ],
  },
];

// Pill buttons. `small` ones sit under project cards as store links.
const LINKS = [
  { file: 'linkedin', label: 'LinkedIn' },
  { file: 'email', label: 'Email' },
  { file: 'google-play', label: 'Google Play', small: true },
  { file: 'app-store', label: 'App Store', small: true },
];

/* ──────────────────────────────── TOKENS ──────────────────────────────── */

const C = {
  bgFrom: '#0A0F14',
  bgTo: '#0E171E',
  border: '#1C2832',
  dots: '#1E2B35',
  text: '#EEF3F6',
  textSoft: '#A3B1BC',
  textMuted: '#6B7C88',
  accent: '#2DD4BF',
  accentSoft: '#5EEAD4',
};

const fontFile = (family, weight) =>
  join(here, 'node_modules', '@fontsource', family, 'files', `${family}-latin-${weight}-normal.woff2`);
const SANS = Object.fromEntries([400, 500, 600].map((w) => [w, fontkit.openSync(fontFile('geist-sans', w))]));
const MONO = Object.fromEntries([400, 500].map((w) => [w, fontkit.openSync(fontFile('geist-mono', w))]));

/* ───────────────────────────── TYPE ENGINE ───────────────────────────── */

/** Shapes a string (kerning included) and returns glyph positions in px. */
function layout(str, { font, size, tracking = 0 }) {
  const run = font.layout(str);
  const k = size / font.unitsPerEm;
  let pen = 0;
  const glyphs = run.glyphs.map((glyph, i) => {
    const p = run.positions[i];
    const g = { glyph, x: pen + p.xOffset * k, y: p.yOffset * k };
    pen += p.xAdvance * k + tracking;
    return g;
  });
  return { glyphs, k, width: glyphs.length ? pen - tracking : 0 };
}

const measure = (str, style) => layout(str, style).width;

/** Formats a value given in tenths of a px as the shortest decimal string. */
function num(tenths) {
  const a = Math.abs(tenths);
  const whole = Math.floor(a / 10);
  const frac = a % 10;
  const s = frac ? `${whole || ''}.${frac}` : String(whole);
  return tenths < 0 ? `-${s}` : s;
}

/**
 * Serialises glyph outlines as compact path data: relative commands,
 * coordinates rounded to 0.1px, and no separators where SVG doesn't need them.
 */
function pathData(paths) {
  let d = '';
  let last = '';
  let px = 0;
  let py = 0;
  let sx = 0;
  let sy = 0;
  const put = (cmd, values) => {
    const repeat = cmd === last && 'lhvqc'.includes(cmd);
    let s = repeat ? '' : cmd;
    values.forEach((v, i) => {
      const n = num(v);
      if ((i > 0 || repeat) && !n.startsWith('-')) s += ' ';
      s += n;
    });
    d += s;
    last = cmd;
  };
  for (const path of paths) {
    for (const { command, args } of path.commands) {
      const a = args.map((v) => Math.round(v * 10));
      const [x, y] = a.slice(-2);
      switch (command) {
        case 'moveTo':
          if (d) put('m', [x - px, y - py]);
          else put('M', [x, y]);
          sx = x;
          sy = y;
          break;
        case 'lineTo':
          if (x === px && y === py) continue;
          if (y === py) put('h', [x - px]);
          else if (x === px) put('v', [y - py]);
          else put('l', [x - px, y - py]);
          break;
        case 'quadraticCurveTo':
          put('q', [a[0] - px, a[1] - py, x - px, y - py]);
          break;
        case 'bezierCurveTo':
          put('c', [a[0] - px, a[1] - py, a[2] - px, a[3] - py, x - px, y - py]);
          break;
        case 'closePath':
          put('z', []);
          px = sx;
          py = sy;
          continue;
        default:
          throw new Error(`Unknown path command ${command}`);
      }
      px = x;
      py = y;
    }
  }
  return d;
}

/** Renders one line of text as a single outlined <path>. */
function text(str, style, x, y, { anchor = 'start', attrs = '' } = {}) {
  const { glyphs, k, width } = layout(str, style);
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const outlines = glyphs
    .filter(({ glyph }) => glyph.path.commands.length)
    .map(({ glyph, x: gx, y: gy }) => glyph.path.scale(k, -k).translate(left + gx, y - gy));
  const paint = attrs.includes('fill=') ? '' : ` fill="${style.fill}"`;
  return `<path${paint}${attrs} d="${pathData(outlines)}"/>`;
}

/** Greedy word wrap; \n forces a break and a dash never starts a line. */
function wrap(str, style, maxWidth) {
  return str.split('\n').flatMap((paragraph) => {
    const words = paragraph.replace(/ ([–—])/g, ' $1').split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, style) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  });
}

const capMiddle = (style) => (style.font.capHeight / style.font.unitsPerEm) * style.size * 0.5;

/* ────────────────────────────── PRIMITIVES ────────────────────────────── */

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const upper = (s) => s.toUpperCase();

function svg({ width, height, viewBox, title, desc, defs = '', body }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${esc(title)}</title>`,
    `<desc id="desc">${esc(desc)}</desc>`,
    defs ? `<defs>${defs}\n</defs>` : '',
    body,
    '</svg>',
  ]
    .filter(Boolean)
    .join('\n')
    .concat('\n');
}

/** Gradient, glow and clip shared by every card-shaped asset. */
function surfaceDefs({ x, y, w, h, r, glow }) {
  return `
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bgFrom}"/><stop offset="1" stop-color="${C.bgTo}"/></linearGradient>
<linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity=".5"/><stop offset=".3" stop-color="${C.border}"/><stop offset="1" stop-color="${C.border}"/></linearGradient>
<radialGradient id="glow" cx="${glow.cx}" cy="${glow.cy}" r="${glow.r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.accent}" stop-opacity="${glow.opacity}"/><stop offset=".5" stop-color="${C.accent}" stop-opacity="${+(glow.opacity / 3.5).toFixed(3)}"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
<clipPath id="card"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>`;
}

function surface({ x, y, w, h, r }, inner = '') {
  return [
    '<g clip-path="url(#card)">',
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#bg)"/>`,
    inner,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#glow)"/>`,
    '</g>',
    `<rect x="${x + 0.75}" y="${y + 0.75}" width="${w - 1.5}" height="${h - 1.5}" rx="${r - 0.75}" fill="none" stroke="url(#edge)" stroke-width="1.5"/>`,
  ]
    .filter(Boolean)
    .join('\n');
}

const dotGridDefs = (w, h, fadeFrom, fadeTo) => `
<pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.2" fill="${C.dots}"/></pattern>
<linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="${fadeFrom}" stop-color="#fff" stop-opacity="0"/><stop offset="${fadeTo}" stop-color="#fff"/></linearGradient>
<mask id="fadeMask"><rect width="${w}" height="${h}" fill="url(#fade)"/></mask>`;

/** Concentric Clean Architecture layers, optionally labelled. */
function layerDiagram({ cx, cy, radii }, { labels = true, nodes = [] } = {}) {
  const strokeOpacity = [0.9, 0.5, 0.3, 0.22];
  const labelOpacity = [1, 0.75, 0.55, 0.45];
  const style = { font: MONO[500], size: 12, tracking: 2, fill: C.accentSoft };
  const out = [`<circle cx="${cx}" cy="${cy}" r="${radii[0]}" fill="${C.accent}" fill-opacity=".08"/>`];
  radii.forEach((r, i) => {
    const dash = i === radii.length - 1 ? ' stroke-dasharray="2 8"' : '';
    out.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.accent}" stroke-opacity="${strokeOpacity[i]}" stroke-width="1.5"${dash}/>`,
    );
  });
  if (labels) {
    LAYERS.forEach((label, i) => {
      const y = (i === 0 ? cy : cy - (radii[i - 1] + radii[i]) / 2) + capMiddle(style);
      out.push(
        text(upper(label), style, cx, y, {
          anchor: 'middle',
          attrs: ` fill="${C.accentSoft}" fill-opacity="${labelOpacity[i]}"`,
        }),
      );
    });
  }
  for (const [ring, deg] of nodes) {
    const a = (deg * Math.PI) / 180;
    const x = +(cx + radii[ring] * Math.cos(a)).toFixed(1);
    const y = +(cy + radii[ring] * Math.sin(a)).toFixed(1);
    out.push(
      `<circle cx="${x}" cy="${y}" r="11" fill="${C.accent}" fill-opacity=".14"/><circle cx="${x}" cy="${y}" r="4" fill="${C.accent}"/>`,
    );
  }
  return out.join('\n');
}

/* ────────────────────────────── COMPONENTS ────────────────────────────── */

const bannerTitle = `${PROFILE.name} — ${PROFILE.role}`;
const bannerDesc = `${PROFILE.tagline} ${PROFILE.reachLabel} ${PROFILE.reach.join(', ')}.`;

/** Full-width hero for desktop and tablets. */
function banner() {
  const W = 1200;
  const X = 76;
  const radii = [56, 104, 152, 200];
  const ringX = 1046;

  const eyebrow = { font: MONO[500], size: 15, tracking: 3, fill: C.accentSoft };
  const name = { font: SANS[600], size: 72, tracking: -2, fill: C.text };
  const tagline = { font: SANS[400], size: 26, fill: C.textSoft };
  const meta = { font: MONO[400], size: 14, tracking: 2.2, fill: C.textMuted };
  const metaStrong = { ...meta, fill: C.textSoft };

  // The name keeps its size and wraps onto a second line if it would run into the diagram.
  const nameX = X - 3;
  const nameLines = wrap(PROFILE.name, name, ringX - radii.at(-1) - 24 - nameX);
  if (nameLines.length > 2) throw new Error('Banner: the name needs more than two lines.');

  // Vertical rhythm for a one-line name: rule 121, name 210, tagline 262, footer 347, height 420.
  // A second line adds its leading; the outer margins tighten a little to compensate.
  const twoLines = nameLines.length > 1;
  const leading = 74;
  const ruleY = twoLines ? 105 : 121;
  const nameY = ruleY + 89;
  const taglineY = nameY + (nameLines.length - 1) * leading + 52;
  const footerY = taglineY + (twoLines ? 70 : 85);
  const H = footerY + (twoLines ? 70 : 73);
  const box = { x: 0, y: 0, w: W, h: H, r: 24 };
  const ring = { cx: ringX, cy: H / 2, radii };

  const reachLead = `${upper(PROFILE.reachLabel)} `;
  const reachX = X + 30;
  const body = [
    surface(
      box,
      `<rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#fadeMask)"/>\n` +
        layerDiagram(ring, { nodes: [[1, 145], [2, -32], [3, 158]] }),
    ),
    `<rect x="${X}" y="${ruleY}" width="28" height="2" rx="1" fill="${C.accent}"/>`,
    text(upper(PROFILE.role), eyebrow, X + 44, ruleY + 1 + capMiddle(eyebrow)),
    ...nameLines.map((ln, i) => text(ln, name, nameX, nameY + i * leading)),
    text(PROFILE.tagline, tagline, X, taglineY),
    `<circle cx="${X + 5}" cy="${footerY}" r="4" fill="${C.accent}"/>`,
    text(reachLead, meta, reachX, footerY + capMiddle(meta)),
    text(PROFILE.reach.map(upper).join('  ·  '), metaStrong, reachX + measure(reachLead, meta), footerY + capMiddle(meta)),
  ].join('\n');

  return svg({
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    title: bannerTitle,
    desc: bannerDesc,
    defs: surfaceDefs({ ...box, glow: { cx: ring.cx, cy: ring.cy, r: 400, opacity: 0.2 } }) + dotGridDefs(W, H, 0.3, 0.85),
    body,
  });
}

/** Stacked hero shown on narrow screens, where the wide banner gets too small to read. */
function bannerCompact() {
  const W = 720;
  const X = 56;

  const eyebrow = { font: MONO[500], size: 21, tracking: 4, fill: C.accentSoft };
  const name = { font: SANS[600], size: 80, tracking: -2.2, fill: C.text };
  const tagline = { font: SANS[400], size: 29, fill: C.textSoft };

  const nameLines = wrap(PROFILE.name, name, W - 2 * X);
  const taglineLines = wrap(PROFILE.tagline, tagline, 430);
  if (taglineLines.length > 2) throw new Error('Compact banner: tagline needs more than two lines.');

  // The card grows with the number of name lines; the diagram stays anchored bottom-right.
  const nameY = 178;
  const leading = 82;
  const taglineY = nameY + (nameLines.length - 1) * leading + 64;
  const H = taglineY + (taglineLines.length - 1) * 40 + 56;
  const box = { x: 0, y: 0, w: W, h: H, r: 24 };
  const ring = { cx: 660, cy: H - 90, radii: [48, 92, 136, 180] };

  const body = [
    surface(
      box,
      `<rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#fadeMask)"/>\n` +
        layerDiagram(ring, { labels: false, nodes: [[1, 200]] }),
    ),
    `<rect x="${X}" y="80" width="36" height="2.5" rx="1.25" fill="${C.accent}"/>`,
    text(upper(PROFILE.role), eyebrow, X + 54, 81.25 + capMiddle(eyebrow)),
    ...nameLines.map((ln, i) => text(ln, name, X - 3, nameY + i * leading)),
    ...taglineLines.map((ln, i) => text(ln, tagline, X, taglineY + i * 40)),
  ].join('\n');

  return svg({
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    title: bannerTitle,
    desc: bannerDesc,
    defs: surfaceDefs({ ...box, glow: { cx: ring.cx, cy: ring.cy, r: 380, opacity: 0.2 } }) + dotGridDefs(W, H, 0.45, 1),
    body,
  });
}

const cardTitle = (p) => `${p.name} — ${p.sector}${p.region ? `, ${p.region}` : ''}`;
const cardDesc = (p) =>
  `${p.summary} ${p.facts.map(([v, l]) => `${v} ${l.replace(/\n/g, ' ').toLowerCase()}`).join(', ')}.`;

/** Project tile for phones and tablets: drawn at 820 wide, shown at up to 460px. */
function projectCard(project, index) {
  const W = 820;
  const H = 536;
  const M = 10; // transparent margin; becomes the gutter between tiles
  const P = 50;
  const box = { x: M, y: M, w: W - 2 * M, h: H - 2 * M, r: 26 };
  const x0 = M + P;
  const inner = W - 2 * (M + P);

  const indexStyle = { font: MONO[500], size: 20, tracking: 2, fill: C.accent };
  const eyebrow = { font: MONO[400], size: 20, tracking: 2.2, fill: C.textMuted };
  const name = { font: SANS[600], size: 58, tracking: -1.2, fill: C.text };
  const summary = { font: SANS[400], size: 27, fill: C.textSoft };
  const value = { font: SANS[600], size: 44, tracking: -0.8, fill: C.text };
  const label = { font: MONO[400], size: 19, tracking: 1.4, fill: C.textMuted };

  const lines = wrap(project.summary, summary, inner);
  if (lines.length > 3) throw new Error(`${project.name}: summary needs ${lines.length} lines (max 3).`);

  const num = String(index + 1).padStart(2, '0');
  const numWidth = measure(num, indexStyle);
  const sector = [project.sector, project.region].filter(Boolean).map(upper).join('  ·  ');
  if (numWidth + 44 + measure(sector, eyebrow) > inner) throw new Error(`${project.name}: eyebrow is too long.`);

  const colW = inner / 3;
  const facts = project.facts.flatMap(([v, l], i) => {
    const fx = x0 + i * colW;
    const labelLines = wrap(upper(l), label, colW - 20);
    if (labelLines.length > 2) throw new Error(`${project.name}: fact label "${l}" needs more than two lines.`);
    if (measure(v, value) > colW - 16) throw new Error(`${project.name}: fact value "${v}" is too wide.`);
    return [text(v, value, fx - 1, 408), ...labelLines.map((ln, j) => text(ln, label, fx, 446 + j * 27))];
  });

  const body = [
    surface(box),
    text(num, indexStyle, x0, 90),
    `<rect x="${x0 + numWidth + 14}" y="83" width="16" height="1.5" fill="${C.textMuted}"/>`,
    text(sector, eyebrow, x0 + numWidth + 44, 90),
    text(project.name, name, x0 - 2, 170),
    ...lines.map((ln, i) => text(ln, summary, x0, 226 + i * 39)),
    `<rect x="${x0}" y="338" width="${inner}" height="1" fill="${C.border}"/>`,
    ...facts,
  ].join('\n');

  const shown = 460; // display width; GitHub scales it down on narrower screens
  return svg({
    width: shown,
    height: +((H * shown) / W).toFixed(1),
    viewBox: `0 0 ${W} ${H}`,
    title: cardTitle(project),
    desc: cardDesc(project),
    defs: surfaceDefs({ ...box, glow: { cx: W - M - 30, cy: M + 10, r: 360, opacity: 0.13 } }),
    body,
  });
}

/**
 * Wide project card for desktop: drawn at 2x and shown 846px wide, the width
 * of GitHub's profile README column. Story on the left, facts panel on the right.
 */
function projectWide(project, index, valueColumn) {
  const W = 1692;
  const H = 396;
  const P = 60;
  const split = 1090; // where the facts panel starts
  const box = { x: 0, y: 0, w: W, h: H, r: 28 };
  const leftW = split - P - 64;

  const indexStyle = { font: MONO[500], size: 22, tracking: 2.2, fill: C.accent };
  const eyebrow = { font: MONO[400], size: 22, tracking: 2.4, fill: C.textMuted };
  const name = { font: SANS[600], size: 64, tracking: -1.4, fill: C.text };
  const summary = { font: SANS[400], size: 30, fill: C.textSoft };
  const value = WIDE_VALUE;
  const label = { font: MONO[400], size: 20, tracking: 1.5, fill: C.textMuted };

  const lines = wrap(project.summary, summary, leftW);
  if (lines.length > 3) throw new Error(`${project.name} (wide): summary needs ${lines.length} lines (max 3).`);

  const num = String(index + 1).padStart(2, '0');
  const numWidth = measure(num, indexStyle);
  const sector = [project.sector, project.region].filter(Boolean).map(upper).join('  ·  ');
  if (numWidth + 48 + measure(sector, eyebrow) > leftW) throw new Error(`${project.name} (wide): eyebrow is too long.`);

  // Facts panel: three rows, value column shared by every card so they line up.
  const rowsTop = 40;
  const rowH = (H - 2 * rowsTop) / 3;
  const valueX = split + 56;
  const labelX = valueX + valueColumn;
  const labelW = W - P - labelX;
  const facts = project.facts.flatMap(([v, l], i) => {
    const mid = rowsTop + rowH * i + rowH / 2;
    // One line when it fits; otherwise keep the tile's intended break.
    const joined = upper(l.replace(/\n/g, ' '));
    const labelLines = measure(joined, label) <= labelW ? [joined] : wrap(upper(l), label, labelW);
    if (labelLines.length > 2) throw new Error(`${project.name} (wide): fact label "${l}" needs more than two lines.`);
    const first = mid + capMiddle(label) - ((labelLines.length - 1) * 27) / 2;
    return [
      ...(i > 0 ? [`<rect x="${split + 48}" y="${rowsTop + rowH * i}" width="${W - split - 96}" height="1" fill="${C.border}"/>`] : []),
      text(v, value, valueX - 1, mid + capMiddle(value)),
      ...labelLines.map((ln, j) => text(ln, label, labelX, first + j * 27)),
    ];
  });

  const body = [
    surface(
      box,
      `<rect x="${split}" y="0" width="${W - split}" height="${H}" fill="#FFFFFF" fill-opacity=".018"/>\n` +
        `<rect x="${split}" y="0" width="1" height="${H}" fill="${C.border}"/>`,
    ),
    text(num, indexStyle, P, 100),
    `<rect x="${P + numWidth + 16}" y="92.5" width="18" height="1.5" fill="${C.textMuted}"/>`,
    text(sector, eyebrow, P + numWidth + 48, 100),
    text(project.name, name, P - 2, 186),
    ...lines.map((ln, i) => text(ln, summary, P, 246 + i * 42)),
    ...facts,
  ].join('\n');

  return svg({
    width: W / 2,
    height: H / 2,
    viewBox: `0 0 ${W} ${H}`,
    title: cardTitle(project),
    desc: cardDesc(project),
    defs: surfaceDefs({ ...box, glow: { cx: split, cy: 0, r: 620, opacity: 0.12 } }),
    body,
  });
}

/** Pill-shaped link button, drawn at 2x. Small pills are store links under project cards. */
function linkButton({ label, small = false }) {
  const S = 2;
  const k = small ? 0.8 : 1;
  const H = Math.round(40 * k) * S;
  const labelStyle = { font: MONO[500], size: 13 * k * S, tracking: 1.8 * k * S, fill: C.accentSoft };
  const arrowStyle = { font: SANS[500], size: 15 * k * S, fill: C.accentSoft };
  const padX = 20 * k * S;
  const gap = 9 * k * S;
  const tw = measure(upper(label), labelStyle);
  const aw = measure('↗', arrowStyle);
  const W = Math.ceil(padX * 2 + tw + gap + aw);
  const baseline = H / 2 + capMiddle(labelStyle);

  const body = [
    `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="${(H - 3) / 2}" fill="${C.bgFrom}" stroke="${C.accent}" stroke-opacity=".55" stroke-width="3"/>`,
    text(upper(label), labelStyle, padX, baseline),
    text('↗', arrowStyle, padX + tw + gap, baseline + S),
  ].join('\n');

  return svg({
    width: W / S,
    height: H / S,
    viewBox: `0 0 ${W} ${H}`,
    title: label,
    desc: `${label} link`,
    body,
  });
}

/* ───────────────────────────────── BUILD ───────────────────────────────── */

// The wide cards share one value column, sized to the widest fact value.
const WIDE_VALUE = { font: SANS[600], size: 46, tracking: -0.8, fill: C.text };
const wideValueColumn = Math.ceil(Math.max(...PROJECTS.flatMap((p) => p.facts.map(([v]) => measure(v, WIDE_VALUE))))) + 40;

const files = {
  'banner.svg': banner(),
  'banner-compact.svg': bannerCompact(),
  ...Object.fromEntries(PROJECTS.map((p, i) => [`projects/${p.file}.svg`, projectCard(p, i)])),
  ...Object.fromEntries(PROJECTS.map((p, i) => [`projects/${p.file}-wide.svg`, projectWide(p, i, wideValueColumn)])),
  ...Object.fromEntries(LINKS.map((l) => [`links/${l.file}.svg`, linkButton(l)])),
};

for (const [rel, content] of Object.entries(files)) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`${rel.padEnd(24)} ${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
}
