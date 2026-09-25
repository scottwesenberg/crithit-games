import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0d0b1a",
          900: "#161329",
          800: "#221d3d",
          700: "#332b57",
        },
        brand: {
          50: "#f3f1ff",
          100: "#e7e2ff",
          200: "#cabdff",
          300: "#a690ff",
          400: "#8560ff",
          500: "#6c37ff",
          600: "#5c1ff2",
          700: "#4c17c9",
          800: "#3f16a3",
          900: "#341582",
        },
        ember: {
          400: "#ffb44d",
          500: "#ff9d1f",
          600: "#f47f00",
        },
      },
      fontFamily: {
        display: ["'Rubik'", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 10px rgba(13, 11, 26, 0.08)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 62s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
