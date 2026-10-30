import type { APIRoute } from 'astro';
import { supabaseAdmin, supabase } from '../../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/admin/profile/update
 * Actualiza los datos de perfil (full_name y avatar_url) en public.profiles y user_metadata.
 */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    // 1. Obtener usuario autenticado desde locals o tokens de sesión
    let currentUser = locals.user;

    if (!currentUser) {
      const accessToken = cookies.get('sb-access-token')?.value || 
        request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

      if (accessToken) {
        const { data: authData } = await supabase.auth.getUser(accessToken);
        currentUser = authData?.user || null;
      }
    }

    if (!currentUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sesión no válida o no autenticada.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { full_name, avatar_url } = body;

    const trimmedName = typeof full_name === 'string' ? full_name.trim() : null;
    const cleanAvatarUrl = typeof avatar_url === 'string' && avatar_url.trim() ? avatar_url.trim() : null;

    // 2. Actualizar metadatos en Supabase Auth (auth.users)
    const metadataUpdate: Record<string, any> = {};
    if (trimmedName !== null) metadataUpdate.full_name = trimmedName;
    if (cleanAvatarUrl !== null) metadataUpdate.avatar_url = cleanAvatarUrl;

    if (Object.keys(metadataUpdate).length > 0) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(currentUser.id, {
          user_metadata: {
            ...currentUser.user_metadata,
            ...metadataUpdate,
          },
        });
      } catch (authErr) {
        console.warn('Advertencia al actualizar user_metadata en auth.users:', authErr);
      }
    }

    // 3. Actualizar o crear fila en public.profiles
    const now = new Date().toISOString();
    
    // Primero intentamos actualizar con avatar_url si la columna existe
    const profilePayloadWithAvatar: Record<string, any> = {
      id: currentUser.id,
      updated_at: now,
    };
    if (trimmedName !== null) profilePayloadWithAvatar.full_name = trimmedName;
    if (cleanAvatarUrl !== null) profilePayloadWithAvatar.avatar_url = cleanAvatarUrl;

    const { data: updatedProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayloadWithAvatar, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (profileErr) {
      // Si el error es PGRST204 (columna avatar_url no existe en profiles), intentamos guardar solo full_name
      if (profileErr.code === 'PGRST204' || profileErr.message?.includes('avatar_url')) {
        const fallbackPayload: Record<string, any> = {
          id: currentUser.id,
          updated_at: now,
        };
        if (trimmedName !== null) fallbackPayload.full_name = trimmedName;

        const { data: fallbackData, error: fallbackErr } = await supabaseAdmin
          .from('profiles')
          .upsert(fallbackPayload, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (fallbackErr) {
          console.error('Error al actualizar public.profiles (fallback):', fallbackErr);
          throw fallbackErr;
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Perfil actualizado exitosamente.',
            profile: {
              ...fallbackData,
              avatar_url: cleanAvatarUrl,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        console.error('Error al actualizar public.profiles:', profileErr);
        throw profileErr;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Perfil actualizado exitosamente.',
        profile: updatedProfile || {
          id: currentUser.id,
          full_name: trimmedName,
          avatar_url: cleanAvatarUrl,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en POST /api/admin/profile/update:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Error interno al actualizar el perfil de usuario.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
