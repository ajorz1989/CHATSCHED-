/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        billboard: {
          yellow: "#F5B700",
          yellowDeep: "#D9A400",
          ink: "#1A1712",
          inkSoft: "#4A4335",
          paper: "#FAF9F5",
          paperDim: "#F0EEE6",
          green: "#1C6B45",
          greenDeep: "#134F34",
          red: "#D4451F",
        },
      },
      fontFamily: {
        display: ["'Archivo Black'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        block: "8px 8px 0 #1A1712",
        blockSm: "5px 5px 0 #1A1712",
      },
      keyframes: {
        "op-float": { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-7px)" } },
        "op-slide-in": { from: { opacity: "0", transform: "translateX(40px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        "op-ring": { "0%": { transform: "scale(1)", opacity: ".55" }, "100%": { transform: "scale(2.1)", opacity: "0" } },
        "op-dash": { to: { strokeDashoffset: "-20" } },
        "op-chip": {
          "0%, 6%": { backgroundColor: "#FAF9F5" },
          "16%, 78%": { backgroundColor: "#F5B700" },
          "90%, 100%": { backgroundColor: "#FAF9F5" },
        },
        "op-tick": { "0%, 6%": { opacity: "0" }, "16%, 78%": { opacity: "1" }, "90%, 100%": { opacity: "0" } },
        "op-rail": { "0%": { transform: "scaleX(0)" }, "55%, 85%": { transform: "scaleX(1)" }, "100%": { transform: "scaleX(1)", opacity: "0" } },
        "op-draw": { "0%": { strokeDashoffset: "10" }, "35%, 85%": { strokeDashoffset: "0" }, "100%": { strokeDashoffset: "10" } },
        "op-bars": { "0%, 100%": { transform: "scaleY(.4)" }, "50%": { transform: "scaleY(1)" } },
        "op-lock": { "0%, 100%": { transform: "translateY(-2.5px)" }, "40%, 80%": { transform: "translateY(0)" } },
        "op-wave": { "0%, 100%": { opacity: ".2" }, "50%": { opacity: "1" } },
        "op-drift": { "0%, 100%": { transform: "translate(0,0) rotate(0deg)" }, "50%": { transform: "translate(10px,-14px) rotate(8deg)" } },
      },
      animation: {
        "op-float": "op-float 5s ease-in-out infinite",
        "op-slide-in": "op-slide-in .7s cubic-bezier(.22,.8,.28,1) both",
        "op-ring": "op-ring 2s ease-out infinite",
        "op-dash": "op-dash 1.4s linear infinite",
        "op-chip": "op-chip 7s ease-in-out infinite",
        "op-tick": "op-tick 7s ease-in-out infinite",
        "op-rail": "op-rail 7s ease-in-out infinite",
        "op-draw": "op-draw 3.2s ease-in-out infinite",
        "op-bars": "op-bars 1.8s ease-in-out infinite",
        "op-lock": "op-lock 2.6s ease-in-out infinite",
        "op-wave": "op-wave 1.8s ease-in-out infinite",
        "op-drift": "op-drift 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
