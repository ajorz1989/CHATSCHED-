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
    },
  },
  plugins: [],
}
