import { useCallback, useEffect, useRef, useState } from 'react';
import MainMenu from './screens/MainMenu';
import HowToPlay from './screens/HowToPlay';
import SettingsScreen from './screens/SettingsScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import GameOverScreen from './screens/GameOverScreen';
import ContinueAdScreen from './screens/ContinueAdScreen';
import PauseScreen from './screens/PauseScreen';
import LoadingScreen from './screens/LoadingScreen';
import AchievementsModal from './screens/AchievementsModal';
import UnlockCelebration from './screens/UnlockCelebration';
import { BannerAd, InterstitialAd } from './AdPlaceholders';
import Footer from './Footer';
import { useGameEngine } from './useGameEngine';
import {
  getSelectedSkin,
  incrementGameOverCount,
  markUsedSecondChanceEver,
  unlockAchievement,
} from './storage';
import type { ScreenName, SkinId } from './types';

const REVIVE_INVINCIBILITY_MS = 2000;
const MAX_VISIBLE_EXTRA_LIVES = 2;

export default function GoldenFishRush() {
  const [screen, setScreen] = useState<ScreenName>('loading');
  const [finalScore, setFinalScore] = useState(0);
  const [usedSecondChanceThisRun, setUsedSecondChanceThisRun] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [reviveCountdown, setReviveCountdown] = useState<number | null>(null);
  const [newUnlocks, setNewUnlocks] = useState<SkinId[] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skin = getSelectedSkin();

  useEffect(() => {
    const timer = setTimeout(() => setScreen('menu'), 900);
    return () => clearTimeout(timer);
  }, []);

  const handleGameOver = useCallback(
    (score: number) => {
      setFinalScore(score);
      setScreen(usedSecondChanceThisRun ? 'gameover' : 'continueAd');
    },
    [usedSecondChanceThisRun],
  );

  const keepEngineAlive =
    screen === 'playing' ||
    screen === 'paused' ||
    screen === 'continueAd' ||
    reviveCountdown !== null;

  const enginePaused = screen !== 'playing' || reviveCountdown !== null;

  const { score, lives, doJump, reviveAt, shieldCharges, magnetRemainingMs } = useGameEngine({
    canvasRef,
    active: keepEngineAlive,
    paused: enginePaused,
    skin,
    onGameOver: handleGameOver,
  });

  const startRun = useCallback(() => {
    setUsedSecondChanceThisRun(false);
    setReviveCountdown(null);
    setFinalScore(0);
    setShowInterstitial(false);
    setNewUnlocks(null);
    setScreen('playing');
  }, []);

  const handleWatchAd = useCallback(() => {
    setScreen('continueAd');
  }, []);

  const handleAdFinished = useCallback(() => {
    setUsedSecondChanceThisRun(true);
    markUsedSecondChanceEver();
    unlockAchievement('comeback');
    reviveAt(REVIVE_INVINCIBILITY_MS);
    setReviveCountdown(3);
  }, [reviveAt]);

  const handleSkipAd = useCallback(() => {
    setReviveCountdown(null);
    setScreen('gameover');
  }, []);

  useEffect(() => {
    if (reviveCountdown === null) return;
    if (reviveCountdown <= 0) {
      setReviveCountdown(null);
      setScreen('playing');
      return;
    }
    const timer = setTimeout(() => {
      setReviveCountdown((current) => (current ?? 1) - 1);
    }, 700);
    return () => clearTimeout(timer);
  }, [reviveCountdown]);

  useEffect(() => {
    if (screen !== 'gameover') return;
    const count = incrementGameOverCount();
    if (count % 3 === 0) {
      setShowInterstitial(true);
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing') return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        doJump();
      }
      if (event.code === 'Escape') {
        setScreen('paused');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [screen, doJump]);

  const handlePointerDown = useCallback(() => {
    if (screen === 'playing') {
      doJump();
    }
  }, [screen, doJump]);

  const handleNewUnlocks = useCallback((ids: SkinId[]) => {
    setNewUnlocks(ids);
  }, []);

  const handleUnlockContinue = useCallback(() => {
    setNewUnlocks(null);
  }, []);

  const visibleLives = Math.max(0, Math.min(lives, MAX_VISIBLE_EXTRA_LIVES));

  return (
    <div className="gfr-root">
      <div className="gfr-game-area">
        <canvas
          ref={canvasRef}
          className="gfr-canvas"
          onPointerDown={handlePointerDown}
          onClick={handlePointerDown}
        />

        {(screen === 'playing' || screen === 'paused') && (
          <div className="hud">
            <div className="hud-lives" aria-label={`Extra lives: ${visibleLives}`}>
              {Array.from({ length: MAX_VISIBLE_EXTRA_LIVES }).map((_, index) => (
                <span
                  key={index}
                  className={index < visibleLives ? 'hud-heart hud-heart-full' : 'hud-heart hud-heart-empty'}
                >
                  {index < visibleLives ? '♥' : '♡'}
                </span>
              ))}
              {/* Power-up indicators - small, left-aligned with hearts, non-intrusive */}
              {shieldCharges > 0 && (
                <span style={{ marginLeft: '10px', fontSize: '14px', verticalAlign: 'middle' }} title="Shield charges">🛡️{shieldCharges}</span>
              )}
              {magnetRemainingMs > 0 && (
                <span style={{ marginLeft: '8px', fontSize: '14px', verticalAlign: 'middle' }} title="Coin Magnet active">🧲 {Math.ceil(magnetRemainingMs / 1000)}s</span>
              )}
            </div>

            <div className="hud-score">{score}</div>

            {screen === 'playing' && (
              <button
                className="hud-pause-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  setScreen('paused');
                }}
                aria-label="Pause"
              >
                ⏸
              </button>
            )}
          </div>
        )}

        {reviveCountdown !== null && (
          <div className="revive-countdown-overlay">
            <span>{reviveCountdown > 0 ? reviveCountdown : 'GO!'}</span>
          </div>
        )}

        {screen === 'loading' && <LoadingScreen />}

        {screen === 'menu' && (
          <MainMenu
            onPlay={startRun}
            onLeaderboard={() => setScreen('leaderboard')}
            onHowTo={() => setScreen('howto')}
            onSettings={() => setScreen('settings')}
          />
        )}

        {screen === 'howto' && <HowToPlay onBack={() => setScreen('menu')} />}

        {screen === 'settings' && <SettingsScreen onBack={() => setScreen('menu')} />}

        {screen === 'leaderboard' && <LeaderboardScreen onBack={() => setScreen('menu')} />}

        {screen === 'paused' && (
          <PauseScreen
            onResume={() => setScreen('playing')}
            onMenu={() => {
              setReviveCountdown(null);
              setScreen('menu');
            }}
          />
        )}

        {screen === 'continueAd' && (
          <ContinueAdScreen
            onFinished={handleAdFinished}
            onSkip={handleSkipAd}
          />
        )}

        {screen === 'gameover' && !newUnlocks && (
          <GameOverScreen
            finalScore={finalScore}
            canContinue={!usedSecondChanceThisRun}
            onWatchAd={handleWatchAd}
            onPlayAgain={startRun}
            onLeaderboard={() => setScreen('leaderboard')}
            onMenu={() => setScreen('menu')}
            onNewUnlocks={handleNewUnlocks}
          />
        )}

        {newUnlocks && newUnlocks.length > 0 && (
          <UnlockCelebration unlockedIds={newUnlocks} onContinue={handleUnlockContinue} />
        )}

        {showAchievements && <AchievementsModal onClose={() => setShowAchievements(false)} />}

        {showInterstitial && <InterstitialAd onClose={() => setShowInterstitial(false)} />}
      </div>

      {screen === 'menu' && (
        <button
          className="achievements-fab"
          onClick={() => setShowAchievements(true)}
          aria-label="Achievements"
        >
          🏅
        </button>
      )}

      <BannerAd />
      <Footer />
    </div>
  );
}
