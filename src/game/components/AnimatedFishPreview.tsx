import { useEffect, useState } from 'react';

interface AnimatedFishPreviewProps {
  src: string;
  className?: string;
  width: number;
  height: number;
  columns?: number;
  rows?: number;
  fps?: number;
}

/**
 * Lightweight CSS sprite-sheet player for UI fish previews.
 * The golden sheet contains the swimming and blink poses used in the game.
 */
export default function AnimatedFishPreview({
  src,
  className = '',
  width,
  height,
  columns = 4,
  rows = 4,
  fps = 8,
}: AnimatedFishPreviewProps) {
  const frameCount = columns * rows;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % frameCount);
    }, 1000 / fps);
    return () => window.clearInterval(interval);
  }, [frameCount, fps]);

  const column = frame % columns;
  const row = Math.floor(frame / columns);
  const backgroundPosition = `${columns === 1 ? 0 : (column / (columns - 1)) * 100}% ${rows === 1 ? 0 : (row / (rows - 1)) * 100}%`;

  return (
    <span
      className={`animated-fish-preview ${className}`}
      aria-hidden="true"
      style={{
        width,
        height,
        backgroundImage: `url(${src})`,
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        backgroundPosition,
      }}
    />
  );
}
