import type { CSSProperties } from 'react';
import type { Memory } from '../types/memory';

type MemoryCardProps = {
  cardNumber: number;
  isRevealed?: boolean;
  isSelected?: boolean;
  memory: Memory;
  index: number;
};

const CARD_ROTATIONS = [-5, 3, -2, 4, -4];
const CARD_ACCENTS = ['#a85d45', '#6f7d55', '#bd8b4b', '#7a5d8c', '#c66f7d'];

function toCssUrl(imageSrc: string) {
  return `url("${imageSrc.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
}

export function MemoryCard({
  cardNumber: _cardNumber,
  isRevealed = false,
  isSelected = false,
  memory,
  index,
}: MemoryCardProps) {
  const imageSrc = (memory.image ?? '').trim() || '/assets/card-front.png';
  const style = {
    '--card-rotation': `${CARD_ROTATIONS[index % CARD_ROTATIONS.length]}deg`,
    '--card-accent': CARD_ACCENTS[index % CARD_ACCENTS.length],
    '--card-draw-delay': `${Math.min(index, 12) * 52}ms`,
    '--card-slide-delay': `${(index % 8) * 18}ms`,
    ...(isRevealed ? {
      backgroundImage: toCssUrl(imageSrc),
      backgroundSize: '105%',
      backgroundPosition: 'center',
    } : {}),
  } as CSSProperties;
  const className = [
    'memory-card',
    isSelected ? 'memory-card--selected' : '',
    isRevealed ? 'memory-card--revealed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={className}
      data-card-id={memory.id}
      data-memory-id={memory.id}
      style={style}
      aria-current={isSelected ? 'true' : undefined}
      aria-label={`${memory.title}, ${memory.date}, ${memory.location}`}
    />
  );
}
