import { supabase } from './supabase';

/**
 * Estructura de los settings del sitio leídos desde public.site_settings
 */
export interface SiteSettings {
  module_publicaciones_visible: boolean;
  module_galeria_visible: boolean;
}

/**
 * Valores por defecto si la tabla no existe o falla la consulta.
 * Mostramos todos los módulos por defecto (fail-open).
 */
const DEFAULTS: SiteSettings = {
  module_publicaciones_visible: true,
  module_galeria_visible: true,
};

/**
 * Lee la configuración global del sitio desde Supabase SSR.
 * Usa el cliente público (anon) ya que los settings son de lectura pública.
 * En caso de error retorna los defaults para no romper la landing.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value');

    if (error || !data) {
      console.warn('[siteSettings] Falló la consulta, usando defaults:', error?.message);
      return { ...DEFAULTS };
    }

    const settings: SiteSettings = { ...DEFAULTS };

    for (const row of data) {
      if (row.key === 'module_publicaciones_visible') {
        settings.module_publicaciones_visible = row.value === true || row.value === 'true';
      } else if (row.key === 'module_galeria_visible') {
        settings.module_galeria_visible = row.value === true || row.value === 'true';
      }
    }

    return settings;
  } catch (err) {
    console.error('[siteSettings] Error inesperado:', err);
    return { ...DEFAULTS };
  }
}
