type FingerControlZonesProps = {
  activeControlZone: 'left' | 'center' | 'right' | 'none';
  carouselControlSpeed: 'none' | 'slow' | 'medium' | 'fast';
  visible: boolean;
};

const ZONE_LEFT = 40;
const ZONE_RIGHT = 60;
const SPEED_ALPHA: Record<string, number> = { none: 0.05, slow: 0.10, medium: 0.18, fast: 0.28 };

export function FingerHotZones({
  activeControlZone,
  carouselControlSpeed,
  visible,
}: FingerControlZonesProps) {
  if (!visible) {
    return null;
  }

  const leftAlpha = activeControlZone === 'left' ? SPEED_ALPHA[carouselControlSpeed] ?? 0.10 : 0.04;
  const rightAlpha = activeControlZone === 'right' ? SPEED_ALPHA[carouselControlSpeed] ?? 0.10 : 0.04;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${ZONE_LEFT}%`,
          height: '100%',
          zIndex: 61,
          pointerEvents: 'none',
          background: `linear-gradient(90deg, rgba(255,220,160,${leftAlpha}) 0%, transparent 100%)`,
          transition: 'background 300ms ease',
        }}
      >
        {activeControlZone === 'left' && (
          <div
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: `rgba(168,93,69,${0.5 + leftAlpha * 2})`,
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '28px',
              fontWeight: 700,
              userSelect: 'none',
              transition: 'opacity 300ms ease',
            }}
          >
            ←
          </div>
        )}
        {activeControlZone === 'left' && (
          <div
            style={{
              position: 'absolute',
              left: '50px',
              top: 'calc(50% + 24px)',
              color: `rgba(139,79,54,${0.5 + leftAlpha * 2})`,
              fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
              fontSize: '13px',
              fontWeight: 650,
              userSelect: 'none',
              transition: 'opacity 300ms ease',
            }}
          >
            向左浏览
          </div>
        )}
      </div>

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: `${100 - ZONE_RIGHT}%`,
          height: '100%',
          zIndex: 61,
          pointerEvents: 'none',
          background: `linear-gradient(270deg, rgba(255,220,160,${rightAlpha}) 0%, transparent 100%)`,
          transition: 'background 300ms ease',
        }}
      >
        {activeControlZone === 'right' && (
          <div
            style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: `rgba(168,93,69,${0.5 + rightAlpha * 2})`,
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '28px',
              fontWeight: 700,
              userSelect: 'none',
              transition: 'opacity 300ms ease',
            }}
          >
            →
          </div>
        )}
        {activeControlZone === 'right' && (
          <div
            style={{
              position: 'absolute',
              right: '50px',
              top: 'calc(50% + 24px)',
              color: `rgba(139,79,54,${0.5 + rightAlpha * 2})`,
              fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
              fontSize: '13px',
              fontWeight: 650,
              userSelect: 'none',
              transition: 'opacity 300ms ease',
            }}
          >
            向右浏览
          </div>
        )}
      </div>
    </>
  );
}
