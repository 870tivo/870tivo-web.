import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { check, recordFailure, resetOnSuccess } from '../../../../lib/rateLimiter';

export const prerender = false;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Respuesta JSON estandarizada, coherente con el resto de endpoints del proyecto.
 */
function jsonResponse(
  body: { success: boolean; message: string; code?: string; [key: string]: unknown },
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Genera el mensaje de error progresivo según el número de intento fallido.
 *
 *   - Intentos 1–2  → Mensaje neutral.
 *   - Intentos 3–4  → Advertencia crítica con contador regresivo.
 *   - Intento  5+   → Bloqueo total activado.
 */
function buildFailureMessage(failureCount: number, attemptsLeft: number): string {
  if (failureCount <= 2) {
    return 'Credenciales incorrectas. Verifica tus datos e intenta de nuevo.';
  }
  if (failureCount <= 4) {
    const plural = attemptsLeft === 1 ? 'intento' : 'intentos';
    return `Credenciales incorrectas. Atención: te quedan ${attemptsLeft} ${plural} antes de que tu acceso sea bloqueado por 30 minutos.`;
  }
  // failureCount >= 5 → bloqueo activado
  return 'Demasiados intentos fallidos. Tu acceso ha sido bloqueado temporalmente por 30 minutos.';
}

// ─── Endpoint ────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/auth/login
 *
 * Endpoint SSR de autenticación para el panel administrativo.
 * Implementa rate limiting progresivo antes de delegar en Supabase Auth.
 *
 * Flujo:
 *   1. Parsear y validar el body JSON (email + password).
 *   2. Consultar el rate limiter → rechazar inmediatamente si está bloqueado.
 *   3. Intentar signInWithPassword en Supabase Auth.
 *   4a. Si falla → recordar el fallo, devolver mensaje progresivo.
 *   4b. Si ok   → resetear el contador, devolver tokens de sesión.
 */
export const POST: APIRoute = async ({ request }) => {
  // ── 1. Parsear body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { success: false, code: 'BAD_REQUEST', message: 'Cuerpo de solicitud inválido (se esperaba JSON).' },
      400
    );
  }

  const { email, password } = (body as Record<string, unknown>) ?? {};

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return jsonResponse(
      { success: false, code: 'INVALID_EMAIL', message: 'Por favor, proporciona un correo electrónico válido.' },
      400
    );
  }

  if (!password || typeof password !== 'string' || password.length < 1) {
    return jsonResponse(
      { success: false, code: 'INVALID_PASSWORD', message: 'Por favor, proporciona una contraseña.' },
      400
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  // ── 2. Rate limiting: consulta previa al intento ───────────────────────────
  const preCheck = check(normalizedEmail);

  if (!preCheck.allowed) {
    // Bloqueo activo — ni intentamos llamar a Supabase
    return jsonResponse(
      {
        success:      false,
        code:         'RATE_LIMIT_BLOCKED',
        message:      'Demasiados intentos fallidos. Tu acceso ha sido bloqueado temporalmente por 30 minutos.',
        blockedUntil: preCheck.blockedUntil,
      },
      429
    );
  }

  // ── 3. Autenticación con Supabase ─────────────────────────────────────────
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email:    normalizedEmail,
      password: password as string,
    });

    // ── 4a. Fallo de autenticación ───────────────────────────────────────────
    if (error || !data.session) {
      // Supabase ya nos bloqueó (rate limit propio del servidor)
      if (error?.status === 429) {
        return jsonResponse(
          {
            success: false,
            code:    'SUPABASE_RATE_LIMIT',
            message: 'Demasiados intentos fallidos. Tu acceso ha sido bloqueado temporalmente por 30 minutos.',
          },
          429
        );
      }

      // Email no confirmado — no penalizamos con rate limiting
      if (error?.message?.toLowerCase().includes('email not confirmed')) {
        return jsonResponse(
          {
            success: false,
            code:    'EMAIL_NOT_CONFIRMED',
            message: 'El correo electrónico aún no ha sido confirmado. Revisa tu bandeja de entrada.',
          },
          403
        );
      }

      // Registrar el intento fallido y obtener el estado actualizado
      const afterFailure = recordFailure(normalizedEmail);

      return jsonResponse(
        {
          success:      false,
          code:         afterFailure.isBlocked ? 'RATE_LIMIT_BLOCKED' : 'INVALID_CREDENTIALS',
          message:      buildFailureMessage(afterFailure.failureCount, afterFailure.attemptsLeft),
          failureCount: afterFailure.failureCount,
          attemptsLeft: afterFailure.attemptsLeft,
          isBlocked:    afterFailure.isBlocked,
          blockedUntil: afterFailure.blockedUntil,
        },
        afterFailure.isBlocked ? 429 : 401
      );
    }

    // ── 4b. Login exitoso ────────────────────────────────────────────────────
    resetOnSuccess(normalizedEmail);

    // El servidor establece las cookies directamente en la respuesta (Opción B).
    // Esto evita que los tokens viajen en el body JSON y los expone al cliente JS.
    //
    // HttpOnly=false es INTENCIONAL: el cliente necesita leer/limpiar estas cookies
    // mediante clearAuthCookies() y para sincronizar el estado de sesión en el navegador.
    // Si se cambiara a HttpOnly=true, el logout y la sincronización del cliente dejarían de funcionar.
    const isProduction = import.meta.env.PROD;
    const securePart = isProduction ? '; Secure' : '';

    const accessCookie = [
      `sb-access-token=${data.session.access_token}`,
      'Path=/',
      `Max-Age=${data.session.expires_in}`,
      'SameSite=Lax',
      'HttpOnly=false',
      securePart,
    ].filter(Boolean).join('; ');

    const refreshCookie = [
      `sb-refresh-token=${data.session.refresh_token}`,
      'Path=/',
      `Max-Age=${60 * 60 * 24 * 7}`, // 7 días
      'SameSite=Lax',
      'HttpOnly=false',
      securePart,
    ].filter(Boolean).join('; ');

    // Se usa Headers + append para poder enviar dos Set-Cookie separados
    // (un objeto literal no permite claves duplicadas).
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', accessCookie);
    headers.append('Set-Cookie', refreshCookie);

    return new Response(
      JSON.stringify({ success: true, message: 'Autenticación exitosa.' }),
      { status: 200, headers }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    console.error('[login endpoint] Error inesperado:', err);
    return jsonResponse(
      { success: false, code: 'INTERNAL_SERVER_ERROR', message },
      500
    );
  }
};
