/**
 * Generic Object Pool for performance optimization.
 * Prevents frequent allocations in the game loop (critical for 60 FPS on Android).
 * Used for obstacles, particles, etc.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private activeCount = 0;

  constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize = 20) {
    this.createFn = createFn;
    this.resetFn = resetFn;

    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  /**
   * Acquire an object from the pool (or create new if empty).
   */
  acquire(): T {
    let obj: T;
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.createFn();
    }
    this.activeCount++;
    return obj;
  }

  /**
   * Release an object back to the pool after resetting it.
   */
  release(obj: T): void {
    this.resetFn(obj);
    this.pool.push(obj);
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getAvailableCount(): number {
    return this.pool.length;
  }

  /**
   * Clear the pool (use carefully, e.g. on level reset).
   */
  clear(): void {
    this.pool = [];
    this.activeCount = 0;
  }
}
