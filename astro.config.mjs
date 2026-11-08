import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel/serverless';

/**
 * Security headers aplicados en desarrollo local (vite dev server).
 * En producción Vercel, los mismos headers los aplica vercel.json con
 * mayor prioridad y de forma global antes de que el runtime los procese.
 *
 * X-Powered-By: Astro no lo emite por defecto. El header de Node/Express
 * tampoco aplica en Vercel Serverless Functions — queda suprimido
 * automáticamente. No es necesario configurarlo explícitamente.
 */
const SECURITY_HEADERS = {
  'X-Frame-Options':           'DENY',
  'X-Content-Type-Options':    'nosniff',
  'Referrer-Policy':           'strict-origin-when-cross-origin',
  'Permissions-Policy':        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  /**
   * Content-Security-Policy — adaptada para:
   *   · Supabase Auth (REST + Realtime WebSocket): zgvfcqmuqlapmoukrdps.supabase.co
   *   · Google Fonts: fonts.googleapis.com + fonts.gstatic.com
   *   · Vercel Live (preview feedback widget): vercel.live
   *   · Imágenes en Supabase Storage y blobs locales
   *   · Scripts inline de Astro (is:inline, anti-flicker theme, etc.)
   *
   * Nota sobre 'unsafe-inline' en script-src:
   *   Astro inyecta scripts inline en SSR (ej: hidration, theme scripts con is:inline).
   *   Para eliminar 'unsafe-inline' en el futuro se requiere implementar
   *   nonces por petición, lo cual es compatible con el adapter Vercel Serverless
   *   pero requiere un refactor del middleware. Dejar como tarea de hardening v2.
   */
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co https://870tivo-web.vercel.app",
    "connect-src 'self' https://zgvfcqmuqlapmoukrdps.supabase.co wss://zgvfcqmuqlapmoukrdps.supabase.co https://*.supabase.co wss://*.supabase.co https://vercel.live",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
};

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [tailwind(), react()],

  vite: {
    server: {
      watch: {
        ignored: ['**/skills/**'],
      },
      // Inyectar los headers de seguridad en el servidor de desarrollo local
      headers: SECURITY_HEADERS,
    },
  },
});
