/**
 * Performance Utilities
 * Phase 1: Helpers for game loop optimization, mobile, and Android stability.
 */

/**
 * Debounce function - useful for resize, input, etc.
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle function - limit calls per time window.
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Safe RAF wrapper with cleanup tracking.
 */
export function createSafeRAFLoop(callback: (time: number) => void) {
  let rafId: number | null = null;
  let mounted = true;

  const loop = (time: number) => {
    if (!mounted) return;
    callback(time);
    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);

  return () => {
    mounted = false;
    if (rafId) cancelAnimationFrame(rafId);
  };
}

/**
 * Check if running on mobile / touch device.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Clamp value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
