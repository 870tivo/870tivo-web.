import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/admin/authors/save
 * Crea o actualiza un autor en la tabla public.authors
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, name, socialUrl } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'El nombre del autor es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authorData: Record<string, any> = {
      name: name.trim(),
      social_url: socialUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (id) {
      // Actualizar autor existente
      const { data, error } = await supabaseAdmin
        .from('authors')
        .update(authorData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Crear nuevo autor
      const { data, error } = await supabaseAdmin
        .from('authors')
        .insert(authorData)
        .select()
        .single();

      if (error) {
        // Verificar si es error de duplicado
        if (error.code === '23505') {
          return new Response(
            JSON.stringify({ success: false, message: `Ya existe un autor con el nombre «${name.trim()}».` }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw error;
      }
      result = data;
    }

    return new Response(
      JSON.stringify({ success: true, author: result, message: `Autor «${result.name}» guardado exitosamente.` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/admin/authors/save:', err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error al guardar el autor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
