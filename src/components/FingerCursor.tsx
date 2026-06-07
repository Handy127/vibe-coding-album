import type { FingerCursorState } from '../hooks/useFingerCursor';

type FingerCursorProps = {
  isVisible: boolean;
  state: FingerCursorState;
  x: number;
  y: number;
};

export function FingerCursor({ isVisible, state, x, y }: FingerCursorProps) {
  const className = [
    'finger-cursor',
    isVisible ? 'finger-cursor--visible' : '',
    `finger-cursor--${state}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={{ transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)` }}
      aria-hidden="true"
    >
      <span className="finger-cursor__aura" />
      <span className="finger-cursor__ring" />
      <span className="finger-cursor__point" />
    </div>
  );
}
