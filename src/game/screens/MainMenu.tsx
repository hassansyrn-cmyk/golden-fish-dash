import { useEffect, useState } from 'react';
import { getDailyChallenge, getGlobalBestScore, getPersonalBest } from '../storage';

interface Props {
  onPlay: () => void;
  onLeaderboard: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}

export default function MainMenu({ onPlay, onLeaderboard, onHowTo, onSettings }: Props) {
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
      <div className="menu-fish-decor" aria-hidden="true">
        <svg viewBox="0 0 80 56" width="88" height="62" className="menu-fish-svg">
          {/* soft glow */}
          <circle cx="44" cy="28" r="24" fill="#ffe066" opacity="0.2" />
          {/* tail */}
          <path d="M4 28 L20 10 L18 28 L20 46 Z" fill="#ff9f1c" />
          {/* body */}
          <ellipse cx="44" cy="28" rx="24" ry="16" fill="#ffc93c" />
          {/* belly */}
          <ellipse cx="46" cy="33" rx="15" ry="9" fill="#fff3c4" opacity="0.9" />
          {/* dorsal fin */}
          <path d="M32 14 Q44 0 56 14 L50 16 L38 16 Z" fill="#ff9f1c" />
          {/* lower fin */}
          <path d="M34 40 Q44 54 54 40 L48 38 L40 38 Z" fill="#ff9f1c" opacity="0.95" />
          {/* side fin */}
          <path d="M50 30 Q66 22 68 36 Q58 34 50 30" fill="#ff9f1c" />
          {/* eye */}
          <circle cx="58" cy="23" r="4.5" fill="#1a1200" />
          <circle cx="59.5" cy="21.5" r="1.6" fill="#fff" />
          {/* smile */}
          <path d="M60 30 Q64 34 68 30" stroke="#1a1200" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {/* shine */}
          <path d="M30 20 Q44 12 58 20" stroke="rgba(255,255,255,0.55)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      </div>
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
          {daily.completed ? `Completed! +${daily.challenge.rewardCoins} coins` : `${daily.progress}/${daily.challenge.target}`}
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
      </div>
    </div>
  );
}
