import { getAllAchievements } from '../storage';

interface Props {
  onClose: () => void;
}

export default function AchievementsModal({ onClose }: Props) {
  const achievements = getAllAchievements();
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3 className="screen-subtitle">Achievements</h3>
        <ul className="achievements-list">
          {achievements.map((a) => (
            <li key={a.id} className={`achievement-row ${a.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`}>
              <span className="achievement-icon">{a.unlocked ? '🏅' : '🔒'}</span>
              <div>
                <div className="achievement-name">{a.name}</div>
                <div className="achievement-desc">{a.description}</div>
              </div>
            </li>
          ))}
        </ul>
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
