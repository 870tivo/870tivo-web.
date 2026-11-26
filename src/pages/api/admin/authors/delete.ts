import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { recordAuditLog } from '../../../../lib/auditLog';

export const prerender = false;

/**
 * POST /api/admin/authors/delete
 * Elimina un autor por su id
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el ID del autor.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingAuthor } = await supabaseAdmin
      .from('authors')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from('authors')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await recordAuditLog({
      userEmail: (locals as any)?.user?.email || 'Equipo Editorial',
      action: 'eliminó el autor',
      target: existingAuthor?.name ? `«${existingAuthor.name}»` : String(id),
      entityType: 'author',
      details: { id },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Autor eliminado correctamente.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/admin/authors/delete:', err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error al eliminar el autor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
