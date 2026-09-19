import io

p = 'src/game/useGameEngine.ts'
s = io.open(p, encoding='utf-8').read()

# 1. HudState interface: production boss shape.
old = """  bossActive: boolean;
  bossKind: string | null;
  bossPearls: number;
  bossTarget: number;
  bossRemainingMs: number;
}"""
new = """  bossActive: boolean;
  bossKind: string | null;
  bossPhase: string | null;
  bossRemainingMs: number;
}"""
assert old in s, 'hud interface'
s = s.replace(old, new)

old = """  bossActive: false,
  bossKind: null,
  bossPearls: 0,
  bossTarget: 0,
  bossRemainingMs: 0,
};"""
new = """  bossActive: false,
  bossKind: null,
  bossPhase: null,
  bossRemainingMs: 0,
};"""
assert old in s, 'hud empty'
s = s.replace(old, new)

old = """function readHudState(engine: EngineState): HudState {
  const boss = engine.boss;
  return {"""
new = """function readHudState(engine: EngineState): HudState {
  const boss = engine.boss;
  const bossRemainingMs = boss
    ? Math.max(0, boss.config.battleDurationMs - (engine.timeMs - boss.battleStartedAt))
    : 0;
  return {"""
assert old in s, 'hud head'
s = s.replace(old, new)

old = """    bossActive: !!boss && !boss.ended,
    bossKind: boss ? boss.kind : null,
    bossPearls: boss ? boss.pearlsCollected : 0,
    bossTarget: boss ? boss.pearlTarget : 0,
    bossRemainingMs: boss ? Math.max(0, boss.durationMs - (engine.timeMs - boss.startedAtMs)) : 0,
  };"""
new = """    bossActive: boss !== null,
    bossKind: boss ? boss.config.id : null,
    bossPhase: boss ? boss.phase : null,
    bossRemainingMs,
  };"""
assert old in s, 'hud fields'
s = s.replace(old, new)

old = """    bossActive: hudState.bossActive,
    bossKind: hudState.bossKind,
    bossPearls: hudState.bossPearls,
    bossTarget: hudState.bossTarget,
    bossRemainingMs: hudState.bossRemainingMs,"""
new = """    bossActive: hudState.bossActive,
    bossKind: hudState.bossKind,
    bossPhase: hudState.bossPhase,
    bossRemainingMs: hudState.bossRemainingMs,"""
assert old in s, 'hook return'
s = s.replace(old, new)

# RunStats field rename.
s = s.replace('state.runStats.setPiecesCleared', 'state.runStats.spectaclesCleared')

# 2. Options interface + destructure + ref: rename to onSpectacleStart.
old = "  onSetPieceStart?: (kind: string, nameKey: string) => void;"
assert old in s, 'options decl'
s = s.replace(old, "  onSpectacleStart?: (nameKey: string) => void;")
s = s.replace(
    "export function useGameEngine({ canvasRef, active, paused, skin, modifiers, demo, onGameOver, onChapterTransition, onSetPieceStart }: UseGameEngineOptions) {",
    "export function useGameEngine({ canvasRef, active, paused, skin, modifiers, demo, onGameOver, onChapterTransition, onSpectacleStart }: UseGameEngineOptions) {")
s = s.replace("const onSetPieceStartRef = useRef(onSetPieceStart);", "const onSpectacleStartRef = useRef(onSpectacleStart);")
s = s.replace("onSetPieceStartRef.current = onSetPieceStart;", "onSpectacleStartRef.current = onSpectacleStart;")
s = s.replace("}, [onGameOver, onChapterTransition, onSetPieceStart]);", "}, [onGameOver, onChapterTransition, onSpectacleStart]);")

# 3. Callback wiring: rename onSetPieceStart/onSpectacleEnd block.
old = """              onSetPieceStart: (kind, nameKey) => {
                audioManager.playSound(kind === 'spectacle' ? 'chapter' : 'bossRoar', settings.sound);
                safeVibrate([50, 40, 90], settings.vibration);
                onSetPieceStartRef.current?.(kind, nameKey);
              },

              onSpectacleEnd: (succeeded) => {"""
new = """              onSpectacleStart: (nameKey) => {
                audioManager.playSound('chapter', settings.sound);
                safeVibrate([50, 40, 90], settings.vibration);
                onSpectacleStartRef.current?.(nameKey);
              },

              onSpectacleEnd: (succeeded) => {"""
assert old in s, 'callbacks wiring'
s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('useGameEngine adapted OK')
