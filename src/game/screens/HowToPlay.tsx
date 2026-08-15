import { useI18n } from '../i18n';

interface Props {
  onBack: () => void;
}

export default function HowToPlay({ onBack }: Props) {
  const { t } = useI18n();

  return (
    <div className="screen howto-screen">
      <h2 className="screen-title">{t('howto.title')}</h2>
      <ul className="howto-list">
        <li>
          <span className="howto-icon">👆</span>
          {t('howto.tap')}
        </li>
        <li>
          <span className="howto-icon">🌊</span>
          {t('howto.gravity')}
        </li>
        <li>
          <span className="howto-icon">🏆</span>
          {t('howto.score')}
        </li>
        <li>
          <span className="howto-icon">📺</span>
          {t('howto.continue')}
        </li>
        <li>
          <span className="howto-icon">🥇</span>
          {t('howto.unlock')}
        </li>
      </ul>
      <button className="btn btn-primary" onClick={onBack}>
        {t('howto.gotIt')}
      </button>
    </div>
  );
}
