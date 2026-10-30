import fs from 'node:fs';
import path from 'node:path';

// Path to persistent JSON storage for post visibility
const DATA_FILE = path.resolve(process.cwd(), 'src/data/posts-visibility.json');

// In-memory cache for fast access
let visibilityCache: Record<string, boolean> | null = null;

/**
 * Default visibility: all default posts are published initially
 */
const DEFAULT_VISIBILITY: Record<string, boolean> = {
  'pajaro-muerto': true,
  'la-estetica-de-las-ruinas': true,
  'buscando-el-silencio': true,
};

/**
 * Loads the current visibility map from file or default
 */
export function getVisibilityMap(): Record<string, boolean> {
  if (visibilityCache) {
    return { ...DEFAULT_VISIBILITY, ...visibilityCache };
  }

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      visibilityCache = parsed;
      return { ...DEFAULT_VISIBILITY, ...parsed };
    }
  } catch (err) {
    console.error('Error reading posts-visibility.json:', err);
  }

  visibilityCache = { ...DEFAULT_VISIBILITY };
  return visibilityCache;
}

/**
 * Checks if a specific post slug is currently published
 */
export function isPostPublished(slug: string): boolean {
  const map = getVisibilityMap();
  return map[slug] !== false; // true unless explicitly false
}

/**
 * Updates the visibility status of a post and persists to disk
 */
export function setPostVisibility(slug: string, isPublished: boolean): Record<string, boolean> {
  const current = getVisibilityMap();
  current[slug] = Boolean(isPublished);
  visibilityCache = current;

  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving posts-visibility.json:', err);
  }

  return current;
}
