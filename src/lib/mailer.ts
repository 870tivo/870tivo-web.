import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export const DEFAULT_SITE_URL = 'https://870tivo-web.vercel.app';
export const DEFAULT_GMAIL_USER = '870colectivo@gmail.com';

function readEnv(key: string): string | undefined {
  const metaEnv =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env as Record<string, string | undefined>)[key]
      : undefined;
  const procEnv =
    typeof process !== 'undefined' && process.env
      ? process.env[key]
      : undefined;
  const value = metaEnv || procEnv;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Resuelve la URL pública del sitio usando PUBLIC_SITE_URL con fallback a producción.
 */
export function getSiteUrl(): string {
  const raw = readEnv('PUBLIC_SITE_URL') || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}

/**
 * Obtiene las credenciales SMTP de Gmail desde las variables de entorno.
 */
export function getGmailCredentials(): { user: string; pass: string | undefined } {
  const user = readEnv('GMAIL_USER') || DEFAULT_GMAIL_USER;
  const pass = readEnv('GMAIL_APP_PASSWORD');
  return { user, pass };
}

/**
 * Crea el transporte de Nodemailer configurado para Gmail SMTP.
 * Retorna null si falta configurar GMAIL_APP_PASSWORD.
 */
export function createGmailTransporter(): Transporter | null {
  const { user, pass } = getGmailCredentials();
  if (!pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
}

