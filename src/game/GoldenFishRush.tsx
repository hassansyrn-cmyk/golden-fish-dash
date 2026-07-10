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
import { BannerAd, InterstitialAd } from './AdPlaceholders';
import Footer from './Footer';
import { useGameEngine } from './useGameEngine';
import { sounds } from './sounds';
import { getSelectedSkin, incrementGameOverCount, markUsedSecondChanceEver, unlockAchievement } from './storage';
import type { ScreenName } from './types';

const REVIVE_INVINCIBILITY_MS = 2000;

export default function GoldenFishRush() {
  const [screen, setScreen] = useState<ScreenName>('loading');
  const [finalScore, setFinalScore] = useState(0);
  const [usedSecondChanceThisRun, setUsedSecondChanceThisRun] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [reviveCountdown, setReviveCountdown] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skin = getSelectedSkin();

  useEffect(() => {
    const timer = setTimeout(() => setScreen('menu'), 900);
    return () => clearTimeout(timer);
  }, []);

  // Global click/pointerdown sound effect for buttons
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'BUTTON' ||
         target.closest('button') ||
         target.classList.contains('skin-card') ||
         target.classList.contains('hud-pause-btn') ||
         target.closest('.skin-card'))
      ) {
        sounds.playButtonClick();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setScreen(usedSecondChanceThisRun ? 'gameover' : 'continueAd');
  }, [usedSecondChanceThisRun]);

  const { score, coins, lives, doJump, reviveAt } = useGameEngine({
    canvasRef,
    active: screen === 'playing' || screen === 'paused',
    paused: screen === 'paused',
    skin,
    onGameOver: handleGameOver,
  });

  const startRun = useCallback(() => {
    setUsedSecondChanceThisRun(false);
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
    setScreen('gameover');
  }, []);

  useEffect(() => {
    if (reviveCountdown === null) return;
    if (reviveCountdown <= 0) {
      setReviveCountdown(null);
      setScreen('playing');
      return;
    }
    const t = setTimeout(() => setReviveCountdown((c) => (c ?? 1) - 1), 700);
    return () => clearTimeout(t);
  }, [reviveCountdown]);

  useEffect(() => {
    if (screen !== 'gameover') return;
    const count = incrementGameOverCount();
    if (count % 3 === 0) setShowInterstitial(true);
  }, [screen]);

  // Input handling: tap/click/space to jump while playing.
  useEffect(() => {
    if (screen !== 'playing') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        doJump();
      }
      if (e.code === 'Escape') setScreen('paused');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [screen, doJump]);

  const handlePointerDown = useCallback(() => {
    if (screen === 'playing') doJump();
  }, [screen, doJump]);

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
          <div className="hud" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="hud-info" style={{ display: 'flex', gap: '15px' }}>
              <div className="hud-score" style={{ fontSize: '20px', fontWeight: 'bold' }}>🏆 {score}</div>
              <div className="hud-coins" style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffd60a' }}>🪙 {coins}</div>
              {lives > 1 && (
                <div className="hud-lives" style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff4081', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  💖 <span style={{ textShadow: '0 0 8px rgba(255,64,129,0.6)' }}>{lives}</span>
                </div>
              )}
            </div>
            {screen === 'playing' && (
              <button
                className="hud-pause-btn"
                onClick={(e) => {
                  e.stopPropagation();
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
          <PauseScreen onResume={() => setScreen('playing')} onMenu={() => setScreen('menu')} />
        )}

        {screen === 'continueAd' && (
          <ContinueAdScreen
            onFinished={handleAdFinished}
            onSkip={handleSkipAd}
          />
        )}

        {screen === 'gameover' && (
          <GameOverScreen
            finalScore={finalScore}
            canContinue={!usedSecondChanceThisRun}
            onWatchAd={handleWatchAd}
            onPlayAgain={startRun}
            onLeaderboard={() => setScreen('leaderboard')}
            onMenu={() => setScreen('menu')}
          />
        )}

        {showAchievements && <AchievementsModal onClose={() => setShowAchievements(false)} />}
        {showInterstitial && <InterstitialAd onClose={() => setShowInterstitial(false)} />}
      </div>

      {screen === 'menu' && (
        <button className="achievements-fab" onClick={() => setShowAchievements(true)} aria-label="Achievements">
          🏅
        </button>
      )}

      <BannerAd />
      <Footer />
    </div>
  );
}
