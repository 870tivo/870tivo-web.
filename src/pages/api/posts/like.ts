import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/posts/like
 * Incrementa o decrementa atómicamente el contador de likes de un artículo.
 * Body: { slug: string; action: 'like' | 'unlike' }
 * Response: { success: true; likes: number }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { slug, action } = body;

    if (!slug || typeof slug !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el slug del post.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action !== 'like' && action !== 'unlike') {
      return new Response(
        JSON.stringify({ success: false, message: 'El campo action debe ser "like" o "unlike".' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanSlug = slug.trim();
    const rpcName = action === 'like' ? 'increment_post_likes' : 'decrement_post_likes';

    const { data, error } = await supabaseAdmin.rpc(rpcName, { post_slug: cleanSlug });

    if (error) {
      console.error(`Error en RPC ${rpcName}:`, error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, likes: data ?? 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error no controlado en /api/posts/like:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

