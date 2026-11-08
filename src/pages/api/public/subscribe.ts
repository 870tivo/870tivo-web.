import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// ── Configuración de rate limiting en memoria ────────────────────────────────
// Límite conservador: 3 intentos por IP cada 10 minutos.
// Para escalar a multi-región, reemplazar por Vercel KV / Upstash Redis.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000; // 10 minutos

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const ipStore = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipStore.get(ip);

  // Limpiar entradas expiradas periódicamente (cada llamada)
  if (ipStore.size > 500) {
    for (const [key, val] of ipStore.entries()) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) ipStore.delete(key);
    }
  }

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Primera solicitud de esta IP en la ventana actual
    ipStore.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  entry.count++;
  return true;
}

// ── Validación de email ──────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 320;
}

// ── Helpers de respuesta ─────────────────────────────────────────────────────
function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Endpoint ─────────────────────────────────────────────────────────────────

/**
 * POST /api/public/subscribe
 *
 * Registra un correo electrónico en la tabla `email_subscribers`.
 * - No requiere autenticación de usuario.
 * - Usa el cliente `supabase` (anon key) con RLS de INSERT habilitado en la tabla.
 * - Devuelve 409 si el correo ya estaba registrado (upsert semántico vía UNIQUE).
 * - Incluye rate limiting por IP: máx. 3 intentos cada 10 minutos.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  // ── 1. Rate limiting por IP ──────────────────────────────────────────────
  const ip = clientAddress ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return json(
      { success: false, message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
      429
    );
  }

  // ── 2. Parseo y validación del body ─────────────────────────────────────
  let email: string;

  try {
    const body = await request.json() as Record<string, unknown>;
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return json({ success: false, message: 'Cuerpo de solicitud inválido.' }, 400);
  }

  if (!email || !isValidEmail(email)) {
    return json({ success: false, message: 'Por favor ingresa un correo válido.' }, 400);
  }

  // ── 3. Inserción en Supabase ─────────────────────────────────────────────
  // Usamos anon key (supabase) ya que la tabla tiene RLS con política de INSERT público.
  // No usamos upsert para distinguir entre registro nuevo y duplicado.
  const { error } = await supabase
    .from('email_subscribers')
    .insert({ email });

  if (error) {
    // Código PostgreSQL 23505 = unique_violation (email duplicado)
    if (error.code === '23505') {
      return json(
        { success: false, message: 'Este correo ya está en la lista.' },
        409
      );
    }

    console.error('[subscribe] Error de Supabase:', error.message);
    return json(
      { success: false, message: 'No pudimos registrar el correo. Intenta de nuevo más tarde.' },
      500
    );
  }

  return json(
    { success: true, message: 'Registro exitoso. Te avisamos en cada nueva publicación.' },
    201
  );
};

