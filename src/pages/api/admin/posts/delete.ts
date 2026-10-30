import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { deleteCustomPost } from '../../../../lib/customPosts';

export const prerender = false;

/**
 * POST /api/admin/posts/delete
 * Elimina una publicación.
 * REGLA ESTRICTA DE NEGOCIO: La publicación DEBE estar en estado 'borrador'.
 * Si está en estado 'publicado', la solicitud es rechazada con código 400.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug || typeof slug !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el slug de la publicación.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanSlug = slug.trim().toLowerCase();

    // 1. Consultar estado actual del post en Supabase
    const { data: existingPost, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('id, title, status')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (fetchError) {
      console.error('Error al verificar estado de la publicación:', fetchError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al consultar la base de datos.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Si existe en Supabase y su estado es 'publicado', BLOQUEAR la eliminación
    if (existingPost && (existingPost.status === 'publicado' || existingPost.status === 'published')) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `La publicación «${existingPost.title}» está actualmente publicada en la revista. Para eliminarla, primero debes cambiar su estado a Borrador usando el interruptor.`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Proceder con la eliminación en Supabase
    const { error: deleteError } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('slug', cleanSlug);

    if (deleteError) {
      console.error('Error al eliminar post en Supabase:', deleteError);
      return new Response(
        JSON.stringify({ success: false, message: 'No se pudo eliminar el artículo de la base de datos.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Eliminar de posts-custom.json si existía allí
    deleteCustomPost(cleanSlug);

    return new Response(
      JSON.stringify({
        success: true,
        message: `El borrador «${existingPost?.title || cleanSlug}» ha sido eliminado definitivamente.`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/admin/posts/delete:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor al eliminar la publicación.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
