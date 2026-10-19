/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

// Design tokens: "pit wall at night".
// The neutral ramp is retuned from flat grey to a cool asphalt graphite, so
// every existing bg-/text-/border-neutral-* class picks up the new surface
// palette without per-file edits. Red is retuned to F1 broadcast red.
// Purple/green keep their timing-screen meaning (overall best / personal best).
const asphalt = {
  50: '#f3f4f6',
  100: '#e6e8eb',
  200: '#c9cdd3',
  300: '#a7adb6',
  400: '#7f8793',
  500: '#5f6773',
  600: '#464d58',
  700: '#323842',
  800: '#22272f',
  850: '#1a1e25',
  900: '#13161b',
  950: '#0b0d10',
};

const broadcastRed = {
  50: '#fff1f0',
  100: '#ffdfdc',
  200: '#ffc4be',
  300: '#ff9a90',
  400: '#ff6152',
  500: '#f5321f',
  600: '#e10600',
  700: '#bd0500',
  800: '#9c0a05',
  900: '#810f0b',
  950: '#470301',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neutral: asphalt,
        red: broadcastRed,
        tarmac: '#08090b',
        chalk: '#eef0f2',
      },
      fontFamily: {
        // One family for the whole product: Titillium Web was F1's own
        // broadcast typeface. Numbers get tabular figures from index.css, so
        // the old font-mono timing columns stay aligned in the same face.
        sans: ['"Titillium Web"', ...defaultTheme.fontFamily.sans],
        mono: ['"Titillium Web"', ...defaultTheme.fontFamily.sans],
      },
      transitionProperty: {
        // Explicit replacement for `transition-all`: paint and compositor
        // properties only, never layout.
        ui: 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter',
      },
      transitionTimingFunction: {
        // Quick out, soft landing. Used for everything user-triggered.
        pit: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        slideInFromBottom: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        routeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        loadSweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        'slide-in-bottom': 'slideInFromBottom 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'route-in': 'routeIn 0.24s ease-out both',
        'load-sweep': 'loadSweep 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};