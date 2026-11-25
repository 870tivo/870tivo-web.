import { createGmailTransporter, getGmailCredentials, getSiteUrl } from './mailer';

export interface InvitationEmailPayload {
  email: string;
  actionLink: string;
  roleName?: string | null;
  invitedBy?: string | null;
  isResend?: boolean;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Genera la plantilla HTML responsive de invitación con la estética oscura y minimalista de 870tivo.
 */
export function buildInvitationEmailTemplate(payload: InvitationEmailPayload): string {
  const siteUrl = getSiteUrl();
  const safeSiteUrl = escapeHtml(siteUrl);
  const safeEmail = escapeHtml(payload.email.trim());
  const safeActionLink = escapeHtml(payload.actionLink);
  const safeRoleName = payload.roleName?.trim() ? escapeHtml(payload.roleName.trim()) : null;
  const safeInvitedBy = payload.invitedBy?.trim() ? escapeHtml(payload.invitedBy.trim()) : null;
  const isResend = payload.isResend !== false;

  const badgeLabel = isResend ? 'Recordatorio de Invitación' : 'Invitación de Acceso';
  const headingText = 'Activa tu cuenta en 870tivo';
  const introText = isResend
    ? 'Se ha generado un nuevo enlace de activación para tu cuenta en el estudio editorial de 870tivo. Completa tu perfil y define tu contraseña de acceso desde el botón inferior.'
    : 'Has sido invitado a colaborar en el estudio editorial de 870tivo. Completa tu perfil y define tu contraseña de acceso desde el botón inferior.';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headingText} · 870tivo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 32px 16px;
      background-color: #0d0d0f;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e4e4e7;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 580px;
      margin: 0 auto;
      background-color: #17171a;
      border: 1px solid #27272a;
      border-radius: 4px;
      overflow: hidden;
    }
    .header {
      padding: 24px 32px 20px;
      border-bottom: 1px solid #27272a;
    }
    .brand {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.15em;
      color: #ffffff;
      text-decoration: none;
    }
    .body-content {
      padding: 32px;
    }
    .tag {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: #f97316;
      margin-bottom: 10px;
    }
    h1 {
      font-family: 'Playfair Display', Georgia, Cambria, serif;
      font-size: 26px;
      line-height: 1.3;
      margin: 0 0 14px;
      color: #ffffff;
      font-weight: 700;
    }
    .intro {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      color: #d4d4d8;
      margin: 0 0 24px;
    }
    .details-box {
      background-color: #121214;
      border: 1px solid #27272a;
      border-radius: 4px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .detail-row {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #e4e4e7;
      margin: 4px 0;
    }
    .detail-label {
      color: #a1a1aa;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
    }
    .btn-container {
      margin: 28px 0 24px;
    }
    .btn {
      display: inline-block;
      background-color: #f97316;
      color: #ffffff !important;
      text-decoration: none;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      padding: 14px 28px;
      border-radius: 2px;
    }
    .fallback-box {
      padding-top: 18px;
      border-top: 1px solid #27272a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #a1a1aa;
    }
    .fallback-link {
      display: block;
      margin-top: 8px;
      color: #f97316;
      word-break: break-all;
      font-size: 11px;
      text-decoration: underline;
    }
    .security-note {
      margin-top: 14px;
      font-size: 11px;
      color: #71717a;
      line-height: 1.5;
    }
    .footer {
      padding: 24px 32px;
      background-color: #121214;
      border-top: 1px solid #27272a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      color: #71717a;
      line-height: 1.6;
    }
  </style>
</head>
<body style="margin:0;padding:32px 16px;background-color:#0d0d0f;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e4e4e7;">
  <div class="wrapper" style="max-width:580px;margin:0 auto;background-color:#17171a;border:1px solid #27272a;border-radius:4px;overflow:hidden;">
    <div class="header" style="padding:24px 32px 20px;border-bottom:1px solid #27272a;">
      <a href="${safeSiteUrl}" target="_blank" rel="noopener noreferrer" class="brand" style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:900;letter-spacing:0.15em;color:#ffffff;text-decoration:none;">
        870tivo
      </a>
    </div>

    <div class="body-content" style="padding:32px;">
      <div class="tag" style="font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#f97316;margin-bottom:10px;">
        ${badgeLabel}
      </div>
      <h1 style="font-family:'Playfair Display',Georgia,Cambria,serif;font-size:26px;line-height:1.3;margin:0 0 14px;color:#ffffff;font-weight:700;">
        ${headingText}
      </h1>
      <p class="intro" style="font-size:15px;line-height:1.6;color:#d4d4d8;margin:0 0 24px;">
        ${introText}
      </p>

      <div class="details-box" style="background-color:#121214;border:1px solid #27272a;border-radius:4px;padding:16px 20px;margin-bottom:24px;">
        <div class="detail-row" style="font-size:13px;line-height:1.6;color:#e4e4e7;margin:4px 0;">
          <span class="detail-label" style="color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Correo invitado:</span>
          <span style="color:#ffffff;font-weight:600;"> ${safeEmail}</span>
        </div>
        ${
          safeRoleName
            ? `<div class="detail-row" style="font-size:13px;line-height:1.6;color:#e4e4e7;margin:4px 0;">
          <span class="detail-label" style="color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Rol asignado:</span>
          <span style="color:#f97316;font-weight:600;"> ${safeRoleName}</span>
        </div>`
            : ''
        }
        ${
          safeInvitedBy
            ? `<div class="detail-row" style="font-size:13px;line-height:1.6;color:#e4e4e7;margin:4px 0;">
          <span class="detail-label" style="color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Enviado por:</span>
          <span> ${safeInvitedBy}</span>
        </div>`
            : ''
        }
      </div>

      <div class="btn-container" style="margin:28px 0 24px;">
        <a href="${safeActionLink}" class="btn" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#f97316;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:14px 28px;border-radius:2px;">
          Activar cuenta y crear contraseña
        </a>
      </div>

      <div class="fallback-box" style="padding-top:18px;border-top:1px solid #27272a;font-size:12px;line-height:1.6;color:#a1a1aa;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:
        <a href="${safeActionLink}" class="fallback-link" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:8px;color:#f97316;word-break:break-all;font-size:11px;text-decoration:underline;">
          ${safeActionLink}
        </a>
        <p class="security-note" style="margin-top:14px;font-size:11px;color:#71717a;line-height:1.5;">
          Este enlace es personal, de un solo uso y tiene vigencia limitada. Si ya activaste tu cuenta o no esperabas este mensaje, puedes ignorarlo con seguridad.
        </p>
      </div>
    </div>

    <div class="footer" style="padding:24px 32px;background-color:#121214;border-top:1px solid #27272a;font-size:11px;color:#71717a;line-height:1.6;">
      Recibes este correo porque fuiste invitado al panel administrativo de 870tivo.<br/>
      Remitente oficial: <strong style="color:#a1a1aa;">870COLECTIVO@GMAIL.COM</strong> · Espacio de pensamiento y cultura abierta · <strong style="color:#a1a1aa;">870tivo</strong>.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Genera la versión en texto plano del correo de invitación.
 */
export function buildInvitationEmailText(payload: InvitationEmailPayload): string {
  const isResend = payload.isResend !== false;
  const lines = [
    isResend ? 'Recordatorio de invitación · 870tivo' : 'Invitación de acceso · 870tivo',
    '',
    'Activa tu cuenta en 870tivo',
    '',
    isResend
      ? 'Se ha generado un nuevo enlace de activación para tu cuenta en el estudio editorial de 870tivo.'
      : 'Has sido invitado a colaborar en el estudio editorial de 870tivo.',
    '',
    `Correo invitado: ${payload.email.trim()}`,
  ];

  if (payload.roleName?.trim()) {
    lines.push(`Rol asignado: ${payload.roleName.trim()}`);
  }
  if (payload.invitedBy?.trim()) {
    lines.push(`Enviado por: ${payload.invitedBy.trim()}`);
  }

  lines.push(
    '',
    'Abre el siguiente enlace para completar tu perfil y crear tu contraseña:',
    payload.actionLink,
    '',
    'Este enlace es personal, de un solo uso y tiene vigencia limitada.',
    '',
    '870tivo · Espacio de pensamiento y cultura abierta'
  );

  return lines.join('\n');
}

/**
 * Envía el correo de invitación usando Nodemailer y Gmail SMTP.
 */
export async function sendInvitationEmail(
  payload: InvitationEmailPayload
): Promise<{ success: boolean; message: string; messageId?: string }> {
  try {
    const { user: gmailUser } = getGmailCredentials();
    const transporter = createGmailTransporter();

    if (!transporter) {
      const msg =
        'No se pudo enviar el correo: falta configurar GMAIL_APP_PASSWORD en las variables de entorno.';
      console.warn(`[Invitations] ${msg} (remitente configurado: ${gmailUser})`);
      return {
        success: false,
        message: msg,
      };
    }

    const isResend = payload.isResend !== false;
    const subject = isResend
      ? 'Recordatorio: Activa tu cuenta en 870tivo'
      : 'Invitación al panel editorial · 870tivo';

    const info = await transporter.sendMail({
      from: `"870tivo" <${gmailUser}>`,
      to: payload.email.trim(),
      subject,
      html: buildInvitationEmailTemplate(payload),
      text: buildInvitationEmailText(payload),
    });

    return {
      success: true,
      message: `Correo de invitación enviado a ${payload.email.trim()}`,
      messageId: info.messageId,
    };
  } catch (err: any) {
    console.error('[Invitations] Error al enviar correo de invitación con Nodemailer:', err);
    return {
      success: false,
      message: err?.message || 'Error inesperado al enviar el correo de invitación.',
    };
  }
}

