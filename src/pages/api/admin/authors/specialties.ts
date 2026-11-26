import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { recordAuditLog } from '../../../../lib/auditLog';

export const prerender = false;

/**
 * GET /api/admin/authors/specialties
 * Retorna todas las especialidades editoriales ordenadas alfabéticamente.
 */
export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('specialties')
      .select('id, name, created_at')
      .order('name', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return new Response(
          JSON.stringify({ success: true, specialties: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, specialties: data || [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error al listar especialidades:', err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error al obtener especialidades', specialties: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST /api/admin/authors/specialties
 * Crea una nueva especialidad editorial en public.specialties,
 * asegurando la ausencia de duplicados insensibles a mayúsculas/minúsculas.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'El nombre de la especialidad es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const trimmedName = name.trim();

    // 1. Verificar si ya existe una especialidad con nombre idéntico (case-insensitive)
    const { data: existing, error: searchError } = await supabaseAdmin
      .from('specialties')
      .select('id, name, created_at')
      .ilike('name', trimmedName)
      .maybeSingle();

    if (searchError && searchError.code !== '42P01') {
      console.warn('Error al buscar especialidad duplicada:', searchError);
    }

    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          specialty: existing,
          alreadyExists: true,
          message: `La especialidad «${existing.name}» ya existe.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Insertar nueva especialidad
    const { data, error } = await supabaseAdmin
      .from('specialties')
      .insert({ name: trimmedName })
      .select('id, name, created_at')
      .single();

    if (error) {
      // Conflicto de unicidad
      if (error.code === '23505') {
        const { data: duplicate } = await supabaseAdmin
          .from('specialties')
          .select('id, name, created_at')
          .ilike('name', trimmedName)
          .maybeSingle();

        if (duplicate) {
          return new Response(
            JSON.stringify({
              success: true,
              specialty: duplicate,
              alreadyExists: true,
              message: `La especialidad «${duplicate.name}» ya existe.`,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Si la tabla no ha sido creada aún
      if (error.code === '42P01') {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'La tabla public.specialties aún no ha sido creada en Supabase. Ejecuta el script scripts/create-specialties-table.sql en el SQL Editor.',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      throw error;
    }

    await recordAuditLog({
      userEmail: (locals as any)?.user?.email || 'Equipo Editorial',
      action: 'creó la especialidad',
      target: `«${data.name}»`,
      entityType: 'author',
      details: { id: data.id, kind: 'specialty' },
    });

    return new Response(
      JSON.stringify({
        success: true,
        specialty: data,
        message: `Especialidad «${data.name}» creada exitosamente.`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/admin/authors/specialties:', err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error al guardar la especialidad.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

