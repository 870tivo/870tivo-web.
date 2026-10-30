import fs from 'node:fs';
import path from 'node:path';
import { posts as defaultPosts, type BlogPost } from './posts';
import { setPostVisibility } from './postVisibility';

const CUSTOM_POSTS_FILE = path.resolve(process.cwd(), 'src/data/posts-custom.json');

let customPostsCache: BlogPost[] | null = null;

/**
 * Lee las publicaciones personalizadas desde el archivo JSON
 */
export function getCustomPosts(): BlogPost[] {
  if (customPostsCache) {
    return customPostsCache;
  }

  try {
    if (fs.existsSync(CUSTOM_POSTS_FILE)) {
      const raw = fs.readFileSync(CUSTOM_POSTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        customPostsCache = parsed;
        return customPostsCache;
      }
    }
  } catch (err) {
    console.error('Error al leer posts-custom.json:', err);
  }

  customPostsCache = [];
  return customPostsCache;
}

/**
 * Retorna todas las publicaciones combinando las predeterminadas y las personalizadas/editadas.
 * Si un slug ya existe en las personalizadas, este sobrescribe el predeterminado.
 */
export function getAllMergedPosts(): BlogPost[] {
  const customList = getCustomPosts();
  const customMap = new Map<string, BlogPost>();
  for (const p of customList) {
    customMap.set(p.slug, p);
  }

  const merged: BlogPost[] = [];

  // Agregar predeterminados (o su versión editada si existe)
  for (const basePost of defaultPosts) {
    if (customMap.has(basePost.slug)) {
      merged.push(customMap.get(basePost.slug)!);
      customMap.delete(basePost.slug);
    } else {
      merged.push(basePost);
    }
  }

  // Agregar los posts completamente nuevos creados por el usuario al inicio
  const newlyCreated = Array.from(customMap.values());
  return [...newlyCreated, ...merged];
}

/**
 * Genera iniciales a partir de un nombre (ej: "Miguel Ángel Uribe" -> "MU")
 */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '870';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Formatea la fecha actual en español (ej: "OCTUBRE 21, 2026")
 */
function getFormattedCurrentDate(): string {
  const now = new Date();
  const months = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];
  return `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

/**
 * Calcula un estimado de tiempo de lectura basado en palabras del contenido
 */
function calculateReadingTime(text: string): string {
  const words = text ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} MIN DE LECTURA`;
}

/**
 * Guarda o actualiza una publicación
 */
export function savePost(
  postData: {
    slug: string;
    title: string;
    subtitle?: string;
    badge?: string;
    author?: string;
    authorSocial?: string;
    heroImage?: string;
    heroCaption?: string;
    content?: string;
    status?: 'publicado' | 'borrador';
    readingTime?: string;
  }
): BlogPost {
  const currentList = getCustomPosts();
  const slug = postData.slug.trim().toLowerCase();
  const author = postData.author?.trim() || 'Redactor 870tivo';
  const authorSocial = postData.authorSocial?.trim() || '';
  const authorHandle = authorSocial.replace(/^https?:\/\/(www\.)?(instagram\.com\/|twitter\.com\/|x\.com\/)?/, '').replace(/^@/, '') || '870tivo';

  // Buscar si ya existe en custom o en base
  const existingIndex = currentList.findIndex((p) => p.slug === slug);
  const existingBase = defaultPosts.find((p) => p.slug === slug);

  const mergedItem: BlogPost = {
    slug,
    title: postData.title.trim(),
    subtitle: postData.subtitle?.trim() || existingBase?.subtitle || 'Ensayo editorial para Galería 870tivo',
    badge: (postData.badge?.trim() || existingBase?.badge || 'EDITORIAL').toUpperCase(),
    author,
    authorInitials: getInitials(author),
    authorHandle,
    authorSocial: authorSocial || undefined,
    date: existingBase?.date || getFormattedCurrentDate(),
    readingTime: postData.readingTime || calculateReadingTime(postData.content || ''),
    heroImage: postData.heroImage?.trim() || existingBase?.heroImage || '/assets/logo/870.jpeg',
    heroCaption: postData.heroCaption?.trim() || existingBase?.heroCaption || `Fotografía editorial: Archivo 870tivo (${new Date().getFullYear()})`,
    content: postData.content || existingBase?.content || '',
    recommended: existingBase?.recommended || [
      {
        slug: 'pajaro-muerto',
        badge: 'ENSAYO DE PORTADA',
        title: '«Pájaro muerto»',
        excerpt: 'Una reflexión sobre la transitoriedad y la belleza en la decadencia.',
        author: 'Miguel Ángel Uribe',
        initials: 'MU',
        date: 'OCTUBRE 14, 2026',
        readingTime: '12 MIN',
      }
    ],
  };

  if (existingIndex >= 0) {
    currentList[existingIndex] = mergedItem;
  } else {
    currentList.unshift(mergedItem);
  }

  customPostsCache = currentList;

  // Persistir en posts-custom.json
  try {
    const dir = path.dirname(CUSTOM_POSTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_POSTS_FILE, JSON.stringify(currentList, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error al guardar posts-custom.json:', err);
  }

  // Actualizar visibilidad
  const isPublished = postData.status === 'publicado';
  setPostVisibility(slug, isPublished);

  return mergedItem;
}

/**
 * Elimina un post de la lista personalizada en posts-custom.json
 */
export function deleteCustomPost(slug: string): boolean {
  const currentList = getCustomPosts();
  const normalizedSlug = slug.trim().toLowerCase();
  const filtered = currentList.filter(p => p.slug !== normalizedSlug);

  if (filtered.length === currentList.length) {
    return false;
  }

  customPostsCache = filtered;

  try {
    const dir = path.dirname(CUSTOM_POSTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_POSTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error al actualizar posts-custom.json al eliminar:', err);
    return false;
  }
}

