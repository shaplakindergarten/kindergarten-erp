// src/lib/utils/error.ts

/**
 * Extract human-readable message from any error shape.
 *
 * Handles:
 * - Error instances
 * - Plain strings
 * - Supabase / PostgREST error objects
 *   ({ message, code, details, hint, error_description })
 * - Plain objects
 * - null / undefined
 */
export function getErrorMessage(error: unknown): string {
  if (error === null || error === undefined) return "Unknown error";

  if (error instanceof Error) {
    return error.message || error.name || "Unknown error";
  }

  if (typeof error === "string") {
    return error.trim() || "Unknown error";
  }

  if (typeof error === "number" || typeof error === "boolean") {
    return String(error);
  }

  if (typeof error === "object") {
    const err = error as Record<string, unknown>;

    // 1. Standard message
    if (typeof err.message === "string" && err.message.trim()) {
      return err.message;
    }

    // 2. OAuth / Auth error shape
    if (typeof err.error_description === "string" && err.error_description.trim()) {
      return err.error_description;
    }

    // 3. PostgREST details
    if (typeof err.details === "string" && err.details.trim()) {
      return err.details;
    }

    // 4. PostgREST hint
    if (typeof err.hint === "string" && err.hint.trim()) {
      return err.hint;
    }

    // 5. Generic error field
    if (typeof err.error === "string" && err.error.trim()) {
      return err.error;
    }

    // 6. Fall back to code
    if (typeof err.code === "string" && err.code.trim()) {
      return `Database error (${err.code})`;
    }

    // 7. Empty Supabase error {} — transient
    const keys = Object.keys(err);
    if (keys.length === 0) return "Transient Supabase error";

    // 8. Last resort — JSON.stringify (helps debugging)
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") return json;
    } catch {
      // circular reference — ignore
    }
  }

  return "Unknown error";
}

/**
 * Extract the PostgREST / Postgres error code if present.
 *
 * Common codes:
 * - 23505  unique_violation
 * - 23503  foreign_key_violation
 * - 42501  insufficient_privilege
 * - 42P17  infinite_recursion_in_policy
 * - 42P01  undefined_table
 * - PGRST116  no rows returned (.single() failed)
 * - PGRST301  JWT / permission issues
 */
export function getErrorCode(error: unknown): string | null {
  if (error && typeof error === "object") {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === "string" && code.trim()) return code;
  }
  return null;
}

/**
 * Detect network / offline errors so the UI can show a friendlier message.
 */
export function isNetworkError(error: unknown): boolean {
  // Browser offline shortcut
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;

  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("failed to fetch") ||
    message.includes("network error") ||
    message.includes("network request failed") ||
    message.includes("fetch failed") ||
    message.includes("offline") ||
    message.includes("connection refused") ||
    message.includes("connection closed") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("socket hang up") ||
    message.includes("network is unreachable")
  );
}

/**
 * Detect RLS / permission errors.
 *
 * Used to silently downgrade count queries when the current user
 * (e.g., staff role) doesn't have access to a table.
 */
export function isRlsError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    code === "42P17" ||       // infinite recursion in policy
    code === "42501" ||       // insufficient_privilege
    code === "PGRST301" ||    // JWT invalid / missing
    message.includes("permission denied") ||
    message.includes("row-level security") ||
    message.includes("row level security") ||
    message.includes("infinite recursion") ||
    message.includes("not authorized") ||
    message.includes("unauthorized") ||
    message.includes("jwt")
  );
}

/**
 * Detect Supabase's "empty" error shape {} — transient glitch that
 * happens during realtime races or token refresh.
 *
 * Returns true when the error object exists but has no meaningful content.
 */
export function isEmptySupabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // Empty object literal {}
  const keys = Object.keys(error as object);
  if (keys.length === 0) return true;

  // Object with only empty-string fields
  const err = error as Record<string, unknown>;
  const allEmpty =
    (!err.message || String(err.message).trim() === "") &&
    (!err.details || String(err.details).trim() === "") &&
    (!err.hint || String(err.hint).trim() === "") &&
    (!err.code || String(err.code).trim() === "");

  return allEmpty;
}

/**
 * Detect unique constraint violations (Postgres 23505).
 *
 * Useful for showing "already exists" messages instead of raw errors.
 */
export function isUniqueViolation(error: unknown): boolean {
  return getErrorCode(error) === "23505";
}

/**
 * Detect foreign key violations (Postgres 23503).
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return getErrorCode(error) === "23503";
}

/**
 * Detect "no rows found" from PostgREST `.single()` (PGRST116).
 */
export function isNotFoundError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === "PGRST116") return true;

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("no rows") ||
    message.includes("not found") ||
    message.includes("0 rows")
  );
}