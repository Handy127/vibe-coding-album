import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

type NostalgicCursorProps = {
  containerRef: RefObject<HTMLElement | null>;
};

type TrailDot = {
  age: number;
  driftX: number;
  driftY: number;
  life: number;
  size: number;
  x: number;
  y: number;
};

const TRAIL_DOT_COUNT = 6;
const TRAIL_DISTANCE = 14;
const TRAIL_LIFE = 28;
const EMPTY_TRAIL_DOT: TrailDot = {
  age: TRAIL_LIFE,
  driftX: 0,
  driftY: 0,
  life: TRAIL_LIFE,
  size: 0,
  x: 0,
  y: 0,
};

function isMemoryCardTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('.memory-card'));
}

export function NostalgicCursor({ containerRef }: NostalgicCursorProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const frameRef = useRef<number | null>(null);
  const targetPositionRef = useRef({ x: 0, y: 0 });
  const cursorPositionRef = useRef({ x: 0, y: 0 });
  const startDragPositionRef = useRef({ x: 0, y: 0 });
  const lastTrailPositionRef = useRef({ x: 0, y: 0 });
  const trailDotsRef = useRef<TrailDot[]>(
    Array.from({ length: TRAIL_DOT_COUNT }, () => ({ ...EMPTY_TRAIL_DOT })),
  );
  const nextTrailDotRef = useRef(0);
  const isInsideRef = useRef(false);
  const isSelectedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isDraggingCardRef = useRef(false);
  const isPullingUpRef = useRef(false);
  const [isInside, setIsInside] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isPullingUp, setIsPullingUp] = useState(false);
  const trailIndexes = useMemo(
    () => Array.from({ length: TRAIL_DOT_COUNT }, (_, index) => index),
    [],
  );

  const updateInside = useCallback((nextIsInside: boolean) => {
    if (isInsideRef.current === nextIsInside) {
      return;
    }

    isInsideRef.current = nextIsInside;
    setIsInside(nextIsInside);
  }, []);

  const updateSelected = useCallback((nextIsSelected: boolean) => {
    if (isSelectedRef.current === nextIsSelected) {
      return;
    }

    isSelectedRef.current = nextIsSelected;
    setIsSelected(nextIsSelected);
  }, []);

  const updatePullingUp = useCallback((nextIsPullingUp: boolean) => {
    if (isPullingUpRef.current === nextIsPullingUp) {
      return;
    }

    isPullingUpRef.current = nextIsPullingUp;
    setIsPullingUp(nextIsPullingUp);
  }, []);

  const spawnTrailDot = useCallback((x: number, y: number) => {
    if (prefersReducedMotion) {
      return;
    }

    const dotIndex = nextTrailDotRef.current;
    const offset = dotIndex % 2 === 0 ? -1 : 1;

    trailDotsRef.current[dotIndex] = {
      age: 0,
      driftX: offset * (0.16 + Math.random() * 0.18),
      driftY: 0.34 + Math.random() * 0.18,
      life: TRAIL_LIFE,
      size: 4 + Math.random() * 3,
      x: x - offset * 4,
      y: y + 8 + Math.random() * 6,
    };

    nextTrailDotRef.current = (dotIndex + 1) % TRAIL_DOT_COUNT;
  }, [prefersReducedMotion]);

  const animateCursor = useCallback(() => {
    const cursorElement = cursorRef.current;
    const targetPosition = targetPositionRef.current;
    const cursorPosition = cursorPositionRef.current;

    cursorPosition.x += (targetPosition.x - cursorPosition.x) * 0.18;
    cursorPosition.y += (targetPosition.y - cursorPosition.y) * 0.18;

    if (cursorElement) {
      cursorElement.style.transform = `translate3d(${cursorPosition.x}px, ${cursorPosition.y}px, 0) translate(-50%, -50%)`;
    }

    let hasLiveTrailDot = false;

    trailDotsRef.current.forEach((dot, index) => {
      const dotElement = trailRefs.current[index];

      if (!dotElement || dot.age >= dot.life) {
        return;
      }

      dot.age += 1;
      const progress = dot.age / dot.life;
      const opacity = Math.max(0, 1 - progress) * 0.58;
      const scale = 1 - progress * 0.35;

      dotElement.style.width = `${dot.size}px`;
      dotElement.style.height = `${dot.size}px`;
      dotElement.style.opacity = String(opacity);
      dotElement.style.transform = `translate3d(${dot.x + dot.driftX * dot.age}px, ${dot.y + dot.driftY * dot.age}px, 0) translate(-50%, -50%) scale(${scale})`;

      hasLiveTrailDot = true;
    });

    if (isInsideRef.current || hasLiveTrailDot) {
      frameRef.current = window.requestAnimationFrame(animateCursor);
      return;
    }

    frameRef.current = null;
  }, []);

  const startAnimation = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(animateCursor);
  }, [animateCursor]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const handleMouseEnter = (event: MouseEvent) => {
      targetPositionRef.current = { x: event.clientX, y: event.clientY };
      cursorPositionRef.current = { x: event.clientX, y: event.clientY };
      lastTrailPositionRef.current = { x: event.clientX, y: event.clientY };
      updateInside(true);
      startAnimation();
    };

    const handleMouseLeave = () => {
      updateInside(false);
      updateSelected(false);
      updatePullingUp(false);
      isDraggingRef.current = false;
      isDraggingCardRef.current = false;
      startAnimation();
    };

    const handleMouseMove = (event: MouseEvent) => {
      targetPositionRef.current = { x: event.clientX, y: event.clientY };
      updateInside(true);

      const isOverCard = isMemoryCardTarget(event.target) || isDraggingCardRef.current;
      updateSelected(isOverCard);

      if (isDraggingRef.current && isDraggingCardRef.current) {
        const totalDeltaX = event.clientX - startDragPositionRef.current.x;
        const totalDeltaY = event.clientY - startDragPositionRef.current.y;
        const isUpwardPull = totalDeltaY < -12 && Math.abs(totalDeltaY) > Math.abs(totalDeltaX) * 0.45;

        updatePullingUp(isUpwardPull);

        if (isUpwardPull && !prefersReducedMotion) {
          const trailDeltaX = event.clientX - lastTrailPositionRef.current.x;
          const trailDeltaY = event.clientY - lastTrailPositionRef.current.y;
          const trailDistance = Math.hypot(trailDeltaX, trailDeltaY);

          if (trailDistance >= TRAIL_DISTANCE) {
            spawnTrailDot(event.clientX, event.clientY);
            lastTrailPositionRef.current = { x: event.clientX, y: event.clientY };
          }
        }
      }

      startAnimation();
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      isDraggingRef.current = true;
      isDraggingCardRef.current = isMemoryCardTarget(event.target);
      startDragPositionRef.current = { x: event.clientX, y: event.clientY };
      lastTrailPositionRef.current = { x: event.clientX, y: event.clientY };
      updateSelected(isDraggingCardRef.current);
    };

    const handleMouseUp = (event: MouseEvent) => {
      isDraggingRef.current = false;
      isDraggingCardRef.current = false;
      updatePullingUp(false);
      updateSelected(isMemoryCardTarget(document.elementFromPoint(event.clientX, event.clientY)));
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [
    containerRef,
    prefersReducedMotion,
    spawnTrailDot,
    startAnimation,
    updateInside,
    updatePullingUp,
    updateSelected,
  ]);

  const cursorClassName = [
    'nostalgic-cursor',
    isInside ? 'nostalgic-cursor--visible' : '',
    isSelected ? 'nostalgic-cursor--selected' : '',
    isPullingUp ? 'nostalgic-cursor--pulling' : '',
    prefersReducedMotion ? 'nostalgic-cursor--reduced-motion' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div ref={cursorRef} className={cursorClassName} aria-hidden="true">
        <span className="nostalgic-cursor__halo" />
        <span className="nostalgic-cursor__ring" />
        <span className="nostalgic-cursor__star" />
      </div>
      <div className="nostalgic-cursor-trail" aria-hidden="true">
        {trailIndexes.map((index) => (
          <span
            key={index}
            ref={(node) => {
              trailRefs.current[index] = node;
            }}
            className="nostalgic-cursor-trail__dot"
          />
        ))}
      </div>
    </>
  );
}
