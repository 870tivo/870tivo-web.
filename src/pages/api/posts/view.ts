import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/posts/view
 * Incrementa atómicamente el contador de vistas de un artículo mediante la función RPC increment_post_views.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug || typeof slug !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el slug del post.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanSlug = slug.trim();

    // Invocar función RPC en Supabase
    const { error: rpcError } = await supabaseAdmin.rpc('increment_post_views', {
      post_slug: cleanSlug,
    });

    if (rpcError) {
      console.error('Error al incrementar vistas de post:', rpcError);
      return new Response(
        JSON.stringify({ success: false, message: rpcError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, slug: cleanSlug }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error no controlado en /api/posts/view:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

