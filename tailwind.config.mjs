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
        // Paleta Editorial Oficial: «Tierra y energía» / Papel y Tinta
        editorial: {
          bg: '#FAF6F0',          // Fondo Crema/Hueso
          darkBg: '#111111',      // Fondo oscuro mate profundo
          ink: '#1F1B16',         // Texto Principal (Casi negro cálido)
          text: '#1F1B16',
          primary: '#E4572E',     // Primario (Naranja quemado)
          accent: '#F2B134',      // Acento (Mostaza)
          mustard: '#F2B134',
          forest: '#2F4B3A',      // Apoyo (Verde bosque)
          card: '#FFFFFF',        // Tarjeta plana en fondo claro
          darkCard: '#181818',    // Tarjeta plana en fondo oscuro mate
          border: '#E5DFD5',      // Borde editorial sutil
          darkBorder: '#282828',  // Borde editorial sutil oscuro
          muted: '#78716A',       // Texto secundario cálido
          darkMuted: '#9B948A',
        },
        brand: {
          bg: '#FAF6F0',          // Crema / Hueso
          darkBg: '#111111',      // Fondo oscuro mate profundo
          ink: '#1F1B16',         // Casi negro cálido
          text: '#1F1B16',
          orange: '#E4572E',      // Naranja quemado (Primario)
          primary: '#E4572E',
          yellow: '#F2B134',      // Mostaza (Acento)
          accent: '#F2B134',
          mustard: '#F2B134',
          forest: '#2F4B3A',      // Verde bosque (Apoyo)
          turquoise: '#2F4B3A',   // Aliased to forest green for editorial consistency
          card: '#F5EFE6',        // Tarjeta hueso suave
          bone: '#FAF6F0',        // Crema / Hueso
          border: '#E5DFD5',      // Borde editorial sutil
          muted: '#78716A',       // Gris cálido editorial
          darkCard: '#181818',    // Superficie mate profunda
          darkInk: '#FAF6F0',     // Texto claro sobre fondo oscuro mate
          darkBorder: '#282828',
          darkMuted: '#9B948A',
        },
        tivo: {
          bg: '#111111',
          card: '#181818',
          yellow: '#F2B134',
          gold: '#E4572E',
          forest: '#2F4B3A',
          turquoise: '#2F4B3A',
          text: '#FAF6F0',
          muted: '#9B948A',
        }
      },
    },
  },
  plugins: [typography],
};

