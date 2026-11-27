import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { hasPermission } from '../../../../lib/auth';
import { notifySubscribersOnPublish } from '../../../../lib/newsletter';
import { recordAuditLog } from '../../../../lib/auditLog';

export const prerender = false;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * POST /api/admin/posts/toggle-visibility
 * Alterna el estado de visibilidad ('publicado' / 'borrador') de una publicación en Supabase
 * y dispara notificaciones al newsletter cuando se publica.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.user?.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: 'No autorizado. Se requiere iniciar sesión.',
        }),
        { status: 401, headers: JSON_HEADERS }
      );
    }

    const canToggle =
      Boolean(locals.isSuperAdmin) ||
      (await hasPermission(locals.user.id, 'publicaciones', 'toggle_visibility'));

    if (!canToggle) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Forbidden',
          message: 'Acceso denegado: No tienes permisos para cambiar la visibilidad de publicaciones.',
        }),
        { status: 403, headers: JSON_HEADERS }
      );
    }

    const body = await request.json();
    const { slug, isPublished } = body ?? {};

    if (typeof slug !== 'string' || slug.trim().length === 0 || typeof isPublished !== 'boolean') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid payload: slug and isPublished are required.',
        }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const cleanSlug = slug.trim();
    const newStatus = isPublished ? 'publicado' : 'borrador';

    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from('posts')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('slug', cleanSlug)
      .select('title, slug, subtitle, category, author, cover_image, status')
      .maybeSingle();

    if (updateError) {
      console.error('[toggle-visibility] Error al actualizar visibilidad en Supabase:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error al actualizar el estado de la publicación en Supabase.',
        }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    if (!updatedPost) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No se encontró la publicación solicitada.',
        }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    if (isPublished) {
      notifySubscribersOnPublish({
        title: updatedPost.title,
        slug: updatedPost.slug,
        subtitle: updatedPost.subtitle,
        category: updatedPost.category,
        author: updatedPost.author,
        coverImage: updatedPost.cover_image,
      }).catch((err) =>
        console.error('[toggle-visibility] Error notificando suscriptores:', err)
      );
    }

    await recordAuditLog({
      userEmail: locals.user.email || 'Equipo Editorial',
      action: isPublished ? 'publicó el artículo' : 'pasó a borrador el artículo',
      target: `«${updatedPost.title}»`,
      entityType: 'post',
      details: { slug: updatedPost.slug, status: updatedPost.status, isPublished },
    });

    return new Response(
      JSON.stringify({
        success: true,
        slug: updatedPost.slug,
        isPublished,
        status: updatedPost.status,
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err: any) {
    console.error('[toggle-visibility] Error inesperado:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Server error' }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
};

