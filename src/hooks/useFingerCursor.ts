import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AlbumState, GestureActions, GestureMotionControls } from './useGestureController';
import {
  enableAdvancedGestures,
  type HandLandmarkerDebugState,
  type LandmarkPoint,
} from './useHandLandmarker';

export type FingerCursorState = 'idle' | 'hoveringCard' | 'draggingUp';

export type FingerCursorActionName = 'none' | 'selectCard' | 'openSelectedCard';

export type FingerCursorCalibration = {
  cursorOffsetX?: number;
  cursorOffsetY?: number;
  cursorScaleX?: number;
  cursorScaleY?: number;
  mirrorX?: boolean;
};

export type FingerCursorDebugState = {
  activeControlMode: 'fingerCursor';
  activeControlZone: 'left' | 'center' | 'right' | 'none';
  advancedGesturesEnabled: boolean;
  albumState: AlbumState;
  cameraActive: boolean;
  carouselControlSpeed: 'none' | 'slow' | 'medium' | 'fast';
  closeCooldownRemaining: number;
  currentCarouselSpeed: number;
  isWheelActive: boolean;
  closeDwellProgress: number;
  closeGestureDetected: boolean;
  closeGestureType: 'none' | 'downwardSwipe' | 'closeButtonDwell' | 'mouseClick';
  cursorX: number | null;
  cursorY: number | null;
  displayedX: number | null;
  displayedY: number | null;
  fingerCursorMode: boolean;
  handDetected: boolean;
  hoveredCardId: string | null;
  ignoredReason: string;
  indexFingerTip: LandmarkPoint;
  lastCarouselAction: 'left' | 'right' | 'none';
  lastFingerAction: FingerCursorActionName;
  mappedX: number | null;
  mappedY: number | null;
  mirrorX: boolean;
  modelLoaded: boolean;
  nextCarouselActionInMs: number;
  openedCardId: string | null;
  rawLandmarkX: number | null;
  rawLandmarkY: number | null;
  selectedCardId: string | null;
  selectionStartY: number | null;
  upwardDrawDelta: number;
};

export type FingerCursorSnapshot = {
  hoveredCardId: string | null;
  isVisible: boolean;
  state: FingerCursorState;
  x: number;
  y: number;
};

type UseFingerCursorOptions = {
  actions?: GestureActions;
  albumState: AlbumState;
  calibration?: FingerCursorCalibration;
  debugState: HandLandmarkerDebugState;
  enabled: boolean;
  motion?: GestureMotionControls;
  openedCardId?: string | null;
  selectedCardId?: string | null;
  trackRef?: RefObject<HTMLElement | null>;
};

const CURSOR_LERP = 0.25;
const LOST_HAND_TIMEOUT_MS = 300;
const HOVER_RETENTION_MS = 500;
const UPWARD_DRAW_THRESHOLD_PX = 80;
const POST_OPEN_LOCK_MS = 1000;
const WHEEL_DEAD_LEFT = 0.40;
const WHEEL_DEAD_RIGHT = 0.60;
const WHEEL_MAX_SPEED = 2.2;
const WHEEL_LERP = 0.08;
const WHEEL_SYNC_INTERVAL_MS = 100;
const CLOSE_DOWNWARD_SWIPE_PX = 120;
const CLOSE_DWELL_DURATION_MS = 700;
const CLOSE_COOLDOWN_MS = 800;

export const DEFAULT_FINGER_CURSOR_CALIBRATION: Required<FingerCursorCalibration> = {
  cursorOffsetX: 0,
  cursorOffsetY: 0,
  cursorScaleX: 1,
  cursorScaleY: 1,
  mirrorX: true,
};

const INITIAL_CURSOR: FingerCursorSnapshot = {
  hoveredCardId: null,
  isVisible: false,
  state: 'idle',
  x: 0,
  y: 0,
};

const INITIAL_DEBUG_STATE: FingerCursorDebugState = {
  activeControlMode: 'fingerCursor',
  activeControlZone: 'none',
  advancedGesturesEnabled: enableAdvancedGestures,
  albumState: 'idle',
  cameraActive: false,
  carouselControlSpeed: 'none',
  closeCooldownRemaining: 0,
  currentCarouselSpeed: 0,
  isWheelActive: false,
  closeDwellProgress: 0,
  closeGestureDetected: false,
  closeGestureType: 'none',
  cursorX: null,
  cursorY: null,
  displayedX: null,
  displayedY: null,
  fingerCursorMode: false,
  handDetected: false,
  hoveredCardId: null,
  ignoredReason: 'finger cursor off',
  indexFingerTip: null,
  lastCarouselAction: 'none',
  lastFingerAction: 'none',
  mappedX: null,
  mappedY: null,
  mirrorX: DEFAULT_FINGER_CURSOR_CALIBRATION.mirrorX,
  modelLoaded: false,
  nextCarouselActionInMs: 0,
  openedCardId: null,
  rawLandmarkX: null,
  rawLandmarkY: null,
  selectedCardId: null,
  selectionStartY: null,
  upwardDrawDelta: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isBrowsingState(albumState: AlbumState) {
  return albumState === 'idle' || albumState === 'browsing' || albumState === 'selecting';
}

function canOpenFromFinger(albumState: AlbumState) {
  return albumState === 'browsing' || albumState === 'selecting';
}

function getScreenPoint(
  indexFingerTip: Exclude<LandmarkPoint, null>,
  calibration: Required<FingerCursorCalibration>,
) {
  const viewportWidth = window.innerWidth || 1;
  const viewportHeight = window.innerHeight || 1;
  const sourceX = calibration.mirrorX ? 1 - indexFingerTip.x : indexFingerTip.x;
  const normalizedX =
    (sourceX - 0.5) * calibration.cursorScaleX + 0.5 + calibration.cursorOffsetX;
  const normalizedY =
    (indexFingerTip.y - 0.5) * calibration.cursorScaleY + 0.5 + calibration.cursorOffsetY;

  return {
    mappedX: clamp(normalizedX * viewportWidth, 0, viewportWidth),
    mappedY: clamp(normalizedY * viewportHeight, 0, viewportHeight),
    rawLandmarkX: indexFingerTip.x,
    rawLandmarkY: indexFingerTip.y,
  };
}

function getCardIdAtPoint(
  x: number,
  y: number,
  trackElement: HTMLElement | null | undefined,
) {
  if (!trackElement) {
    return null;
  }

  const hoveredCard = document
    .elementsFromPoint(x, y)
    .map((element) =>
      element.closest<HTMLElement>('.memory-card[data-card-id], .memory-card[data-memory-id]'),
    )
    .find((cardElement): cardElement is HTMLElement =>
      Boolean(cardElement && trackElement.contains(cardElement)),
    );

  if (hoveredCard) {
    return hoveredCard.dataset.cardId ?? hoveredCard.dataset.memoryId ?? null;
  }

  const cardElements = Array.from(
    trackElement.querySelectorAll<HTMLElement>(
      '.memory-card[data-card-id], .memory-card[data-memory-id]',
    ),
  );
  const cardUnderPoint = cardElements.find((cardElement) => {
    const rect = cardElement.getBoundingClientRect();

    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });

  return cardUnderPoint?.dataset.cardId ?? cardUnderPoint?.dataset.memoryId ?? null;
}

export function useFingerCursor({
  actions,
  albumState,
  calibration,
  debugState,
  enabled,
  motion,
  openedCardId = null,
  selectedCardId = null,
  trackRef,
}: UseFingerCursorOptions) {
  const actionsRef = useRef(actions);
  const albumStateRef = useRef(albumState);
  const calibrationRef = useRef({ ...DEFAULT_FINGER_CURSOR_CALIBRATION, ...calibration });
  const debugStateRef = useRef(debugState);
  const enabledRef = useRef(enabled);
  const frameRef = useRef<number | null>(null);
  const lastFingerActionRef = useRef<FingerCursorActionName>('none');
  const lastHoveredAtRef = useRef(0);
  const lastHoveredCardIdRef = useRef<string | null>(null);
  const lastHandSeenAtRef = useRef(0);
  const localLockUntilRef = useRef(0);
  const openedCardIdRef = useRef(openedCardId);
  const selectionStartCardIdRef = useRef<string | null>(null);
  const selectionStartYRef = useRef<number | null>(null);
  const selectedCardIdRef = useRef(selectedCardId);
  const smoothedPointRef = useRef<{ x: number; y: number } | null>(null);
  const trackRefRef = useRef(trackRef);
  const closeDownwardStartYRef = useRef<number | null>(null);
  const closeDownwardStartXRef = useRef<number | null>(null);
  const closeDwellStartTimeRef = useRef(0);
  const closeDwellProgressRef = useRef(0);
  const closeCooldownUntilRef = useRef(0);
  const closeGestureDetectedRef = useRef(false);
  const closeGestureTypeRef = useRef<'none' | 'downwardSwipe' | 'closeButtonDwell' | 'mouseClick'>('none');
  const lastCarouselActionTimeRef = useRef(0);
  const lastCarouselActionRef = useRef<'left' | 'right' | 'none'>('none');
  const currentControlZoneRef = useRef<'left' | 'center' | 'right' | 'none'>('none');
  const wheelTargetRef = useRef(0);
  const wheelSpeedRef = useRef(0);
  const wheelOffsetRef = useRef(0);
  const wheelFrameRef = useRef<number | null>(null);
  const isWheelActiveRef = useRef(false);
  const wheelLastTimeRef = useRef(0);
  const wheelLastSyncRef = useRef(0);
  const wheelGroupWidthRef = useRef(0);
  const wheelTrackRef = useRef<HTMLElement | null>(null);
  const motionRef = useRef(motion);
  const [cursor, setCursor] = useState<FingerCursorSnapshot>(INITIAL_CURSOR);
  const [fingerDebugState, setFingerDebugState] =
    useState<FingerCursorDebugState>(INITIAL_DEBUG_STATE);

  useEffect(() => {
    actionsRef.current = actions;
    albumStateRef.current = albumState;
    calibrationRef.current = { ...DEFAULT_FINGER_CURSOR_CALIBRATION, ...calibration };
    debugStateRef.current = debugState;
    enabledRef.current = enabled;
    motionRef.current = motion;
    openedCardIdRef.current = openedCardId;
    selectedCardIdRef.current = selectedCardId;
    trackRefRef.current = trackRef;
  }, [
    actions,
    albumState,
    calibration,
    debugState,
    enabled,
    motion,
    openedCardId,
    selectedCardId,
    trackRef,
  ]);

  useEffect(() => {
    return () => {
      if (wheelFrameRef.current !== null) {
        cancelAnimationFrame(wheelFrameRef.current);
        wheelFrameRef.current = null;
      }
      isWheelActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const updateCursor = () => {
      const now = performance.now();
      const latestDebugState = debugStateRef.current;
      const latestAlbumState = albumStateRef.current;
      const latestEnabled = enabledRef.current;
      const latestIndexFingerTip = latestDebugState.indexFingerTip;
      let directHoveredCardId: string | null = null;
      let hoveredCardId: string | null = null;
      let ignoredReason = latestEnabled ? 'waiting for hand' : 'finger cursor off';
      let cursorState: FingerCursorState = 'idle';
      let mappedPoint: { x: number; y: number } | null = null;
      let rawLandmarkX: number | null = null;
      let rawLandmarkY: number | null = null;
      let nextPoint = smoothedPointRef.current;
      let upwardDrawDelta = 0;
      let isHorizontalMovement = false;
      let horizontalSwipeDetected = false;
      let closeGestureDetected = false;
      let closeGestureType: 'none' | 'downwardSwipe' | 'closeButtonDwell' | 'mouseClick' = 'none';
      let closeDwellProgress = 0;
      let closeCooldownRemaining = 0;
      let activeControlZone: 'left' | 'center' | 'right' | 'none' = 'none';
      let carouselControlSpeed: 'none' | 'slow' | 'medium' | 'fast' = 'none';
      let nextCarouselActionInMs = 0;
      let lastCarouselAction: 'left' | 'right' | 'none' = lastCarouselActionRef.current;

      if (latestEnabled && latestDebugState.handDetected && latestIndexFingerTip) {
        const targetPoint = getScreenPoint(latestIndexFingerTip, calibrationRef.current);

        mappedPoint = {
          x: targetPoint.mappedX,
          y: targetPoint.mappedY,
        };
        rawLandmarkX = targetPoint.rawLandmarkX;
        rawLandmarkY = targetPoint.rawLandmarkY;

        lastHandSeenAtRef.current = now;
        nextPoint = smoothedPointRef.current
          ? {
              x: clamp(
                smoothedPointRef.current.x +
                  (targetPoint.mappedX - smoothedPointRef.current.x) * CURSOR_LERP,
                0,
                window.innerWidth || 1,
              ),
              y: clamp(
                smoothedPointRef.current.y +
                  (targetPoint.mappedY - smoothedPointRef.current.y) * CURSOR_LERP,
                0,
                window.innerHeight || 1,
              ),
            }
          : mappedPoint;
        smoothedPointRef.current = nextPoint;
      }

      const handRecentlyVisible =
        latestEnabled &&
        lastHandSeenAtRef.current > 0 &&
        now - lastHandSeenAtRef.current <= LOST_HAND_TIMEOUT_MS &&
        Boolean(nextPoint);
      const canTriggerActions =
        latestEnabled &&
        latestDebugState.handDetected &&
        Boolean(latestIndexFingerTip) &&
        now >= localLockUntilRef.current;

      if (!latestEnabled) {
        lastHoveredAtRef.current = 0;
        lastHoveredCardIdRef.current = null;
        selectionStartCardIdRef.current = null;
        selectionStartYRef.current = null;
        smoothedPointRef.current = null;
        lastCarouselActionTimeRef.current = 0;
        currentControlZoneRef.current = 'none';
      } else if (!latestDebugState.handDetected) {
        selectionStartCardIdRef.current = null;
        selectionStartYRef.current = null;
        lastCarouselActionTimeRef.current = 0;
        currentControlZoneRef.current = 'none';
        ignoredReason = handRecentlyVisible ? 'hand recently lost' : 'no hand detected';
      } else if (now < localLockUntilRef.current) {
        ignoredReason = 'finger cursor cooldown active';
      } else if (latestAlbumState === 'opening' || latestAlbumState === 'opened' || latestAlbumState === 'closing') {
        selectionStartCardIdRef.current = null;
        selectionStartYRef.current = null;
        lastCarouselActionTimeRef.current = 0;
        currentControlZoneRef.current = 'none';
        ignoredReason = 'opened state locked';
      }

      closeCooldownRemaining = Math.max(0, closeCooldownUntilRef.current - now);

      if (
        canTriggerActions &&
        nextPoint &&
        latestAlbumState === 'opened' &&
        closeCooldownRemaining <= 0
      ) {
        if (closeDownwardStartYRef.current === null) {
          closeDownwardStartYRef.current = nextPoint.y;
          closeDownwardStartXRef.current = nextPoint.x;
        }

        const closeStartY = closeDownwardStartYRef.current ?? nextPoint.y;
        const closeStartX = closeDownwardStartXRef.current ?? nextPoint.x;
        const downwardDy = nextPoint.y - closeStartY;
        const downwardDx = nextPoint.x - closeStartX;

        if (downwardDy >= CLOSE_DOWNWARD_SWIPE_PX && downwardDy > Math.abs(downwardDx) * 1.2) {
          if (actionsRef.current?.closeOpenedCard()) {
            closeGestureDetected = true;
            closeGestureDetectedRef.current = true;
            closeGestureType = 'downwardSwipe';
            closeGestureTypeRef.current = 'downwardSwipe';
            closeCooldownUntilRef.current = now + CLOSE_COOLDOWN_MS;
            closeCooldownRemaining = CLOSE_COOLDOWN_MS;
            closeDownwardStartYRef.current = null;
            closeDownwardStartXRef.current = null;
            closeDwellStartTimeRef.current = 0;
            closeDwellProgressRef.current = 0;
            ignoredReason = 'accepted close via downward swipe';
          } else {
            ignoredReason = 'closeOpenedCard rejected';
          }
        } else if (downwardDy < -25 || Math.abs(downwardDx) > 40) {
          closeDownwardStartYRef.current = nextPoint.y;
          closeDownwardStartXRef.current = nextPoint.x;
        }

        const closeButton = document.querySelector('.memory-modal__close');
        if (closeButton && !closeGestureDetected) {
          const buttonRect = closeButton.getBoundingClientRect();
          if (
            nextPoint.x >= buttonRect.left &&
            nextPoint.x <= buttonRect.right &&
            nextPoint.y >= buttonRect.top &&
            nextPoint.y <= buttonRect.bottom
          ) {
            if (closeDwellStartTimeRef.current === 0) {
              closeDwellStartTimeRef.current = now;
            }
            closeDwellProgressRef.current = now - closeDwellStartTimeRef.current;
            closeDwellProgress = closeDwellProgressRef.current;

            if (closeDwellProgressRef.current >= CLOSE_DWELL_DURATION_MS) {
              if (actionsRef.current?.closeOpenedCard()) {
                closeGestureDetected = true;
                closeGestureDetectedRef.current = true;
                closeGestureType = 'closeButtonDwell';
                closeGestureTypeRef.current = 'closeButtonDwell';
                closeCooldownUntilRef.current = now + CLOSE_COOLDOWN_MS;
                closeCooldownRemaining = CLOSE_COOLDOWN_MS;
                closeDwellStartTimeRef.current = 0;
                closeDwellProgressRef.current = 0;
                ignoredReason = 'accepted close via button dwell';
              }
            }
          } else {
            closeDwellStartTimeRef.current = 0;
            closeDwellProgressRef.current = 0;
          }
        }
      } else if (latestAlbumState !== 'opened') {
        closeDownwardStartYRef.current = null;
        closeDownwardStartXRef.current = null;
        closeDwellStartTimeRef.current = 0;
        closeDwellProgressRef.current = 0;
        closeGestureDetectedRef.current = false;
        closeGestureTypeRef.current = 'none';
      }

      // ===== CONTINUOUS WHEEL CAROUSEL =====

      if (
        canTriggerActions &&
        nextPoint &&
        !openedCardIdRef.current &&
        isBrowsingState(latestAlbumState)
      ) {
        const viewportWidth = window.innerWidth || 1;
        const xRatio = nextPoint.x / viewportWidth;

        if (xRatio < WHEEL_DEAD_LEFT) {
          activeControlZone = 'left';
          const dist = WHEEL_DEAD_LEFT - xRatio;
          const norm = dist / WHEEL_DEAD_LEFT;
          wheelTargetRef.current = WHEEL_MAX_SPEED * norm * norm;
          carouselControlSpeed = norm > 0.5 ? 'fast' : norm > 0.25 ? 'medium' : 'slow';
        } else if (xRatio > WHEEL_DEAD_RIGHT) {
          activeControlZone = 'right';
          const dist = xRatio - WHEEL_DEAD_RIGHT;
          const norm = dist / (1 - WHEEL_DEAD_RIGHT);
          wheelTargetRef.current = -WHEEL_MAX_SPEED * norm * norm;
          carouselControlSpeed = norm > 0.5 ? 'fast' : norm > 0.25 ? 'medium' : 'slow';
        } else {
          activeControlZone = 'center';
          carouselControlSpeed = 'none';
          wheelTargetRef.current = 0;
        }

        const trackEl = trackRefRef.current?.current ?? null;
        if (trackEl && wheelTrackRef.current !== trackEl) {
          wheelTrackRef.current = trackEl;
          wheelGroupWidthRef.current = trackEl.scrollWidth / 3;
        }

        if (!isWheelActiveRef.current && Math.abs(wheelTargetRef.current) > 0.01) {
          isWheelActiveRef.current = true;
          wheelLastTimeRef.current = now;
          wheelLastSyncRef.current = 0;
          wheelOffsetRef.current = 0;

          const wheelLoop = (loopNow: number) => {
            const dt = Math.min(loopNow - wheelLastTimeRef.current, 32);
            wheelLastTimeRef.current = loopNow;

            wheelSpeedRef.current += (wheelTargetRef.current - wheelSpeedRef.current) * WHEEL_LERP;

            if (Math.abs(wheelSpeedRef.current) < 0.005 && Math.abs(wheelTargetRef.current) < 0.005) {
              motionRef.current?.setWheelOffset(0);
              isWheelActiveRef.current = false;
              wheelFrameRef.current = null;
              return;
            }

            wheelOffsetRef.current += wheelSpeedRef.current * (dt / 16.67);

            let wrappedOffset = wheelOffsetRef.current;
            const gw = wheelGroupWidthRef.current;
            if (gw > 0) {
              while (wrappedOffset > -gw * 0.5) wrappedOffset -= gw;
              while (wrappedOffset < -gw * 1.5) wrappedOffset += gw;
            }
            wheelOffsetRef.current = wrappedOffset;

            const el = wheelTrackRef.current;
            if (el) {
              el.style.transform = `translate3d(${wrappedOffset}px, 0, 0)`;
            }

            if (loopNow - wheelLastSyncRef.current > WHEEL_SYNC_INTERVAL_MS) {
              wheelLastSyncRef.current = loopNow;
              motionRef.current?.setWheelOffset(wrappedOffset);
            }

            wheelFrameRef.current = requestAnimationFrame(wheelLoop);
          };

          wheelFrameRef.current = requestAnimationFrame(wheelLoop);
        }

        ignoredReason = activeControlZone === 'center'
          ? 'wheel stopped'
          : `wheel ${activeControlZone} (target: ${wheelTargetRef.current.toFixed(2)})`;
      } else {
        wheelTargetRef.current = 0;
        currentControlZoneRef.current = 'none';
      }

      const currentCarouselSpeed = wheelSpeedRef.current;
      const isWheelActive = isWheelActiveRef.current;

      if (handRecentlyVisible && nextPoint) {
        directHoveredCardId = getCardIdAtPoint(
          nextPoint.x,
          nextPoint.y,
          trackRefRef.current?.current,
        );

        if (directHoveredCardId) {
          lastHoveredCardIdRef.current = directHoveredCardId;
          lastHoveredAtRef.current = now;
          hoveredCardId = directHoveredCardId;
        } else if (
          lastHoveredCardIdRef.current &&
          now - lastHoveredAtRef.current <= HOVER_RETENTION_MS
        ) {
          hoveredCardId = lastHoveredCardIdRef.current;
        }

        cursorState = hoveredCardId ? 'hoveringCard' : 'idle';
      }

      if (
        canTriggerActions &&
        nextPoint &&
        directHoveredCardId &&
        isBrowsingState(latestAlbumState)
      ) {
        if (directHoveredCardId !== selectedCardIdRef.current) {
          const didSelect = actionsRef.current?.selectCard(directHoveredCardId) ?? false;

          if (didSelect) {
            selectedCardIdRef.current = directHoveredCardId;
            selectionStartCardIdRef.current = directHoveredCardId;
            selectionStartYRef.current = nextPoint.y;
            lastFingerActionRef.current = 'selectCard';
            ignoredReason = 'accepted selectCard';
          } else {
            ignoredReason = 'selectCard rejected by album state';
          }
        } else {
          if (
            selectionStartCardIdRef.current !== directHoveredCardId ||
            selectionStartYRef.current === null
          ) {
            selectionStartCardIdRef.current = directHoveredCardId;
            selectionStartYRef.current = nextPoint.y;
          }

          ignoredReason = 'hovering selected card';
        }
      } else if (
        latestDebugState.handDetected &&
        !directHoveredCardId &&
        hoveredCardId &&
        isBrowsingState(latestAlbumState)
      ) {
        ignoredReason = 'retaining last card selection';
      } else if (
        latestDebugState.handDetected &&
        !directHoveredCardId &&
        isBrowsingState(latestAlbumState)
      ) {
        ignoredReason = 'finger cursor not over a card';
      }

      if (!directHoveredCardId) {
        selectionStartCardIdRef.current = null;
        selectionStartYRef.current = null;
      }

      if (
        canTriggerActions &&
        nextPoint &&
        directHoveredCardId &&
        selectedCardIdRef.current === directHoveredCardId &&
        selectionStartCardIdRef.current === directHoveredCardId &&
        selectionStartYRef.current !== null &&
        !openedCardIdRef.current &&
        !isHorizontalMovement &&
        !horizontalSwipeDetected &&
        canOpenFromFinger(latestAlbumState)
      ) {
        upwardDrawDelta = Math.max(0, selectionStartYRef.current - nextPoint.y);

        if (upwardDrawDelta > 18) {
          cursorState = 'draggingUp';
          ignoredReason = `finger moving upward ${Math.round(upwardDrawDelta)}px / ${UPWARD_DRAW_THRESHOLD_PX}px`;
        }

        if (upwardDrawDelta >= UPWARD_DRAW_THRESHOLD_PX) {
          const didOpen = actionsRef.current?.openSelectedCard() ?? false;

          if (didOpen) {
            openedCardIdRef.current = selectedCardIdRef.current;
            lastFingerActionRef.current = 'openSelectedCard';
            localLockUntilRef.current = now + POST_OPEN_LOCK_MS;
            selectionStartCardIdRef.current = null;
            selectionStartYRef.current = null;
            ignoredReason = 'accepted openSelectedCard';
          } else {
            ignoredReason = 'openSelectedCard rejected by album state';
          }
        }
      }

      setCursor({
        hoveredCardId,
        isVisible: handRecentlyVisible,
        state: cursorState,
        x: nextPoint?.x ?? 0,
        y: nextPoint?.y ?? 0,
      });
      setFingerDebugState({
        activeControlMode: 'fingerCursor',
        activeControlZone,
        advancedGesturesEnabled: enableAdvancedGestures,
        albumState: latestAlbumState,
        cameraActive: latestDebugState.cameraActive,
        carouselControlSpeed,
        closeCooldownRemaining,
        currentCarouselSpeed,
        isWheelActive,
        closeDwellProgress,
        closeGestureDetected,
        closeGestureType,
        cursorX: handRecentlyVisible && nextPoint ? nextPoint.x : null,
        cursorY: handRecentlyVisible && nextPoint ? nextPoint.y : null,
        displayedX: handRecentlyVisible && nextPoint ? nextPoint.x : null,
        displayedY: handRecentlyVisible && nextPoint ? nextPoint.y : null,
        fingerCursorMode: latestEnabled,
        handDetected: latestDebugState.handDetected,
        hoveredCardId,
        ignoredReason,
        indexFingerTip: latestDebugState.indexFingerTip,
        lastCarouselAction,
        lastFingerAction: lastFingerActionRef.current,
        mappedX: mappedPoint?.x ?? null,
        mappedY: mappedPoint?.y ?? null,
        mirrorX: calibrationRef.current.mirrorX,
        modelLoaded: latestDebugState.modelLoaded,
        nextCarouselActionInMs,
        openedCardId: openedCardIdRef.current,
        rawLandmarkX,
        rawLandmarkY,
        selectedCardId: selectedCardIdRef.current,
        selectionStartY: selectionStartYRef.current,
        upwardDrawDelta,
      });

      frameRef.current = window.requestAnimationFrame(updateCursor);
    };

    frameRef.current = window.requestAnimationFrame(updateCursor);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    cursor,
    debugState: fingerDebugState,
  };
}
