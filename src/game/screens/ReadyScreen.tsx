import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

interface Props {
  onComplete: () => void;
}

const STEPS = [3, 2, 1] as const;

export default function ReadyScreen({ onComplete }: Props) {
  const { t } = useI18n();
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
  const count = isGo ? t('ready.go') : STEPS[step];

  return (
    <div className="ready-overlay" role="status" aria-live="assertive">
      <div className="ready-card">
        <div className="ready-kicker">{t('ready.title')}</div>
        <div className={`ready-count ${isGo ? 'ready-count-go' : ''}`}>{count}</div>
        <div className="ready-instruction">
          <span className="ready-tap-icon" aria-hidden="true">✦</span>
          <span>{t('ready.instruction', { key: 'Space' })}</span>
        </div>
        <p className="ready-tip">{t('ready.tip')}</p>
      </div>
    </div>
  );
}
