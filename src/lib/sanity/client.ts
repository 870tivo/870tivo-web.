import { createClient } from '@sanity/client';

export const sanityClient = createClient({
    projectId: import.meta.env.SANITY_PROJECT_ID || 'tu-project-id',
    dataset: import.meta.env.SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
});
