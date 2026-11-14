import type { APIRoute } from 'astro';
import { supabase, supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/admin/auth/logout
 *
 * Endpoint SSR para cerrar sesión de administración de forma segura.
 * 1. Revoca la sesión directamente en Supabase Auth usando el access token actual
 *    para invalidar el JWT de inmediato en el backend.
 * 2. Elimina las cookies `sb-access-token` y `sb-refresh-token` en la respuesta HTTP.
 */
export const POST: APIRoute = async ({ cookies }) => {
  const accessToken = cookies.get('sb-access-token')?.value;

  // 1. Revocar la sesión directamente en el servidor de Supabase
  if (accessToken) {
    try {
      await supabaseAdmin.auth.admin.signOut(accessToken);
    } catch (err) {
      console.warn('[logout endpoint] Aviso al revocar sesión con admin.signOut:', err);
      try {
        await supabase.auth.signOut();
      } catch {
        // Fallback no crítico
      }
    }
  } else {
    try {
      await supabase.auth.signOut();
    } catch {
      // Token ausente o ya expirado
    }
  }

  // 2. Limpieza de cookies de sesión en la respuesta HTTP
  cookies.delete('sb-access-token', { path: '/' });
  cookies.delete('sb-refresh-token', { path: '/' });

  return new Response(
    JSON.stringify({ success: true, message: 'Sesión cerrada correctamente.' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
