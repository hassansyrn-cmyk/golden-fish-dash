import { useCallback, useEffect, useRef, useState } from 'react';
import MainMenu from './screens/MainMenu';
import HowToPlay from './screens/HowToPlay';
import SettingsScreen from './screens/SettingsScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import GameOverScreen from './screens/GameOverScreen';
import ContinueAdScreen from './screens/ContinueAdScreen';
import PauseScreen from './screens/PauseScreen';
import LoadingScreen from './screens/LoadingScreen';
import ReadyScreen from './screens/ReadyScreen';
import AchievementsModal from './screens/AchievementsModal';
import UnlockCelebration from './screens/UnlockCelebration';
import ShopScreen from './screens/ShopScreen';
import DailyRewardsScreen from './screens/DailyRewardsScreen';
import LuckySpinScreen from './screens/LuckySpinScreen';
import { BannerAd } from './AdPlaceholders';
import Footer from './Footer';
import { useGameEngine } from './useGameEngine';
import { audioManager } from './managers/AudioManager';
import {
  getSelectedSkin,
  getSettings,
  markUsedSecondChanceEver,
  unlockAchievement,
} from './storage';
import type { ScreenName, SkinId } from './types';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Custom 3D/Glossy Heart Icon component for the HUD
const HeartIcon = ({ full }: { full: boolean }) => {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        margin: '0 3px',
        filter: full
          ? 'drop-shadow(0 0 6px rgba(255, 77, 109, 0.75)) drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
          : 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
        transition: 'transform 0.2s ease-in-out',
      }}
    >
      <defs>
        {/* Full Heart Gradient */}
        <radialGradient id="heart-grad-full" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffccd5" />
          <stop offset="40%" stopColor="#ff4d6d" />
          <stop offset="100%" stopColor="#800f2f" />
        </radialGradient>

        {/* Empty Heart Gradient */}
        <radialGradient id="heart-grad-empty" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="rgba(240, 240, 240, 0.35)" />
          <stop offset="60%" stopColor="rgba(120, 120, 120, 0.25)" />
          <stop offset="100%" stopColor="rgba(40, 40, 40, 0.15)" />
        </radialGradient>
      </defs>

      {/* Main Heart Path */}
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={full ? "url(#heart-grad-full)" : "url(#heart-grad-empty)"}
        stroke={full ? "#ff4d6d" : "rgba(255, 255, 255, 0.55)"}
        strokeWidth="1.2"
      />

      {/* Glossy Overlay Highlight for Full Heart */}
      {full && (
        <ellipse
          cx="7.5"
          cy="6.5"
          rx="2.5"
          ry="1.2"
          transform="rotate(-25 7.5 6.5)"
          fill="rgba(255, 255, 255, 0.85)"
        />
      )}

      {/* Glossy Overlay Highlight for Empty Heart */}
      {!full && (
        <ellipse
          cx="7.5"
          cy="6.5"
          rx="2.5"
          ry="1.2"
          transform="rotate(-25 7.5 6.5)"
          fill="rgba(255, 255, 255, 0.2)"
        />
      )}
    </svg>
  );
};

const ShieldIcon = ({ full }: { full: boolean }) => (
  <svg width="25" height="25" viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="shield-grad-full" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#e4fbff" />
        <stop offset="44%" stopColor="#4fc3f7" />
        <stop offset="100%" stopColor="#1565c0" />
      </linearGradient>
      <linearGradient id="shield-grad-empty" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(220, 245, 255, 0.30)" />
        <stop offset="100%" stopColor="rgba(50, 85, 130, 0.16)" />
      </linearGradient>
    </defs>
    <path
      d="M12 2.4 20 5.6v5.8c0 5.05-3.28 8.6-8 10.22C7.28 20 4 16.45 4 11.4V5.6L12 2.4Z"
      fill={full ? 'url(#shield-grad-full)' : 'url(#shield-grad-empty)'}
      stroke={full ? '#b3ecff' : 'rgba(255,255,255,0.42)'}
      strokeWidth="1.25"
    />
    {full && <path d="m8.2 11.9 2.25 2.15 5.2-5.25" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
);

const REVIVE_INVINCIBILITY_MS = 2000;
const MAX_VISIBLE_EXTRA_LIVES = 2;
const MAX_VISIBLE_SHIELDS = 2;
export default function GoldenFishRush() {
  const [screen, setScreen] = useState<ScreenName>('loading');
  const [finalScore, setFinalScore] = useState(0);
  const [usedSecondChanceThisRun, setUsedSecondChanceThisRun] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [reviveCountdown, setReviveCountdown] = useState<number | null>(null);
  const [newUnlocks, setNewUnlocks] = useState<SkinId[] | null>(null);
  const [showExitHint, setShowExitHint] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skin = getSelectedSkin();
  const backListenerRef = useRef<any>(null);
  const exitConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setScreen('menu'), 900);
    return () => clearTimeout(timer);
  }, []);

  // Android hardware back button handling (Capacitor)
  useEffect(() => {
    const setupBackButton = async () => {
      if (backListenerRef.current) {
        backListenerRef.current.remove();
        backListenerRef.current = null;
      }

      if (!Capacitor.isNativePlatform()) {
        return;
      }

      backListenerRef.current = await App.addListener('backButton', () => {
        if (
          screen === 'shop' ||
          screen === 'settings' ||
          screen === 'leaderboard' ||
          screen === 'howto' ||
          screen === 'dailyRewards' ||
          screen === 'luckySpin'
        ) {
          setScreen('menu');
        } else if (screen === 'playing') {
          setScreen('paused');
        } else if (screen === 'paused') {
          setScreen('playing');
        } else if (screen === 'continueAd') {
          setScreen('gameover');
        } else if (screen === 'menu') {
          if (exitConfirmTimerRef.current) {
            clearTimeout(exitConfirmTimerRef.current);
            exitConfirmTimerRef.current = null;
            setShowExitHint(false);
            void App.exitApp();
          } else {
            audioManager.playSound('back', getSettings().sound);
            setShowExitHint(true);
            exitConfirmTimerRef.current = setTimeout(() => {
              exitConfirmTimerRef.current = null;
              setShowExitHint(false);
            }, 2000);
          }
        } else {
          setScreen('menu');
        }
      });
    };

    setupBackButton();

    return () => {
      if (backListenerRef.current) {
        backListenerRef.current.remove();
        backListenerRef.current = null;
      }
      if (exitConfirmTimerRef.current) {
        clearTimeout(exitConfirmTimerRef.current);
        exitConfirmTimerRef.current = null;
      }
      setShowExitHint(false);
    };
  }, [screen]);

  const handleGameOver = useCallback(
    (score: number) => {
      setFinalScore(score);
      setScreen(usedSecondChanceThisRun ? 'gameover' : 'continueAd');
    },
    [usedSecondChanceThisRun],
  );

  const keepEngineAlive =
    screen === 'ready' ||
    screen === 'playing' ||
    screen === 'paused' ||
    screen === 'continueAd' ||
    reviveCountdown !== null;

  const enginePaused = screen !== 'playing' || reviveCountdown !== null;

  const {
    score,
    roundCoins,
    lives,
    shieldCharges,
    magnetRemainingMs,
    feverRemainingMs,
    hourglassRemainingMs,
    dropRushRemainingMs,
    miniChallenge,
    doJump,
    reviveAt,
  } = useGameEngine({
    canvasRef,
    active: keepEngineAlive,
    paused: enginePaused,
    skin,
    onGameOver: handleGameOver,
  });

  // Start run - shop boosts are now automatically applied inside the hook's setup()
  const startRun = useCallback(() => {
    setUsedSecondChanceThisRun(false);
    setReviveCountdown(null);
    setFinalScore(0);
    setNewUnlocks(null);

    setScreen('ready');
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
    setScreen('playing'); // Immediately switch so ad modal closes cleanly
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
  const visibleShields = Math.max(0, Math.min(shieldCharges, MAX_VISIBLE_SHIELDS));
  const activePowerUps = [
    { id: 'magnet', icon: '🧲', label: 'MAGNET', remainingMs: magnetRemainingMs, color: '#ffb74d' },
    { id: 'fever', icon: '✦', label: 'FEVER', remainingMs: feverRemainingMs, color: '#f48fb1' },
    { id: 'slow', icon: '⌛', label: 'SLOW', remainingMs: hourglassRemainingMs, color: '#80deea' },
    { id: 'drop-rush', icon: '✦', label: 'DROP RUSH', remainingMs: dropRushRemainingMs, color: '#fff176' },
  ].filter((powerUp) => powerUp.remainingMs > 0);
  const handleOpenShop = useCallback(() => {
    setScreen('shop');
  }, []);

  const handleShopBack = useCallback(() => {
    setScreen('menu');
  }, []);

  const handleOpenDailyRewards = useCallback(() => {
    setScreen('dailyRewards');
  }, []);

  const handleDailyBack = useCallback(() => {
    setScreen('menu');
  }, []);

  const handleOpenLuckySpin = useCallback(() => {
    setScreen('luckySpin');
  }, []);

  const handleLuckySpinBack = useCallback(() => {
    setScreen('menu');
  }, []);

  const handleGoToLeaderboard = useCallback(() => {
    setScreen('leaderboard');
  }, []);

  const handleGoToHowTo = useCallback(() => {
    setScreen('howto');
  }, []);

  const handleGoToSettings = useCallback(() => {
    setScreen('settings');
  }, []);

  const handleGoToMenu = useCallback(() => {
    setReviveCountdown(null);
    setScreen('menu');
  }, []);

  const handleResumePlaying = useCallback(() => {
    setScreen('playing');
  }, []);

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
            <div className="hud-resource-stack">
              <div className="hud-lives" aria-label={`Extra lives: ${visibleLives}`}>
                {Array.from({ length: MAX_VISIBLE_EXTRA_LIVES }).map((_, index) => {
                  const isFull = index < visibleLives;
                  return (
                    <span
                      key={index}
                      className={isFull ? 'hud-heart-wrapper hud-heart-full' : 'hud-heart-wrapper hud-heart-empty'}
                    >
                      <HeartIcon full={isFull} />
                    </span>
                  );
                })}
              </div>

              <div className="hud-shields" aria-label={`Shield charges: ${visibleShields} of ${MAX_VISIBLE_SHIELDS}`}>
                {Array.from({ length: MAX_VISIBLE_SHIELDS }).map((_, index) => {
                  const isFull = index < visibleShields;
                  return (
                    <span key={index} className={isFull ? 'hud-shield-wrapper hud-shield-full' : 'hud-shield-wrapper hud-shield-empty'}>
                      <ShieldIcon full={isFull} />
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="hud-score">{score}</div>

            {(activePowerUps.length > 0 || miniChallenge) && (
              <div className="hud-status-stack">
                {activePowerUps.length > 0 && (
                  <div className="hud-powerups" aria-label="Active power-ups">
                    {activePowerUps.map((powerUp) => (
                      <div
                        key={powerUp.id}
                        className="hud-powerup-chip"
                        style={{ borderColor: powerUp.color, boxShadow: `0 0 12px ${powerUp.color}55` }}
                      >
                        <span className="hud-powerup-icon">{powerUp.icon}</span>
                        <span>{powerUp.label} {Math.max(1, Math.ceil(powerUp.remainingMs / 1000))}s</span>
                      </div>
                    ))}
                  </div>
                )}

                {miniChallenge && (
                  <div className={`hud-challenge hud-challenge-${miniChallenge.status}`} aria-live="polite">
                    <div className="hud-challenge-heading">
                      <span>{miniChallenge.status === 'complete' ? '✓ COMPLETE' : miniChallenge.status === 'failed' ? 'TRY AGAIN' : miniChallenge.label}</span>
                      {miniChallenge.status === 'active' && <strong>{Math.max(1, Math.ceil(miniChallenge.remainingMs / 1000))}s</strong>}
                    </div>
                    <div className="hud-challenge-objective">
                      {miniChallenge.status === 'complete'
                        ? `+${miniChallenge.rewardCoins} coins earned!`
                        : miniChallenge.status === 'failed'
                          ? 'Challenge expired'
                          : `${miniChallenge.objective}: ${miniChallenge.progress}/${miniChallenge.target}`}
                    </div>
                  </div>
                )}
              </div>
            )}

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

        {showExitHint && screen === 'menu' && (
          <div className="exit-confirm-toast" role="status" aria-live="polite">
            <span className="exit-confirm-icon">↩</span>
            <span>هل تريد الخروج من اللعبة؟<br /><strong>اضغط زر الرجوع مرة أخرى</strong></span>
          </div>
        )}

        {screen === 'loading' && <LoadingScreen />}

        {screen === 'ready' && <ReadyScreen onComplete={() => setScreen('playing')} />}

        {screen === 'menu' && (
          <MainMenu
            onPlay={startRun}
            onLeaderboard={handleGoToLeaderboard}
            onHowTo={handleGoToHowTo}
            onSettings={handleGoToSettings}
            onShop={handleOpenShop}
            onDailyRewards={handleOpenDailyRewards}
            onLuckySpin={handleOpenLuckySpin}
          />
        )}

        {screen === 'howto' && <HowToPlay onBack={handleGoToMenu} />}

        {screen === 'settings' && <SettingsScreen onBack={handleGoToMenu} />}

        {screen === 'leaderboard' && <LeaderboardScreen onBack={handleGoToMenu} />}

        {screen === 'shop' && <ShopScreen onBack={handleShopBack} onNewUnlocks={handleNewUnlocks} />}

        {screen === 'dailyRewards' && <DailyRewardsScreen onBack={handleDailyBack} />}

        {screen === 'luckySpin' && <LuckySpinScreen onBack={handleLuckySpinBack} />}

        {screen === 'paused' && (
          <PauseScreen
            onResume={handleResumePlaying}
            onMenu={handleGoToMenu}
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
            roundCoins={roundCoins}
            canContinue={!usedSecondChanceThisRun}
            onWatchAd={handleWatchAd}
            onPlayAgain={startRun}
            onLeaderboard={handleGoToLeaderboard}
            onMenu={handleGoToMenu}
            onNewUnlocks={handleNewUnlocks}
            onShop={handleOpenShop}
          />
        )}

        {newUnlocks && newUnlocks.length > 0 && (
          <UnlockCelebration unlockedIds={newUnlocks} onContinue={handleUnlockContinue} />
        )}

        {showAchievements && <AchievementsModal onClose={() => setShowAchievements(false)} />}

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
