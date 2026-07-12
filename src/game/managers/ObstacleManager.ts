/**
 * ObstacleManager - Example of clean architecture using ObjectPool
 * Phase 1: Demonstrates how we will manage obstacles with pooling for performance.
 *
 * In later commits (still Phase 1 or early Phase 2), we will integrate this
 * into engine.ts to replace raw array push/filter for obstacles.
 */
import { ObjectPool } from '../../utils/objectPool';

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  active: boolean;
  vx?: number; // for moving obstacles later
}

function createObstacle(): Obstacle {
  return {
    x: 0,
    y: 0,
    width: 64,
    height: 120,
    type: 'pipe',
    active: true,
    vx: 0,
  };
}

function resetObstacle(obs: Obstacle): void {
  obs.x = 0;
  obs.y = 0;
  obs.active = false;
  obs.vx = 0;
  obs.type = 'pipe';
}

// Singleton pool for obstacles (pre-allocated for performance)
export const obstaclePool = new ObjectPool<Obstacle>(
  createObstacle,
  resetObstacle,
  30 // initial pool size - enough for dense obstacle sections
);

/**
 * Acquire a new obstacle from the pool (instead of {} or new Object)
 */
export function acquireObstacle(): Obstacle {
  return obstaclePool.acquire();
}

/**
 * Release obstacle back to pool when it goes off-screen
 */
export function releaseObstacle(obs: Obstacle): void {
  obstaclePool.release(obs);
}

/**
 * Get stats for debugging / performance monitoring
 */
export function getObstaclePoolStats() {
  return {
    active: obstaclePool.getActiveCount(),
    available: obstaclePool.getAvailableCount(),
  };
}
