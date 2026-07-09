import { useEffect, useState } from 'react';
import { getLocalLeaderboard, getPersonalBest } from '../storage';
import type { LeaderboardEntry } from '../types';

interface Props {
  onBack: () => void;
}

export default function LeaderboardScreen({ onBack }: Props) {
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const best = getPersonalBest();

  useEffect(() => {
    // TODO(backend): call fetchGlobalLeaderboard() here once a real API exists.
    setBoard(getLocalLeaderboard());
  }, []);

  return (
    <div className="screen leaderboard-screen">
      <h2 className="screen-title">Top 10 Leaderboard</h2>
      <p className="leaderboard-sub">Your best: {best}</p>
      <ol className="leaderboard-list">
        {board.map((entry, i) => (
          <li key={`${entry.name}-${entry.date}-${i}`} className={`leaderboard-row ${i < 3 ? 'leaderboard-top3' : ''}`}>
            <span className="leaderboard-rank">#{i + 1}</span>
            <span className="leaderboard-name">{entry.name}</span>
            <span className="leaderboard-score">{entry.score}</span>
          </li>
        ))}
      </ol>
      <button className="btn btn-primary" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
