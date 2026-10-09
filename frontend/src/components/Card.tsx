import type { ReactNode } from 'react'

type CardProps = { title?: ReactNode; sub?: string; actions?: ReactNode; children: ReactNode; className?: string }

export function Card({ title, sub, actions, children, className = '' }: CardProps) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <p className="muted small">{sub}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
