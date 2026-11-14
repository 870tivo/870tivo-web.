import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/posts/comment
 * Guarda un nuevo comentario en la publicación indicada.
 * Body: { post_id: string; author_name: string; content: string }
 * Response: { success: true; comment: CommentRow }
 * No requiere autenticación (público), pero valida que el post exista y esté publicado.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { post_id, author_name, content } = body;

    // Validaciones básicas
    if (!post_id || typeof post_id !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el ID del post.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanName = (author_name || '').toString().trim();
    const cleanContent = (content || '').toString().trim();

    if (!cleanName || cleanName.length < 1) {
      return new Response(
        JSON.stringify({ success: false, message: 'Por favor ingresa tu nombre o apodo.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (cleanName.length > 60) {
      return new Response(
        JSON.stringify({ success: false, message: 'El nombre no puede superar 60 caracteres.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (cleanContent.length < 5) {
      return new Response(
        JSON.stringify({ success: false, message: 'El comentario debe tener al menos 5 caracteres.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (cleanContent.length > 1000) {
      return new Response(
        JSON.stringify({ success: false, message: 'El comentario no puede superar 1000 caracteres.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el post existe y está publicado
    const { data: postCheck, error: postCheckError } = await supabaseAdmin
      .from('posts')
      .select('id, status')
      .eq('id', post_id)
      .maybeSingle();

    if (postCheckError || !postCheck) {
      return new Response(
        JSON.stringify({ success: false, message: 'La publicación especificada no existe.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (postCheck.status !== 'publicado') {
      return new Response(
        JSON.stringify({ success: false, message: 'No se pueden dejar comentarios en publicaciones no activas.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insertar el comentario
    const { data: newComment, error: insertError } = await supabaseAdmin
      .from('comments')
      .insert({
        post_id,
        author_name: cleanName,
        content: cleanContent,
      })
      .select('id, post_id, author_name, content, created_at')
      .single();

    if (insertError || !newComment) {
      console.error('Error al insertar comentario:', insertError);
      return new Response(
        JSON.stringify({ success: false, message: 'No se pudo guardar el comentario. Inténtalo de nuevo.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, comment: newComment }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error no controlado en POST /api/posts/comment:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

