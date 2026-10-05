/**
 * Sanity Studio Configuration
 * Install Sanity Studio separately: npm create sanity@latest
 * Or configure an embedded studio using @sanity/astro
 */

// Schemas for 870tivo content types
export const schemas = [
    // Post / Microcuento / Ensayo
    {
        name: 'post',
        title: 'Entradas del Blog',
        type: 'document',
        fields: [
            { name: 'title', title: 'Título', type: 'string' },
            { name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } },
            { name: 'excerpt', title: 'Extracto', type: 'text' },
            { name: 'publishedAt', title: 'Fecha de publicación', type: 'datetime' },
            { name: 'mainImage', title: 'Imagen principal', type: 'image' },
            { name: 'youtubeId', title: 'YouTube Video ID', type: 'string' },
            { name: 'body', title: 'Cuerpo del artículo', type: 'array', of: [{ type: 'block' }] },
            { name: 'author', title: 'Autor', type: 'reference', to: [{ type: 'author' }] },
            { name: 'category', title: 'Categoría', type: 'reference', to: [{ type: 'category' }] },
        ],
    },
    // Author
    {
        name: 'author',
        title: 'Autores',
        type: 'document',
        fields: [
            { name: 'name', title: 'Nombre completo', type: 'string' },
            { name: 'handle', title: 'Instagram handle', type: 'string' },
            { name: 'bio', title: 'Biografía', type: 'text' },
            { name: 'image', title: 'Foto', type: 'image' },
        ],
    },
    // Category
    {
        name: 'category',
        title: 'Categorías',
        type: 'document',
        fields: [
            { name: 'title', title: 'Nombre', type: 'string' },
            { name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } },
        ],
    },
    // Gallery
    {
        name: 'gallery',
        title: 'Galerías',
        type: 'document',
        fields: [
            { name: 'title', title: 'Título', type: 'string' },
            { name: 'description', title: 'Descripción', type: 'text' },
            { name: 'images', title: 'Imágenes', type: 'array', of: [{ type: 'image' }] },
        ],
    },
    // Cine Cycle
    {
        name: 'cineCycle',
        title: 'Ciclos de Cine',
        type: 'document',
        fields: [
            { name: 'title', title: 'Título de la película', type: 'string' },
            { name: 'director', title: 'Director', type: 'string' },
            { name: 'datetime', title: 'Fecha y hora', type: 'string' },
            { name: 'colorVariant', title: 'Color del afiche', type: 'string', options: { list: ['blue', 'pink', 'orange', 'dark', 'color'] } },
            { name: 'poster', title: 'Afiche', type: 'image' },
        ],
    },
];
