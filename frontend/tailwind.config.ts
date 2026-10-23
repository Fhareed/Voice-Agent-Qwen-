import type { Config } from "tailwindcss";

const config: Config = {
  // The dashboard uses its own semantic CSS (no Tailwind utilities), while the
  // marketing + auth pages are 100% Tailwind. Making utilities !important lets
  // icon sizes etc. win over the globally-loaded `.lu` rule without affecting
  // the dashboard's styles.
  important: true,
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FFF8EE",
        paper: "#FFFDF8",
        ink: "#111827",
        muted: "#5B6472",
        hair: "#E7E0D0",
        flame: "#FF6B35",   // primary accent (orange)
        sun: "#FFD84D",     // yellow
        cobalt: "#2F6BFF",  // brand blue — matches the dashboard accent + the logo's water
        rose: "#FF5C8A",    // pink
        mint: "#34D39E",    // green
        grape: "#7C5CFF",   // purple (our extra color)
        periwinkle: "#B8D1FF",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ["Onest", "system-ui", "sans-serif"],
      },
      boxShadow: {
        hard: "6px 7px 0 #111827",
        "hard-lg": "10px 12px 0 #111827",
        "hard-sm": "4px 5px 0 #111827",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        spinslow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        blink: {
          "0%,50%": { opacity: "1" },
          "50.01%,100%": { opacity: "0" },
        },
      },
      animation: {
        marquee: "marquee 26s linear infinite",
        "marquee-fast": "marquee 18s linear infinite",
        float: "float 5s ease-in-out infinite",
        spinslow: "spinslow 16s linear infinite",
        blink: "blink 1s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
