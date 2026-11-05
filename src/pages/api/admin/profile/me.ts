/**
 * src/pages/api/admin/profile/me.ts
 * GET /api/admin/profile/me
 * Devuelve { first_name, last_name, full_name, email, avatar_url } del usuario autenticado
 * para sincronizar el header y estado del perfil en la interfaz de administración.
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

  const email = user.email || '';

  let firstName = locals.userFirstName || '';
  let lastName = locals.userLastName || '';
  let avatarUrl = (user.user_metadata?.avatar_url as string) || null;

  // Si locals no tenía first_name / last_name, consultar public.profiles
  if (!firstName && !lastName) {
    try {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        firstName = data.first_name || '';
        lastName = data.last_name || '';
        if (data.avatar_url) avatarUrl = data.avatar_url;
      }
    } catch (e) {
      console.warn('Error consultando perfil en me.ts:', e);
    }
  }

  // Fallback con metadatos de usuario si aún están vacíos
  if (!firstName && !lastName) {
    firstName = (user.user_metadata?.first_name as string) || '';
    lastName = (user.user_metadata?.last_name as string) || '';

    // Si había un full_name guardado en user_metadata, dividirlo
    if (!firstName && !lastName && user.user_metadata?.full_name) {
      const parts = (user.user_metadata.full_name as string).trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }

  const full_name = [firstName, lastName].filter(Boolean).join(' ') || locals.userFullName || email.split('@')[0] || '';

  return new Response(
    JSON.stringify({
      success: true,
      first_name: firstName,
      last_name: lastName,
      full_name,
      email,
      avatar_url: avatarUrl,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
