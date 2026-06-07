import { useCallback, useEffect, useState } from 'react'
import { CamerasCanvas } from './components/CamerasCanvas'
import { ControlsFooter } from './components/ControlsFooter'
import { MenuScreen } from './components/MenuScreen'
import {
  OverlayPageView,
  type OverlayPageId,
} from './components/OverlayPageView'
import {
  DEFAULT_MENU_LAYOUT,
  MENU_ORIENTATION_SLOT,
  type MenuLayout,
} from './cameraConstants'
import './App.css'

type OverlayView = 'menu' | OverlayPageId

function App() {
  const [activeSlot, setActiveSlot] = useState(-1)
  const [orbitActive, setOrbitActive] = useState(false)
  const [menuFullscreen, setMenuFullscreen] = useState(false)
  const [menuLayout, setMenuLayout] = useState<MenuLayout>(DEFAULT_MENU_LAYOUT)
  const [overlayView, setOverlayView] = useState<OverlayView>('menu')

  const onActiveSlotChange = useCallback((slotIndex: number) => {
    setActiveSlot(slotIndex)
  }, [])

  const onOrbitActiveChange = useCallback((active: boolean) => {
    setOrbitActive(active)
  }, [])

  const onMenuLayoutChange = useCallback((layout: MenuLayout) => {
    setMenuLayout(layout)
  }, [])

  const toggleMenuFullscreen = useCallback(() => {
    setMenuFullscreen((value) => !value)
  }, [])

  const showMenuOverlay =
    menuFullscreen ||
    (activeSlot === MENU_ORIENTATION_SLOT && !orbitActive)

  useEffect(() => {
    if (!showMenuOverlay) {
      setOverlayView('menu')
      setMenuFullscreen(false)
    }
  }, [showMenuOverlay])

  return (
    <div className="viewport">
      <CamerasCanvas
        sceneHidden={menuFullscreen}
        onActiveSlotChange={onActiveSlotChange}
        onOrbitActiveChange={onOrbitActiveChange}
        onMenuLayoutChange={onMenuLayoutChange}
      />
      {showMenuOverlay && (
        <div
          className={
            menuFullscreen
              ? 'menu-panel menu-panel--fullscreen'
              : 'menu-panel'
          }
          style={
            menuFullscreen
              ? undefined
              : {
                  width: menuLayout.width,
                  height: menuLayout.height,
                  left: `${menuLayout.centerX}%`,
                  top: `${menuLayout.centerY}%`,
                }
          }
        >
          {overlayView === 'menu' ? (
            <MenuScreen
              isFullscreen={menuFullscreen}
              onToggleFullscreen={toggleMenuFullscreen}
              onNavigate={setOverlayView}
            />
          ) : (
            <OverlayPageView
              page={overlayView}
              isFullscreen={menuFullscreen}
              onToggleFullscreen={toggleMenuFullscreen}
              onBack={() => setOverlayView('menu')}
            />
          )}
        </div>
      )}
      <ControlsFooter />
    </div>
  )
}

export default App
