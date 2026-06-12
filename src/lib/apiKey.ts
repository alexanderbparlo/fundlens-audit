// BYOK (bring-your-own-key): the Anthropic key is supplied by each user, never
// stored server-side. The browser holds it in sessionStorage (cleared when the
// tab closes) and attaches it to every Anthropic-backed request via this header.
// This module is import-safe on both client and server — it pulls in no SDK.

export const ANTHROPIC_KEY_HEADER = 'x-anthropic-key'

const STORAGE_KEY = 'fundlens-audit:anthropic-key'

/** Read the caller's Anthropic key from sessionStorage (browser only). */
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(STORAGE_KEY)
}

/** Persist the key for the current tab session. */
export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(STORAGE_KEY, key.trim())
}

/** Forget the key (e.g. on a shared machine). */
export function clearStoredApiKey(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(STORAGE_KEY)
}

/** Anthropic keys are `sk-ant-...`; a light shape check to catch obvious typos. */
export function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim())
}
