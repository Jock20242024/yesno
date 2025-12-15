/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#ec9c13",
        "primary-hover": "#d48a11",
        "background-light": "#f3f4f6",
        "background-dark": "#000000",
        "surface-dark": "#0F0F0F",
        "surface-hover": "#1A1A1A",
        "border-dark": "#27272a",
        "text-secondary": "#71717a",
        "poly-green": "#10b981",
        "poly-red": "#ef4444",
        "poly-blue": "#3b82f6",
        "pm-bg": "#0e1217",
        "pm-card": "#1c2027",
        "pm-card-hover": "#252a33",
        "pm-border": "#2d323b",
        "pm-text": "#f3f4f6",
        "pm-text-dim": "#828a99",
        "pm-green": "#22c55e",
        "pm-green-dim": "rgba(34, 197, 94, 0.1)",
        "pm-red": "#ef4444",
        "pm-red-dim": "rgba(239, 68, 68, 0.1)",
        "pm-blue": "#3b82f6",
        "coin-gold": "#F7931A",
      },
      boxShadow: {
        "glow-green": "0 0 20px rgba(34, 197, 94, 0.15)",
        "glow-red": "0 0 20px rgba(239, 68, 68, 0.15)",
      },
      fontFamily: {
        "display": ["Inter", "Noto Sans SC", "sans-serif"],
        "body": ["Inter", "Noto Sans SC", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0px",
        "sm": "0.125rem",
        "md": "0.25rem",
        "lg": "0.375rem",
        "xl": "0.5rem",
        "full": "9999px",
      },
    },
  },
  plugins: [],
};

