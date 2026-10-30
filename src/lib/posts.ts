export interface RecommendedPost {
  slug: string;
  badge: string;
  title: string;
  excerpt: string;
  author: string;
  initials: string;
  date: string;
  readingTime: string;
}

export interface BlogPost {
  slug: string;
  badge: string;
  title: string;
  subtitle: string;
  author: string;
  authorInitials: string;
  authorHandle: string;
  authorSocial?: string;
  date: string;
  readingTime: string;
  heroImage: string;
  heroCaption: string;
  content?: string;
  recommended: RecommendedPost[];
}

export const posts: BlogPost[] = [
  {
    slug: 'pajaro-muerto',
    badge: 'ENSAYO DE PORTADA',
    title: '«Pájaro muerto»',
    subtitle: 'Una reflexión sobre la transitoriedad, el duelo fraternal y el despertar estético a través de la lente del cine inmaterial.',
    author: 'MIGUEL ÁNGEL URIBE',
    authorInitials: 'MU',
    authorHandle: '870tivo',
    date: 'OCTUBRE 14, 2026',
    readingTime: '12 MIN DE LECTURA',
    heroImage: '/assets/images/pajaro-muerto.jpeg',
    heroCaption: 'Fotografía de portada: Colección Archivo Inmaterial (2026)',
    recommended: [
      {
        slug: 'la-estetica-de-las-ruinas',
        badge: 'FOTOGRAFÍA',
        title: 'La estética de las ruinas en el paisaje contemporáneo',
        excerpt: 'Un análisis visual sobre cómo los espacios abandonados redefinen nuestra relación con el tiempo.',
        author: 'Jose Gómez',
        initials: 'JG',
        date: 'OCTUBRE 12, 2026',
        readingTime: '6 MIN',
      },
      {
        slug: 'buscando-el-silencio',
        badge: 'PAISAJE SONORO',
        title: 'Buscando el silencio en la metrópolis moderna',
        excerpt: 'Registros sonoros y reflexiones literarias sobre el significado de la quietud en Bogotá.',
        author: 'Mariana García',
        initials: 'MG',
        date: 'SEPTIEMBRE 28, 2026',
        readingTime: '8 MIN',
      }
    ]
  },
  {
    slug: 'la-estetica-de-las-ruinas',
    badge: 'FOTOGRAFÍA & ARQUITECTURA',
    title: 'La estética de las ruinas en el paisaje contemporáneo',
    subtitle: 'Exploración sobre las texturas del concreto desgastado y la memoria que persiste en las esquinas olvidadas de la urbe.',
    author: 'JOSE GÓMEZ',
    authorInitials: 'JG',
    authorHandle: '870tivo',
    date: 'OCTUBRE 12, 2026',
    readingTime: '6 MIN DE LECTURA',
    heroImage: '/assets/images/pajaro-muerto.jpeg',
    heroCaption: 'Fotografía de portada: Colección Archivo Inmaterial (2026)',
    recommended: [
      {
        slug: 'pajaro-muerto',
        badge: 'ENSAYO DE PORTADA',
        title: '«Pájaro muerto»',
        excerpt: 'Una reflexión sobre la transitoriedad y la belleza en la decadencia, a través de la lente documental.',
        author: 'Miguel Ángel Uribe',
        initials: 'MU',
        date: 'OCTUBRE 14, 2026',
        readingTime: '12 MIN',
      },
      {
        slug: 'buscando-el-silencio',
        badge: 'PAISAJE SONORO',
        title: 'Buscando el silencio en la metrópolis moderna',
        excerpt: 'Registros sonoros y reflexiones literarias sobre el significado de la quietud en Bogotá.',
        author: 'Mariana García',
        initials: 'MG',
        date: 'SEPTIEMBRE 28, 2026',
        readingTime: '8 MIN',
      }
    ]
  },
  {
    slug: 'buscando-el-silencio',
    badge: 'PAISAJE SONORO',
    title: 'Buscando el silencio en la metrópolis moderna',
    subtitle: 'Registros sonoros y reflexiones literarias sobre el significado de la quietud en Bogotá.',
    author: 'MARIANA GARCÍA',
    authorInitials: 'MG',
    authorHandle: '870tivo',
    date: 'SEPTIEMBRE 28, 2026',
    readingTime: '8 MIN DE LECTURA',
    heroImage: '/assets/images/pajaro-muerto.jpeg',
    heroCaption: 'Fotografía de portada: Colección Archivo Inmaterial (2026)',
    recommended: [
      {
        slug: 'pajaro-muerto',
        badge: 'ENSAYO DE PORTADA',
        title: '«Pájaro muerto»',
        excerpt: 'Una reflexión sobre la transitoriedad y la belleza en la decadencia, a través de la lente documental.',
        author: 'Miguel Ángel Uribe',
        initials: 'MU',
        date: 'OCTUBRE 14, 2026',
        readingTime: '12 MIN',
      },
      {
        slug: 'la-estetica-de-las-ruinas',
        badge: 'FOTOGRAFÍA',
        title: 'La estética de las ruinas en el paisaje contemporáneo',
        excerpt: 'Un análisis visual sobre cómo los espacios abandonados redefinen nuestra relación con el tiempo.',
        author: 'Jose Gómez',
        initials: 'JG',
        date: 'OCTUBRE 12, 2026',
        readingTime: '6 MIN',
      }
    ]
  }
];

import fs from 'node:fs';
import path from 'node:path';
import { getVisibilityMap, isPostPublished } from './postVisibility';

export { isPostPublished, getVisibilityMap };

export function getAllPosts(): BlogPost[] {
  try {
    const file = path.resolve(process.cwd(), 'src/data/posts-custom.json');
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const custom: BlogPost[] = JSON.parse(raw);
      if (Array.isArray(custom)) {
        const customSlugs = new Set(custom.map(c => c.slug));
        const filteredDefault = posts.filter(p => !customSlugs.has(p.slug));
        return [...custom, ...filteredDefault];
      }
    }
  } catch (err) {
    console.error('Error al cargar posts-custom.json:', err);
  }
  return posts;
}

export function getPublishedPosts(): BlogPost[] {
  return getAllPosts().filter((p) => isPostPublished(p.slug));
}

export function getPostsWithStatus(): (BlogPost & { isPublished: boolean })[] {
  const map = getVisibilityMap();
  return getAllPosts().map((p) => ({
    ...p,
    isPublished: map[p.slug] !== false,
  }));
}

