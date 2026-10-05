// GROQ queries for Sanity CMS
// Uncomment and adapt once Sanity project is configured

export const ALL_POSTS_QUERY = `*[_type == "post"] | order(publishedAt desc) {
  _id,
  title,
  slug,
  excerpt,
  publishedAt,
  "author": author->{ name, handle, "image": image.asset->url },
  "category": category->title,
  "mainImage": mainImage.asset->url,
  readingTime
}`;

export const POST_BY_SLUG_QUERY = `*[_type == "post" && slug.current == $slug][0] {
  _id,
  title,
  slug,
  body,
  publishedAt,
  youtubeId,
  "author": author->{ name, handle, bio },
  "category": category->title,
  "mainImage": mainImage.asset->url
}`;

export const ALL_GALLERY_QUERY = `*[_type == "gallery"] | order(_createdAt desc) {
  _id,
  title,
  description,
  "images": images[].asset->url
}`;

export const ALL_CINE_CYCLES_QUERY = `*[_type == "cineCycle"] | order(date desc) {
  _id,
  title,
  director,
  datetime,
  colorVariant,
  "poster": poster.asset->url
}`;
