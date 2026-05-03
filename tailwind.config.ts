import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#09111f",
        panel: "#101a2d",
        ink: "#eff6ff",
        accent: "#38bdf8",
        accentWarm: "#f59e0b",
        accentRose: "#fb7185"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(148, 163, 184, 0.15), 0 24px 64px rgba(8, 15, 32, 0.45)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
