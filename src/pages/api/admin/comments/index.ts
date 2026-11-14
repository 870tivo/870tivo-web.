/**
 * src/pages/api/admin/comments/index.ts
 * Endpoint administrativo para consultar comentarios asociados a un post.
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const user = (context.locals as any).user;
    if (!user?.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const postId = context.url.searchParams.get('postId');
    if (!postId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el parámetro postId.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener comentarios:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, comments: comments || [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error in GET /api/admin/comments:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

