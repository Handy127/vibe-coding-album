import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { FingerCursor } from './FingerCursor';
import { FingerHotZones } from './FingerHotZones';
import type { AlbumState, GestureActions, GestureMotionControls } from '../hooks/useGestureController';
import {
  DEFAULT_FINGER_CURSOR_CALIBRATION,
  useFingerCursor,
} from '../hooks/useFingerCursor';
import { useHandLandmarker, type LandmarkPoint } from '../hooks/useHandLandmarker';

type ImageLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

type FingerCursorDebugPanelProps = {
  actions?: GestureActions;
  albumState: AlbumState;
  motion?: GestureMotionControls;
  onFingerModeChange?: (active: boolean) => void;
  openedCardId?: string | null;
  selectedCardId?: string | null;
  trackRef?: RefObject<HTMLElement | null>;
  openedMemoryExists?: boolean;
  openedImageSrc?: string;
  imageLoadStatus?: ImageLoadStatus;
  lastImageErrorSrc?: string | null;
};

const FINGER_CURSOR_CALIBRATION = {
  ...DEFAULT_FINGER_CURSOR_CALIBRATION,
  cursorOffsetX: 0,
  cursorOffsetY: 0,
  cursorScaleX: 1,
  cursorScaleY: 1,
  mirrorX: true,
};

function formatBoolean(value: boolean) {
  return value ? 'true' : 'false';
}

function formatPoint(point: LandmarkPoint) {
  if (!point) {
    return 'x: --, y: --';
  }

  return `x: ${point.x.toFixed(3)}, y: ${point.y.toFixed(3)}`;
}

function formatScreenPoint(x: number | null, y: number | null) {
  if (x === null || y === null) {
    return 'x: --, y: --';
  }

  return `x: ${Math.round(x)}, y: ${Math.round(y)}`;
}

function formatCoordinate(value: number | null, digits = 3) {
  if (value === null) {
    return '--';
  }

  return value.toFixed(digits);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function FingerCursorDebugPanel({
  actions,
  albumState,
  motion,
  onFingerModeChange,
  openedCardId = null,
  selectedCardId = null,
  trackRef,
  openedMemoryExists = false,
  openedImageSrc = '',
  imageLoadStatus = 'idle',
  lastImageErrorSrc = null,
}: FingerCursorDebugPanelProps) {
  const { videoRef, canvasRef, debugState, start, stop } = useHandLandmarker();
  const [fingerCursorMode, setFingerCursorMode] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const fingerCursor = useFingerCursor({
    actions,
    albumState,
    calibration: FINGER_CURSOR_CALIBRATION,
    debugState,
    enabled: fingerCursorMode,
    motion,
    openedCardId,
    selectedCardId,
    trackRef,
  });
  const mediaClassName = [
    'finger-cursor-debug__media',
    FINGER_CURSOR_CALIBRATION.mirrorX ? 'finger-cursor-debug__media--mirrored' : '',
    showCameraPreview ? '' : 'finger-cursor-debug__media--hidden',
  ]
    .filter(Boolean)
    .join(' ');
  const panelClassName = [
    'finger-cursor-debug',
    showDebugPanel ? '' : 'finger-cursor-debug--collapsed',
  ]
    .filter(Boolean)
    .join(' ');

  const handleStartClick = () => {
    setFingerCursorMode(true);
    onFingerModeChange?.(true);
    void start();
  };

  const handleStopClick = () => {
    setFingerCursorMode(false);
    onFingerModeChange?.(false);
    stop();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) {
        return;
      }

      if (event.key.toLowerCase() === 'p') {
        setShowCameraPreview((currentValue) => !currentValue);
        return;
      }

      if (event.key.toLowerCase() === 'd') {
        setShowDebugPanel((currentValue) => !currentValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
      <FingerCursor
        isVisible={fingerCursor.cursor.isVisible}
        state={fingerCursor.cursor.state}
        x={fingerCursor.cursor.x}
        y={fingerCursor.cursor.y}
      />

      <FingerHotZones
        activeControlZone={fingerCursor.debugState.activeControlZone}
        carouselControlSpeed={fingerCursor.debugState.carouselControlSpeed}
        visible={fingerCursorMode && fingerCursor.debugState.handDetected}
      />

      <button
        className="finger-cursor-debug__button"
        type="button"
        onClick={fingerCursorMode ? handleStopClick : handleStartClick}
        disabled={fingerCursorMode && debugState.cameraActive}
        style={{
          position: 'fixed',
          top: '18px',
          left: '18px',
          zIndex: 70,
        }}
      >
        {fingerCursorMode ? '关闭手势光标' : '开启手势光标'}
      </button>

      {fingerCursorMode ? (
        <div
          style={{
            position: 'fixed',
            top: '54px',
            left: '18px',
            zIndex: 70,
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: '10px',
            padding: '5px 7px',
            borderRadius: '3px',
            lineHeight: 1.4,
            maxWidth: '200px',
          }}
        >
          <div>cam: {debugState.cameraPermission} active:{String(debugState.cameraActive)}</div>
          <div>model: {String(debugState.modelLoaded)}</div>
          <div>hand: {String(debugState.handDetected)}</div>
          <div>finger: {fingerCursor.debugState.indexFingerTip ? `${fingerCursor.debugState.indexFingerTip.x.toFixed(3)},${fingerCursor.debugState.indexFingerTip.y.toFixed(3)}` : 'null'}</div>
          <div>cursor: {fingerCursor.debugState.cursorX?.toFixed(1) ?? '--'},{fingerCursor.debugState.cursorY?.toFixed(1) ?? '--'}</div>
          <div>err: {debugState.errorMessage ? debugState.errorMessage.slice(0, 60) : 'none'}</div>
        </div>
      ) : null}

      <div className={mediaClassName}>
        <video
          ref={videoRef}
          className="finger-cursor-debug__video"
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="finger-cursor-debug__canvas"
          aria-hidden="true"
        />
      </div>

      {showDebugPanel ? (
        <aside className={panelClassName} aria-label="Finger cursor debug panel">
          <div className="finger-cursor-debug__controls">
            <button
              className="finger-cursor-debug__button finger-cursor-debug__button--quiet"
              type="button"
              onClick={() => setShowCameraPreview((currentValue) => !currentValue)}
            >
              {showCameraPreview ? 'Hide Camera' : 'Show Camera'}
            </button>
          </div>

          <dl className="finger-cursor-debug__list">
            <div>
              <dt>fingerCursorMode</dt>
              <dd>{formatBoolean(fingerCursor.debugState.fingerCursorMode)}</dd>
            </div>
            <div>
              <dt>handDetected</dt>
              <dd>{formatBoolean(fingerCursor.debugState.handDetected)}</dd>
            </div>
            <div>
              <dt>cursorX</dt>
              <dd>{formatCoordinate(fingerCursor.debugState.cursorX, 1)}</dd>
            </div>
            <div>
              <dt>cursorY</dt>
              <dd>{formatCoordinate(fingerCursor.debugState.cursorY, 1)}</dd>
            </div>
            <div>
              <dt>activeControlZone</dt>
              <dd>{fingerCursor.debugState.activeControlZone}</dd>
            </div>
            <div>
              <dt>carouselControlSpeed</dt>
              <dd>{fingerCursor.debugState.carouselControlSpeed}</dd>
            </div>
            <div>
              <dt>currentCarouselSpeed</dt>
              <dd>{formatCoordinate(fingerCursor.debugState.currentCarouselSpeed, 3)}</dd>
            </div>
            <div>
              <dt>albumState</dt>
              <dd>{fingerCursor.debugState.albumState}</dd>
            </div>
            <div>
              <dt>selectedCardId</dt>
              <dd>{fingerCursor.debugState.selectedCardId ?? 'null'}</dd>
            </div>
            <div>
              <dt>openedCardId</dt>
              <dd>{fingerCursor.debugState.openedCardId ?? 'null'}</dd>
            </div>
            <div>
              <dt>ignoredReason</dt>
              <dd>{fingerCursor.debugState.ignoredReason}</dd>
            </div>
          </dl>

          {debugState.errorMessage ? (
            <p className="finger-cursor-debug__error">{debugState.errorMessage}</p>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
