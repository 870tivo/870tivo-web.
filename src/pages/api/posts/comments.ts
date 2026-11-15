import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

/**
 * GET /api/posts/comments?postId=UUID
 * Devuelve los comentarios públicos de una publicación, ordenados del más reciente al más antiguo.
 * No requiere autenticación (RLS permite SELECT público en public.comments).
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const postId = url.searchParams.get('postId');

    if (!postId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el parámetro postId.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select('id, post_id, author_name, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener comentarios públicos:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, comments: comments || [] }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    console.error('Error no controlado en GET /api/posts/comments:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

