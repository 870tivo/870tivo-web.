import type { APIRoute } from 'astro';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isUserAdminOrHasAccess } from '../../../../lib/auth';
import { getSiteUrl } from '../../../../lib/mailer';
import { sendInvitationEmail } from '../../../../lib/invitations';

export const prerender = false;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LIST_USERS_PAGES = 10;
const LIST_USERS_PER_PAGE = 100;

function jsonResponse(
  body: { success: boolean; message: string; code?: string; [key: string]: any },
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function findAuthUserByEmail(normalizedEmail: string): Promise<User | null> {
  for (let page = 1; page <= MAX_LIST_USERS_PAGES; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const match = users.find((u) => (u.email || '').trim().toLowerCase() === normalizedEmail);
    if (match) {
      return match;
    }

    if (users.length < LIST_USERS_PER_PAGE) {
      break;
    }
  }

  return null;
}

/**
 * POST /api/admin/users/resend-invite
 * Reenvía la invitación por correo a un usuario pendiente vía Supabase Auth Admin + Nodemailer.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return jsonResponse(
      { success: false, code: 'UNAUTHORIZED', message: 'No autenticado. Por favor, inicia sesión.' },
      401
    );
  }

  if (!isUserAdminOrHasAccess(locals.role, locals.permissions)) {
    return jsonResponse(
      {
        success: false,
        code: 'FORBIDDEN',
        message: 'Acceso denegado: Privilegios de administrador requeridos.',
      },
      403
    );
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { success: false, code: 'BAD_REQUEST', message: 'Cuerpo de solicitud inválido (JSON esperado).' },
        400
      );
    }

    const { id, userId, email } = body || {};
    const targetUserId =
      typeof userId === 'string' && userId.trim()
        ? userId.trim()
        : typeof id === 'string' && id.trim()
          ? id.trim()
          : '';
    const rawEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (rawEmail && !EMAIL_REGEX.test(rawEmail)) {
      return jsonResponse(
        { success: false, code: 'INVALID_EMAIL', message: 'Por favor, proporciona un correo electrónico válido.' },
        400
      );
    }

    if (!targetUserId && !rawEmail) {
      return jsonResponse(
        {
          success: false,
          code: 'BAD_REQUEST',
          message: 'Debes proporcionar el identificador del usuario o un correo electrónico válido.',
        },
        400
      );
    }

    // 1. Buscar al usuario en Supabase Auth
    let targetUser: User | null = null;
    if (targetUserId) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (userErr && userErr.status !== 404) {
        console.error('[ResendInvite] Error consultando usuario por ID:', userErr);
        return jsonResponse(
          { success: false, code: 'AUTH_LOOKUP_FAILED', message: 'Error al consultar el usuario en Supabase Auth.' },
          500
        );
      }
      if (userData?.user) {
        if (rawEmail && (userData.user.email || '').trim().toLowerCase() !== rawEmail) {
          return jsonResponse(
            {
              success: false,
              code: 'USER_NOT_FOUND',
              message: 'El identificador y el correo electrónico no coinciden con ningún usuario registrado.',
            },
            404
          );
        }
        targetUser = userData.user;
      }
    } else if (rawEmail) {
      targetUser = await findAuthUserByEmail(rawEmail);
    }

    if (!targetUser || !targetUser.email) {
      return jsonResponse(
        {
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'No se encontró ningún usuario invitado con ese correo o identificador.',
        },
        404
      );
    }

    const targetEmail = targetUser.email.trim().toLowerCase();

    // 2. Verificar en public.profiles y user_metadata que la invitación siga pendiente
    const { data: profileRow, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', targetUser.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('[ResendInvite] Aviso al consultar perfil:', profileErr.message);
    }

    const userMeta = (targetUser.user_metadata || {}) as Record<string, any>;
    const firstName = (profileRow?.first_name || userMeta.first_name || '').trim();
    const lastName = (profileRow?.last_name || userMeta.last_name || '').trim();
    const combinedFullName =
      [firstName, lastName].filter(Boolean).join(' ') ||
      (typeof userMeta.full_name === 'string' ? userMeta.full_name.trim() : '') ||
      (typeof userMeta.name === 'string' ? userMeta.name.trim() : '');

    if (combinedFullName) {
      return jsonResponse(
        {
          success: false,
          code: 'INVITATION_ALREADY_ACCEPTED',
          message: 'Este usuario ya completó la activación de su cuenta y no tiene una invitación pendiente.',
        },
        409
      );
    }

    // 3. Consultar rol asignado (opcional)
    let roleName: string | null = null;
    try {
      const { data: userRoleRow } = await supabaseAdmin
        .from('user_roles')
        .select('role_id, roles(id, name)')
        .eq('user_id', targetUser.id)
        .maybeSingle();

      if (userRoleRow?.roles) {
        const roleData = Array.isArray(userRoleRow.roles) ? userRoleRow.roles[0] : userRoleRow.roles;
        roleName = roleData?.name || null;
      }
    } catch (roleLookupErr) {
      console.warn('[ResendInvite] No se pudo consultar el rol del usuario invitado:', roleLookupErr);
    }

    // 4. Generar enlace nuevo y renovar vigencia usando PUBLIC_SITE_URL
    const redirectTo = `${getSiteUrl()}/2416f50b-da02-4a5b-86a8-61ae470ed3bd/setup-profile`;
    const linkTypes: Array<'invite' | 'magiclink' | 'recovery'> = !targetUser.email_confirmed_at
      ? ['invite', 'magiclink', 'recovery']
      : ['magiclink', 'recovery'];

    let actionLink: string | null = null;
    let lastLinkError: string | null = null;

    for (const type of linkTypes) {
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type,
        email: targetEmail,
        options: { redirectTo },
      });

      if (!linkErr && linkData?.properties?.action_link) {
        actionLink = linkData.properties.action_link;
        break;
      }

      lastLinkError = linkErr?.message || 'No se recibió action_link de Supabase Auth.';
      console.warn(`[ResendInvite] generateLink(${type}) falló para ${targetEmail}:`, lastLinkError);
    }

    if (!actionLink) {
      return jsonResponse(
        {
          success: false,
          code: 'LINK_GENERATION_FAILED',
          message: `No se pudo generar un nuevo enlace de invitación: ${lastLinkError || 'Error desconocido.'}`,
        },
        500
      );
    }

    // 5. Enviar correo real con Nodemailer + Gmail SMTP
    const emailResult = await sendInvitationEmail({
      email: targetEmail,
      actionLink,
      roleName,
      invitedBy: locals.userFullName || locals.user.email || null,
      isResend: true,
    });

    if (!emailResult.success) {
      return jsonResponse(
        {
          success: false,
          code: 'EMAIL_SEND_FAILED',
          message: emailResult.message,
        },
        502
      );
    }

    // 6. Registrar fecha de reenvío en Supabase (user_metadata + public.profiles.updated_at)
    const nowIso = new Date().toISOString();
    const resendCount = (Number(userMeta.invitation_resend_count) || 0) + 1;

    const { error: metaUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      user_metadata: {
        ...userMeta,
        invitation_resent_at: nowIso,
        invitation_resent_by: locals.user.email || locals.user.id,
        invitation_resend_count: resendCount,
      },
    });
    if (metaUpdateErr) {
      console.warn('[ResendInvite] No se pudo actualizar metadata de reenvío:', metaUpdateErr.message);
    }

    const { error: profileUpdateErr } = await supabaseAdmin
      .from('profiles')
      .update({ updated_at: nowIso })
      .eq('id', targetUser.id);
    if (profileUpdateErr) {
      console.warn('[ResendInvite] No se pudo actualizar updated_at en profiles:', profileUpdateErr.message);
    }

    return jsonResponse(
      {
        success: true,
        message: `Invitación reenviada exitosamente a ${targetEmail}`,
        resentAt: nowIso,
        userId: targetUser.id,
        email: targetEmail,
      },
      200
    );
  } catch (err: any) {
    console.error('[ResendInvite] Error inesperado al reenviar invitación:', err);
    return jsonResponse(
      {
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || 'Error interno del servidor al procesar el reenvío.',
      },
      500
    );
  }
};
