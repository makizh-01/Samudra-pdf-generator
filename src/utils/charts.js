/**
 * Chart generation (pure SVG -> PNG via sharp).
 * Renders the two dynamic visuals of the SAMUDRA.Jobfit report:
 *   - 7-axis behavioural radar chart with zone bands
 *   - 0–100% Job Fit gauge with needle
 * No scoring or interpretation happens here — values arrive
 * pre-computed from the database.
 */
const sharp = require('sharp');

const FONT = 'DejaVu Sans, Verdana, Arial, sans-serif';

/* ------------------------------------------------------------------ */
/* Radar chart                                                         */
/* ------------------------------------------------------------------ */

// Display order: top, then clockwise (matches the reference report)
const RADAR_ORDER = [
  ['ADAPTABILITY', 'A'],
  ['MOTIVATION', 'D'],   // Drive & Ambition is labelled "Motivation" on the wheel
  ['UNBIASED', 'U'],
  ['DECISIONING', 'M'],  // Mental Clarity / decisioning axis
  ['RESILIENCE', 'R'],
  ['ASSERTIVENESS', 'AC'], // Accountability / assertiveness axis
  ['STABILITY', 'S'],
];

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180; // 0° = top, clockwise
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function ringPath(cx, cy, r, n = 7) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(polar(cx, cy, r, (360 / n) * i));
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z';
}

function radarSvg(traits) {
  const W = 900, H = 700, cx = 430, cy = 340, R = 210;
  const scale = (v) => (v / 100) * R;
  const axes = RADAR_ORDER.map(([label, key], i) => ({
    label,
    score: Number(traits[key]?.score ?? 0),
    angle: (360 / 7) * i,
  }));

  const zoneBand = (lo, hi, fill) =>
    `<path d="${ringPath(cx, cy, scale(hi))} ${ringPath(cx, cy, scale(lo))}" fill="${fill}" fill-rule="evenodd"/>`;

  const grid = [20, 40, 60, 80, 100]
    .map((v) => `<path d="${ringPath(cx, cy, scale(v))}" fill="none" stroke="#c9d6e2" stroke-width="1"/>`)
    .join('');

  const spokes = axes
    .map((a) => {
      const [x, y] = polar(cx, cy, R, a.angle);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#c9d6e2" stroke-width="1"/>`;
    })
    .join('');

  const dataPts = axes.map((a) => polar(cx, cy, scale(a.score), a.angle));
  const dataPath =
    dataPts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z';
  const dots = dataPts
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#1F4E9C"/>`)
    .join('');

  const ticks = [0, 20, 40, 60, 80, 100]
    .map((v) => `<text x="${cx + 9}" y="${cy - scale(v) - 4}" font-size="13" fill="#555" font-family="${FONT}">${v}</text>`)
    .join('');

  // Trait name sits outside the outer ring; the score sits directly beneath it,
  // so neither collides with the radial tick numbers.
  const labels = axes
    .map((a) => {
      const [lx, ly] = polar(cx, cy, R + 52, a.angle);
      const anchor = Math.abs(a.angle) < 1 || Math.abs(a.angle - 180) < 1
        ? 'middle'
        : a.angle < 180 ? 'start' : 'end';
      return (
        `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" font-size="17" font-weight="bold" fill="#333" font-family="${FONT}">${a.label}</text>` +
        `<text x="${lx.toFixed(1)}" y="${(ly + 24).toFixed(1)}" text-anchor="${anchor}" font-size="21" font-weight="bold" fill="#F5A623" font-family="${FONT}">${a.score}</text>`
      );
    })
    .join('');

  const legend = [
    ['#E8F1FA', '75–100', 'Strength Zone'],
    ['#DDF1FA', '60–75', 'Moderate Zone'],
    ['#FDF3D7', '0–60', 'Development Zone'],
  ]
    .map(
      ([c, range, name], i) =>
        `<rect x="720" y="${430 + i * 30}" width="22" height="16" fill="${c}" stroke="#bbb"/>` +
        `<text x="750" y="${443 + i * 30}" font-size="13" fill="#333" font-family="${FONT}">${range}  ${name}</text>`
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${zoneBand(0, 60, '#FDF3D7')}${zoneBand(60, 75, '#DDF1FA')}${zoneBand(75, 100, '#E8F1FA')}
  ${grid}${spokes}
  <path d="${dataPath}" fill="rgba(31,78,156,0.06)" stroke="#1F4E9C" stroke-width="3"/>
  ${dots}${ticks}${labels}${legend}
  <text x="${cx}" y="${H - 20}" text-anchor="middle" font-size="14" font-weight="bold" fill="#333" font-family="${FONT}">Scale: 0 (Lowest) to 100 (Highest)</text>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* Gauge                                                               */
/* ------------------------------------------------------------------ */

function arcPath(cx, cy, rOuter, rInner, startPct, endPct) {
  // 0% at left (180°), 100% at right (0°) on the upper semicircle
  const ang = (p) => Math.PI * (1 - p / 100);
  const p1 = [cx + rOuter * Math.cos(ang(startPct)), cy - rOuter * Math.sin(ang(startPct))];
  const p2 = [cx + rOuter * Math.cos(ang(endPct)), cy - rOuter * Math.sin(ang(endPct))];
  const p3 = [cx + rInner * Math.cos(ang(endPct)), cy - rInner * Math.sin(ang(endPct))];
  const p4 = [cx + rInner * Math.cos(ang(startPct)), cy - rInner * Math.sin(ang(startPct))];
  const large = endPct - startPct > 50 ? 1 : 0;
  return `M${p1[0].toFixed(1)},${p1[1].toFixed(1)} A${rOuter},${rOuter} 0 ${large} 1 ${p2[0].toFixed(1)},${p2[1].toFixed(1)} L${p3[0].toFixed(1)},${p3[1].toFixed(1)} A${rInner},${rInner} 0 ${large} 0 ${p4[0].toFixed(1)},${p4[1].toFixed(1)} Z`;
}

function gaugeSvg(pct) {
  const W = 760, H = 480, cx = 380, cy = 330, R = 230, RI = 178;
  const segs =
    arcPathSeg('#FFC425', 0, 25) + arcPathSeg('#2FA84F', 25, 75) + arcPathSeg('#D9D9D9', 75, 100);
  function arcPathSeg(color, a, b) {
    return `<path d="${arcPath(cx, cy, R, RI, a, b)}" fill="${color}"/>`;
  }
  const ticks = [0, 25, 50, 75, 100]
    .map((p) => {
      const a = Math.PI * (1 - p / 100);
      const x1 = cx + (R + 6) * Math.cos(a), y1 = cy - (R + 6) * Math.sin(a);
      const x2 = cx + (R + 22) * Math.cos(a), y2 = cy - (R + 22) * Math.sin(a);
      const xt = cx + (R + 50) * Math.cos(a), yt = cy - (R + 50) * Math.sin(a) + 6;
      return (
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#333" stroke-width="3"/>` +
        `<text x="${xt.toFixed(1)}" y="${yt.toFixed(1)}" text-anchor="middle" font-size="19" fill="#111" font-family="${FONT}">${p}%</text>`
      );
    })
    .join('');
  const a = Math.PI * (1 - pct / 100);
  const tip = [cx + (R - 25) * Math.cos(a), cy - (R - 25) * Math.sin(a)];
  const b1 = [cx + 13 * Math.cos(a + Math.PI / 2), cy - 13 * Math.sin(a + Math.PI / 2)];
  const b2 = [cx + 13 * Math.cos(a - Math.PI / 2), cy - 13 * Math.sin(a - Math.PI / 2)];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${segs}${ticks}
  <polygon points="${b1.map((v) => v.toFixed(1))} ${b2.map((v) => v.toFixed(1))} ${tip.map((v) => v.toFixed(1))}" fill="#333"/>
  <circle cx="${cx}" cy="${cy}" r="18" fill="white" stroke="#333" stroke-width="6"/>
  <text x="${cx}" y="${cy + 68}" text-anchor="middle" font-size="58" font-weight="bold" fill="#1F3F94" font-family="${FONT}">${pct}%</text>
  <text x="${cx}" y="${cy + 105}" text-anchor="middle" font-size="26" font-weight="bold" fill="#111" font-family="${FONT}">Overall Job Fit</text>
</svg>`;
}


/* ------------------------------------------------------------------ */
/* Static brand graphics (inlined into the HTML preview)               */
/* ------------------------------------------------------------------ */

const HEX = [
  ['S', '#E23B3B', 'Social|Intelligence'],
  ['A', '#F5A623', 'Adaptability'],
  ['M', '#8C9FD4', 'Mental|Clarity'],
  ['U', '#3BA9E0', 'Unbiased'],
  ['D', '#F5C542', 'Drive &|Ambition'],
  ['R', '#8CC63F', 'Resilience'],
  ['A', '#1E9E4A', 'Accountability'],
];

function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** S.A.M.U.D.R.A framework strip (7 coloured hexagons + labels). */
function frameworkSvg() {
  const W = 940, H = 250;
  const startX = 90, gapX = 128, y = 148;
  const nodes = HEX.map(([letter, color, label], i) => {
    const x = startX + i * gapX;
    const [l1, l2 = ''] = label.split('|');
    return (
      `<line x1="${x}" y1="${y - 60}" x2="${x}" y2="${y - 34}" stroke="#bbb" stroke-width="1"/>` +
      `<polygon points="${hexPoints(x, y, 33)}" fill="#fff" stroke="${color}" stroke-width="2.5"/>` +
      `<polygon points="${hexPoints(x, y, 25)}" fill="${color}"/>` +
      `<text x="${x}" y="${y + 7}" text-anchor="middle" font-size="21" font-weight="bold" fill="#fff" font-family="${FONT}">${letter}</text>` +
      `<text x="${x}" y="${y + 54}" text-anchor="middle" font-size="12" fill="#333" font-family="${FONT}">${l1}</text>` +
      `<text x="${x}" y="${y + 68}" text-anchor="middle" font-size="12" fill="#333" font-family="${FONT}">${l2}</text>`
    );
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <text x="${W / 2}" y="46" text-anchor="middle" font-size="40" font-weight="bold" fill="#5a6b7a" font-family="${FONT}">S.A.M.U.D.R.A</text>
  <text x="${W / 2}" y="74" text-anchor="middle" font-size="18" fill="#444" font-family="${FONT}">Performance Intelligence Framework</text>
  <line x1="${startX}" y1="${y - 60}" x2="${startX + 6 * gapX}" y2="${y - 60}" stroke="#bbb" stroke-width="1"/>
  ${nodes}
</svg>`;
}

/** GPS7 circular-arrow mark used on the cover page. */
function gps7LogoSvg(fill = '#ffffff', textFill = '#8fa3c8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="0 0 240 200">
  <path d="M120,30 a70,70 0 1 0 66,92 l-34,0 a38,38 0 1 1 -32,-60 Z" fill="${fill}"/>
  <rect x="112" y="14" width="52" height="52" fill="${fill}"/>
  <polygon points="150,4 196,50 150,50" fill="${fill}"/>
  <text x="122" y="145" font-size="34" font-weight="bold" fill="${textFill}" font-family="${FONT}">GPS7</text>
</svg>`;
}

/* ------------------------------------------------------------------ */

async function svgToPng(svg, width) {
  return sharp(Buffer.from(svg)).resize({ width }).png().toBuffer();
}

module.exports = {
  radarSvg,
  gaugeSvg,
  frameworkSvg,
  gps7LogoSvg,
  radarPng: (traits) => svgToPng(radarSvg(traits), 1200),
  gaugePng: (pct) => svgToPng(gaugeSvg(pct), 1000),
};
