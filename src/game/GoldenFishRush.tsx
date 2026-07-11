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
import ShopScreen from './screens/ShopScreen';
import { BannerAd, InterstitialAd } from './AdPlaceholders';
import Footer from './Footer';
import { useGameEngine } from './useGameEngine';
import {
  getSelectedSkin,
  incrementGameOverCount,
  markUsedSecondChanceEver,
  unlockAchievement,
  getShopItemCount,
  consumeShopItem,
  getShopInventory,
} from './storage';
import type { ScreenName, SkinId } from './types';
import { Capacitor } from '@capacitor/core';

const REVIVE_INVINCIBILITY_MS = 2000;
const MAX_VISIBLE_EXTRA_LIVES = 2;
const MAGNET_SHOP_DURATION = 8000;

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
  const backListenerRef = useRef<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => setScreen('menu'), 900);
    return () => clearTimeout(timer);
  }, []);

  // Android hardware back button handling (Capacitor) - only on native platforms
  // Uses dynamic import to avoid Rollup/Vite resolution error during web build
  useEffect(() => {
    const setupBackButton = async () => {
      // Clean up previous listener
      if (backListenerRef.current) {
        backListenerRef.current.remove();
        backListenerRef.current = null;
      }

      // Only activate back button handling when running inside Capacitor (Android/iOS)
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      try {
        // Dynamic import so web build (vite) does not fail when @capacitor/app is not in node_modules
        const { App } = await import('@capacitor/app');

        backListenerRef.current = await App.addListener('backButton', () => {
          if (screen === 'shop' || screen === 'settings' || screen === 'leaderboard' || screen === 'howto') {
            setScreen('menu');
          } else if (screen === 'playing') {
            setScreen('paused');
          } else if (screen === 'paused') {
            setScreen('playing');
          } else if (screen === 'continueAd') {
            setScreen('gameover');
          } else if (screen === 'menu') {
            // Allow default exit behavior on main menu (do nothing special)
          } else {
            // Safe default for other screens
            setScreen('menu');
          }
        });
      } catch (err) {
        // Plugin not installed or not available in this environment - fail silently
        // (Android build via Capacitor will have it after cap sync if added)
        console.warn('[GoldenFishRush] Capacitor backButton plugin unavailable:', err);
      }
    };

    setupBackButton();

    return () => {
      if (backListenerRef.current) {
        backListenerRef.current.remove();
        backListenerRef.current = null;
      }
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
    screen === 'playing' ||
    screen === 'paused' ||
    screen === 'continueAd' ||
    reviveCountdown !== null;

  const enginePaused = screen !== 'playing' || reviveCountdown !== null;

  const { score, lives, doJump, reviveAt } = useGameEngine({
    canvasRef,
    active: keepEngineAlive,
    paused: enginePaused,
    skin,
    onGameOver: handleGameOver,
  });

  // Consume shop items and apply boosts at run start
  const startRun = useCallback(() => {
    setUsedSecondChanceThisRun(false);
    setReviveCountdown(null);
    setFinalScore(0);
    setShowInterstitial(false);
    setNewUnlocks(null);

    const inv = getShopInventory();

    if (inv.shield > 0) {
      consumeShopItem('shield');
      reviveAt(0);
    }

    if (inv.magnet > 0) {
      consumeShopItem('magnet');
    }

    if (inv.gemBoost > 0) {
      consumeShopItem('gemBoost');
    }

    setScreen('playing');
  }, [reviveAt]);

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

  const handleOpenShop = useCallback(() => {
    setScreen('shop');
  }, []);

  const handleShopBack = useCallback(() => {
    setScreen('menu');
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
            <div className="hud-lives" aria-label={`Extra lives: ${visibleLives}`}>
              {Array.from({ length: MAX_VISIBLE_EXTRA_LIVES }).map((_, index) => (
                <span
                  key={index}
                  className={index < visibleLives ? 'hud-heart hud-heart-full' : 'hud-heart hud-heart-empty'}
                >
                  {index < visibleLives ? '♥' : '♡'}
                </span>
              ))}
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
            onShop={handleOpenShop}
          />
        )}

        {screen === 'howto' && <HowToPlay onBack={() => setScreen('menu')} />}

        {screen === 'settings' && <SettingsScreen onBack={() => setScreen('menu')} />}

        {screen === 'leaderboard' && <LeaderboardScreen onBack={() => setScreen('menu')} />}

        {screen === 'shop' && <ShopScreen onBack={handleShopBack} />}

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
            onShop={handleOpenShop}
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
