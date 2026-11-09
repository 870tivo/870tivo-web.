/**
 * src/pages/api/admin/activities/save.ts
 * Endpoint para crear o actualizar actividades culturales en Supabase.
 * Soporta campos comunes, metadatos especializados por categoría y tags.
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import type { ActivityCategory } from '../../../../types/database';

export const prerender = false;

const VALID_CATEGORIES: ActivityCategory[] = [
  'ciclos-cine',
  'club-lectura',
  'talleres',
  'encuentros',
];

function sanitizeSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export const POST: APIRoute = async (context) => {
  try {
    const user = (context.locals as any).user;
    if (!user?.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sesión no válida o no autorizada.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await context.request.json();
    const {
      id,
      title,
      slug,
      category,
      event_date,
      location,
      cover_url,
      description,
      content,
      tags,
      status,
      is_published,
      metadata,
    } = body;

    // 1. Validaciones requeridas
    if (!title || typeof title !== 'string' || !title.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'El título de la actividad es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!category || !VALID_CATEGORIES.includes(category as ActivityCategory)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Categoría inválida (${category}). Debe ser una de: ${VALID_CATEGORIES.join(', ')}.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!event_date) {
      return new Response(
        JSON.stringify({ success: false, message: 'La fecha y hora del evento son obligatorias.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Normalizar fecha
    const parsedDate = new Date(event_date);
    if (isNaN(parsedDate.getTime())) {
      return new Response(
        JSON.stringify({ success: false, message: 'El formato de fecha no es válido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Generar / Sanitizar slug
    let finalSlug = slug ? sanitizeSlug(slug) : sanitizeSlug(title);
    if (!finalSlug) {
      finalSlug = `actividad-${Date.now()}`;
    }

    // 4. Estado y visibilidad
    const finalStatus: 'publicado' | 'borrador' | 'archivado' =
      status === 'publicado' || status === 'borrador' || status === 'archivado'
        ? status
        : is_published ? 'publicado' : 'borrador';

    const finalIsPublished = is_published !== undefined
      ? Boolean(is_published)
      : finalStatus === 'publicado';

    // 5. Tags como array limpio
    let finalTags: string[] = [];
    if (Array.isArray(tags)) {
      finalTags = tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof tags === 'string') {
      finalTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    }

    // 6. Metadata especializada
    const finalMetadata = typeof metadata === 'object' && metadata !== null ? metadata : {};

    // 7. Insertar o Actualizar en Supabase
    const payload = {
      title: title.trim(),
      slug: finalSlug,
      category: category as ActivityCategory,
      event_date: parsedDate.toISOString(),
      location: (location && String(location).trim()) || 'Sede 870tivo',
      cover_url: (cover_url && String(cover_url).trim()) || null,
      description: (description && String(description).trim()) || null,
      content: (content && String(content).trim()) || null,
      tags: finalTags,
      status: finalStatus,
      is_published: finalIsPublished,
      metadata: finalMetadata,
      updated_at: new Date().toISOString(),
    };

    if (id && typeof id === 'string' && id.trim()) {
      // MODO EDICIÓN
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('activities')
        .update(payload)
        .eq('id', id.trim())
        .select()
        .single();

      if (updateError) {
        console.error('Error al actualizar actividad en Supabase:', updateError);
        return new Response(
          JSON.stringify({ success: false, message: `Error al actualizar: ${updateError.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Actividad «${payload.title}» actualizada exitosamente.`,
          activity: updated,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // MODO CREACIÓN
      // Verificar unicidad de slug
      const { data: existing } = await supabaseAdmin
        .from('activities')
        .select('id')
        .eq('slug', finalSlug)
        .maybeSingle();

      if (existing) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
        payload.slug = finalSlug;
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('activities')
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        console.error('Error al insertar actividad en Supabase:', insertError);
        return new Response(
          JSON.stringify({ success: false, message: `Error al crear: ${insertError.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Actividad «${payload.title}» creada exitosamente.`,
          activity: inserted,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    console.error('Error en /api/admin/activities/save:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor al procesar la actividad.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

