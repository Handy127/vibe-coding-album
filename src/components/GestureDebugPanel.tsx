import type { HandGestureControlDebugState } from '../hooks/useHandGestureControls';
import type { HandLandmarkerDebugState, LandmarkPoint } from '../hooks/useHandLandmarker';

type GestureDebugPanelProps = {
  actionState: HandGestureControlDebugState;
  debugState: HandLandmarkerDebugState;
};

function formatPoint(position: LandmarkPoint) {
  if (!position) {
    return '--, --';
  }

  return `${position.x.toFixed(2)}, ${position.y.toFixed(2)}`;
}

function formatCooldown(milliseconds: number) {
  return `${Math.ceil(milliseconds)}ms`;
}

export function GestureDebugPanel({ actionState, debugState }: GestureDebugPanelProps) {
  return (
    <aside className="gesture-debug-panel" aria-label="Gesture debug panel">
      <dl>
        <div>
          <dt>camera permission</dt>
          <dd>{debugState.cameraPermission}</dd>
        </div>
        <div>
          <dt>camera active</dt>
          <dd>{String(debugState.cameraActive)}</dd>
        </div>
        <div>
          <dt>model loaded</dt>
          <dd>{String(debugState.modelLoaded)}</dd>
        </div>
        <div>
          <dt>hand detected</dt>
          <dd>{String(debugState.handDetected)}</dd>
        </div>
        <div>
          <dt>index finger</dt>
          <dd>{formatPoint(debugState.indexFingerTip)}</dd>
        </div>
        <div>
          <dt>current gesture</dt>
          <dd>{debugState.currentGesture}</dd>
        </div>
        <div>
          <dt>gesture confidence</dt>
          <dd>{debugState.gestureConfidence.toFixed(2)}</dd>
        </div>
        <div>
          <dt>last action</dt>
          <dd>{actionState.lastTriggeredAction}</dd>
        </div>
        <div>
          <dt>action cooldown</dt>
          <dd>{formatCooldown(actionState.actionCooldownRemaining)}</dd>
        </div>
      </dl>

      {debugState.errorMessage ? (
        <p className="gesture-debug-panel__status gesture-debug-panel__status--error">
          {debugState.errorMessage}
        </p>
      ) : null}
    </aside>
  );
}
