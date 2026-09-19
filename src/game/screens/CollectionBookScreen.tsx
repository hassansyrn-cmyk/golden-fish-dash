import { useMemo } from 'react';
import { CHAPTERS, TOTAL_LORE_FRAGMENTS } from '../ocean/chapters';
import { getFoundLore, getLoreCompletionPercent, medalFor, getChapterProgress, getRunCollectionTotals } from '../storage';
import { useI18n } from '../i18n';

interface Props {
  onBack: () => void;
}

/** Lifetime collection counters (all-time, persisted across runs). */
function useLifetimeTotals() {
  return useMemo(() => getRunCollectionTotals(), []);
}

export default function CollectionBookScreen({ onBack }: Props) {
  const { t, language } = useI18n();
  const found = useMemo(() => new Set(getFoundLore()), []);
  const completion = useMemo(() => getLoreCompletionPercent(), []);
  const progress = useMemo(() => getChapterProgress(), []);
  const totals = useLifetimeTotals();

  return (
    <div className="screen collection-screen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <button className="menu-language-button back-button" type="button" onClick={onBack} aria-label={t('common.back')}>
        ←
      </button>
      <h1 className="screen-title">{t('collection.title')}</h1>

      <div className="collection-progress-card">
        <div className="collection-progress-head">
          <span>{t('collection.loreCompletion')}</span>
          <strong>{found.size}/{TOTAL_LORE_FRAGMENTS}</strong>
        </div>
        <div className="collection-progress-track">
          <div className="collection-progress-fill" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="collection-totals">
        <div className="collection-total"><span>✨</span><strong>{totals.surges}</strong><span>{t('collection.surges')}</span></div>
        <div className="collection-total"><span>🐠</span><strong>{totals.rescues}</strong><span>{t('collection.rescues')}</span></div>
        <div className="collection-total"><span>🪸</span><strong>{totals.barriers}</strong><span>{t('collection.barriers')}</span></div>
        <div className="collection-total"><span>🦐</span><strong>{totals.plankton}</strong><span>{t('collection.plankton')}</span></div>
        <div className="collection-total"><span>🔮</span><strong>{totals.pearls}</strong><span>{t('collection.pearls')}</span></div>
        <div className="collection-total"><span>🔥</span><strong>{totals.bestCombo}</strong><span>{t('collection.bestCombo')}</span></div>
      </div>

      <div className="lore-list">
        {CHAPTERS.map((chapter) => (
          <div key={chapter.id} className="lore-chapter">
            <h3>{t(chapter.nameKey)}</h3>
            {chapter.lore.map((fragment) => {
              const isFound = found.has(fragment.id);
              return (
                <div key={fragment.id} className={`lore-entry ${isFound ? 'lore-entry-found' : 'lore-entry-missing'}`}>
                  <span className="lore-entry-icon">{isFound ? '📖' : '🔒'}</span>
                  <div>
                    <strong>{isFound ? t(fragment.titleKey) : t('collection.undiscovered')}</strong>
                    {isFound && <p>{t(fragment.textKey)}</p>}
                  </div>
                </div>
              );
            })}
            {(() => {
              const p = progress[chapter.id];
              const medal = p ? medalFor(p) : 0;
              return (
                <p className="lore-chapter-medal">
                  {t('map.medal')}: {medal === 3 ? t('medal.gold') : medal === 2 ? t('medal.silver') : medal === 1 ? t('medal.bronze') : t('medal.none')}
                </p>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
