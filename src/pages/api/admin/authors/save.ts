import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { recordAuditLog } from '../../../../lib/auditLog';

export const prerender = false;

function generateBaseSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'autor';
}

async function getUniqueSlug(baseSlug: string, currentAuthorId?: string): Promise<string> {
  let candidate = baseSlug;
  let counter = 1;

  while (counter <= 50) {
    let query = supabaseAdmin
      .from('authors')
      .select('id')
      .eq('slug', candidate);

    if (currentAuthorId) {
      query = query.neq('id', currentAuthorId);
    }

    const { data } = await query.maybeSingle();

    if (!data) {
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }

  return `${baseSlug}-${Date.now().toString().slice(-4)}`;
}

/**
 * POST /api/admin/authors/save
 * Crea o actualiza un autor en la tabla public.authors sincronizando todos sus campos:
 * name, slug, specialty, bio, avatar_url, social_url, social_links.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { id, name, bio, specialty, avatarUrl, socialUrl, socialLinks } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'El nombre del autor es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const trimmedName = name.trim();

    // 1. Resolver slug único
    let slug: string | null = body.slug?.trim() ? generateBaseSlug(body.slug.trim()) : null;

    if (!slug) {
      if (id) {
        const { data: existingAuthor } = await supabaseAdmin
          .from('authors')
          .select('slug, name')
          .eq('id', id)
          .maybeSingle();

        if (existingAuthor?.slug && existingAuthor.name === trimmedName) {
          slug = existingAuthor.slug;
        }
      }

      if (!slug) {
        const baseSlug = generateBaseSlug(trimmedName);
        slug = await getUniqueSlug(baseSlug, id);
      }
    } else {
      slug = await getUniqueSlug(slug, id);
    }

    // 2. Normalizar campos opcionales
    const cleanBio = typeof bio === 'string' && bio.trim() ? bio.trim() : null;
    const cleanSpecialty = typeof specialty === 'string' && specialty.trim() ? specialty.trim() : null;
    const rawAvatar = body.avatar_url ?? avatarUrl;
    const cleanAvatarUrl = typeof rawAvatar === 'string' && rawAvatar.trim() ? rawAvatar.trim() : null;
    const rawSocial = body.social_url ?? socialUrl;
    const cleanSocialUrl = typeof rawSocial === 'string' && rawSocial.trim() ? rawSocial.trim() : null;

    // 3. Normalizar objeto social_links (JSONB)
    let parsedSocialLinks: Record<string, string> | null = null;
    if (socialLinks) {
      let rawObj = socialLinks;
      if (typeof socialLinks === 'string') {
        try {
          rawObj = JSON.parse(socialLinks);
        } catch {
          rawObj = null;
        }
      }

      if (rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj)) {
        const cleanMap: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawObj)) {
          if (typeof v === 'string' && v.trim()) {
            cleanMap[k.toLowerCase()] = v.trim();
          }
        }
        if (Object.keys(cleanMap).length > 0) {
          parsedSocialLinks = cleanMap;
        }
      }
    }

    const authorData: Record<string, any> = {
      name: trimmedName,
      slug,
      bio: cleanBio,
      specialty: cleanSpecialty,
      avatar_url: cleanAvatarUrl,
      social_url: cleanSocialUrl,
      updated_at: new Date().toISOString(),
    };

    if (socialLinks !== undefined) {
      authorData.social_links = parsedSocialLinks;
    }

    let result;

    if (id) {
      // Actualizar autor existente
      let { data, error } = await supabaseAdmin
        .from('authors')
        .update(authorData)
        .eq('id', id)
        .select()
        .single();

      // Si la columna specialty no existe aún en Supabase, reintentar sin ella
      if (error && (error.code === '42703' || error.message?.includes('specialty'))) {
        console.warn('La columna "specialty" no existe aún en public.authors. Guardando autor sin specialty temporalmente.');
        const fallbackData = { ...authorData };
        delete fallbackData.specialty;
        const retry = await supabaseAdmin
          .from('authors')
          .update(fallbackData)
          .eq('id', id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Error al actualizar autor:', error);
        throw error;
      }
      result = data;
    } else {
      // Crear nuevo autor
      let { data, error } = await supabaseAdmin
        .from('authors')
        .insert(authorData)
        .select()
        .single();

      // Si la columna specialty no existe aún en Supabase, reintentar sin ella
      if (error && (error.code === '42703' || error.message?.includes('specialty'))) {
        console.warn('La columna "specialty" no existe aún en public.authors. Guardando autor sin specialty temporalmente.');
        const fallbackData = { ...authorData };
        delete fallbackData.specialty;
        const retry = await supabaseAdmin
          .from('authors')
          .insert(fallbackData)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (error.code === '23505') {
          return new Response(
            JSON.stringify({ success: false, message: `Ya existe un autor con el nombre o slug «${trimmedName}».` }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw error;
      }
      result = data;
    }

    await recordAuditLog({
      userEmail: (locals as any)?.user?.email || 'Equipo Editorial',
      action: id ? 'actualizó el autor' : 'creó el autor',
      target: `«${result.name}»`,
      entityType: 'author',
      details: { id: result.id, slug: result.slug, specialty: result.specialty ?? null },
    });

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
