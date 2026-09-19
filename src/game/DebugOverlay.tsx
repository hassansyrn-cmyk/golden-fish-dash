import { useEffect, useRef, useState } from 'react';
import type { EngineState } from './engine';

interface DebugSnapshot {
  fps: number;
  entities: number;
  biome: string;
  pattern: string;
  audio: string;
  score: number;
  combo: number;
  surge: string;
  boss: string;
  particles: number;
}

/**
 * QA overlay (?debug=1). Reads the live engine through the debug hook
 * installed by useGameEngine — zero cost in normal play.
 */
export default function DebugOverlay() {
  const [snapshot, setSnapshot] = useState<DebugSnapshot | null>(null);
  const frames = useRef<{ count: number; since: number }>({ count: 0, since: performance.now() });

  useEffect(() => {
    const rafState = { last: 0 };
    const tick = () => {
      rafState.last = requestAnimationFrame(tick);
      frames.current.count += 1;
      const now = performance.now();
      if (now - frames.current.since < 250) return;
      const fps = Math.round((frames.current.count * 1000) / (now - frames.current.since));
      frames.current = { count: 0, since: now };

      const engineRef = (window as unknown as { __gfrEngine?: { current: EngineState | null } }).__gfrEngine;
      const state = engineRef?.current;
      if (!state) return;
      setSnapshot({
        fps,
        entities:
          state.obstacles.length + state.coins.length + state.gems.length + state.powerUps.length +
          state.sharks.length + state.seaMines.length + state.jellyfish.length + state.plankton.length +
          state.sunPearls.length + state.barriers.length + state.currents.length + state.companions.length,
        biome: state.chapter.id,
        pattern: state.spectacle ? 'finale' : 'procedural',
        audio: typeof window !== 'undefined' && 'AudioContext' in window ? 'webaudio' : 'silent',
        score: state.score,
        combo: state.combo.count,
        surge: state.surge.activeUntil > state.timeMs ? 'active' : `${Math.round(state.surge.charge)}%`,
        boss: state.boss
          ? `${state.boss.config.id} ${state.boss.phase}${state.spectacle ? ' +finale' : ''}`
          : state.spectacle ? 'finale' : '—',
        particles: state.particles.length,
      });
    };
    const handle = requestAnimationFrame(tick);
    void rafState;
    return () => cancelAnimationFrame(handle);
  }, []);

  if (!snapshot) return null;
  return (
    <div
      className="debug-overlay"
      style={{
        position: 'absolute', insetInlineStart: 6, top: 6, zIndex: 40,
        font: '600 10px/1.5 monospace', color: '#7df9ff',
        background: 'rgba(0, 8, 20, 0.72)', padding: '6px 8px', borderRadius: 8,
        pointerEvents: 'none', whiteSpace: 'pre', textAlign: 'left',
      }}
    >
      {`FPS ${snapshot.fps}
Entities ${snapshot.entities} (particles ${snapshot.particles})
Biome ${snapshot.biome}
Pattern ${snapshot.pattern}
Score ${snapshot.score} · Combo ${snapshot.combo}
Surge ${snapshot.surge}
Boss ${snapshot.boss}
Audio ${snapshot.audio}`}
    </div>
  );
}
