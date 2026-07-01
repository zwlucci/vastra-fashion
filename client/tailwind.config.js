/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#171717",
        clay: "#b86b4b",
        moss: "#66715a",
        pearl: "#f7f3ee"
      },
      boxShadow: {
        soft: "0 16px 50px rgba(20, 20, 20, 0.08)"
      }
    }
  },
  plugins: []
};
