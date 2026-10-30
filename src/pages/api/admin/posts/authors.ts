import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

/**
 * GET /api/admin/posts/authors
 * Obtiene ÚNICAMENTE los autores reales registrados en la tabla public.authors.
 * Si la tabla está vacía, devuelve un array vacío [].
 */
export const GET: APIRoute = async () => {
  try {
    const { data: authorsData, error: authorsErr } = await supabaseAdmin
      .from('authors')
      .select('id, name, social_url, created_at')
      .order('name', { ascending: true });

    if (authorsErr) {
      console.error('Error al consultar tabla authors:', authorsErr);
      return new Response(
        JSON.stringify({ success: false, message: authorsErr.message, authors: [] }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authors = (authorsData || []).map(a => ({
      id: a.id,
      name: a.name,
      socialUrl: a.social_url || undefined,
      createdAt: a.created_at,
    }));

    return new Response(JSON.stringify({ success: true, authors }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error al listar autores', authors: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
