import { useEffect, useState } from 'react';
import { getLocalLeaderboard, getPersonalBest, fetchGlobalLeaderboard } from '../storage';
import type { LeaderboardEntry } from '../types';
import { useI18n } from '../i18n';

interface Props {
  onBack: () => void;
}

export default function LeaderboardScreen({ onBack }: Props) {
  const { t } = useI18n();
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const best = getPersonalBest();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchGlobalLeaderboard();
        if (mounted) {
          setBoard(data.length > 0 ? data : getLocalLeaderboard());
        }
      } catch (err) {
        console.warn('[LeaderboardScreen] Firebase load failed, using local/sample data.');
        if (mounted) {
          setError(t('leaderboard.offline'));
          setBoard(getLocalLeaderboard());
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [t]);

  return (
    <div className="screen leaderboard-screen">
      <h2 className="screen-title">{t('leaderboard.title')}</h2>
      <p className="leaderboard-sub">{t('leaderboard.yourBest', { score: best })}</p>
      {loading && <p className="leaderboard-sub" style={{ opacity: 0.7 }}>{t('leaderboard.loadingScores')}</p>}
      {!loading && error && <p className="leaderboard-sub" style={{ color: '#f59e0b' }}>{error}</p>}
      <ol className="leaderboard-list">
        {board.length === 0 && !loading ? (
          <li className="leaderboard-row">{t('leaderboard.noScores')}</li>
        ) : (
          board.map((entry, i) => (
            <li key={`${entry.name}-${entry.date}-${i}`} className={`leaderboard-row ${i < 3 ? 'leaderboard-top3' : ''}`}>
              <span className="leaderboard-rank">#{i + 1}</span>
              <span className="leaderboard-name">{entry.name}</span>
              <span className="leaderboard-score">{entry.score}</span>
            </li>
          ))
        )}
      </ol>
      <button className="btn btn-primary" onClick={onBack}>
        {t('common.back')}
      </button>
    </div>
  );
}
