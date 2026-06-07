import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MIN_INERTIA_VELOCITY = 0.018;
const MAX_INERTIA_VELOCITY = 1.2;
const DEFAULT_CARD_STEP = 204;
const SLIDE_ANIMATION_DURATION = 620;
const OPENING_ANIMATION_DURATION = 1180;
const CLOSING_ANIMATION_DURATION = 760;
const MIN_OPENED_LOCK_DURATION = 800;
const SELECTED_DRAG_SLOWDOWN = 0.58;
const SELECTED_INERTIA_SLOWDOWN = 0.42;

export type AlbumState = 'idle' | 'browsing' | 'selecting' | 'opening' | 'opened' | 'closing';

type UseGestureControllerOptions = {
  cardCount: number;
  loopCount: number;
  prefersReducedMotion: boolean;
};

export type GestureActions = {
  nextCards: () => boolean;
  previousCards: () => boolean;
  selectCard: (cardId: string) => boolean;
  openSelectedCard: () => boolean;
  closeOpenedCard: () => boolean;
};

export type GestureMotionControls = {
  moveCardsBy: (deltaX: number) => void;
  setMeasuredTrackWidth: (trackWidth: number) => void;
  setWheelOffset: (newOffset: number) => void;
  startInertia: (initialVelocity: number) => void;
  stopInertia: () => void;
};

function isAlbumInputLocked(albumState: AlbumState) {
  return albumState === 'opening' || albumState === 'opened' || albumState === 'closing';
}

export function useGestureController({
  cardCount,
  loopCount,
  prefersReducedMotion,
}: UseGestureControllerOptions) {
  const groupWidthRef = useRef(0);
  const cardStepRef = useRef(DEFAULT_CARD_STEP);
  const offsetRef = useRef(0);
  const inertiaFrameRef = useRef<number | null>(null);
  const slideAnimationTimeoutRef = useRef<number | null>(null);
  const openingTimeoutRef = useRef<number | null>(null);
  const closingTimeoutRef = useRef<number | null>(null);
  const openedLockUntilRef = useRef(0);
  const albumStateRef = useRef<AlbumState>('idle');
  const selectedCardIdRef = useRef<string | null>(null);
  const openedCardIdRef = useRef<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [isInertiaActive, setIsInertiaActive] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isSlideAnimating, setIsSlideAnimating] = useState(false);
  const [albumState, setAlbumState] = useState<AlbumState>('idle');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [openedCardId, setOpenedCardId] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (inertiaFrameRef.current !== null) {
        window.cancelAnimationFrame(inertiaFrameRef.current);
      }

      if (slideAnimationTimeoutRef.current !== null) {
        window.clearTimeout(slideAnimationTimeoutRef.current);
      }

      if (openingTimeoutRef.current !== null) {
        window.clearTimeout(openingTimeoutRef.current);
      }

      if (closingTimeoutRef.current !== null) {
        window.clearTimeout(closingTimeoutRef.current);
      }
    },
    [],
  );

  const setAlbumStateValue = useCallback((nextAlbumState: AlbumState) => {
    albumStateRef.current = nextAlbumState;
    setAlbumState(nextAlbumState);
  }, []);

  const normalizeOffset = useCallback((value: number) => {
    const groupWidth = groupWidthRef.current;

    if (groupWidth <= 0) {
      return value;
    }

    let nextValue = value;

    while (nextValue > -groupWidth * 0.5) {
      nextValue -= groupWidth;
    }

    while (nextValue < -groupWidth * 1.5) {
      nextValue += groupWidth;
    }

    return nextValue;
  }, []);

  const setCarouselOffset = useCallback(
    (nextOffset: number) => {
      const normalizedOffset = normalizeOffset(nextOffset);

      offsetRef.current = normalizedOffset;
      setOffset(normalizedOffset);
    },
    [normalizeOffset],
  );

  const stopInertia = useCallback(() => {
    if (inertiaFrameRef.current !== null) {
      window.cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }

    setIsInertiaActive(false);
  }, []);

  const stopSlideAnimation = useCallback(() => {
    if (slideAnimationTimeoutRef.current !== null) {
      window.clearTimeout(slideAnimationTimeoutRef.current);
      slideAnimationTimeoutRef.current = null;
    }

    setIsSlideAnimating(false);
  }, []);

  const startSlideAnimation = useCallback(() => {
    if (prefersReducedMotion) {
      return;
    }

    if (slideAnimationTimeoutRef.current !== null) {
      window.clearTimeout(slideAnimationTimeoutRef.current);
    }

    setIsSlideAnimating(true);
    slideAnimationTimeoutRef.current = window.setTimeout(() => {
      slideAnimationTimeoutRef.current = null;
      setIsSlideAnimating(false);
    }, SLIDE_ANIMATION_DURATION);
  }, [prefersReducedMotion]);

  const startInertia = useCallback(
    (initialVelocity: number) => {
      if (isAlbumInputLocked(albumStateRef.current)) {
        setIsInertiaActive(false);
        return;
      }

      if (prefersReducedMotion || Math.abs(initialVelocity) < MIN_INERTIA_VELOCITY) {
        setIsInertiaActive(false);
        return;
      }

      stopSlideAnimation();
      setIsInertiaActive(true);
      const adjustedInitialVelocity = selectedCardIdRef.current
        ? initialVelocity * SELECTED_INERTIA_SLOWDOWN
        : initialVelocity;
      let velocity = Math.max(
        -MAX_INERTIA_VELOCITY,
        Math.min(MAX_INERTIA_VELOCITY, adjustedInitialVelocity),
      );
      let previousTime = performance.now();

      const step = (currentTime: number) => {
        const deltaTime = Math.min(currentTime - previousTime, 32);
        previousTime = currentTime;
        velocity *= Math.pow(0.94, deltaTime / 16.67);

        setCarouselOffset(offsetRef.current + velocity * deltaTime);

        if (Math.abs(velocity) >= MIN_INERTIA_VELOCITY) {
          inertiaFrameRef.current = window.requestAnimationFrame(step);
          return;
        }

        inertiaFrameRef.current = null;
        setIsInertiaActive(false);
      };

      inertiaFrameRef.current = window.requestAnimationFrame(step);
    },
    [prefersReducedMotion, setCarouselOffset, stopSlideAnimation],
  );

  const moveCardsBy = useCallback(
    (deltaX: number) => {
      if (isAlbumInputLocked(albumStateRef.current)) {
        return;
      }

      stopSlideAnimation();
      const adjustedDeltaX = selectedCardIdRef.current
        ? deltaX * SELECTED_DRAG_SLOWDOWN
        : deltaX;

      setCarouselOffset(offsetRef.current + adjustedDeltaX);
    },
    [setCarouselOffset, stopSlideAnimation],
  );

  const setMeasuredTrackWidth = useCallback(
    (trackWidth: number) => {
      const nextGroupWidth = trackWidth / loopCount;

      groupWidthRef.current = nextGroupWidth;
      cardStepRef.current = cardCount > 0 ? nextGroupWidth / cardCount : DEFAULT_CARD_STEP;

      if (cardCount > 0 && albumStateRef.current === 'idle') {
        setAlbumStateValue('browsing');
      }

      if (offsetRef.current === 0) {
        setCarouselOffset(-nextGroupWidth);
        return;
      }

      setCarouselOffset(offsetRef.current);
    },
    [cardCount, loopCount, setAlbumStateValue, setCarouselOffset],
  );

  const nextCards = useCallback(() => {
    if (isAlbumInputLocked(albumStateRef.current)) {
      return false;
    }

    stopInertia();
    startSlideAnimation();
    setAlbumStateValue('browsing');
    setCarouselOffset(offsetRef.current - cardStepRef.current);
    return true;
  }, [setAlbumStateValue, setCarouselOffset, startSlideAnimation, stopInertia]);

  const previousCards = useCallback(() => {
    if (isAlbumInputLocked(albumStateRef.current)) {
      return false;
    }

    stopInertia();
    startSlideAnimation();
    setAlbumStateValue('browsing');
    setCarouselOffset(offsetRef.current + cardStepRef.current);
    return true;
  }, [setAlbumStateValue, setCarouselOffset, startSlideAnimation, stopInertia]);

  const selectCard = useCallback((cardId: string) => {
    if (isAlbumInputLocked(albumStateRef.current)) {
      return false;
    }

    selectedCardIdRef.current = cardId;
    setSelectedCardId(cardId);
    setAlbumStateValue('selecting');
    return true;
  }, [setAlbumStateValue]);

  const openSelectedCard = useCallback(() => {
    if (isAlbumInputLocked(albumStateRef.current)) {
      return false;
    }

    const nextOpenedCardId = selectedCardIdRef.current;

    if (!nextOpenedCardId) {
      return false;
    }

    stopInertia();
    stopSlideAnimation();
    openedCardIdRef.current = nextOpenedCardId;
    setOpenedCardId(nextOpenedCardId);
    setAlbumStateValue('opening');

    if (closingTimeoutRef.current !== null) {
      window.clearTimeout(closingTimeoutRef.current);
      closingTimeoutRef.current = null;
    }

    if (openingTimeoutRef.current !== null) {
      window.clearTimeout(openingTimeoutRef.current);
    }

    setIsOpening(true);
    openingTimeoutRef.current = window.setTimeout(() => {
      openingTimeoutRef.current = null;
      setIsOpening(false);
      openedLockUntilRef.current = performance.now() + MIN_OPENED_LOCK_DURATION;
      setAlbumStateValue('opened');
    }, prefersReducedMotion ? 1 : OPENING_ANIMATION_DURATION);

    return true;
  }, [prefersReducedMotion, setAlbumStateValue, stopInertia, stopSlideAnimation]);

  const closeOpenedCard = useCallback(() => {
    if (albumStateRef.current !== 'opened' || !openedCardIdRef.current) {
      return false;
    }

    if (performance.now() < openedLockUntilRef.current) {
      return false;
    }

    if (openingTimeoutRef.current !== null) {
      window.clearTimeout(openingTimeoutRef.current);
      openingTimeoutRef.current = null;
    }

    if (closingTimeoutRef.current !== null) {
      window.clearTimeout(closingTimeoutRef.current);
      closingTimeoutRef.current = null;
    }

    setIsOpening(false);
    openedLockUntilRef.current = 0;
    openedCardIdRef.current = null;
    setOpenedCardId(null);
    setAlbumStateValue('closing');

    closingTimeoutRef.current = window.setTimeout(() => {
      closingTimeoutRef.current = null;
      setAlbumStateValue(selectedCardIdRef.current ? 'selecting' : 'browsing');
    }, prefersReducedMotion ? 1 : CLOSING_ANIMATION_DURATION);

    return true;
  }, [prefersReducedMotion, setAlbumStateValue]);

  const actions = useMemo<GestureActions>(
    () => ({
      closeOpenedCard,
      nextCards,
      openSelectedCard,
      previousCards,
      selectCard,
    }),
    [closeOpenedCard, nextCards, openSelectedCard, previousCards, selectCard],
  );

  const setWheelOffset = useCallback(
    (newOffset: number) => {
      const normalizedOffset = normalizeOffset(newOffset);
      offsetRef.current = normalizedOffset;
      setOffset(normalizedOffset);
    },
    [normalizeOffset],
  );

  const motion = useMemo<GestureMotionControls>(
    () => ({
      moveCardsBy,
      setMeasuredTrackWidth,
      setWheelOffset,
      startInertia,
      stopInertia,
    }),
    [moveCardsBy, setMeasuredTrackWidth, setWheelOffset, startInertia, stopInertia],
  );

  return {
    actions,
    albumState,
    isInertiaActive,
    isOpening,
    isSlideAnimating,
    motion,
    offset,
    openedCardId,
    selectedCardId,
  };
}
