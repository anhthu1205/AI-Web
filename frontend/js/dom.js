// Dựng phần tử DOM. Mọi chuỗi đi qua textContent / Node.append(string) nên không bao giờ được hiểu là HTML.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child !== undefined && child !== null && child !== false) node.append(child);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// Icon tĩnh: [thẻ, thuộc tính]. Không ghép chuỗi chứa dữ liệu.
const ICONS = {
  home: [['path', { d: 'M3 21V9l9-6 9 6v12' }], ['path', { d: 'M9 21v-7h6v7' }]],
  db: [
    ['ellipse', { cx: 12, cy: 5, rx: 8, ry: 3 }],
    ['path', { d: 'M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5' }],
    ['path', { d: 'M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6' }],
  ],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  arrow: [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
  copy: [['rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }], ['path', { d: 'M5 15V6a2 2 0 0 1 2-2h9' }]],
  download: [['path', { d: 'M12 4v11M7 11l5 5 5-5' }], ['path', { d: 'M5 20h14' }]],
  menu: [['path', { d: 'M4 7h16M4 12h16M4 17h16' }]],
  close: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  block: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M5.6 5.6l12.8 12.8' }]],
  help: [['path', { d: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4' }], ['path', { d: 'M12 18h.01' }]],
  search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M20 20l-4-4' }]],
  clock: [['circle', { cx: 12, cy: 13, r: 8 }], ['path', { d: 'M12 9v4l2 2M9 2h6' }]],
  alert: [['path', { d: 'M12 7v6M12 17h.01' }]],
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
};

export function icon(name, size = 16, strokeWidth = 2) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attrs] of ICONS[name] || []) {
    const part = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) part.setAttribute(k, String(v));
    svg.appendChild(part);
  }
  return svg;
}

export const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
