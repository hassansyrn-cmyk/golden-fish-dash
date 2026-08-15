import { useI18n } from '../i18n';

interface Props {
  onResume: () => void;
  onMenu: () => void;
}

export default function PauseScreen({ onResume, onMenu }: Props) {
  const { t } = useI18n();

  return (
    <div className="screen pause-screen">
      <h2 className="screen-title">{t('pause.title')}</h2>
      <div className="gameover-buttons">
        <button className="btn btn-primary" onClick={onResume}>
          {t('pause.resume')}
        </button>
        <button className="btn btn-secondary" onClick={onMenu}>
          {t('pause.menu')}
        </button>
      </div>
    </div>
  );
}
