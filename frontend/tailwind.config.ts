import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#efe7d8",
        surface: "#fffaf0",
        ink: "#174a34",
        muted: "#766b5b",
        line: "#d5c4aa",
        accent: {
          50: "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          900: "#064e3b",
        },
        brand: {
          50: "#fff7ed",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "var(--font-thai)",
          "var(--font-lao)",
          "system-ui",
          "sans-serif",
        ],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tight: "-0.02em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(92,68,35,0.14), 0 8px 20px rgba(92,68,35,0.08)",
        pop: "0 12px 32px rgba(67,47,23,0.18), 0 2px 8px rgba(67,47,23,0.10)",
        ink: "0 1px 0 rgba(255,255,255,0.14) inset, 0 8px 22px rgba(23,74,52,0.24)",
      },
      animation: {
        "slide-up": "slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 0.2s ease-out",
      },
      keyframes: {
        "slide-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
