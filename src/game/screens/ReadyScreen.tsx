import { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

const STEPS = [3, 2, 1] as const;

export default function ReadyScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      const launchTimer = window.setTimeout(onComplete, 280);
      return () => window.clearTimeout(launchTimer);
    }

    const timer = window.setTimeout(() => setStep((current) => current + 1), 760);
    return () => window.clearTimeout(timer);
  }, [onComplete, step]);

  const isGo = step >= STEPS.length;
  const count = isGo ? 'GO!' : STEPS[step];

  return (
    <div className="ready-overlay" role="status" aria-live="assertive">
      <div className="ready-card">
        <div className="ready-kicker">DIVE PREP</div>
        <div className={`ready-count ${isGo ? 'ready-count-go' : ''}`}>{count}</div>
        <div className="ready-instruction">
          <span className="ready-tap-icon" aria-hidden="true">✦</span>
          <span>Tap anywhere or press <strong>Space</strong> to swim</span>
        </div>
        <p className="ready-tip">Keep one side of every reef gate clear and follow the coins.</p>
      </div>
    </div>
  );
}
