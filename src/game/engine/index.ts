/**
 * Game Engine Module (Phase 1 - Architecture Foundation)
 *
 * This will be expanded in later phases to fully separate:
 * - core.ts (main engine state & loop)
 * - physics.ts
 * - entities/
 * - systems/ (spawning, collision, progression)
 * - managers/ (powerup, difficulty, particle)
 *
 * Currently re-exports the existing implementation for backward compatibility.
 */

export * from '../engine';

export { ObjectPool } from '../../utils/objectPool';
