/** @type {import('tailwindcss').Config} */
// Compiled/purged Tailwind build (replaces the render-blocking cdn.tailwindcss.com dev script).
// Content globs cover every file that carries className strings so no utilities are purged.
// NOTE: this project is ESM ("type": "module"), so plugins are imported, not require()d.
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}',
  ],
  theme: {
    // Default theme is preserved — the app renders in Tailwind's system-font sans stack today
    // (Inter was loaded but never applied), so we keep the same stack for a pixel-identical result.
    //
    // DESIGN SCALE (convention, not enforced by a lint rule — follow it when adding UI):
    //   Radius   surfaces + controls = `rounded-2xl`; pills/dots = `rounded-full`. Nothing else.
    //            (The app previously shipped 10 radii, incl. rounded-[40px]/[32px]/[24px].)
    //   Padding  cards = `p-6 sm:p-8`; inset panels = `p-4`; never a flat `p-12` (it leaves ~246px
    //            of interior on a 390px screen and clips content).
    //   Fields   `px-4 py-3.5 rounded-2xl text-[15px]` + `w-full min-w-0`, label `text-[11px]
    //            uppercase tracking-widest mb-2`. See components/auth/AuthField.
    //   Eyebrows one tracking value: `tracking-widest`. Reserve `tracking-[0.2em]`+ for the wordmark.
    //   Numbers  right-align money/token columns and add `tabular-nums` so digits line up.
    extend: {},
  },
  // Supplies the `animate-in` / `fade-in` / `slide-in-from-*` / `zoom-in` enter utilities used
  // throughout the app. Without it those class names compile to nothing and every "animation" in
  // the UI is silently inert. Reduced-motion is handled globally in index.css.
  plugins: [tailwindcssAnimate],
};
