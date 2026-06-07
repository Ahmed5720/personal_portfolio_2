import './OverlayPageView.css'

export type OverlayPageId = 'projects' | 'blog' | 'contact'

interface OverlayPageViewProps {
  page: OverlayPageId
  onBack: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

const PAGE_TITLES: Record<OverlayPageId, string> = {
  projects: 'Projects',
  blog: 'Blog',
  contact: 'Contact',
}

export function OverlayPageView({
  page,
  onBack,
  isFullscreen,
  onToggleFullscreen,
}: OverlayPageViewProps) {
  const title = PAGE_TITLES[page]

  return (
    <div className="overlay-page" role="document" aria-label={title}>
      <div className="overlay-page__terminal">
        <p className="overlay-page__line overlay-page__line--system">
          TERMINAL v1.0 — {title.toUpperCase()}
        </p>
        <p className="overlay-page__line">
          <span className="overlay-page__prompt">&gt;</span> LOADING {title.toUpperCase()}...
        </p>
        <p className="overlay-page__line overlay-page__line--empty">
          // Content coming soon.
        </p>
        <button type="button" className="overlay-page__back" onClick={onBack}>
          <span className="overlay-page__prompt">&gt;</span> BACK TO MENU
        </button>
        <button
          type="button"
          className="overlay-page__back overlay-page__back--fullscreen"
          onClick={onToggleFullscreen}
        >
          <span className="overlay-page__prompt">&gt;</span>{' '}
          {isFullscreen ? 'RETURN TO SCENE' : 'FULL SCREEN MENU'}
        </button>
      </div>
    </div>
  )
}
