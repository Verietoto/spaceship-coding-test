// The card that explains one step (or welcomes, or says goodbye). Presentational: the overlay decides where it goes and what the buttons do.
import type { CSSProperties, Ref } from 'react'
import { Icon } from '../../components/Icon'
import { useMessages } from '../../i18n'
import { tour as tourMsg } from '../../i18n/tour'
import type { Side } from '../../lib/tour'

export type CardProps = {
  kind: 'welcome' | 'step' | 'finish'
  titleId: string
  bodyId: string
  title: string
  body: string
  /** A step: the name of its chapter, which chapter it is of how many, and its place among the steps of that chapter. */
  chapter?: string
  chapterNo?: number
  chapterOf?: number
  dots?: { total: number; index: number }
  /** A step: where it is among all the steps of the run. */
  index?: number
  total?: number
  /** Bullet points under the text of a step. */
  items?: string[]
  /** Welcome: the three selling points. Finish: the questions to try. */
  points?: string[]
  isNews?: boolean
  /** Finish: one line under the questions. */
  hint?: string
  /** A step: is there another chapter after this one to jump to? */
  canSkipChapter?: boolean
  side: Side
  style?: CSSProperties
  /** The card's own element, so the overlay can measure it. */
  ref?: Ref<HTMLDivElement>
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onSkipChapter?: () => void
  onTry?: (question: string) => void
}

export function TourCard({
  kind, titleId, bodyId, title, body, chapter, chapterNo = 0, chapterOf = 0, dots, index = 0, total = 0, items = [], points = [], isNews, hint,
  canSkipChapter, side, style, ref, onNext, onBack, onSkip, onSkipChapter, onTry,
}: CardProps) {
  const t = useMessages(tourMsg)
  return (
    <div ref={ref} className={`tour-card ${kind} side-${side}`} style={style} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
      <button type="button" className="icon-btn tour-close" aria-label={t('close')} onClick={onSkip}>
        <Icon name="close" size={16} />
      </button>
      {kind === 'welcome' && (
        <span className="tour-mark" aria-hidden="true">
          S
        </span>
      )}
      {kind === 'step' && chapter && (
        <p className="tour-chapter-row">
          <span className="tour-chapter">{chapter}</span>
          <span className="tour-chapter-no">{t('chapter_of', { n: chapterNo, total: chapterOf })}</span>
        </p>
      )}
      <h2 id={titleId} className="tour-title">
        {title}
      </h2>
      <p id={bodyId} className="tour-body">
        {body}
      </p>
      {kind === 'step' && items.length > 0 && (
        <ul className="tour-points tour-items">
          {items.map((item) => (
            <li key={item}>
              <Icon name="arrow" size={14} /> {item}
            </li>
          ))}
        </ul>
      )}
      {kind === 'welcome' && (
        <>
          {!isNews && (
            <ul className="tour-points">
              {points.map((p) => (
                <li key={p}>
                  <Icon name="sparkle" size={14} /> {p}
                </li>
              ))}
            </ul>
          )}
          <p className="tour-time">{isNews ? '' : t('welcome_time')}</p>
        </>
      )}
      {kind === 'finish' && hint && <p className="tour-time">{hint}</p>}
      {kind === 'finish' && points.length > 0 && (
        <div className="tour-try">
          {points.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => onTry?.(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      {kind === 'step' && (
        <p className="tour-skips">
          {canSkipChapter && (
            <button type="button" className="link xsmall" onClick={onSkipChapter}>
              {t('skip_chapter')}
            </button>
          )}
          <button type="button" className="link xsmall" onClick={onSkip}>
            {t('skip_tour')}
          </button>
        </p>
      )}
      <div className="tour-foot">
        {kind === 'step' && dots ? (
          <span className="tour-progress" aria-label={t('progress', { n: index + 1, total })}>
            <span className="tour-dots" aria-hidden="true">
              {Array.from({ length: dots.total }, (_, i) => (
                <span key={i} className="tour-dot" aria-current={i === dots.index ? 'step' : undefined} data-done={i < dots.index ? 'true' : undefined} />
              ))}
            </span>
            <span className="tour-count">{t('progress', { n: index + 1, total })}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="tour-actions">
          {kind === 'welcome' ? (
            <>
              <button type="button" className="btn ghost" onClick={onSkip}>
                {t('skip')}
              </button>
              <button type="button" className="btn primary" onClick={onNext} data-tour-primary>
                {isNews ? t('start_news') : t('start')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={onBack}>
                {t('back')}
              </button>
              <button type="button" className="btn primary" onClick={onNext} data-tour-primary>
                {kind === 'finish' ? t('done') : t('next')}
              </button>
            </>
          )}
        </span>
      </div>
    </div>
  )
}
