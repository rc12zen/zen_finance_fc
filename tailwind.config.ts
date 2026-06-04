import type { Config } from "tailwindcss"
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1E3A5F",
        accent: "#2E6DA4",
      }
    },
  },
  plugins: [],
}
export default config
