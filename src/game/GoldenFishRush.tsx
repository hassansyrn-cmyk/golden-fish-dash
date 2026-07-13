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
import DailyRewardsScreen from './screens/DailyRewardsScreen';
import LuckySpinScreen from './screens/LuckySpinScreen';
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
          // Allow default exit behavior on main menu
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

  const { score, roundCoins, lives, doJump, reviveAt, engineStateRef } = useGameEngine({
    canvasRef,
    active: keepEngineAlive,
    paused: enginePaused,
    skin,
    onGameOver: handleGameOver,
    hide2DFish: false,
  });

  // Start run - shop boosts are now automatically applied inside the hook's setup()
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
            <div className="hud-lives" aria-label={`Extra lives: ${visibleLives}`} style={{ display: 'flex', alignItems: 'center' }}>
              {Array.from({ length: MAX_VISIBLE_EXTRA_LIVES }).map((_, index) => {
                const isFull = index < visibleLives;
                return (
                  <span
                    key={index}
                    className={isFull ? 'hud-heart-wrapper hud-heart-full' : 'hud-heart-wrapper hud-heart-empty'}
                    style={{ display: 'inline-flex', alignItems: 'center' }}
                  >
                    <HeartIcon full={isFull} />
                  </span>
                );
              })}
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

        {screen === 'shop' && <ShopScreen onBack={handleShopBack} />}

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
