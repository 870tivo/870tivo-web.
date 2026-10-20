import type { APIRoute } from 'astro';
import { setPostVisibility, getVisibilityMap } from '../../../lib/postVisibility';

export const prerender = false;

export const GET: APIRoute = async () => {
  const map = getVisibilityMap();
  return new Response(JSON.stringify({ success: true, visibility: map }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { slug, isPublished } = body;

    if (!slug || typeof isPublished !== 'boolean') {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid payload: slug and isPublished are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = setPostVisibility(slug, isPublished);

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        isPublished,
        visibility: updated,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
