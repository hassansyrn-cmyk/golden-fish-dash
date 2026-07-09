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
        🐠
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
