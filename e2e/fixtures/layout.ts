/**
 * Layout defect probes, run inside the page. Each returns a list of human-readable findings, so a
 * failing assertion names the element ("button 'Renew' 34px past the right edge"), not a boolean.
 * These are the bug classes the founder has hit on real devices: content wider than the phone,
 * a price stat overlapping its label, a CTA clipped inside a fixed-width card.
 */
import type { Page } from '@playwright/test';

export interface LayoutReport {
  pageOverflowX: number;
  offscreen: string[];
  overlaps: string[];
  clipped: string[];
  smallTargets: string[];
}

export async function probeLayout(page: Page, opts: { touch: boolean }): Promise<LayoutReport> {
  return page.evaluate(({ touch }) => {
    const describe = (el: Element) => {
      const tag = el.tagName.toLowerCase();
      const name = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('href') || '')
        .trim().replace(/\s+/g, ' ').slice(0, 40);
      const id = el.id ? `#${el.id}` : '';
      return `${tag}${id} '${name}'`;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
      // Inside a closed drawer / off-canvas panel: an ancestor translated fully out of view.
      return !(el as HTMLElement).closest('[aria-hidden="true"], [inert]');
    };
    // Elements inside a horizontal scroller are allowed past the edge: that is what a scroller is.
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if ((s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') && p.scrollWidth > p.clientWidth + 1) return true;
      }
      return false;
    };

    const vw = document.documentElement.clientWidth;
    const pageOverflowX = Math.max(0, document.documentElement.scrollWidth - vw);

    const offscreen: string[] = [];
    const interactive = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="tab"]')]
      .filter(visible);
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (inScroller(el)) continue;
      // Wholly off-canvas = a closed drawer, which is hidden, not broken. (Whether its links are
      // still keyboard-reachable is the a11y spec's question, not a layout one.)
      if (r.right <= 0 || r.left >= vw) continue;
      if (r.right > vw + 1) offscreen.push(`${describe(el)} ${Math.round(r.right - vw)}px past the right edge`);
      else if (r.left < -1) offscreen.push(`${describe(el)} ${Math.round(-r.left)}px past the left edge`);
    }

    // Two interactive elements sharing pixels. Nested ones (a button inside a link) are not overlaps.
    const overlaps: string[] = [];
    // The part of an element its scrolling/clipping ancestors actually let through: a sidebar link
    // scrolled out of its panel is not "under" the card below the panel.
    const shown = (el: Element) => {
      let { left, top, right, bottom } = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflow === 'visible' && s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const c = p.getBoundingClientRect();
        left = Math.max(left, c.left); top = Math.max(top, c.top);
        right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom);
      }
      return { left, top, right, bottom };
    };
    const boxes = interactive.map((el) => ({ el, r: shown(el) }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        // A field's own adornment (show-password eye, clear button) sits inside the field on purpose.
        const field = (x: Element) => x.matches('input, textarea, select');
        const adornment = (f: Element, btn: Element) => field(f) && !field(btn) && !!btn.parentElement?.contains(f);
        if (adornment(a.el, b.el) || adornment(b.el, a.el)) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 4 && h > 4) {
          // Fixed/sticky chrome over scrolled content is by design; only flag same-layer collisions.
          const pos = (el: Element) => { for (let p: Element | null = el; p; p = p.parentElement) { const s = getComputedStyle(p).position; if (s === 'fixed' || s === 'sticky') return 'f'; } return 's'; };
          if (pos(a.el) !== pos(b.el)) continue;
          overlaps.push(`${describe(a.el)} overlaps ${describe(b.el)} (${Math.round(w)}x${Math.round(h)})`);
        }
      }
    }

    // Text cut off: a leaf text container that hides overflow and is narrower than its content.
    // Deliberate truncation (text-overflow: ellipsis / line-clamp) is a design choice, not a bug.
    const clipped: string[] = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,label,td,th,div')) {
      if (!visible(el) || el.children.length > 2) continue;
      const s = getComputedStyle(el);
      if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none' && s.webkitLineClamp !== '') continue;
      // Visually hidden on purpose (Tailwind sr-only: a 1px box with clip): read by screen readers, never shown.
      if ((el.clientWidth <= 1 && el.clientHeight <= 1) || s.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(s.clipPath)) continue;
      const hides = s.overflow === 'hidden' || s.overflowX === 'hidden' || s.overflowY === 'hidden';
      if (!hides) continue;
      const text = (el as HTMLElement).innerText?.trim();
      if (!text) continue;
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
        clipped.push(`${describe(el)} clipped (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`);
      }
    }

    const smallTargets: string[] = [];
    if (touch) {
      for (const el of interactive) {
        if (el.matches('input[type="hidden"]')) continue;
        const r = el.getBoundingClientRect();
        // WCAG 2.2 SC 2.5.8 minimum: 24x24 CSS px. Inline links inside a sentence are exempt.
        // 2.5.8's inline exception: a link or text button flowing inside a sentence.
        const inline = getComputedStyle(el).display === 'inline' && !!el.parentElement && /^(P|SPAN|LI|LABEL)$/.test(el.parentElement.tagName);
        if (r.right <= 0 || r.left >= document.documentElement.clientWidth) continue; // closed drawer
        if (!inline && (r.width < 24 || r.height < 24)) smallTargets.push(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return { pageOverflowX, offscreen, overlaps: overlaps.slice(0, 20), clipped: clipped.slice(0, 20), smallTargets: smallTargets.slice(0, 30) };
  }, opts);
}
