import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Netflix-ish dark palette
        ink: "#0b0b0f",
        panel: "#16161d",
        edge: "#26262f",
        brand: "#e50914",
        muted: "#9aa0aa",
      },
      fontFamily: {
        sans: ["var(--font-system)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
