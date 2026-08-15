import { getAllAchievements } from '../storage';
import { translateAchievement, useI18n } from '../i18n';

interface Props {
  onClose: () => void;
}

export default function AchievementsModal({ onClose }: Props) {
  const { language, t } = useI18n();
  const achievements = getAllAchievements();
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3 className="screen-subtitle">{t('achievements.title')}</h3>
        <ul className="achievements-list">
          {achievements.map((a) => (
            <li key={a.id} className={`achievement-row ${a.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`}>
              <span className="achievement-icon">{a.unlocked ? '🏅' : '🔒'}</span>
              <div>
                <div className="achievement-name">{translateAchievement(a.id, 'name', language)}</div>
                <div className="achievement-desc">{translateAchievement(a.id, 'description', language)}</div>
              </div>
            </li>
          ))}
        </ul>
        <button className="btn btn-primary" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
