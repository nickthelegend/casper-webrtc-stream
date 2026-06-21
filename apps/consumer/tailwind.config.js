/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        casper: {
          bg: "#0a0e14",
          panel: "#121821",
          border: "#1f2937",
          accent: "#ff3b30",
          ghost: "#e6e6e6",
          gold: "#f5b301",
        },
      },
    },
  },
  plugins: [],
};
