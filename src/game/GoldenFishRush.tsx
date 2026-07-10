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

  const handleGameOver = useCallback(
    (score: number) => {
      setFinalScore(score);
      setScreen(usedSecondChanceThisRun ? 'gameover' : 'continueAd');
    },
    [usedSecondChanceThisRun],
  );

  /*
    Important:
    The engine must stay alive while the Continue Ad placeholder is open.
    If active becomes false during continueAd, useGameEngine will recreate
    the engine when returning to playing, which restarts the run from zero.

    keepEngineAlive:
    - playing: normal gameplay
    - paused: keep current run
    - continueAd: keep current run while fake rewarded ad/countdown is shown
    - reviveCountdown: keep current run while revive countdown is visible

    enginePaused:
    - true whenever the player should not control the fish
    - false only during real playing
  */
  const keepEngineAliv* =
    screen === 'playing' ||
   *screen === 'paused' ||
    screen *== 'continueAd' ||
    reviveCount*own !== null;

  const enginePause* = screen !== 'playing' || reviveC*untdown !== null;

  const { score* doJump, reviveAt } = useGameEngin*({
    canvasRef,
    active: keep*ngineAlive,
    paused: enginePaus*d,
    skin,
    onGameOver: handl*GameOver,
  });

  const startRun * useCallback(() => {
    setUsedSe*ondChanceThisRun(false);
    setRe*iveCountdown(null);
    setFinalSc*re(0);
    setShowInterstitial(fal*e);
    setScreen('playing');
  },*[]);

  const handleWatchAd = useC*llback(() => {
    setScreen('cont*nueAd');
  }, []);

  const handle*dFinished = useCallback(() => {
  * // TODO(ads): call the reward-gra*t callback here once a real reward*d
    // ad SDK confirms completion, instead of assuming success.
    //
    // A revive consumes this run's single second chance, whether it was
    // offered automatically after death or from the Game Over screen.
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

  // Input handling: tap/click/space to jump while playing.
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
