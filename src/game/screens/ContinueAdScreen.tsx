import { useEffect, useState } from 'react';

interface Props {
  onFinished: () => void;
  onSkip: () => void;
}

// -----------------------------------------------------------------------
// Fake rewarded-ad simulation. TODO(ads): replace this countdown modal with
// a real rewarded ad SDK call (e.g. Google AdMob / IMA). On successful ad
// completion, call the same onFinished() callback to revive the player.
// -----------------------------------------------------------------------
export default function ContinueAdScreen({ onFinished, onSkip }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (!watching) return;
    if (secondsLeft <= 0) {
      onFinished();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [watching, secondsLeft, onFinished]);

  if (!watching) {
    return (
      <div className="screen continue-screen">
        <h2 className="screen-title">Continue?</h2>
        <p className="continue-copy">Watch a short ad for one more chance to keep your run alive.</p>
        <div className="gameover-buttons">
          <button className="btn btn-ad" onClick={() => setWatching(true)}>
            Watch Ad to Continue
          </button>
          <button className="btn btn-secondary" onClick={onSkip}>
            No Thanks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen continue-screen ad-modal">
      <div className="ad-frame">
        <span className="ad-label">Advertisement</span>
        <div className="ad-countdown">{secondsLeft}</div>
        <p>Reviving your fish in {secondsLeft}s…</p>
      </div>
    </div>
  );
}
