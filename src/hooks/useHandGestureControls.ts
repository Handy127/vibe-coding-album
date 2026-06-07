import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlbumState, GestureActions } from './useGestureController';
import type {
  GestureName,
  HandLandmarkerDebugState,
  LandmarkPoint,
} from './useHandLandmarker';

export type GestureActionName =
  | 'none'
  | 'nextCards'
  | 'previousCards'
  | 'selectCard'
  | 'openSelectedCard'
  | 'closeOpenedCard';

export type HandGestureControlDebugState = {
  albumState: AlbumState;
  actionCooldownRemaining: number;
  currentGesture: GestureName;
  gestureCooldownRemaining: number;
  ignoredGestureReason: string;
  lastGesture: GestureName;
  lastTriggeredAction: GestureActionName;
  openedCardId: string | null;
  selectedCardId: string | null;
};

type UseHandGestureControlsOptions = {
  actions?: GestureActions;
  albumState: AlbumState;
  debugState: HandLandmarkerDebugState;
  enabled?: boolean;
  openedCardId?: string | null;
  selectedCardId?: string | null;
  trackRef?: RefObject<HTMLElement | null>;
};

const GESTURE_ACTION_COOLDOWN = 1000;
const FIST_CLOSE_HOLD_MS = 300;
const MIN_UPWARD_ACTION_CONFIDENCE = 0.62;

const INITIAL_CONTROL_DEBUG_STATE: HandGestureControlDebugState = {
  albumState: 'idle',
  actionCooldownRemaining: 0,
  currentGesture: 'none',
  gestureCooldownRemaining: 0,
  ignoredGestureReason: 'waiting',
  lastGesture: 'none',
  lastTriggeredAction: 'none',
  openedCardId: null,
  selectedCardId: null,
};

function getCooldownRemaining(cooldownUntil: number) {
  return Math.max(0, cooldownUntil - performance.now());
}

function getCarouselElement(trackElement: HTMLElement | null) {
  return trackElement?.closest<HTMLElement>('.card-carousel') ?? null;
}

function getTargetPointFromFinger(
  carouselElement: HTMLElement,
  indexFingerTip: Exclude<LandmarkPoint, null>,
) {
  const carouselRect = carouselElement.getBoundingClientRect();

  return {
    x: carouselRect.left + carouselRect.width * indexFingerTip.x,
    y: carouselRect.top + carouselRect.height * indexFingerTip.y,
  };
}

function isCardVisible(cardRect: DOMRect, carouselRect: DOMRect) {
  return (
    cardRect.right > carouselRect.left &&
    cardRect.left < carouselRect.right &&
    cardRect.bottom > carouselRect.top &&
    cardRect.top < carouselRect.bottom
  );
}

function findNearestVisibleCardId(
  trackElement: HTMLElement | null,
  indexFingerTip: LandmarkPoint,
) {
  if (!trackElement || !indexFingerTip) {
    return null;
  }

  const carouselElement = getCarouselElement(trackElement);

  if (!carouselElement) {
    return null;
  }

  const carouselRect = carouselElement.getBoundingClientRect();
  const targetPoint = getTargetPointFromFinger(carouselElement, indexFingerTip);
  const cardElements = Array.from(
    trackElement.querySelectorAll<HTMLElement>(
      '.memory-card[data-card-id], .memory-card[data-memory-id]',
    ),
  );
  let closestCardId: string | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  cardElements.forEach((cardElement) => {
    const cardId = cardElement.dataset.cardId ?? cardElement.dataset.memoryId;
    const cardRect = cardElement.getBoundingClientRect();

    if (!cardId || !isCardVisible(cardRect, carouselRect)) {
      return;
    }

    const cardCenterX = cardRect.left + cardRect.width / 2;
    const cardCenterY = cardRect.top + cardRect.height / 2;
    const normalizedXDistance = (targetPoint.x - cardCenterX) / Math.max(cardRect.width, 1);
    const normalizedYDistance = (targetPoint.y - cardCenterY) / Math.max(cardRect.height, 1);
    const distance = Math.hypot(normalizedXDistance, normalizedYDistance * 0.72);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestCardId = cardId;
    }
  });

  return closestCardId;
}

function isActionGesture(gesture: GestureName) {
  return (
    gesture === 'leftSwipe' ||
    gesture === 'rightSwipe' ||
    gesture === 'upwardSwipe' ||
    gesture === 'fist' ||
    gesture === 'point'
  );
}

function isOpenedState(albumState: AlbumState) {
  return albumState === 'opening' || albumState === 'opened' || albumState === 'closing';
}

function isBrowsingState(albumState: AlbumState) {
  return albumState === 'idle' || albumState === 'browsing' || albumState === 'selecting';
}

function getGestureStateReason({
  albumState,
  cooldownRemaining,
  currentGesture,
  enabled,
  fistHoldElapsed,
  gestureConfidence,
  handDetected,
  isWaitingForNone,
  openedCardId,
  selectedCardId,
}: {
  albumState: AlbumState;
  cooldownRemaining: number;
  currentGesture: GestureName;
  enabled: boolean;
  fistHoldElapsed: number;
  gestureConfidence: number;
  handDetected: boolean;
  isWaitingForNone: boolean;
  openedCardId: string | null;
  selectedCardId: string | null;
}) {
  if (!enabled) {
    return 'gesture controls disabled';
  }

  if (!handDetected) {
    return 'no hand detected';
  }

  if (!isActionGesture(currentGesture)) {
    return 'waiting for actionable gesture';
  }

  if (cooldownRemaining > 0) {
    return 'gesture cooldown active';
  }

  if (isWaitingForNone) {
    return 'waiting for gesture to return to none';
  }

  if (albumState === 'opening' || albumState === 'closing') {
    return 'album is transitioning';
  }

  if (isOpenedState(albumState) && currentGesture !== 'fist') {
    return 'opened state only allows fist';
  }

  if (isOpenedState(albumState) && currentGesture === 'fist' && !openedCardId) {
    return 'no opened card to close';
  }

  if (
    albumState === 'opened' &&
    currentGesture === 'fist' &&
    fistHoldElapsed < FIST_CLOSE_HOLD_MS
  ) {
    return `holding fist ${Math.ceil(fistHoldElapsed)}ms / ${FIST_CLOSE_HOLD_MS}ms`;
  }

  if (isBrowsingState(albumState) && currentGesture === 'upwardSwipe' && !selectedCardId) {
    return 'no selected card to open';
  }

  if (
    isBrowsingState(albumState) &&
    currentGesture === 'upwardSwipe' &&
    gestureConfidence < MIN_UPWARD_ACTION_CONFIDENCE
  ) {
    return 'upward swipe confidence too low';
  }

  if (isBrowsingState(albumState) && currentGesture === 'fist') {
    return 'fist ignored until a card is opened';
  }

  return 'ready';
}

export function useHandGestureControls({
  actions,
  albumState,
  debugState,
  enabled = false,
  openedCardId = null,
  selectedCardId = null,
  trackRef,
}: UseHandGestureControlsOptions) {
  const cooldownUntilRef = useRef(0);
  const fistHoldStartRef = useRef<number | null>(null);
  const lastGestureRef = useRef<GestureName>('none');
  const waitingForNoneRef = useRef(false);
  const lastSelectedCardIdRef = useRef<string | null>(selectedCardId);
  const openedCardIdRef = useRef<string | null>(openedCardId);
  const selectedCardIdRef = useRef<string | null>(selectedCardId);
  const [controlDebugState, setControlDebugState] = useState<HandGestureControlDebugState>(
    INITIAL_CONTROL_DEBUG_STATE,
  );

  useEffect(() => {
    openedCardIdRef.current = openedCardId;
  }, [openedCardId]);

  useEffect(() => {
    selectedCardIdRef.current = selectedCardId;
    lastSelectedCardIdRef.current = selectedCardId;
  }, [selectedCardId]);

  const markActionTriggered = useCallback((actionName: GestureActionName) => {
    cooldownUntilRef.current = performance.now() + GESTURE_ACTION_COOLDOWN;
    waitingForNoneRef.current = true;
    setControlDebugState({
      albumState,
      actionCooldownRemaining: GESTURE_ACTION_COOLDOWN,
      currentGesture: debugState.currentGesture,
      gestureCooldownRemaining: GESTURE_ACTION_COOLDOWN,
      ignoredGestureReason: `accepted ${actionName}`,
      lastGesture: debugState.currentGesture,
      lastTriggeredAction: actionName,
      openedCardId: openedCardIdRef.current,
      selectedCardId: selectedCardIdRef.current,
    });
  }, [albumState, debugState.currentGesture]);

  const selectNearestVisibleCard = useCallback(() => {
    if (!actions || !trackRef?.current) {
      return false;
    }

    const nearestCardId = findNearestVisibleCardId(
      trackRef.current,
      debugState.indexFingerTip,
    );

    if (!nearestCardId || nearestCardId === lastSelectedCardIdRef.current) {
      return false;
    }

    if (!actions.selectCard(nearestCardId)) {
      return false;
    }

    lastSelectedCardIdRef.current = nearestCardId;
    selectedCardIdRef.current = nearestCardId;
    return true;
  }, [actions, debugState.indexFingerTip, trackRef]);

  useEffect(() => {
    const now = performance.now();
    const cooldownRemaining = getCooldownRemaining(cooldownUntilRef.current);
    const currentGesture = debugState.currentGesture;
    const previousGesture = lastGestureRef.current;

    if (currentGesture === 'none') {
      waitingForNoneRef.current = false;
    }

    const isFistCloseCandidate =
      currentGesture === 'fist' &&
      albumState === 'opened' &&
      debugState.handDetected &&
      Boolean(openedCardIdRef.current) &&
      cooldownRemaining <= 0 &&
      !waitingForNoneRef.current;

    if (isFistCloseCandidate) {
      fistHoldStartRef.current ??= now;
    } else if (currentGesture !== 'fist' || albumState !== 'opened') {
      fistHoldStartRef.current = null;
    }

    const fistHoldElapsed = fistHoldStartRef.current
      ? now - fistHoldStartRef.current
      : 0;

    const ignoredGestureReason = getGestureStateReason({
      albumState,
      cooldownRemaining,
      currentGesture,
      enabled,
      fistHoldElapsed,
      gestureConfidence: debugState.gestureConfidence,
      handDetected: debugState.handDetected,
      isWaitingForNone: waitingForNoneRef.current,
      openedCardId: openedCardIdRef.current,
      selectedCardId: selectedCardIdRef.current,
    });

    setControlDebugState((currentState) => ({
      ...currentState,
      albumState,
      actionCooldownRemaining: Math.ceil(cooldownRemaining),
      currentGesture,
      gestureCooldownRemaining: Math.ceil(cooldownRemaining),
      ignoredGestureReason,
      lastGesture: previousGesture,
      openedCardId: openedCardIdRef.current,
      selectedCardId: selectedCardIdRef.current,
    }));

    if (
      !enabled ||
      !actions ||
      !debugState.handDetected ||
      !isActionGesture(currentGesture) ||
      cooldownRemaining > 0 ||
      waitingForNoneRef.current
    ) {
      lastGestureRef.current = currentGesture;
      return;
    }

    if (albumState === 'opening' || albumState === 'closing') {
      lastGestureRef.current = currentGesture;
      return;
    }

    if (isOpenedState(albumState) && currentGesture !== 'fist') {
      lastGestureRef.current = currentGesture;
      return;
    }

    if (isBrowsingState(albumState) && currentGesture === 'fist') {
      lastGestureRef.current = currentGesture;
      return;
    }

    if (currentGesture === 'point') {
      if (selectNearestVisibleCard()) {
        markActionTriggered('selectCard');
      }
      lastGestureRef.current = currentGesture;
      return;
    }

    if (currentGesture === 'leftSwipe') {
      if (actions.previousCards()) {
        markActionTriggered('previousCards');
      }
      lastGestureRef.current = currentGesture;
      return;
    }

    if (currentGesture === 'rightSwipe') {
      if (actions.nextCards()) {
        markActionTriggered('nextCards');
      }
      lastGestureRef.current = currentGesture;
      return;
    }

    if (currentGesture === 'upwardSwipe') {
      if (!selectedCardIdRef.current) {
        lastGestureRef.current = currentGesture;
        return;
      }

      if (debugState.gestureConfidence < MIN_UPWARD_ACTION_CONFIDENCE) {
        lastGestureRef.current = currentGesture;
        return;
      }

      if (actions.openSelectedCard()) {
        openedCardIdRef.current = selectedCardIdRef.current;
        markActionTriggered('openSelectedCard');
      }
      lastGestureRef.current = currentGesture;
      return;
    }

    if (currentGesture === 'fist') {
      if (!openedCardIdRef.current) {
        lastGestureRef.current = currentGesture;
        return;
      }

      if (albumState !== 'opened' || fistHoldElapsed < FIST_CLOSE_HOLD_MS) {
        lastGestureRef.current = currentGesture;
        return;
      }

      if (actions.closeOpenedCard()) {
        fistHoldStartRef.current = null;
        openedCardIdRef.current = null;
        markActionTriggered('closeOpenedCard');
      }
    }

    lastGestureRef.current = currentGesture;
  }, [
    albumState,
    actions,
    debugState.currentGesture,
    debugState.gestureConfidence,
    debugState.handDetected,
    enabled,
    markActionTriggered,
    selectNearestVisibleCard,
  ]);

  return controlDebugState;
}
