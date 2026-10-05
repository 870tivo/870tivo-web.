// Helper for Sanity image URLs
// Uses @sanity/image-url once your projectId is live

export function buildImageUrl(ref: string, width = 1200): string {
    // Placeholder until Sanity is connected
    if (!ref) return '';
    const projectId = import.meta.env.SANITY_PROJECT_ID || 'tu-project-id';
    const dataset = import.meta.env.SANITY_DATASET || 'production';
    return `https://cdn.sanity.io/images/${projectId}/${dataset}/${ref.replace('image-', '').replace('-jpg', '.jpg').replace('-png', '.png').replace('-webp', '.webp')}?w=${width}&auto=format`;
}
