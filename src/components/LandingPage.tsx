import { useCallback, useRef, useState } from 'react';
import { CardCarousel } from './CardCarousel';
import { NostalgicCursor } from './NostalgicCursor';
import { memories } from '../data/memories';

export function LandingPage() {
  const albumRef = useRef<HTMLElement>(null);
  const [isFingerActive, setIsFingerActive] = useState(false);

  const handleFingerModeChange = useCallback((active: boolean) => {
    setIsFingerActive(active);
    if (active) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = '';
    }
  }, []);

  const mainClass = [
    'landing-page',
    'landing-page--custom-cursor',
    isFingerActive ? 'landing-page--finger-active' : '',
  ].filter(Boolean).join(' ');

  return (
    <main ref={albumRef} className={mainClass}>
      <section className="landing-page__content" aria-labelledby="album-title">
        <h1 id="album-title">我的高中回忆相册</h1>
        <p className="landing-page__subtitle">抽一张卡，打开一段回忆。</p>
        <CardCarousel memories={memories} onFingerModeChange={handleFingerModeChange} />
      </section>
      {!isFingerActive && <NostalgicCursor containerRef={albumRef} />}
    </main>
  );
}
