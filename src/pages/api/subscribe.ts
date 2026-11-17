import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

// ── Rate Limiting en Memoria por IP (3 intentos por IP cada 10 min) ───────────
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const ipStore = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipStore.get(ip);

  // Limpiar memoria si el mapa supera 500 entradas
  if (ipStore.size > 500) {
    for (const [key, val] of ipStore.entries()) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) ipStore.delete(key);
    }
  }

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipStore.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  entry.count++;
  return true;
}

// ── Validación de formato de correo (RFC 5322 compatible regex) ───────────────
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 320;
}

// ── Helper para respuestas JSON ───────────────────────────────────────────────
function jsonResponse(data: { success: boolean; message: string }, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/subscribe
 * Registra un correo para recibir avisos de nuevas publicaciones de 870tivo.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  // 1. Control de frecuencia (Rate Limiting)
  const ip = clientAddress ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return jsonResponse(
      { success: false, message: 'Demasiadas solicitudes. Por favor, intenta de nuevo en unos minutos.' },
      429
    );
  }

  // 2. Parseo del cuerpo de la petición
  let email = '';
  let honeypot = '';

  try {
    const body = (await request.json()) as Record<string, unknown>;
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    // Campo trampa honeypot para capturar bots automáticos
    honeypot = typeof body.hp_token === 'string' ? body.hp_token.trim() : '';
  } catch {
    return jsonResponse({ success: false, message: 'Cuerpo de solicitud inválido.' }, 400);
  }

  // 3. Verificación Honeypot: Rechazo silencioso si el campo trampa fue rellenado
  if (honeypot) {
    // Simulamos respuesta de éxito para no alertar al bot
    return jsonResponse(
      { success: true, message: '¡Te has suscrito correctamente a 870!' },
      200
    );
  }

  // 4. Validación de formato de correo
  if (!email || !isValidEmail(email)) {
    return jsonResponse(
      { success: false, message: 'Por favor, ingresa un correo electrónico válido.' },
      400
    );
  }

  // 5. Inserción en Supabase (tabla email_subscribers)
  // Usamos supabaseAdmin en el servidor para garantizar la inserción confiable
  const { error } = await supabaseAdmin
    .from('email_subscribers')
    .insert({ email, confirmed: true });

  if (error) {
    // Código PostgreSQL 23505: unique_violation (correo ya registrado)
    if (error.code === '23505') {
      return jsonResponse(
        { success: false, message: 'Este correo ya se encuentra en nuestra lista de aviso.' },
        409
      );
    }

    console.error('[API /subscribe] Error en Supabase:', error.message);
    return jsonResponse(
      { success: false, message: 'No pudimos registrar tu correo. Intenta de nuevo más tarde.' },
      500
    );
  }

  return jsonResponse(
    { success: true, message: '¡Te has suscrito correctamente a 870!' },
    201
  );
};
