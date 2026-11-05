import type { APIRoute } from 'astro';
import { supabaseAdmin, supabase } from '../../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/admin/profile/update
 * Actualiza los datos de perfil (first_name, last_name y avatar_url) en public.profiles y user_metadata.
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
    let { first_name, last_name, full_name, avatar_url } = body || {};

    let trimmedFirstName = typeof first_name === 'string' ? first_name.trim() : null;
    let trimmedLastName = typeof last_name === 'string' ? last_name.trim() : null;

    // Soporte de compatibilidad: Si se envía full_name pero no first_name/last_name
    if (trimmedFirstName === null && trimmedLastName === null && typeof full_name === 'string' && full_name.trim()) {
      const parts = full_name.trim().split(/\s+/);
      trimmedFirstName = parts[0] || '';
      trimmedLastName = parts.slice(1).join(' ') || '';
    }

    const cleanAvatarUrl = typeof avatar_url === 'string' && avatar_url.trim() ? avatar_url.trim() : null;

    // Validar que al menos un campo se esté actualizando
    if (trimmedFirstName === null && trimmedLastName === null && cleanAvatarUrl === null) {
      return new Response(
        JSON.stringify({ success: false, message: 'No se enviaron datos para actualizar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const combinedName = [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ');

    // 2. Actualizar metadatos en Supabase Auth (auth.users)
    const metadataUpdate: Record<string, any> = {};
    if (trimmedFirstName !== null) metadataUpdate.first_name = trimmedFirstName;
    if (trimmedLastName !== null) metadataUpdate.last_name = trimmedLastName;
    if (combinedName) {
      metadataUpdate.full_name = combinedName;
      metadataUpdate.name = combinedName;
    }
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
    
    const profilePayload: Record<string, any> = {
      id: currentUser.id,
      updated_at: now,
    };
    if (trimmedFirstName !== null) profilePayload.first_name = trimmedFirstName;
    if (trimmedLastName !== null) profilePayload.last_name = trimmedLastName;
    if (cleanAvatarUrl !== null) profilePayload.avatar_url = cleanAvatarUrl;

    const { data: updatedProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (profileErr) {
      console.error('Error al actualizar public.profiles:', profileErr);
      throw profileErr;
    }

    const finalFirstName = updatedProfile?.first_name ?? trimmedFirstName ?? '';
    const finalLastName = updatedProfile?.last_name ?? trimmedLastName ?? '';
    const finalFullName = [finalFirstName, finalLastName].filter(Boolean).join(' ');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Perfil actualizado exitosamente.',
        profile: {
          id: currentUser.id,
          first_name: finalFirstName,
          last_name: finalLastName,
          full_name: finalFullName,
          avatar_url: updatedProfile?.avatar_url ?? cleanAvatarUrl,
          updated_at: updatedProfile?.updated_at || now,
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
