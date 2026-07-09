import { useState } from 'react';
import { estimateGlobalRank, getPersonalBest, qualifiesForLeaderboard, submitScoreToServer } from '../storage';
import { SKINS } from '../constants';

interface Props {
  finalScore: number;
  canContinue: boolean;
  onWatchAd: () => void;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
  onMenu: () => void;
}

function encouragement(finalScore: number, best: number): string {
  if (finalScore >= best && finalScore > 0) return 'New personal best! You are unstoppable.';
  if (best - finalScore <= 3 && best - finalScore > 0) return `You were close to your best! Only ${best - finalScore} points away.`;
  const nextSkin = SKINS.find((s) => s.unlockScore > finalScore);
  if (nextSkin) return `Only ${nextSkin.unlockScore - finalScore} points away from unlocking the ${nextSkin.name}!`;
  return 'Try again to climb the leaderboard!';
}

export default function GameOverScreen({ finalScore, canContinue, onWatchAd, onPlayAgain, onLeaderboard, onMenu }: Props) {
  const best = getPersonalBest();
  const rank = estimateGlobalRank(finalScore);
  const qualifies = qualifiesForLeaderboard(finalScore);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    // TODO(backend): swap for a real POST /api/score call in production.
    // submitScoreToServer already records the entry in the local
    // leaderboard as its fallback, so no separate insert is needed here.
    await submitScoreToServer(trimmed, finalScore);
    setSubmitted(true);
  }

  return (
    <div className="screen gameover-screen">
      <h2 className="screen-title gameover-title">Game Over</h2>
      <div className="gameover-stats">
        <div>
          <span className="stat-label">Final Score</span>
          <span className="stat-value stat-value-lg">{finalScore}</span>
        </div>
        <div>
          <span className="stat-label">Personal Best</span>
          <span className="stat-value">{Math.max(best, finalScore)}</span>
        </div>
        <div>
          <span className="stat-label">Global Rank (est.)</span>
          <span className="stat-value">#{rank}</span>
        </div>
      </div>

      <p className="gameover-encourage">{encouragement(finalScore, best)}</p>

      {qualifies && !submitted && (
        <div className="name-entry-card">
          <p>You made the leaderboard! Enter a name:</p>
          <div className="name-entry-row">
            <input
              className="name-input"
              maxLength={16}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleSubmit}>
              Save
            </button>
          </div>
        </div>
      )}
      {submitted && <p className="name-saved-note">Score saved to the leaderboard!</p>}

      <div className="gameover-buttons">
        {canContinue && (
          <button className="btn btn-ad" onClick={onWatchAd}>
            Watch Ad to Continue
          </button>
        )}
        <button className="btn btn-primary" onClick={onPlayAgain}>
          Play Again
        </button>
        <button className="btn btn-secondary" onClick={onLeaderboard}>
          Leaderboard
        </button>
        <button className="btn btn-secondary" onClick={onMenu}>
          Main Menu
        </button>
      </div>
    </div>
  );
}
