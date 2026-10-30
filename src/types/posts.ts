/**
 * Tipo que representa una publicación de la tabla public.posts de Supabase.
 * Campos según el schema real de la base de datos.
 */
export interface SupabasePost {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  category: string;
  author: string;
  author_social_url: string | null;
  author_id: string | null;
  cover_image: string | null;
  content: string;
  read_time: string;
  status: 'publicado' | 'borrador';
  created_at: string;
  updated_at: string;
}

/**
 * Helpers de transformación / presentación
 */

export function getAuthorInitials(author: string): string {
  const words = author.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '870';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function formatPostDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
      .format(date)
      .toUpperCase();
  } catch {
    return dateStr;
  }
}
