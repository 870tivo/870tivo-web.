/**
 * Format a date string into a localized Spanish date
 * e.g. "2026-09-23" → "septiembre 23, 2026"
 */
export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Estimate reading time in minutes from a string of content
 */
export function readingTime(content: string): number {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
}

/**
 * Slugify a string for URL usage
 */
export function slugify(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
