import type { APIRoute } from 'astro';
import { supabaseAdmin, supabase } from '../../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/admin/profile/change-password
 * Actualiza la contraseña del usuario autenticado.
 */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    // 1. Obtener usuario autenticado
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
        JSON.stringify({ success: false, message: 'Sesión no válida o expirada. Inicia sesión nuevamente.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { password, confirmPassword } = body;

    // 2. Validaciones de contraseña
    if (!password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'La nueva contraseña es obligatoria.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: 'La contraseña debe contener al menos 6 caracteres.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return new Response(
        JSON.stringify({ success: false, message: 'Las contraseñas ingresadas no coinciden.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Actualizar contraseña del usuario en Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(currentUser.id, {
      password: password,
    });

    if (error) {
      console.error('Error al actualizar contraseña con supabaseAdmin:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message || 'Error al actualizar la contraseña.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contraseña actualizada correctamente.',
        userId: data.user.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en POST /api/admin/profile/change-password:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Error interno del servidor al procesar el cambio de contraseña.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
