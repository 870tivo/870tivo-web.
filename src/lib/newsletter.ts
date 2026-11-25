import { supabaseAdmin } from './supabase';
import { createGmailTransporter, getGmailCredentials, getSiteUrl } from './mailer';

export interface PublishAlertPayload {
  title: string;
  slug: string;
  subtitle?: string | null;
  category?: string | null;
  author?: string | null;
  coverImage?: string | null;
}

/**
 * Genera la plantilla HTML responsive con la estética editorial y minimalista de 870.
 */
export function buildPublicationEmailTemplate(payload: PublishAlertPayload): string {
  const siteUrl = getSiteUrl();
  const postUrl = `${siteUrl}/blog/${payload.slug}`;
  const authorName = payload.author?.trim() || 'Colectivo 870';
  const categoryBadge = payload.category?.toUpperCase() || 'EDITORIAL';
  const logoBase64 = `${siteUrl}/logo.png`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.title} · 870tivo</title>
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
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.15em;
      color: #ffffff;
      text-decoration: none;
    }
    .tag {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: #f97316;
    }
    .body-content {
      padding: 32px;
    }
    h1 {
      font-family: 'Playfair Display', Georgia, Cambria, serif;
      font-size: 26px;
      line-height: 1.3;
      margin: 0 0 12px;
      color: #ffffff;
      font-weight: 700;
    }
    .author-meta {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #a1a1aa;
      margin-bottom: 16px;
    }
    .subtitle {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      color: #d4d4d8;
      margin-bottom: 24px;
    }
    .btn-container {
      margin: 28px 0 12px;
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
    .footer {
      padding: 24px 32px;
      background-color: #121214;
      border-top: 1px solid #27272a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      color: #71717a;
      line-height: 1.6;
    }
    .footer a {
      color: #a1a1aa;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <a href="${siteUrl}" target="_blank" rel="noopener noreferrer" class="brand" style="text-decoration: none;">
        870tivo
      </a>
    </div>

    <div class="body-content">
      <div class="tag" style="margin-bottom: 8px;">Nueva Publicación</div>
      <h1>${payload.title}</h1>
      <div class="author-meta">Por ${authorName}</div>
      ${payload.subtitle ? `<p class="subtitle">${payload.subtitle}</p>` : ''}

      <div class="btn-container">
        <a href="${postUrl}" class="btn" target="_blank" rel="noopener noreferrer">
          Leer publicación en 870tivo
        </a>
      </div>
    </div>

    <div class="footer">
      Recibes este aviso porque estás suscrito a los anuncios de 870tivo.<br/>
      Remitente oficial: <strong>870COLECTIVO@GMAIL.COM</strong> · Espacio de pensamiento y cultura abierta · <strong>870tivo</strong>.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Obtiene la lista de todos los correos registrados en email_subscribers.
 */
export async function getActiveSubscribers(): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_subscribers')
      .select('email');

    if (error) {
      console.error('[Newsletter] Error al consultar suscriptores:', error.message);
      return [];
    }

    return (data || []).map((row: { email: string }) => row.email).filter(Boolean);
  } catch (err) {
    console.error('[Newsletter] Excepción al obtener suscriptores:', err);
    return [];
  }
}

/**
 * Envía la alerta de nuevo contenido a los suscriptores.
 * 
 * Configuración requerida en variables de entorno:
 * - GMAIL_USER: 870colectivo@gmail.com (o el remitente correspondiente)
 * - GMAIL_APP_PASSWORD: La 'Contraseña de aplicación' de 16 caracteres generada en Google Account
 */
export async function notifySubscribersOnPublish(
  payload: PublishAlertPayload
): Promise<{ success: boolean; sentCount: number; message: string }> {
  try {
    const subscribers = await getActiveSubscribers();

    if (subscribers.length === 0) {
      console.log('[Newsletter] No hay suscriptores registrados.');
      return {
        success: true,
        sentCount: 0,
        message: 'No hay suscriptores en la lista para notificar.',
      };
    }

    const { user: gmailUser } = getGmailCredentials();
    const transporter = createGmailTransporter();

    // Si aún no se han configurado las credenciales en .env, registramos aviso claro
    if (!transporter) {
      const msg = `[Newsletter] Envío simulado: se encontró ${subscribers.length} suscriptor(es), pero falta configurar GMAIL_APP_PASSWORD en .env para el envío real desde ${gmailUser}.`;
      console.warn(msg);
      return {
        success: false,
        sentCount: 0,
        message: msg,
      };
    }

    const htmlContent = buildPublicationEmailTemplate(payload);

    // Enviar en bloques usando CCO (BCC) para proteger la privacidad de los destinatarios
    // Lotes de 50 destinatarios por mensaje
    const BATCH_SIZE = 50;
    let totalSent = 0;

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);

      await transporter.sendMail({
        from: `"870 Colectivo" <${gmailUser}>`,
        to: gmailUser, // Destinatario principal visible
        bcc: batch,    // Copia oculta para privacidad total entre suscriptores
        subject: `Nueva publicación: ${payload.title} · 870`,
        html: htmlContent,
      });

      totalSent += batch.length;
    }

    console.log(`[Newsletter] Notificación enviada con éxito a ${totalSent} suscriptor(es).`);
    return {
      success: true,
      sentCount: totalSent,
      message: `Se notificó a ${totalSent} suscriptores correctamente.`,
    };
  } catch (err: any) {
    console.error('[Newsletter] Error durante el despacho de notificaciones:', err);
    return {
      success: false,
      sentCount: 0,
      message: err?.message || 'Error inesperado al enviar notificaciones.',
    };
  }
}

