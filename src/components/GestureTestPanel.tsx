import type { RefObject } from 'react';
import { useState } from 'react';
import type { AlbumState, GestureActions } from '../hooks/useGestureController';
import { useHandGestureControls } from '../hooks/useHandGestureControls';
import { useHandLandmarker, type LandmarkPoint } from '../hooks/useHandLandmarker';

type GestureTestPanelProps = {
  actions?: GestureActions;
  albumState: AlbumState;
  openedCardId?: string | null;
  selectedCardId?: string | null;
  trackRef?: RefObject<HTMLElement | null>;
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

function formatConfidence(value: number) {
  return value.toFixed(2);
}

export function GestureTestPanel({
  actions,
  albumState,
  openedCardId = null,
  selectedCardId = null,
  trackRef,
}: GestureTestPanelProps) {
  const { videoRef, canvasRef, debugState, start, stop } = useHandLandmarker();
  const [showVideoPreview, setShowVideoPreview] = useState(true);
  const actionDebugState = useHandGestureControls({
    actions,
    albumState,
    debugState,
    enabled: Boolean(actions && trackRef),
    openedCardId,
    selectedCardId,
    trackRef,
  });
  const panelClassName = [
    'gesture-test-panel',
    showVideoPreview ? '' : 'gesture-test-panel--video-collapsed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={panelClassName} aria-label="Gesture tracking test">
      <div className="gesture-test-panel__controls">
        <button className="gesture-test-panel__button" type="button" onClick={start}>
          Start Gesture Test
        </button>
        <button
          className="gesture-test-panel__button gesture-test-panel__button--quiet"
          type="button"
          onClick={stop}
          disabled={!debugState.cameraActive}
        >
          Stop
        </button>
        <button
          className="gesture-test-panel__button gesture-test-panel__button--quiet"
          type="button"
          onClick={() => setShowVideoPreview((currentValue) => !currentValue)}
        >
          {showVideoPreview ? 'Hide Video' : 'Show Video'}
        </button>
      </div>

      <div className="gesture-test-panel__stage">
        <video
          ref={videoRef}
          className="gesture-test-panel__video"
          autoPlay
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="gesture-test-panel__canvas" aria-hidden="true" />
      </div>

      <div className="gesture-test-panel__debug" aria-live="polite">
        <dl>
          <div>
            <dt>cameraPermission</dt>
            <dd>{debugState.cameraPermission}</dd>
          </div>
          <div>
            <dt>cameraActive</dt>
            <dd>{formatBoolean(debugState.cameraActive)}</dd>
          </div>
          <div>
            <dt>modelLoaded</dt>
            <dd>{formatBoolean(debugState.modelLoaded)}</dd>
          </div>
          <div>
            <dt>handDetected</dt>
            <dd>{formatBoolean(debugState.handDetected)}</dd>
          </div>
          <div>
            <dt>numberOfHands</dt>
            <dd>{debugState.numberOfHands}</dd>
          </div>
          <div>
            <dt>currentGesture</dt>
            <dd>{actionDebugState.currentGesture}</dd>
          </div>
          <div>
            <dt>lastGesture</dt>
            <dd>{actionDebugState.lastGesture}</dd>
          </div>
          <div>
            <dt>gestureConfidence</dt>
            <dd>{formatConfidence(debugState.gestureConfidence)}</dd>
          </div>
          <div>
            <dt>cooldownRemaining</dt>
            <dd>{debugState.cooldownRemaining}ms</dd>
          </div>
          <div>
            <dt>gestureCooldownRemaining</dt>
            <dd>{actionDebugState.gestureCooldownRemaining}ms</dd>
          </div>
          <div>
            <dt>ignoredGestureReason</dt>
            <dd>{actionDebugState.ignoredGestureReason}</dd>
          </div>
          <div>
            <dt>albumState</dt>
            <dd>{actionDebugState.albumState}</dd>
          </div>
          <div>
            <dt>selectedCardId</dt>
            <dd>{actionDebugState.selectedCardId ?? 'null'}</dd>
          </div>
          <div>
            <dt>openedCardId</dt>
            <dd>{actionDebugState.openedCardId ?? 'null'}</dd>
          </div>
          <div>
            <dt>lastTriggeredAction</dt>
            <dd>{actionDebugState.lastTriggeredAction}</dd>
          </div>
          <div>
            <dt>actionCooldown</dt>
            <dd>{actionDebugState.actionCooldownRemaining}ms</dd>
          </div>
          <div>
            <dt>indexFingerTip</dt>
            <dd>{formatPoint(debugState.indexFingerTip)}</dd>
          </div>
          <div>
            <dt>wrist</dt>
            <dd>{formatPoint(debugState.wrist)}</dd>
          </div>
          <div>
            <dt>thumbTip</dt>
            <dd>{formatPoint(debugState.thumbTip)}</dd>
          </div>
          <div>
            <dt>pinkyTip</dt>
            <dd>{formatPoint(debugState.pinkyTip)}</dd>
          </div>
        </dl>

        {debugState.errorMessage ? (
          <p className="gesture-test-panel__error">{debugState.errorMessage}</p>
        ) : (
          <p className="gesture-test-panel__hint">
            Camera and landmark status will update here after the test starts.
          </p>
        )}
      </div>
    </section>
  );
}
