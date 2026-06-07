import './ControlsFooter.css'

export function ControlsFooter() {
  return (
    <footer className="controls-footer" aria-label="Controls">
      <p className="controls-footer__text">
        Use <kbd>←</kbd> and <kbd>→</kbd> arrow keys to toggle views. Mouse drag
        to orbit, scroll wheel to zoom. Navigate to the computer to access the
        title menu.
      </p>
    </footer>
  )
}
