import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        brand: {
          bg: '#F0D264',        // Mustard Yellow (Background/Highlight)
          yellow: '#F0D264',    // Brand Yellow alias
          ink: '#10201A',       // Dark Green / Ink (Typography, borders, dark theme bg)
          card: '#D3D3BF',      // Cream / Bone (Cards & light elements)
          bone: '#D3D3BF',      // Bone / Cream
          orange: '#EE8A4C',    // Accent Orange (CTAs, buttons, tags)
          turquoise: '#18B5B8', // Accent Turquoise (Active states, highlights)
          muted: '#8A8D85',     // Muted Gray (Secondary text/textures)
          // Dark mode specific background mapping
          darkCard: '#1c2f27',  // Deep dark green card
          darkInk: '#F0E6C0',   // Light cream text for dark mode
        },
        tivo: {
          bg: '#10201A',
          card: '#1c2f27',
          yellow: '#F0D264',
          gold: '#EE8A4C',
          turquoise: '#18B5B8',
          text: '#F0E6C0',
          muted: '#8A8D85',
        }
      },
    },
  },
  plugins: [typography],
};
