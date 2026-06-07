import type { FormEvent, SyntheticEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FingerCursorDebugPanel } from './FingerCursorDebugPanel';
import { MemoryCard } from './MemoryCard';
import { useGestureController } from '../hooks/useGestureController';
import {
  MAX_MEMORY_COMMENT_LENGTH,
  useMemoryInteractions,
} from '../hooks/useMemoryInteractions';
import { useMouseCardControls } from '../hooks/useMouseCardControls';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import type { Memory } from '../types/memory';

type CardCarouselProps = {
  memories: Memory[];
  onFingerModeChange?: (active: boolean) => void;
};

type ImageLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

const LOOP_COUNT = 3;
const FALLBACK_MEMORY_IMAGE = '/assets/card-front.png';
const CLOSE_ANIMATION_DURATION = 760;

type CarouselItem = {
  cardNumber: number;
  memory: Memory;
  key: string;
};

function getMemoryImageSrc(memory: Memory) {
  return (memory.image ?? '').trim() || FALLBACK_MEMORY_IMAGE;
}

export function CardCarousel({ memories, onFingerModeChange }: CardCarouselProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const lastOpenedMemoryRef = useRef<Memory | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [isCommentPanelOpen, setIsCommentPanelOpen] = useState(false);
  const [closingMemory, setClosingMemory] = useState<Memory | null>(null);
  const [imageLoadStatus, setImageLoadStatus] = useState<ImageLoadStatus>('idle');
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape' | 'unknown'>('unknown');
  const [lastImageErrorSrc, setLastImageErrorSrc] = useState<string | null>(null);
  const gestureController = useGestureController({
    cardCount: memories.length,
    loopCount: LOOP_COUNT,
    prefersReducedMotion,
  });
  const mouseCardControls = useMouseCardControls({
    actions: gestureController.actions,
    albumState: gestureController.albumState,
    cardCount: memories.length,
    motion: gestureController.motion,
    openedCardId: gestureController.openedCardId,
  });
  const { addComment, getComments, getLikeCount, likeMemory } = useMemoryInteractions();

  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => {
    try { window.localStorage.removeItem('album:revealed'); } catch { /* ignore */ }
    try { window.localStorage.removeItem('senior-high-memory-album:revealed-ids'); } catch { /* ignore */ }
    return new Set<string>();
  });

  const markRevealed = useCallback((memoryId: string) => {
    setRevealedIds((prev) => {
      if (prev.has(memoryId)) return prev;
      const next = new Set(prev);
      next.add(memoryId);
      return next;
    });
  }, []);

  const carouselItems = useMemo<CarouselItem[]>(
    () =>
      Array.from({ length: LOOP_COUNT }, (_, groupIndex) =>
        memories.map((memory, memoryIndex) => ({
          cardNumber: memoryIndex + 1,
          memory,
          key: `${memory.id}-${groupIndex}`,
        })),
      ).flat(),
    [memories],
  );
  const openedMemory = useMemo(
    () => memories.find((memory) => memory.id === gestureController.openedCardId) ?? null,
    [gestureController.openedCardId, memories],
  );

  const modalMemory = openedMemory ?? closingMemory ?? lastOpenedMemoryRef.current;
  const modalImageSrc = modalMemory ? getMemoryImageSrc(modalMemory) : FALLBACK_MEMORY_IMAGE;
  const isModalOpening = Boolean(openedMemory && gestureController.isOpening);
  const isModalClosing = !openedMemory && Boolean(modalMemory);
  const modalComments = modalMemory ? getComments(modalMemory.id) : [];
  const modalLikeCount = modalMemory ? getLikeCount(modalMemory) : 0;
  const modalCommentCount = modalMemory
    ? modalMemory.comments + modalComments.length
    : 0;

  const carouselClassName = [
    'card-carousel',
    prefersReducedMotion ? 'card-carousel--reduced-motion' : '',
    gestureController.selectedCardId && !gestureController.openedCardId
      ? 'card-carousel--has-selection'
      : '',
    mouseCardControls.isDragging ? 'card-carousel--dragging' : '',
    gestureController.isSlideAnimating ? 'card-carousel--sliding' : '',
    gestureController.isInertiaActive ? 'card-carousel--gliding' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleLikeClick = () => {
    if (!openedMemory) {
      return;
    }

    likeMemory(openedMemory);
  };

  const handleCommentButtonClick = () => {
    setIsCommentPanelOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => commentInputRef.current?.focus(), 100);
      }
      return next;
    });
  };

  const handleCommentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!openedMemory) {
      return;
    }

    const didAddComment = addComment(openedMemory.id, commentDraft);

    if (didAddComment) {
      setCommentDraft('');
    }
  };

  useLayoutEffect(() => {
    const measureTrack = () => {
      if (!trackRef.current || memories.length === 0) {
        return;
      }

      gestureController.motion.setMeasuredTrackWidth(trackRef.current.scrollWidth);
    };

    measureTrack();
    window.addEventListener('resize', measureTrack);

    return () => {
      window.removeEventListener('resize', measureTrack);
    };
  }, [gestureController.motion, memories.length]);

  useEffect(() => {
    if (openedMemory) {
      lastOpenedMemoryRef.current = openedMemory;
      setClosingMemory(null);
      return;
    }

    const lastOpenedMemory = lastOpenedMemoryRef.current;

    if (!lastOpenedMemory) {
      return;
    }

    markRevealed(lastOpenedMemory.id);
    setClosingMemory(lastOpenedMemory);
    lastOpenedMemoryRef.current = null;

    const closeAnimationDuration = prefersReducedMotion ? 1 : CLOSE_ANIMATION_DURATION;
    const closeTimer = window.setTimeout(() => {
      setClosingMemory(null);
    }, closeAnimationDuration);

    return () => {
      window.clearTimeout(closeTimer);
    };
  }, [openedMemory, prefersReducedMotion]);

  useEffect(() => {
    setCommentDraft('');
    setIsCommentPanelOpen(false);
    if (openedMemory) {
      setImageLoadStatus('loading');
    } else {
      setImageLoadStatus('idle');
    }
    setLastImageErrorSrc(null);
    setImageOrientation('unknown');
  }, [gestureController.openedCardId, openedMemory]);

  const handleImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    setImageLoadStatus('loaded');
    setLastImageErrorSrc(null);
    const img = event.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setImageOrientation(img.naturalHeight > img.naturalWidth ? 'portrait' : 'landscape');
    }
  }, []);

  const handleImageError = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const imageElement = event.currentTarget;

    if (imageElement.dataset.fallbackApplied === 'true') {
      return;
    }

    setLastImageErrorSrc(imageElement.src);
    imageElement.dataset.fallbackApplied = 'true';
    imageElement.src = FALLBACK_MEMORY_IMAGE;
    setImageLoadStatus('error');
  }, []);

  const openedMemoryExists = Boolean(openedMemory);
  const openedImageSrc = modalMemory ? (modalMemory.image ?? '').trim() || FALLBACK_MEMORY_IMAGE : '';

  return (
    <>
      <FingerCursorDebugPanel
        actions={gestureController.actions}
        albumState={gestureController.albumState}
        motion={gestureController.motion}
        onFingerModeChange={onFingerModeChange}
        openedCardId={gestureController.openedCardId}
        selectedCardId={gestureController.selectedCardId}
        trackRef={trackRef}
        openedMemoryExists={openedMemoryExists}
        openedImageSrc={openedImageSrc}
        imageLoadStatus={imageLoadStatus}
        lastImageErrorSrc={lastImageErrorSrc}
      />

      <section
        className={carouselClassName}
        aria-label="回忆卡片轮播"
        onMouseDown={mouseCardControls.handleMouseDown}
        onMouseOver={mouseCardControls.handleMouseOver}
      >
        <div
          ref={trackRef}
          className="card-carousel__track"
          style={{ transform: `translate3d(${gestureController.offset}px, 0, 0)` }}
        >
          {carouselItems.map(({ cardNumber, memory, key }, index) => (
            <MemoryCard
              key={key}
              cardNumber={cardNumber}
              isRevealed={revealedIds.has(memory.id)}
              isSelected={gestureController.selectedCardId === memory.id}
              memory={memory}
              index={index}
            />
          ))}
        </div>
      </section>

      {modalMemory ? (
        <div
          className={[
            'memory-modal',
            isModalOpening ? 'memory-modal--opening' : '',
            isModalClosing ? 'memory-modal--closing' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="dialog"
          aria-modal="true"
          aria-label={modalMemory.title}
          onClick={(e) => {
            if (e.target === e.currentTarget && gestureController.albumState === 'opened') {
              gestureController.actions.closeOpenedCard();
            }
          }}
        >
          <button
            className="memory-modal__close"
            type="button"
            aria-label="关闭回忆"
            onClick={gestureController.actions.closeOpenedCard}
          >
            关闭
          </button>

          <div className="memory-modal__stage">
            <div
              className={`opened-photo-viewer${imageOrientation === 'portrait' ? ' opened-photo-viewer--portrait' : ' opened-photo-viewer--landscape'}`}
            >
              <img
                src={modalImageSrc}
                alt={modalMemory.description}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
              <div className="opened-photo-viewer__actions">
                <button
                  className="memory-reveal-card__action"
                  type="button"
                  onClick={handleLikeClick}
                  aria-label={`点赞 ${modalMemory.title}`}
                >
                  <span>喜欢</span>
                  <strong aria-live="polite">{modalLikeCount}</strong>
                </button>
                <button
                  className={`memory-reveal-card__action${isCommentPanelOpen ? ' memory-reveal-card__action--active' : ''}`}
                  type="button"
                  onClick={handleCommentButtonClick}
                  aria-label={`评论 ${modalMemory.title}`}
                  aria-expanded={isCommentPanelOpen}
                >
                  <span>{isCommentPanelOpen ? '留言' : '评论'}</span>
                  <strong>{modalCommentCount}</strong>
                </button>
              </div>
            </div>

            {isCommentPanelOpen ? (
              <aside className="memory-comments-panel" aria-label={`${modalMemory.title} 的留言`}>
                <div className="memory-comments-panel__header">
                  <span>留言</span>
                  <strong aria-live="polite">{modalCommentCount}</strong>
                </div>
                <form className="memory-comments-panel__form" onSubmit={handleCommentSubmit}>
                  <input
                    ref={commentInputRef}
                    type="text"
                    maxLength={MAX_MEMORY_COMMENT_LENGTH}
                    value={commentDraft}
                    placeholder="写下一段回忆"
                    onChange={(event) => setCommentDraft(event.target.value)}
                  />
                  <button type="submit" disabled={!commentDraft.trim()}>
                    添加
                  </button>
                </form>
                {modalComments.length > 0 ? (
                  <ul className="memory-comments-panel__list">
                    {modalComments.map((comment, index) => (
                      <li key={`${modalMemory.id}-${index}-${comment}`}>{comment}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="memory-comments-panel__empty">还没有新的留言。</p>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
