import { useEffect, useState } from 'react';
import { getDailyChallenge, getGlobalBestScore, getPersonalBest } from '../storage';

interface Props {
  onPlay: () => void;
  onLeaderboard: () => void;
  onHowTo: () => void;
  onSettings: () => void;
  onShop: () => void;
}

/**
 * Cute goldfish with blue stripes — matches the splash / loading style.
 */
function MenuFish() {
  return (
    <div className="menu-fish-decor" aria-hidden="true">
      <svg viewBox="0 0 80 56" width="96" height="68" className="menu-fish-svg" style={{ overflow: 'visible' }}>
        {/* soft glow */}
        <ellipse cx="44" cy="28" rx="28" ry="20" fill="#ffe066" opacity="0.25" />
        {/* tail */}
        <path
          d="M6 28 C0 14, 2 12, 14 16 C8 22, 8 28, 8 28 C8 28, 8 34, 14 40 C2 44, 0 42, 6 28 Z"
          fill="#ffb703"
        />
        {/* body */}
        <path
          d="M14 28 C14 14, 26 6, 44 7 C60 8, 72 16, 74 28 C72 40, 60 48, 44 49 C26 50, 14 42, 14 28 Z"
          fill="#ffd60a"
        />
        {/* blue vertical stripes (like splash fish) */}
        <path d="M26 12 C28 28, 28 28, 26 44 C32 44, 34 28, 32 12 Z" fill="#4cc9f0" opacity="0.85" />
        <path d="M40 10 C42 28, 42 28, 40 46 C46 46, 48 28, 46 10 Z" fill="#4cc9f0" opacity="0.9" />
        <path d="M52 14 C54 28, 54 28, 52 42 C56 42, 58 28, 56 14 Z" fill="#4cc9f0" opacity="0.75" />
        {/* belly */}
        <path
          d="M24 32 C32 42, 56 42, 64 30 C56 38, 36 40, 26 34 Z"
          fill="#fff8d6"
          opacity="0.7"
        />
        {/* dorsal */}
        <path d="M32 10 C40 0, 52 0, 56 12 C48 6, 40 6, 32 10 Z" fill="#ffb703" />
        {/* pectoral */}
        <path d="M50 28 C64 20, 66 34, 54 34 C52 32, 51 30, 50 28 Z" fill="#ffb703" />
        {/* eye */}
        <circle cx="62" cy="22" r="5" fill="#1a1200" />
        <circle cx="63.5" cy="20.5" r="1.8" fill="#fff" />
        {/* cheek blush */}
        <ellipse cx="58" cy="28" rx="3.5" ry="2.2" fill="#ff9f1c" opacity="0.4" />
        {/* shine */}
        <path
          d="M28 18 Q44 10 60 18"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function MainMenu({ onPlay, onLeaderboard, onHowTo, onSettings, onShop }: Props) {
  const [best, setBest] = useState(0);
  const [globalBest, setGlobalBest] = useState(0);
  const [daily, setDaily] = useState(getDailyChallenge());

  useEffect(() => {
    setBest(getPersonalBest());
    setGlobalBest(getGlobalBestScore());
    setDaily(getDailyChallenge());
  }, []);

  return (
    <div className="screen menu-screen">
      <MenuFish />
      <h1 className="game-title">
        Golden <span className="game-title-accent">Fish Rush</span>
      </h1>
      <p className="menu-tagline">Tap. Dodge. Rise.</p>

      <div className="menu-stats">
        <div className="stat-pill">
          <span className="stat-label">Personal Best</span>
          <span className="stat-value">{best}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Global Best</span>
          <span className="stat-value">{globalBest}</span>
        </div>
      </div>

      <div className="daily-challenge-card">
        <span className="daily-badge">Daily Challenge</span>
        <p>{daily.challenge.description}</p>
        <div className="daily-progress-track">
          <div
            className="daily-progress-fill"
            style={{ width: `${Math.min(100, (daily.progress / daily.challenge.target) * 100)}%` }}
          />
        </div>
        <span className="daily-status">
          {daily.completed
            ? `Completed! +${daily.challenge.rewardCoins} coins`
            : `${daily.progress}/${daily.challenge.target}`}
        </span>
      </div>

      <div className="menu-buttons">
        <button className="btn btn-primary" onClick={onPlay}>
          Play
        </button>
        <button className="btn btn-secondary" onClick={onLeaderboard}>
          Leaderboard
        </button>
        <button className="btn btn-secondary" onClick={onHowTo}>
          How to Play
        </button>
        <button className="btn btn-secondary" onClick={onSettings}>
          Settings
        </button>
        <button className="btn btn-secondary" onClick={onShop}>
          Shop
        </button>
      </div>
    </div>
  );
}
