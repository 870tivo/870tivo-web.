import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isUserAdminOrHasAccess } from '../../../../lib/auth';

export const prerender = false;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/users/invite
 * Envía una invitación por correo a un nuevo usuario vía Supabase Auth Admin,
 * guarda first_name y last_name en user_metadata y public.profiles,
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

    const { email, roleId, first_name, last_name, full_name } = body || {};

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

    // Validar y normalizar first_name y last_name
    let firstName = typeof first_name === 'string' ? first_name.trim() : '';
    let lastName = typeof last_name === 'string' ? last_name.trim() : '';

    // Compatibilidad: si se envía full_name en lugar de first_name/last_name
    if (!firstName && !lastName && typeof full_name === 'string' && full_name.trim()) {
      const parts = full_name.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    const combinedFullName = [firstName, lastName].filter(Boolean).join(' ');

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

      // Validación de seguridad estricta: Solo un Super Administrador puede invitar usuarios con rol Super Administrador
      const requesterIsSuperAdmin = Boolean(locals.isSuperAdmin || locals.role?.name === 'Super Administrador');
      if (targetRole.name === 'Super Administrador' && !requesterIsSuperAdmin) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Acceso denegado: Solo un Super Administrador puede invitar usuarios con el rol de Super Administrador.' 
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Ejecutar invitación vía Supabase Auth Admin (Service Role)
    const siteUrl = (import.meta.env.PUBLIC_SITE_URL as string) || 'https://870tivo-web.vercel.app';
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    let origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;
    if (import.meta.env.PROD && (origin.includes('localhost') || origin.startsWith('http://'))) {
      origin = siteUrl;
    }
    const redirectTo = import.meta.env.PROD 
      ? 'https://870tivo-web.vercel.app/admin/setup-profile' 
      : `${origin}/admin/setup-profile`;

    const userMetadata: Record<string, any> = {
      first_name: firstName,
      last_name: lastName,
    };
    if (combinedFullName) {
      userMetadata.full_name = combinedFullName;
      userMetadata.name = combinedFullName;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo,
        data: userMetadata,
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

    // 5. Inicializar o sincronizar el perfil en public.profiles con first_name y last_name
    const { error: profileInitErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: invitedUser.id,
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileInitErr) {
      console.warn('Aviso al inicializar perfil en public.profiles para usuario invitado:', profileInitErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitación enviada exitosamente a ${normalizedEmail}`,
        user: {
          id: invitedUser.id,
          email: normalizedEmail,
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: combinedFullName || null,
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
