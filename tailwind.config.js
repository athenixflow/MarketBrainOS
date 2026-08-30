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
    extend: {},
  },
  // Supplies the `animate-in` / `fade-in` / `slide-in-from-*` / `zoom-in` enter utilities used
  // throughout the app. Without it those class names compile to nothing and every "animation" in
  // the UI is silently inert. Reduced-motion is handled globally in index.css.
  plugins: [tailwindcssAnimate],
};
