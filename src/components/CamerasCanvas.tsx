import { useEffect, useRef } from 'react';
import type { MenuLayout } from '../cameraConstants';
import { initCameras } from '../webgpu/cameras/initCameras';

const DEFAULT_MODEL_URL = '/assets/models/roomyff.obj';

interface CamerasCanvasProps {
  modelUrl?: string;
  sceneHidden?: boolean;
  onActiveSlotChange?: (slotIndex: number) => void;
  onOrbitActiveChange?: (active: boolean) => void;
  onMenuLayoutChange?: (layout: MenuLayout) => void;
}

export function CamerasCanvas({
  modelUrl = DEFAULT_MODEL_URL,
  sceneHidden = false,
  onActiveSlotChange,
  onOrbitActiveChange,
  onMenuLayoutChange,
}: CamerasCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    initCameras(canvas, {
      modelUrl,
      onActiveSlotChange,
      onOrbitActiveChange,
      onMenuLayoutChange,
    })
      .then((dispose) => {
        if (cancelled) {
          dispose();
        } else {
          cleanup = dispose;
        }
      })
      .catch((err) => {
        console.error('WebGPU cameras sample failed to start:', err);
      });

    return () => {
      cancelled = true;
      cleanup?.();
      onActiveSlotChange?.(-1);
      onOrbitActiveChange?.(false);
    };
  }, [modelUrl, onActiveSlotChange, onOrbitActiveChange, onMenuLayoutChange]);

  return (
    <canvas
      ref={canvasRef}
      className={`scene-canvas${sceneHidden ? ' scene-canvas--hidden' : ''}`}
      aria-hidden="true"
    />
  );
}
