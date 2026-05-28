// Tailwind v4 ships its PostCSS plugin separately and replaces the v3
// "tailwindcss" + "autoprefixer" pair with a single plugin entry.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
