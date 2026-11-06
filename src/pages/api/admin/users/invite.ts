import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isUserAdminOrHasAccess } from '../../../../lib/auth';

export const prerender = false;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Función auxiliar para estandarizar las respuestas JSON
 */
function jsonResponse(
  body: { success: boolean; message: string; code?: string; [key: string]: any },
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Mapeo y traducción organizada de errores generados por Supabase Auth
 */
function parseSupabaseAuthError(authError: any, email: string): { message: string; status: number; code: string } {
  const errorMsgLower = (authError?.message || '').toLowerCase();
  const rawStatus = authError?.status;

  // 1. Usuario ya registrado o duplicado
  if (
    errorMsgLower.includes('already been registered') ||
    errorMsgLower.includes('already exists') ||
    errorMsgLower.includes('unique constraint') ||
    rawStatus === 422
  ) {
    return {
      code: 'USER_ALREADY_REGISTERED',
      status: 409,
      message: `El usuario con el correo «${email}» ya se encuentra registrado en el sistema.`,
    };
  }

  // 2. Error en base de datos de Supabase (común en triggers como handle_new_user)
  if (
    errorMsgLower.includes('database error saving new user') ||
    errorMsgLower.includes('database error creating new user')
  ) {
    return {
      code: 'DATABASE_TRIGGER_ERROR',
      status: 500,
      message:
        'Error en la base de datos de Supabase al registrar el usuario. Asegúrate de haber ejecutado el script "scripts/fix-invite-and-profiles-trigger.sql" en el SQL Editor de Supabase.',
    };
  }

  // 3. Límite de tasa de solicitudes (Rate Limit / Throttling)
  if (
    errorMsgLower.includes('rate limit') ||
    errorMsgLower.includes('too many requests') ||
    rawStatus === 429
  ) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      message: 'Se ha excedido el límite de envíos de invitaciones. Por favor, espera unos minutos antes de intentar de nuevo.',
    };
  }

  // 4. Formato de correo inválido detectado por el servidor Auth
  if (errorMsgLower.includes('invalid') && errorMsgLower.includes('email')) {
    return {
      code: 'INVALID_EMAIL_FORMAT',
      status: 400,
      message: 'El servidor de autenticación rechazó el formato de la dirección de correo proporcionada.',
    };
  }

  // 5. Error en el proveedor de correo / SMTP
  if (
    errorMsgLower.includes('smtp') ||
    errorMsgLower.includes('mail') ||
    errorMsgLower.includes('transport')
  ) {
    return {
      code: 'SMTP_PROVIDER_ERROR',
      status: 502,
      message: 'Error en el servidor de correo al enviar la invitación. Verifica la configuración SMTP en el panel de Supabase.',
    };
  }

  // 6. Registro deshabilitado
  if (errorMsgLower.includes('signup') && errorMsgLower.includes('disabled')) {
    return {
      code: 'SIGNUP_DISABLED',
      status: 403,
      message: 'El registro e invitación de nuevos colaboradores está deshabilitado en la configuración del proyecto Supabase.',
    };
  }

  // Error genérico con mensaje original o fallback amigable
  return {
    code: 'AUTH_INVITE_ERROR',
    status: rawStatus && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 400,
    message: authError?.message || 'Ocurrió un error al enviar el correo de invitación.',
  };
}

/**
 * POST /api/admin/users/invite
 * 
 * Flujo de ejecución:
 * 1. Validación de sesión y privilegios de administrador.
 * 2. Validación y sanitización del cuerpo de la petición (correo y rol).
 * 3. Validación de permisos de jerarquía (solo Super Admin puede invitar Super Admin).
 * 4. Envío de la invitación mediante Supabase Auth Admin (Service Role).
 * 5. Asignación del rol inicial en la tabla 'public.user_roles'.
 * 6. Inicialización de registro base en 'public.profiles'.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Control de autenticación
  if (!locals.user) {
    return jsonResponse(
      { success: false, code: 'UNAUTHORIZED', message: 'No autenticado. Por favor, inicia sesión para continuar.' },
      401
    );
  }

  // 2. Control de autorización de administrador
  if (!isUserAdminOrHasAccess(locals.role, locals.permissions)) {
    return jsonResponse(
      { success: false, code: 'FORBIDDEN', message: 'Acceso denegado: Se requieren privilegios de administrador.' },
      403
    );
  }

  try {
    // 3. Procesar y parsear el payload JSON
    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { success: false, code: 'BAD_REQUEST', message: 'Cuerpo de solicitud inválido (se esperaba un formato JSON válido).' },
        400
      );
    }

    const { email, roleId } = body || {};

    // 4. Validar formato de correo electrónico
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return jsonResponse(
        { success: false, code: 'INVALID_EMAIL', message: 'Por favor, proporciona una dirección de correo electrónico válida.' },
        400
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 5. Validar existencia del rol (si fue seleccionado)
    let targetRole: { id: string; name: string } | null = null;
    if (roleId && typeof roleId === 'string' && roleId.trim() !== '') {
      const { data: roleData, error: roleErr } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .eq('id', roleId.trim())
        .maybeSingle();

      if (roleErr || !roleData) {
        return jsonResponse(
          { success: false, code: 'ROLE_NOT_FOUND', message: 'El rol seleccionado no es válido o no existe en el catálogo.' },
          404
        );
      }
      targetRole = roleData;

      // Validación estricta: Solo un Super Administrador puede invitar a otro Super Administrador
      const requesterIsSuperAdmin = Boolean(locals.isSuperAdmin || locals.role?.name === 'Super Administrador');
      if (targetRole.name === 'Super Administrador' && !requesterIsSuperAdmin) {
        return jsonResponse(
          {
            success: false,
            code: 'FORBIDDEN_ROLE_ASSIGNMENT',
            message: 'Acceso denegado: Solo un Super Administrador puede invitar colaboradores con el rol de Super Administrador.',
          },
          403
        );
      }
    }

    // 6. Configurar la URL de redirección hacia la ruta secreta de activación
    const siteUrl = (import.meta.env.PUBLIC_SITE_URL as string) || 'https://870tivo-web.vercel.app';
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    let origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;
    if (import.meta.env.PROD && (origin.includes('localhost') || origin.startsWith('http://'))) {
      origin = siteUrl;
    }
    const redirectTo = import.meta.env.PROD 
      ? 'https://870tivo-web.vercel.app/2416f50b-da02-4a5b-86a8-61ae470ed3bd/setup-profile' 
      : `${origin}/2416f50b-da02-4a5b-86a8-61ae470ed3bd/setup-profile`;

    // 7. Enviar la invitación con Supabase Auth Admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo }
    );

    if (authError) {
      console.error('Error al invitar usuario en Supabase Auth:', authError);
      const parsedError = parseSupabaseAuthError(authError, normalizedEmail);
      return jsonResponse(
        { success: false, code: parsedError.code, message: parsedError.message },
        parsedError.status
      );
    }

    const invitedUser = authData?.user;
    if (!invitedUser || !invitedUser.id) {
      return jsonResponse(
        {
          success: false,
          code: 'AUTH_USER_MISSING',
          message: 'No se pudo obtener el identificador del usuario creado por Supabase Auth.',
        },
        500
      );
    }

    // 8. Asignar rol inicial en la tabla public.user_roles
    if (targetRole) {
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
        return jsonResponse(
          {
            success: false,
            code: 'ROLE_ASSIGNMENT_FAILED',
            message: `Invitación enviada a ${normalizedEmail}, pero falló la asignación del rol «${targetRole.name}»: ${insertRoleErr.message}`,
          },
          500
        );
      }
    }

    // 9. Inicializar fila básica en public.profiles para el nuevo usuario
    const { error: profileInitErr } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: invitedUser.id,
          first_name: '',
          last_name: '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (profileInitErr) {
      console.warn('Aviso no crítico al inicializar perfil en public.profiles:', profileInitErr.message);
    }

    // 10. Respuesta exitosa
    return jsonResponse(
      {
        success: true,
        message: `Invitación enviada exitosamente a ${normalizedEmail}`,
        user: {
          id: invitedUser.id,
          email: normalizedEmail,
          roleId: targetRole?.id || null,
          roleName: targetRole?.name || null,
        },
      },
      200
    );
  } catch (err: any) {
    console.error('Error inesperado en endpoint de invitación:', err);
    return jsonResponse(
      {
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || 'Error interno del servidor al procesar la invitación.',
      },
      500
    );
  }
};
