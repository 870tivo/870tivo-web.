/**
 * rateLimiter.ts
 *
 * Módulo de rate limiting en memoria para el endpoint de login administrativo.
 *
 * Estrategia:
 *   - Clave de limitación: email normalizado (lowercase).
 *   - Ventana deslizante: 30 minutos desde el primer intento fallido.
 *   - Máximo: 5 intentos fallidos antes del bloqueo.
 *   - Bloqueo: 30 minutos desde el último intento que superó el límite.
 *   - Limpieza automática: Las entradas expiradas se eliminan en cada llamada a check().
 *
 * Notas de producción:
 *   - Este Map persiste en memoria durante el ciclo de vida de la función serverless
 *     (Vercel warm-starts reusan instancias, lo que hace efectivo el control para
 *     ventanas cortas en un entorno single-region).
 *   - Para escalar a multi-región, reemplazar el Map por un KV store externo
 *     (ej: Vercel KV / Upstash Redis) manteniendo la misma interfaz pública.
 */

/** Configuración de la política de rate limiting */
const MAX_ATTEMPTS   = 5;
const WINDOW_MS      = 30 * 60 * 1_000; // 30 minutos
const BLOCK_MS       = 30 * 60 * 1_000; // 30 minutos de bloqueo

/** Registro interno por clave (email) */
interface RateLimitEntry {
  /** Número de intentos fallidos acumulados en la ventana actual */
  failureCount: number;
  /** Timestamp del primer intento fallido de la ventana actual */
  windowStart: number;
  /** Timestamp hasta el que el acceso está bloqueado (0 = no bloqueado) */
  blockedUntil: number;
}

/** Resultado que devuelve check() */
export interface RateLimitResult {
  /** true si el intento está permitido (no bloqueado) */
  allowed: boolean;
  /** Intentos fallidos realizados hasta ahora en la ventana */
  failureCount: number;
  /** Intentos que le quedan al usuario antes del bloqueo total */
  attemptsLeft: number;
  /** true si el acceso está completamente bloqueado */
  isBlocked: boolean;
  /** Timestamp (ms) hasta el que dura el bloqueo. 0 si no está bloqueado */
  blockedUntil: number;
}

/** Store en memoria: email → RateLimitEntry */
const store = new Map<string, RateLimitEntry>();

/**
 * Normaliza la clave de rate limiting.
 * Siempre usa el email en minúsculas para evitar evasiones triviales.
 */
function normalizeKey(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Elimina del store las entradas cuyo bloqueo y ventana ya expiraron,
 * evitando acumulación ilimitada de memoria.
 */
function evictExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    const windowExpired = now - entry.windowStart > WINDOW_MS;
    const blockExpired  = entry.blockedUntil === 0 || now > entry.blockedUntil;
    if (windowExpired && blockExpired) {
      store.delete(key);
    }
  }
}

/**
 * Consulta el estado de rate limiting para un email dado.
 * No modifica el contador; solo lee el estado actual.
 *
 * @param email - Correo electrónico del intento de login.
 * @returns RateLimitResult con el estado actual.
 */
export function check(email: string): RateLimitResult {
  evictExpiredEntries();

  const key  = normalizeKey(email);
  const now  = Date.now();
  const entry = store.get(key);

  // Sin historial → acceso libre
  if (!entry) {
    return { allowed: true, failureCount: 0, attemptsLeft: MAX_ATTEMPTS, isBlocked: false, blockedUntil: 0 };
  }

  // ── Bloqueo activo ───────────────────────────────────────────────────────
  if (entry.blockedUntil > 0 && now < entry.blockedUntil) {
    return {
      allowed:      false,
      failureCount: entry.failureCount,
      attemptsLeft: 0,
      isBlocked:    true,
      blockedUntil: entry.blockedUntil,
    };
  }

  // ── Ventana expirada → tratar como nuevo inicio ──────────────────────────
  if (now - entry.windowStart > WINDOW_MS) {
    store.delete(key);
    return { allowed: true, failureCount: 0, attemptsLeft: MAX_ATTEMPTS, isBlocked: false, blockedUntil: 0 };
  }

  // ── Dentro de la ventana activa ──────────────────────────────────────────
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - entry.failureCount);
  return {
    allowed:      entry.failureCount < MAX_ATTEMPTS,
    failureCount: entry.failureCount,
    attemptsLeft,
    isBlocked:    false,
    blockedUntil: 0,
  };
}

/**
 * Registra un intento fallido para el email dado.
 * Si se alcanza el límite máximo, activa el bloqueo y retorna el resultado actualizado.
 *
 * @param email - Correo electrónico que falló el intento de login.
 * @returns RateLimitResult con el estado tras registrar el fallo.
 */
export function recordFailure(email: string): RateLimitResult {
  evictExpiredEntries();

  const key = normalizeKey(email);
  const now = Date.now();
  const existing = store.get(key);

  let entry: RateLimitEntry;

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    // Primera falla de la ventana o ventana expirada → resetear
    entry = { failureCount: 1, windowStart: now, blockedUntil: 0 };
  } else {
    // Incrementar contador dentro de la ventana activa
    entry = { ...existing, failureCount: existing.failureCount + 1 };
  }

  // Activar bloqueo si se alcanzó el máximo
  if (entry.failureCount >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
  }

  store.set(key, entry);

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - entry.failureCount);
  return {
    allowed:      entry.failureCount < MAX_ATTEMPTS,
    failureCount: entry.failureCount,
    attemptsLeft,
    isBlocked:    entry.blockedUntil > 0,
    blockedUntil: entry.blockedUntil,
  };
}

/**
 * Resetea el contador de intentos fallidos tras un login exitoso.
 * Debe llamarse siempre que Supabase Auth confirme credenciales válidas.
 *
 * @param email - Correo electrónico del usuario que inició sesión correctamente.
 */
export function resetOnSuccess(email: string): void {
  store.delete(normalizeKey(email));
}

