/** @type {import('tailwindcss').Config} */
export default {
content: [
"./index.html",
"./src/**/*.{js,ts,jsx,tsx}",
],

theme: {
extend: {
colors: {
// Core surfaces
background: "#0B100E",
surface: "#111713",
elevated: "#19211B",


    // Borders
    border: "#29352E",
    "border-subtle": "#202A23",

    // Typography
    foreground: "#F1F1E9",
    secondary: "#A0ACA3",
    muted: "#758279",

    // Brand identity
    accent: "#80B99A",
    "accent-hover": "#96C9A9",
    "accent-light": "#A5D7B6",
    "accent-subtle": "#172B20",

    // Status colors
    success: "#83C99A",
    warning: "#D9B77A",
    danger: "#E58D88",
    info: "#8FC5B9",
  },

  fontFamily: {
    sans: [
      "Inter",
      "ui-sans-serif",
      "system-ui",
      "sans-serif",
    ],

    display: [
      "Manrope",
      "Inter",
      "ui-sans-serif",
      "sans-serif",
    ],
  },

  boxShadow: {
    glow: "0 0 80px rgba(69, 160, 108, 0.12)",
    "glow-sm": "0 0 32px rgba(69, 160, 108, 0.08)",
    card: "0 12px 40px rgba(0, 0, 0, 0.20)",
  },

  borderRadius: {
    xl: "0.875rem",
    "2xl": "1.125rem",
  },

  transitionTimingFunction: {
    smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
},


},

plugins: [],
};
