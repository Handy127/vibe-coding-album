import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AlbumState,
  GestureActions,
  GestureMotionControls,
} from './useGestureController';

const REVEAL_DRAG_THRESHOLD = 72;
const CLICK_OPEN_THRESHOLD = 7;

type UseMouseCardControlsOptions = {
  actions: GestureActions;
  albumState: AlbumState;
  cardCount: number;
  motion: GestureMotionControls;
  openedCardId: string | null;
};

function isAlbumInputLocked(albumState: AlbumState) {
  return albumState === 'opening' || albumState === 'opened' || albumState === 'closing';
}

function getTargetCardId(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const cardElement = target.closest<HTMLElement>('.memory-card');

  return cardElement?.dataset.cardId ?? cardElement?.dataset.memoryId ?? null;
}

export function useMouseCardControls({
  actions,
  albumState,
  cardCount,
  motion,
  openedCardId,
}: UseMouseCardControlsOptions) {
  const velocityRef = useRef(0);
  const lastMouseXRef = useRef(0);
  const startMouseXRef = useRef(0);
  const startMouseYRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const hasRevealedRef = useRef(false);
  const activeCardIdRef = useRef<string | null>(null);
  const previousUserSelectRef = useRef('');
  const [isDragging, setIsDragging] = useState(false);

  const restoreTextSelection = useCallback(() => {
    document.body.style.userSelect = previousUserSelectRef.current;
  }, []);

  useEffect(
    () => () => {
      motion.stopInertia();
      restoreTextSelection();
    },
    [motion, restoreTextSelection],
  );

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault();

      if (isAlbumInputLocked(albumState)) {
        setIsDragging(false);
        restoreTextSelection();
        return;
      }

      const currentTime = performance.now();
      const deltaX = event.clientX - lastMouseXRef.current;
      const deltaTime = Math.max(currentTime - lastMoveTimeRef.current, 16);
      const totalDeltaX = event.clientX - startMouseXRef.current;
      const totalDeltaY = event.clientY - startMouseYRef.current;

      if (
        activeCardIdRef.current &&
        totalDeltaY <= -REVEAL_DRAG_THRESHOLD &&
        Math.abs(totalDeltaY) > Math.abs(totalDeltaX) * 0.85
      ) {
        hasRevealedRef.current = actions.openSelectedCard();
        setIsDragging(false);
        restoreTextSelection();
        return;
      }

      velocityRef.current = deltaX / deltaTime;
      lastMouseXRef.current = event.clientX;
      lastMoveTimeRef.current = currentTime;
      motion.moveCardsBy(deltaX);
    };

    const handleMouseUp = (event: MouseEvent) => {
      const totalDeltaX = event.clientX - startMouseXRef.current;
      const totalDeltaY = event.clientY - startMouseYRef.current;
      const activeCardId = activeCardIdRef.current;

      setIsDragging(false);
      restoreTextSelection();
      activeCardIdRef.current = null;

      if (hasRevealedRef.current) {
        hasRevealedRef.current = false;
        return;
      }

      if (
        activeCardId &&
        Math.hypot(totalDeltaX, totalDeltaY) <= CLICK_OPEN_THRESHOLD
      ) {
        if (actions.openSelectedCard()) {
          return;
        }
      }

      if (isAlbumInputLocked(albumState)) {
        return;
      }

      motion.startInertia(velocityRef.current);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [actions, albumState, isDragging, motion, restoreTextSelection]);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (
        event.button !== 0 ||
        cardCount === 0 ||
        openedCardId ||
        isAlbumInputLocked(albumState)
      ) {
        return;
      }

      event.preventDefault();
      const activeCardId = getTargetCardId(event.target);

      if (activeCardId) {
        actions.selectCard(activeCardId);
      }

      motion.stopInertia();
      previousUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      velocityRef.current = 0;
      startMouseXRef.current = event.clientX;
      startMouseYRef.current = event.clientY;
      lastMouseXRef.current = event.clientX;
      lastMoveTimeRef.current = performance.now();
      activeCardIdRef.current = activeCardId;
      hasRevealedRef.current = false;
      setIsDragging(true);
    },
    [actions, albumState, cardCount, motion, openedCardId],
  );

  const handleMouseOver = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (
        cardCount === 0 ||
        openedCardId ||
        isDragging ||
        isAlbumInputLocked(albumState)
      ) {
        return;
      }

      const hoveredCardId = getTargetCardId(event.target);

      if (hoveredCardId) {
        actions.selectCard(hoveredCardId);
      }
    },
    [actions, albumState, cardCount, isDragging, openedCardId],
  );

  return {
    handleMouseDown,
    handleMouseOver,
    isDragging,
  };
}
