import { useState } from 'react';
import { SKINS } from '../constants';
import {
  getPersonalBest,
  getSelectedSkin,
  getSettings,
  refreshUnlockedSkins,
  resetPersonalBest,
  setSelectedSkin,
  setSettings,
} from '../storage';
import type { AppLanguage, Settings, SkinId } from '../types';
import { translateSkin, useI18n } from '../i18n';
import { PLAYER_FISH_PREVIEW_PATHS } from '../fishAssets';

interface Props {
  onBack: () => void;
}

function SkinPreview({ skinId }: { skinId: SkinId }) {
  const skin = SKINS.find((item) => item.id === skinId) ?? SKINS[0];

  return (
    <div
      className="skin-fish-preview skin-fish-preview-art"
      style={{ filter: `drop-shadow(0 0 10px ${skin.colors.glow})` }}
      aria-hidden="true"
    >
      <img src={PLAYER_FISH_PREVIEW_PATHS[skinId]} alt="" />
    </div>
  );
}

export default function SettingsScreen({ onBack }: Props) {
  const { language, setLanguage: applyLanguage, t } = useI18n();
  const [settings, setLocalSettings] = useState<Settings>(() => getSettings());
  const best = getPersonalBest();

  const [unlocked, setUnlocked] = useState<SkinId[]>(() => refreshUnlockedSkins(best));
  const [selected, setSelected] = useState<SkinId>(() => getSelectedSkin());
  const [confirmReset, setConfirmReset] = useState(false);

  function toggle(key: 'sound' | 'music' | 'vibration') {
    const next = { ...settings, [key]: !settings[key] };
    setLocalSettings(next);
    setSettings(next);
  }

  function chooseLanguage(nextLanguage: AppLanguage) {
    const next = { ...settings, language: nextLanguage };
    setLocalSettings(next);
    setSettings(next);
    applyLanguage(nextLanguage);
  }

  function pickSkin(id: SkinId) {
    if (!unlocked.includes(id)) return;
    setSelected(id);
    setSelectedSkin(id);
  }

  function handleReset() {
    resetPersonalBest();
    const resetUnlocked = refreshUnlockedSkins(0);
    setUnlocked(resetUnlocked);
    setSelected('golden');
    setSelectedSkin('golden');
    setConfirmReset(false);
  }

  const openPrivacyPolicy = () => {
    // Works on both web and Capacitor Android
    window.open('/privacy.html', '_blank');
  };

  return (
    <div className="screen settings-screen">
      <h2 className="screen-title">{t('settings.title')}</h2>

      <div className="settings-group">
        <label className="settings-row">
          <span>{t('settings.sound')}</span>
          <input type="checkbox" checked={settings.sound} onChange={() => toggle('sound')} />
        </label>

        <label className="settings-row">
          <span>{t('settings.music')}</span>
          <input type="checkbox" checked={settings.music} onChange={() => toggle('music')} />
        </label>

        <label className="settings-row">
          <span>{t('settings.vibration')}</span>
          <input type="checkbox" checked={settings.vibration} onChange={() => toggle('vibration')} />
        </label>
      </div>

      <div className="settings-group language-settings-group">
        <h3 className="settings-subtitle">{t('settings.language')}</h3>
        <div className="language-picker" role="group" aria-label={t('settings.language')}>
          <button className={`language-option ${language === 'en' ? 'language-option-active' : ''}`} onClick={() => chooseLanguage('en')}>English</button>
          <button className={`language-option ${language === 'ar' ? 'language-option-active' : ''}`} onClick={() => chooseLanguage('ar')}>العربية</button>
        </div>
        <p className="language-hint">{t('language.auto')}</p>
      </div>

      <h3 className="settings-subtitle">{t('settings.fishRewards')}</h3>

      <div className="skin-grid">
        {SKINS.map((skin) => {
          const isUnlocked = unlocked.includes(skin.id)
            || (skin.unlockMethod !== 'poseidon' && best >= skin.unlockScore);
          const isSelected = selected === skin.id;
          const progressText =
            skin.unlockScore === 0
              ? t('settings.starterFish')
              : isUnlocked
                ? t('settings.unlocked')
                : skin.unlockMethod === 'poseidon'
                  ? t('settings.poseidonReward')
                  : t('settings.scoreUnlock', { score: skin.unlockScore });

          return (
            <button
              key={skin.id}
              className={`skin-card ${isSelected ? 'skin-card-selected' : ''} ${!isUnlocked ? 'skin-card-locked' : ''}`}
              onClick={() => pickSkin(skin.id)}
              disabled={!isUnlocked}
            >
              <SkinPreview skinId={skin.id} />

              <span>{translateSkin(skin.id, 'name', language)}</span>

              <div style={{ fontSize: '11px', color: '#ffd54f', margin: '4px 0', fontWeight: '500', lineHeight: '1.2' }}>
                {translateSkin(skin.id, 'ability', language)}
              </div>

              {!isUnlocked && <span className="skin-lock-req">{progressText}</span>}

              {isUnlocked && !isSelected && (
                <span className="skin-lock-req">{t('settings.tapEquip')}</span>
              )}

              {isSelected && (
                <span className="skin-lock-req">{t('common.selected')}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="settings-group">
        {!confirmReset ? (
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            {t('settings.resetBest')}
          </button>
        ) : (
          <div className="confirm-row">
            <span>{t('settings.confirmReset')}</span>

            <button className="btn btn-danger" onClick={handleReset}>
              {t('settings.confirm')}
            </button>

            <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <p className="privacy-note">{t('settings.privacyNote')}</p>
        
        <button 
          onClick={openPrivacyPolicy}
          className="btn btn-secondary text-sm py-2"
        >
          {t('footer.privacy')}
        </button>
      </div>

      <button className="btn btn-primary mt-4" onClick={onBack}>
        {t('common.back')}
      </button>
    </div>
  );
}
