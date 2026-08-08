/** @type {import('tailwindcss').Config} */
// Compiled/purged Tailwind build (replaces the render-blocking cdn.tailwindcss.com dev script).
// Content globs cover every file that carries className strings so no utilities are purged.
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
  plugins: [],
};
