// Friendly robot for the empty Copilot state (inline SVG, theme colors, gentle float unless reduced motion).
export function CopilotIllustration() {
  return (
    <svg className="robot breathe" width="132" height="116" viewBox="0 0 132 116" aria-hidden="true">
      <circle cx="66" cy="62" r="46" style={{ fill: 'var(--ai-bg)' }} />
      <path d="M66 22 V32" style={{ stroke: 'var(--ai)', strokeWidth: 3, strokeLinecap: 'round' }} />
      <circle cx="66" cy="19" r="4.5" style={{ fill: 'var(--ai-line2)' }} />
      <rect x="36" y="32" width="60" height="46" rx="16" style={{ fill: 'var(--ai-btn)' }} />
      <rect x="44" y="42" width="44" height="24" rx="10" style={{ fill: 'var(--ai-deep2)', opacity: 0.85 }} />
      <circle cx="56" cy="54" r="4" style={{ fill: '#a5f3fc' }} />
      <circle cx="76" cy="54" r="4" style={{ fill: '#a5f3fc' }} />
      <path d="M60 62 Q66 66 72 62" style={{ fill: 'none', stroke: '#a5f3fc', strokeWidth: 2, strokeLinecap: 'round' }} />
      <rect x="28" y="48" width="8" height="16" rx="4" style={{ fill: 'var(--ai-line2)' }} />
      <rect x="96" y="48" width="8" height="16" rx="4" style={{ fill: 'var(--ai-line2)' }} />
      <rect x="48" y="80" width="36" height="16" rx="8" style={{ fill: 'var(--ai-line)' }} />
      <path d="M110 24 L112 30 L118 32 L112 34 L110 40 L108 34 L102 32 L108 30 Z" style={{ fill: 'var(--ai-line2)' }} />
      <path d="M20 44 L21.6 48.4 L26 50 L21.6 51.6 L20 56 L18.4 51.6 L14 50 L18.4 48.4 Z" style={{ fill: 'var(--ai-line)' }} />
    </svg>
  )
}
