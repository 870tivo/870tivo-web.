/**
 * src/pages/api/admin/profile/me.ts
 * GET /api/admin/profile/me
 * Devuelve { full_name, email } del usuario autenticado para sincronizar el header del admin.
 * El middleware ya valida la sesión antes de llegar aquí.
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;

  if (!user?.id) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // full_name from middleware locals (already resolved)
  const fullNameFromLocals = locals.userFullName || '';

  // Also fetch email from auth user
  const email = user.email || '';

  // Try to get fresh full_name from DB if locals didn't have it
  let full_name = fullNameFromLocals;

  if (!full_name) {
    try {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      full_name = data?.full_name || user.user_metadata?.full_name || email.split('@')[0] || '';
    } catch {
      full_name = user.user_metadata?.full_name || email.split('@')[0] || '';
    }
  }

  return new Response(
    JSON.stringify({ success: true, full_name, email }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
