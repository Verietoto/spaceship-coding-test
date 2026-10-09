// 7. Reports: AI summary, export of the active filter (CSV with a preview, or print to PDF), report schedules.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useApi } from '../../app/useApi'
import { useApp } from '../../app/useApp'
import { GlowIcon } from '../../components/GlowIcon'
import { Icon } from '../../components/Icon'
import { SectionHead } from '../../components/SectionHead'
import { Seg } from '../../components/Seg'
import { useMessages } from '../../i18n'
import { common } from '../../i18n/common'
import { useFormat } from '../../i18n/format'
import { reports } from '../../i18n/reports'
import { apiUrl, fq } from '../../lib/api'
import { slug } from '../../lib/filterQuery'
import type { Calc } from '../../lib/types'

export function Reports({ summary, schedules }: { summary: ReactNode; schedules: ReactNode }) {
  const { view } = useApp()
  const t = useMessages(reports)
  const tc = useMessages(common)
  const fmt = useFormat()
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv')
  const { data } = useApi<{ calc: Calc }>('overview', fq(view.f))
  const href = apiUrl('export.csv', fq(view.f))
  const [preview, setPreview] = useState<{ href: string; lines: string[] }>({ href: '', lines: [] })

  useEffect(() => {
    let live = true
    fetch(href)
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => live && setPreview({ href, lines: text.split('\n').filter(Boolean).slice(0, 6) }))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [href])

  const scope = slug(view.f)
  return (
    <>
      <SectionHead title={tc('nav_reports')} question={t('question')} />
      {summary}
      <div className="grid-even">
        <section className="card glow-host">
          <div className="card-head">
            <div className="card-title">
              <GlowIcon name="download" tone="t3" />
              <div>
                <h3>{t('export')}</h3>
                <p>{t('export_sub', { n: data ? fmt.int(data.calc.rows) : '…' })}</p>
              </div>
            </div>
          </div>
          <div className="form-stack">
            <div className="row">
              <Seg label={t('fmt_label')} value={format} onChange={setFormat} options={[['csv', t('fmt_csv')], ['pdf', t('fmt_pdf')]]} />
              <span className="mono xsmall muted">{t('filename', { f: scope, ext: format })}</span>
            </div>
            {format === 'csv' && preview.href === href && preview.lines.length > 0 && (
              <>
                <span className="lab">{t('preview')}</span>
                <div className="preview">
                  {preview.lines.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </>
            )}
            {format === 'csv' ? (
              <a className="btn primary" style={{ justifySelf: 'start' }} href={href} download>
                <Icon name="download" size={16} /> {t('csv')}
              </a>
            ) : (
              <button type="button" className="btn primary" style={{ justifySelf: 'start' }} onClick={() => window.print()}>
                <Icon name="reports" size={16} /> {t('pdf')}
              </button>
            )}
          </div>
        </section>
        {schedules}
      </div>
    </>
  )
}
