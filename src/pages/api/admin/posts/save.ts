import type { APIRoute } from 'astro';
import { savePost } from '../../../../lib/customPosts';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

/**
 * POST /api/admin/posts/save
 * Guarda o actualiza un ensayo/artículo editorial con su estado (publicado/borrador)
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { 
      slug, 
      title, 
      subtitle, 
      badge, 
      author, 
      authorSocial, 
      heroImage, 
      heroCaption, 
      content, 
      status 
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'El título del artículo es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generar slug si no se proporcionó
    let finalSlug = slug;
    if (!finalSlug || typeof finalSlug !== 'string' || !finalSlug.trim()) {
      finalSlug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    } else {
      finalSlug = finalSlug
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    if (!finalSlug) {
      finalSlug = `articulo-${Date.now()}`;
    }

    const postStatus: 'publicado' | 'borrador' = status === 'publicado' ? 'publicado' : 'borrador';

    const saved = savePost({
      slug: finalSlug,
      title: title.trim(),
      subtitle: subtitle?.trim(),
      badge: badge?.trim() || 'EDITORIAL',
      author: author?.trim() || 'Redactor 870tivo',
      authorSocial: authorSocial?.trim(),
      heroImage: heroImage?.trim(),
      heroCaption: heroCaption?.trim(),
      content: content || '',
      status: postStatus,
    });

    // Sincronizar en base de datos Supabase
    try {
      const { error: sbError } = await supabaseAdmin
        .from('posts')
        .upsert({
          slug: finalSlug,
          title: title.trim(),
          subtitle: subtitle?.trim() || null,
          category: badge?.trim() || 'EDITORIAL',
          author: author?.trim() || 'Redactor 870tivo',
          author_social_url: authorSocial?.trim() || null,
          cover_image: heroImage?.trim() || null,
          content: content || '',
          status: postStatus,
          read_time: saved.readingTime || '5 MIN DE LECTURA',
          updated_at: new Date().toISOString()
        }, { onConflict: 'slug' });

      if (sbError) {
        console.error('Error al sincronizar post con Supabase:', sbError);
      }
    } catch (sbErr) {
      console.error('Error de conexión con Supabase en save.ts:', sbErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: postStatus === 'publicado' 
          ? `«${saved.title}» publicado exitosamente en la web.` 
          : `Borrador de «${saved.title}» guardado correctamente.`,
        post: saved,
        status: postStatus,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error al guardar artículo:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor al guardar publicación' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
