// The help button in the header: replay the tour, or see only what is new.
import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useDismiss } from '../../components/useDismiss'
import { useMessages } from '../../i18n'
import { tour as tourMsg } from '../../i18n/tour'
import { useTourControls } from './TourProvider'

export function TourButton() {
  const t = useMessages(tourMsg)
  const tour = useTourControls()
  const [isOpen, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useDismiss(root, isOpen, () => setOpen(false))
  if (!tour) return null
  const choose = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  return (
    <div className="popover-wrap" ref={root}>
      <button type="button" className="icon-btn" aria-label={t('help_label')} title={t('help_label')} aria-expanded={isOpen} aria-haspopup="true" onClick={() => setOpen(!isOpen)}>
        <Icon name="help" size={18} />
      </button>
      {isOpen && (
        <div className="popover narrow card tour-menu" role="menu" aria-label={t('help_label')}>
          <button type="button" role="menuitem" className="btn ghost" onClick={choose(tour.restart)}>
            {t('help_restart')}
          </button>
          {tour.hasNews && (
            <button type="button" role="menuitem" className="btn ghost" onClick={choose(tour.showNews)}>
              {t('help_news')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
