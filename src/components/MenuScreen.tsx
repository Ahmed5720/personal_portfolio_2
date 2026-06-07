import type { OverlayPageId } from './OverlayPageView'
import './MenuScreen.css'

const MENU_ITEMS: { id: OverlayPageId; label: string }[] = [
  { id: 'projects', label: 'PROJECTS' },
  { id: 'blog', label: 'BLOG' },
  { id: 'contact', label: 'CONTACT' },
]

interface MenuScreenProps {
  onNavigate: (page: OverlayPageId) => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export function MenuScreen({
  onNavigate,
  isFullscreen,
  onToggleFullscreen,
}: MenuScreenProps) {
  return (
    <div className="menu-screen" role="dialog" aria-label="Main menu">
      <div className="menu-screen__terminal">
        <p className="menu-screen__line menu-screen__line--system">
          TERMINAL v1.01 — AHMED NASSAR
        </p>
        <p className="menu-screen__line">BOOT OK... CONNECTION ESTABLISHED</p>
        <p className="menu-screen__line menu-screen__line--blink">
          <span className="menu-screen__prompt">&gt;</span> AWAITING INPUT_
        </p>

        <nav className="menu-screen__nav" aria-label="Primary">
          <ul className="menu-screen__list">
            {MENU_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="menu-screen__button"
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="menu-screen__prompt">&gt;</span> {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="menu-screen__button menu-screen__button--fullscreen"
          onClick={onToggleFullscreen}
        >
          <span className="menu-screen__prompt">&gt;</span>{' '}
          {isFullscreen ? 'RETURN TO SCENE' : 'FULL SCREEN MENU'}
        </button>
      </div>
    </div>
  )
}
