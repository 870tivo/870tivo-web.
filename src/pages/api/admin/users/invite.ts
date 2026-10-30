import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isUserAdminOrHasAccess } from '../../../../lib/auth';

export const prerender = false;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/users/invite
 * Envía una invitación por correo a un nuevo usuario vía Supabase Auth Admin
 * y le asigna el rol inicial seleccionado en 'public.user_roles'.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ success: false, message: 'No autenticado.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isUserAdminOrHasAccess(locals.role, locals.permissions)) {
    return new Response(JSON.stringify({ success: false, message: 'Acceso denegado: Privilegios de administrador requeridos.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: 'Cuerpo de solicitud inválido (JSON esperado).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email, roleId } = body || {};

    // 1. Validar correo electrónico
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Por favor, proporciona un correo electrónico válido.' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Si se proporcionó un rol, validar que exista en el catálogo de roles
    let targetRole: { id: string; name: string } | null = null;
    if (roleId && typeof roleId === 'string' && roleId.trim() !== '') {
      const { data: roleData, error: roleErr } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .eq('id', roleId.trim())
        .maybeSingle();

      if (roleErr || !roleData) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'El rol seleccionado no es válido o no existe en el catálogo.' 
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      targetRole = roleData;
    }

    // 3. Ejecutar invitación vía Supabase Auth Admin (Service Role)
    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/admin/reset-password`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo,
      }
    );

    if (authError) {
      console.error('Error al invitar usuario en Supabase Auth:', authError);

      const errorMsgLower = (authError.message || '').toLowerCase();
      const isAlreadyRegistered = 
        errorMsgLower.includes('already been registered') ||
        errorMsgLower.includes('already exists') ||
        errorMsgLower.includes('unique constraint') ||
        authError.status === 422;

      if (isAlreadyRegistered) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `El usuario con el correo «${normalizedEmail}» ya se encuentra registrado en el sistema.`,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: authError.message || 'Error al enviar la invitación por correo.',
        }),
        { status: authError.status || 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const invitedUser = authData?.user;
    if (!invitedUser || !invitedUser.id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No se pudo obtener el identificador del usuario invitado.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Asignar rol inicial en public.user_roles si fue especificado
    if (targetRole) {
      // Eliminar cualquier posible asignación residual previa por seguridad
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', invitedUser.id);

      const { error: insertRoleErr } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: invitedUser.id,
          role_id: targetRole.id,
          assigned_at: new Date().toISOString(),
        });

      if (insertRoleErr) {
        console.error('Error asignando rol inicial al usuario invitado:', insertRoleErr);
        return new Response(
          JSON.stringify({
            success: false,
            message: `Invitación enviada a ${normalizedEmail}, pero falló la asignación del rol «${targetRole.name}»: ${insertRoleErr.message}`,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitación enviada exitosamente a ${normalizedEmail}`,
        user: {
          id: invitedUser.id,
          email: normalizedEmail,
          roleId: targetRole?.id || null,
          roleName: targetRole?.name || null,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error inesperado en endpoint de invitación:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Error interno del servidor al procesar la invitación.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
