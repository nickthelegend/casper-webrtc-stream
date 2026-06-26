/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        casper: {
          bg: "#070a10",
          surface: "#0d121c",
          panel: "#111927",
          border: "#1f2a3a",
          accent: "#ff453a", // live / primary red
          violet: "#8b6cff", // brand
          indigo: "#5b8cff",
          gold: "#ffc24b", // money
          green: "#2ee6a6", // on-chain confirmed
          ghost: "#eaf0f8",
          muted: "#8b98ab",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 8px 40px -8px rgba(139,108,255,0.35)",
        "glow-red": "0 0 28px -4px rgba(255,69,58,0.55)",
        "glow-gold": "0 0 30px -8px rgba(255,194,75,0.45)",
        "glow-green": "0 0 24px -6px rgba(46,230,166,0.5)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -24px rgba(0,0,0,0.7)",
      },
      keyframes: {
        pulseGlow: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(255,69,58,0.55)" },
          "50%": { boxShadow: "0 0 0 7px rgba(255,69,58,0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        ping2: { "75%,100%": { transform: "scale(2.2)", opacity: "0" } },
      },
      animation: {
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "slide-up": "slideUp 0.45s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 2.6s linear infinite",
        float: "float 5s ease-in-out infinite",
        ping2: "ping2 1.6s cubic-bezier(0,0,0.2,1) infinite",
      },
    },
  },
  plugins: [],
};
