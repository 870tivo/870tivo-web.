import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isUserAdminOrHasAccess } from '../../../../lib/auth';

export const prerender = false;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/users/resend-invite
 * Reenvía la invitación por correo a un usuario pendiente vía Supabase Auth Admin.
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

    const { email } = body || {};

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

    // Determinar URL de redirección
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

    // 1. Intentar reenviar invitación oficial vía inviteUserByEmail
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo }
    );

    if (inviteError) {
      console.warn('inviteUserByEmail retornó error al reenviar:', inviteError.message);
      
      // Si el usuario ya existe en auth pero no ha completado activación, podemos generar enlace o verificar
      const errorMsgLower = (inviteError.message || '').toLowerCase();
      const isAlreadyRegistered = 
        errorMsgLower.includes('already been registered') ||
        errorMsgLower.includes('already exists') ||
        inviteError.status === 422;

      if (isAlreadyRegistered) {
        // Intentar generar link de recuperación/invitación para reenvío
        const { error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email: normalizedEmail,
          options: { redirectTo },
        });

        if (linkErr) {
          // Si el tipo invite ya no aplica porque confirmó email, intentamos magiclink
          const { error: magicErr } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: normalizedEmail,
            options: { redirectTo },
          });

          if (magicErr) {
            return new Response(
              JSON.stringify({
                success: false,
                message: `No se pudo reenviar la invitación: ${inviteError.message}`,
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            message: inviteError.message || 'Error al reenviar la invitación por correo.',
          }),
          { status: inviteError.status || 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitación reenviada exitosamente a ${normalizedEmail}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error inesperado al reenviar invitación:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Error interno del servidor al procesar el reenvío.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
