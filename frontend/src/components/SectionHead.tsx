import type { ReactNode } from 'react'

export function SectionHead({ title, question, right }: { title: string; question: string; right?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h1>{title}</h1>
        <p className="muted">{question}</p>
      </div>
      {right}
    </div>
  )
}
