import { useMemo, useState } from 'react';
import { CHAPTERS } from '../ocean/chapters';
import { RUN_MODIFIERS, type RunModifierId } from '../ocean/runConfig';
import { getChapterProgress, medalFor, getPersonalBest, getFoundLore } from '../storage';
import { useI18n } from '../i18n';
import { environmentById } from '../ocean/environmentTheme';

interface Props {
  onBack: () => void;
  onDive: (modifiers: RunModifierId[]) => void;
}

const MEDAL_ICONS = ['·', '🥉', '🥈', '🥇'] as const;

function legendMedal(progress: Record<string, { bestScore: number; setPieceReached: boolean; setPieceCleared: boolean }>, chapterId: string, loreFound: string[], chapterLoreCount: number): 0 | 1 | 2 | 3 | 4 {
  const p = progress[chapterId];
  const base = p ? medalFor(p) : 0;
  if (base === 3 && chapterLoreCount > 0 && chapterLoreCount <= loreFound.length) return 4;
  return base;
}

export default function ChapterMapScreen({ onBack, onDive }: Props) {
  const { t, language } = useI18n();
  const [selected, setSelected] = useState(0);
  const [activeModifiers, setActiveModifiers] = useState<RunModifierId[]>([]);

  const best = useMemo(() => getPersonalBest(), []);
  const progress = useMemo(() => getChapterProgress(), []);
  const loreFound = useMemo(() => getFoundLore(), []);

  const chapter = CHAPTERS[selected];
  const unlocked = best >= chapter.minScore;
  const theme = environmentById(chapter.themeIds[0]);
  const medal = legendMedal(progress, chapter.id, loreFound, chapter.lore.length);

  const toggleModifier = (id: RunModifierId) => {
    setActiveModifiers((current) =>
      current.includes(id) ? current.filter((m) => m !== id) : [...current, id],
    );
  };

  const totalCoinBonus = RUN_MODIFIERS
    .filter((m) => activeModifiers.includes(m.id))
    .reduce((sum, m) => sum + m.coinBonus, 0);

  return (
    <div className="screen chapter-map-screen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <button className="menu-language-button back-button" type="button" onClick={onBack} aria-label={t('common.back')}>
        ←
      </button>
      <h1 className="screen-title">{t('map.title')}</h1>

      <div className="chapter-track" role="listbox" aria-label={t('map.title')}>
        {CHAPTERS.map((c, index) => {
          const chapterTheme = environmentById(c.themeIds[0]);
          const chapterUnlocked = best >= c.minScore;
          const chapterMedal = legendMedal(progress, c.id, loreFound, c.lore.length);
          return (
            <button
              key={c.id}
              role="option"
              aria-selected={index === selected}
              className={`chapter-node ${index === selected ? 'chapter-node-selected' : ''} ${chapterUnlocked ? '' : 'chapter-node-locked'}`}
              style={{ background: `linear-gradient(135deg, ${chapterTheme.mid}, ${chapterTheme.bottom})` }}
              onClick={() => setSelected(index)}
            >
              <span className="chapter-node-index">{index + 1}</span>
              <span className="chapter-node-name">{chapterUnlocked ? t(c.nameKey) : '???'}</span>
              <span className="chapter-node-medal" title={t('map.medal')}>
                {chapterMedal === 4 ? '🏆' : MEDAL_ICONS[chapterMedal]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="chapter-detail" style={{ borderColor: theme.accent }}>
        <div className="chapter-detail-head">
          <h2>{unlocked ? t(chapter.nameKey) : t('map.locked')}</h2>
          <span className="chapter-detail-medal">{medal === 4 ? '🏆' : MEDAL_ICONS[medal]}</span>
        </div>
        <p className="chapter-identity">{unlocked ? t(chapter.identityKey) : t('map.lockedHint', { score: chapter.minScore })}</p>
        <div className="chapter-detail-meta">
          <span>🌊 {t('map.fromScore', { score: chapter.minScore })}</span>
          <span>⚔ {t(chapter.setPiece.nameKey)}</span>
          <span>📜 {chapter.lore.length} {t('map.loreCount')}</span>
        </div>
      </div>

      <div className="modifier-picker">
        <h3>{t('map.modifiers')}</h3>
        {RUN_MODIFIERS.map((modifier) => (
          <button
            key={modifier.id}
            className={`modifier-chip ${activeModifiers.includes(modifier.id) ? 'modifier-chip-active' : ''}`}
            onClick={() => toggleModifier(modifier.id)}
            aria-pressed={activeModifiers.includes(modifier.id)}
          >
            <strong>{t(modifier.nameKey)}</strong>
            <span>{t(modifier.descriptionKey)}</span>
            {modifier.coinBonus > 0 && <em>+{Math.round(modifier.coinBonus * 100)}%</em>}
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary btn-dive"
        disabled={!unlocked}
        onClick={() => unlocked && onDive(activeModifiers)}
      >
        {unlocked ? `${t('map.dive')} ${totalCoinBonus > 0 ? `+${Math.round(totalCoinBonus * 100)}%` : ''}` : t('common.locked')}
      </button>
    </div>
  );
}
