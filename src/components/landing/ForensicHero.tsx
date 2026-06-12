'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import '@/app/landing.css'

type Particle = { x: number; y: number; vx: number; vy: number; r: number }

// Fixed id of the read-only demo engagement seeded by samples/seed-demo.mjs.
// The "See a findings report" CTA deep-links to its completed report.
const DEMO_ENGAGEMENT_ID = '00000000-0000-0000-0000-00000000de10'

/**
 * Forensic Dark landing page. Ported from design-mockups/forensic-dark-hero.html.
 * The ambient canvas and the looping pipeline "instrument" are imperative, so they
 * run inside a mount-once effect scoped to the component root via refs. The ambient
 * cinematic layer is toggled through React state (default on).
 */
export function ForensicHero() {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ambientCtl = useRef<{ start: () => void; stop: () => void } | null>(null)
  const [ambientOn, setAmbientOn] = useState(true)

  // ── Canvas particles + pipeline state machine (mount once) ──────────────────
  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = window.devicePixelRatio || 1
    let W = 0
    let H = 0
    let particles: Particle[] = []
    let raf: number | null = null

    function resize() {
      W = canvas!.width = window.innerWidth * dpr
      H = canvas!.height = window.innerHeight * dpr
      canvas!.style.width = window.innerWidth + 'px'
      canvas!.style.height = window.innerHeight + 'px'
    }
    function seed() {
      const n = Math.min(64, Math.floor(window.innerWidth / 22))
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.18 * dpr,
        vy: (Math.random() - 0.5) * 0.18 * dpr,
        r: (Math.random() * 1.6 + 0.6) * dpr,
      }))
    }
    function draw() {
      ctx!.clearRect(0, 0, W, H)
      const linkDist = 130 * dpr
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const d = Math.hypot(dx, dy)
          if (d < linkDist) {
            ctx!.strokeStyle = 'rgba(0,200,180,' + (0.08 * (1 - d / linkDist)).toFixed(3) + ')'
            ctx!.lineWidth = dpr
            ctx!.beginPath()
            ctx!.moveTo(p.x, p.y)
            ctx!.lineTo(q.x, q.y)
            ctx!.stroke()
          }
        }
        ctx!.fillStyle = 'rgba(0,200,180,0.28)'
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    function startAmbient() { if (!raf && !reduce) draw() }
    function stopAmbient() {
      if (raf) { cancelAnimationFrame(raf); raf = null; ctx!.clearRect(0, 0, W, H) }
    }
    ambientCtl.current = { start: startAmbient, stop: stopAmbient }

    resize(); seed()
    const onResize = () => { resize(); seed() }
    window.addEventListener('resize', onResize)

    // ── Pipeline state machine ────────────────────────────────────────────────
    const $ = (s: string) => root.querySelector(s) as HTMLElement | null
    const $$ = (s: string) => Array.from(root.querySelectorAll(s)) as HTMLElement[]
    const nodes = {
      preparer: $('[data-node="preparer"]'),
      reviewer: $('[data-node="reviewer"]'),
      challenger: $('[data-node="challenger"]'),
      synthesizer: $('[data-node="synthesizer"]'),
    }
    const stateText = (node: HTMLElement | null, t: string) => {
      const el = node?.querySelector('.state')
      if (el) el.textContent = t
    }
    const setStatus = (node: HTMLElement | null, s: string) => node?.setAttribute('data-status', s)
    const conn = (k: string) => $('[data-conn="' + k + '"]')
    const checks = $$('.checks .check')
    const bar = $('.verify-bar')
    const vlabel = $('.verify-label')
    const result = $('.result')

    let timers: ReturnType<typeof setTimeout>[] = []
    const after = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))

    function reset() {
      timers.forEach(clearTimeout); timers = []
      $$('.doc').forEach(d => d.classList.remove('lit'))
      Object.values(nodes).forEach(n => setStatus(n, 'idle'))
      stateText(nodes.preparer, 'waiting')
      stateText(nodes.reviewer, 'idle')
      stateText(nodes.challenger, 'idle')
      stateText(nodes.synthesizer, 'EQR gate · idle')
      ;['ingest', 'split', 'merge'].forEach(k => conn(k)?.classList.remove('active'))
      checks.forEach(c => c.classList.remove('ok', 'flagged'))
      if (bar) bar.style.width = '0%'
      if (vlabel) vlabel.textContent = 'Deterministic verification'
      result?.classList.remove('show')
    }

    function showFinal() {
      $$('.doc').forEach(d => d.classList.add('lit'))
      setStatus(nodes.preparer, 'done'); stateText(nodes.preparer, 'verified figure set ready')
      setStatus(nodes.reviewer, 'done'); stateText(nodes.reviewer, '4 notes')
      setStatus(nodes.challenger, 'done'); stateText(nodes.challenger, '3 challenges')
      setStatus(nodes.synthesizer, 'done'); stateText(nodes.synthesizer, 'EQR gate · cleared')
      conn('split')?.classList.add('active'); conn('merge')?.classList.add('active')
      checks.forEach(c => c.classList.add(c.dataset.flag ? 'flagged' : 'ok'))
      if (bar) bar.style.width = '100%'
      if (vlabel) vlabel.textContent = '10 checks · 1 exception'
      result?.classList.add('show')
    }

    function run() {
      reset()
      if (reduce) { showFinal(); return }

      $$('.doc').forEach((d, i) => after(200 + i * 240, () => d.classList.add('lit')))
      after(1000, () => conn('ingest')?.classList.add('active'))

      after(1300, () => { setStatus(nodes.preparer, 'active'); stateText(nodes.preparer, 'extracting cross-doc figures…') })
      after(3500, () => {
        setStatus(nodes.preparer, 'done'); stateText(nodes.preparer, 'verified figure set ready')
        conn('ingest')?.classList.remove('active')
        conn('split')?.classList.add('active')
      })

      after(3900, () => {
        setStatus(nodes.reviewer, 'active'); stateText(nodes.reviewer, 'validating…')
        setStatus(nodes.challenger, 'active'); stateText(nodes.challenger, 'stress-testing…')
      })
      after(6100, () => {
        setStatus(nodes.reviewer, 'done'); stateText(nodes.reviewer, '4 notes')
        setStatus(nodes.challenger, 'done'); stateText(nodes.challenger, '3 challenges')
        conn('split')?.classList.remove('active')
        conn('merge')?.classList.add('active')
      })

      after(6600, () => {
        setStatus(nodes.synthesizer, 'active'); stateText(nodes.synthesizer, 'EQR gate · reconciling…')
        if (vlabel) vlabel.textContent = 'Verifying NAV bridge…'
      })
      const labels = ['NAV bridge', 'section footing', 'FV hierarchy', 'balance-sheet equation',
        'capital-account rollforward', 'rollforward audit', 'flow-to-balance', 'cross-statement',
        'date sequencing', 'OCR quality']
      checks.forEach((c, i) => {
        after(6800 + i * 320, () => {
          c.classList.add(c.dataset.flag ? 'flagged' : 'ok')
          if (bar) bar.style.width = Math.round(((i + 1) / checks.length) * 100) + '%'
          if (vlabel) vlabel.textContent = 'Verifying ' + labels[i] + '…'
        })
      })

      after(6800 + checks.length * 320 + 200, () => {
        conn('merge')?.classList.remove('active')
        setStatus(nodes.synthesizer, 'done'); stateText(nodes.synthesizer, 'EQR gate · cleared')
        if (vlabel) vlabel.textContent = '10 checks · 1 exception'
      })
      after(6800 + checks.length * 320 + 600, () => result?.classList.add('show'))
      after(6800 + checks.length * 320 + 3400, run)
    }

    run()

    return () => {
      window.removeEventListener('resize', onResize)
      timers.forEach(clearTimeout)
      if (raf) cancelAnimationFrame(raf)
      ambientCtl.current = null
    }
  }, [])

  // ── React to the ambient toggle ─────────────────────────────────────────────
  useEffect(() => {
    if (ambientOn) {
      ambientCtl.current?.start()
    } else {
      // match the 1100ms opacity fade before halting the loop
      const t = setTimeout(() => ambientCtl.current?.stop(), 1100)
      return () => clearTimeout(t)
    }
  }, [ambientOn])

  return (
    <div ref={rootRef} className={`fl-landing${ambientOn ? ' ambient-on' : ''}`}>
      <div className="backdrop" />
      <canvas ref={canvasRef} className="ambient" />
      <div className="grid" />

      <div className="shell">
        <nav>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fundlens-audit-logo.png" alt="FundLens Audit" className="brand-logo" width={96} height={46} />
          <div className="spacer" />
          <a className="nav-link" href="#how-it-works">How it works</a>
          <a className="nav-link" href="#methodology">Methodology</a>
          <Link className="btn btn-primary" href="/app">Launch</Link>
        </nav>

        <section className="hero">
          {/* Left: copy */}
          <div className="copy">
            <span className="eyebrow"><b>●</b> Multi-agent adversarial review</span>
            <h1>Reconcile the whole fund.<br /><span className="quiet">Before you sign.</span></h1>
            <p className="lede">
              Five specialized agents prepare, review, challenge, and synthesize a fund&apos;s
              document set. Every figure is tied to code-verified arithmetic, not the model&apos;s
              mental math.
            </p>
            <div className="cta-row">
              {/* Both CTAs deep-link into the seeded read-only demo engagement.
                  "Run a sample audit" replays the persisted run through the pipeline
                  animation (useAuditRun replay mode); "See a findings report" jumps
                  straight to its completed report. Neither spends tokens or a key. */}
              <Link className="btn btn-primary" href={`/app?view=pipeline&eng=${DEMO_ENGAGEMENT_ID}`}>Run a sample audit →</Link>
              <Link className="btn" href={`/app?view=report&eng=${DEMO_ENGAGEMENT_ID}`}>See a findings report</Link>
            </div>
            <div className="trust">
              <span><i className="tick">✓</i> ILPA 3.0 aware</span>
              <span><i className="tick">✓</i> Deterministic C1–C10 checks</span>
              <span><i className="tick">✓</i> Every finding cites a vouched figure</span>
            </div>
          </div>

          {/* Right: live pipeline instrument */}
          <div className="instrument">
            <div className="inst-head">
              <span>ENGAGEMENT · meridian-growth-iii</span>
              <span className="live"><span className="pip" /> LIVE</span>
            </div>

            <div className="graph">
              <div className="docs">
                <span className="doc" data-doc="0">FS.pdf</span>
                <span className="doc" data-doc="1">CAS.pdf</span>
                <span className="doc" data-doc="2">LPA.pdf</span>
              </div>

              <div className="conn" data-conn="ingest"><span className="flow" /></div>

              <div className="node" data-node="preparer" data-status="idle">
                <span className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v5h5" /><path d="M8 13h8M8 17h5" /></svg>
                </span>
                <span className="meta">
                  <span className="name">Preparer</span>
                  <span className="state">waiting</span>
                </span>
                <span className="badge">✓ extracted</span>
              </div>

              <div className="conn split" data-conn="split">
                <svg width="220" height="26" viewBox="0 0 220 26">
                  <path d="M110 0 V8 Q110 13 70 13 H40 Q14 13 14 22 V26" />
                  <path d="M110 0 V8 Q110 13 150 13 H180 Q206 13 206 22 V26" />
                </svg>
              </div>

              <div className="pair">
                <div className="node parallel" data-node="reviewer" data-status="idle">
                  <span className="ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  </span>
                  <span className="meta"><span className="name">Reviewer</span><span className="state">idle</span></span>
                </div>
                <div className="node parallel" data-node="challenger" data-status="idle">
                  <span className="ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18M5 8l7-5 7 5M5 8v8l7 5 7-5V8" /></svg>
                  </span>
                  <span className="meta"><span className="name">Challenger</span><span className="state">idle</span></span>
                </div>
              </div>

              <div className="conn split" data-conn="merge">
                <svg width="220" height="26" viewBox="0 0 220 26">
                  <path d="M14 0 V4 Q14 13 70 13 H110 V26" />
                  <path d="M206 0 V4 Q206 13 150 13 H110 V26" />
                </svg>
              </div>

              <div className="node" data-node="synthesizer" data-status="idle">
                <span className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 7v5l3 2" /><path d="M16 3h5v5" /></svg>
                </span>
                <span className="meta">
                  <span className="name">Synthesizer</span>
                  <span className="state">EQR gate · idle</span>
                </span>
                <span className="badge">✓ reconciled</span>
              </div>
            </div>

            {/* Deterministic verification */}
            <div className="verify">
              <div className="verify-head">
                <span className="verify-label">Deterministic verification</span>
                <span className="progress"><span className="bar verify-bar" /></span>
              </div>
              <div className="checks">
                <span className="check" data-c="C1"><span className="mk">✓</span><span className="id">C1</span> NAV bridge</span>
                <span className="check" data-c="C2"><span className="mk">✓</span><span className="id">C2</span> Section footing</span>
                <span className="check" data-c="C3"><span className="mk">✓</span><span className="id">C3</span> FV hierarchy</span>
                <span className="check" data-c="C4"><span className="mk">✓</span><span className="id">C4</span> Balance-sheet eq.</span>
                <span className="check" data-c="C5"><span className="mk">✓</span><span className="id">C5</span> Cap-acct rollfwd</span>
                <span className="check" data-c="C6"><span className="mk">✓</span><span className="id">C6</span> Rollforward audit</span>
                <span className="check" data-c="C7" data-flag="1"><span className="mk">!</span><span className="id">C7</span> Flow-to-balance</span>
                <span className="check" data-c="C8"><span className="mk">✓</span><span className="id">C8</span> Cross-statement</span>
                <span className="check" data-c="C9"><span className="mk">✓</span><span className="id">C9</span> Date sequencing</span>
                <span className="check" data-c="C10"><span className="mk">✓</span><span className="id">C10</span> Typo / OCR</span>
              </div>
            </div>

            <div className="result">
              <span className="r-main"><b>12 findings</b>, severity-ranked</span>
              <span className="r-sub">1 exception · C7 flow variance →</span>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section className="section" id="how-it-works">
          <div className="section-eyebrow">The pipeline</div>
          <h2>From raw documents to a finding you can sign off.</h2>
          <p className="section-lede">
            Five specialized agents move a fund&apos;s documents from raw upload to a reconciled,
            severity-ranked finding set. Each stage hands verified figures to the next.
          </p>
          <div className="steps">
            <div className="step">
              <div className="num">01</div>
              <div className="step-name">Ingest &amp; profile</div>
              <p className="step-body">
                Upload the fund&apos;s document set. Each PDF is profiled once and cached, and every
                agent reads the native file rather than a lossy text dump.
              </p>
              <div className="agents">documents → Profiler</div>
            </div>
            <div className="step">
              <div className="num">02</div>
              <div className="step-name">Prepare</div>
              <p className="step-body">
                The Preparer extracts one cross-document figure set: NAV bridge, balance sheet,
                capital accounts, and stated performance.
              </p>
              <div className="agents">Preparer</div>
            </div>
            <div className="step">
              <div className="num">03</div>
              <div className="step-name">Review &amp; challenge</div>
              <p className="step-body">
                Two agents work in parallel. The Reviewer validates disclosure and ILPA expectations;
                the Challenger adversarially stress-tests valuations and assumptions.
              </p>
              <div className="agents">Reviewer ∥ Challenger</div>
            </div>
            <div className="step">
              <div className="num">04</div>
              <div className="step-name">Synthesize</div>
              <p className="step-body">
                The Synthesizer reconciles every output at an EQR gate, then returns a severity-ranked
                finding set with a PBC list.
              </p>
              <div className="agents">Synthesizer</div>
            </div>
          </div>
        </section>

        {/* ── Methodology ───────────────────────────────────────────────────── */}
        <section className="section" id="methodology">
          <div className="section-eyebrow">Methodology</div>
          <h2>Built to be vouched, not trusted.</h2>
          <p className="section-lede">
            The pipeline is built to be checked, not taken on faith. Arithmetic is deterministic,
            review is adversarial, and every finding points back to a figure on a page.
          </p>
          <div className="method-grid">
            <div className="method">
              <h3>Code-verified arithmetic</h3>
              <p>
                Numbers are checked by deterministic code, not the model&apos;s mental math. Ten
                cross-statement checks run on every engagement.
              </p>
              <ul className="checklist">
                <li><span className="cid">C1</span> NAV bridge reconciliation</li>
                <li><span className="cid">C2</span> Section footing</li>
                <li><span className="cid">C3</span> Fair-value hierarchy</li>
                <li><span className="cid">C4</span> Balance-sheet equation</li>
                <li><span className="cid">C5</span> Capital-account rollforward</li>
                <li><span className="cid">C6</span> Rollforward audit</li>
                <li><span className="cid">C7</span> Flow-to-balance</li>
                <li><span className="cid">C8</span> Cross-statement ties</li>
                <li><span className="cid">C9</span> Date sequencing</li>
                <li><span className="cid">C10</span> Typo / OCR integrity</li>
              </ul>
            </div>
            <div className="method">
              <h3>Adversarial by design</h3>
              <p>
                An independent Challenger exists to break the Preparer&apos;s work, not to agree with it.
                A finding survives only if it holds up to a second, skeptical pass.
              </p>
            </div>
            <div className="method">
              <h3>Every finding cites a vouched figure</h3>
              <p>
                Each finding traces to a specific document and a passed or failed check, so a reviewer
                can vouch it in seconds.
              </p>
            </div>
            <div className="method">
              <h3>Fund-aware</h3>
              <p>
                Prompts and checks adapt to the structure in front of them: private equity, venture,
                hedge, credit, or real estate, with ILPA 3.0 expectations built in.
              </p>
            </div>
          </div>
        </section>

        <footer className="foot">
          <span>FundLens Audit</span>
          <span>Bring your own key. Audits run on your Anthropic key and are never stored on our servers.</span>
        </footer>
      </div>

      <div className="toggle-dock">
        <span className="lab">Ambient layer<small>cinematic background</small></span>
        <label className="switch">
          <input
            type="checkbox"
            checked={ambientOn}
            onChange={e => setAmbientOn(e.target.checked)}
            aria-label="Toggle cinematic ambient background"
          />
          <span className="track" />
          <span className="knob" />
        </label>
      </div>
    </div>
  )
}
