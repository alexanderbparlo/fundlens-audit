'use client'

import { useState, useRef, useEffect } from 'react'
import {
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
  looksLikeAnthropicKey,
} from '@/lib/apiKey'

/**
 * BYOK control. The user's Anthropic key lives only in this browser tab's
 * sessionStorage — it is sent per-request to our routes and never stored on the
 * server. Rendered in the top bar; opens automatically when no key is set so a
 * run can't start without one.
 */
export function ApiKeyControl() {
  const [hasKey, setHasKey] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // sessionStorage is browser-only — read it after mount to avoid hydration drift.
  useEffect(() => {
    const stored = getStoredApiKey()
    setHasKey(Boolean(stored))
    if (!stored) setOpen(true)
  }, [])

  // Close the panel on outside click.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
        setError(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function save() {
    const trimmed = draft.trim()
    if (!looksLikeAnthropicKey(trimmed)) {
      setError('That does not look like an Anthropic key (expected sk-ant-…).')
      return
    }
    setStoredApiKey(trimmed)
    setHasKey(true)
    setDraft('')
    setError(null)
    setOpen(false)
  }

  function forget() {
    clearStoredApiKey()
    setHasKey(false)
    setDraft('')
    setError(null)
  }

  return (
    <div className="relative ml-auto" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors ${
          hasKey
            ? 'bg-surface-800 text-secondary border-border hover:text-accent hover:border-accent/30'
            : 'bg-data-flag/10 text-data-flag border-data-flag/30 hover:bg-data-flag/15'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-data-positive' : 'bg-data-flag'}`}
        />
        {hasKey ? 'API key set' : 'Add API key'}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-surface-900 border border-border shadow-xl p-4 space-y-3 z-50">
          <div>
            <p className="text-xs uppercase tracking-widest text-label font-display">Anthropic API key</p>
            <p className="text-secondary text-xs mt-1 leading-relaxed">
              Audits run on your own key. It stays in this browser tab only, is sent
              per request, and is never stored on our servers.
            </p>
          </div>

          <input
            type="password"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg bg-surface-800 border border-border focus:border-accent/50 outline-none px-3 py-2 text-sm text-primary font-mono placeholder:text-muted"
          />

          {error && <p className="text-negative text-xs">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={!draft.trim()}
              className="flex-1 text-xs rounded-lg px-3 py-2 bg-accent/10 text-accent border border-accent/30 hover:bg-accent/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save key
            </button>
            {hasKey && (
              <button
                onClick={forget}
                className="text-xs rounded-lg px-3 py-2 bg-surface-800 text-secondary border border-border hover:text-negative transition-colors"
              >
                Forget
              </button>
            )}
          </div>

          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-secondary hover:text-accent transition-colors"
          >
            Get a key at console.anthropic.com →
          </a>
        </div>
      )}
    </div>
  )
}
