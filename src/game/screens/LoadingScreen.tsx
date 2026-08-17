import { useI18n } from '../i18n';
import { PLAYER_FISH_SPRITE_SHEET_PATHS } from '../fishAssets';
import AnimatedFishPreview from '../components/AnimatedFishPreview';

export default function LoadingScreen() {
  const { t } = useI18n();

  return (
    <div className="screen loading-screen">
      <div className="loading-fish" aria-hidden="true">
        <AnimatedFishPreview
          className="loading-fish-sprite"
          src={PLAYER_FISH_SPRITE_SHEET_PATHS.golden}
          width={132}
          height={100}
          fps={7}
        />
      </div>
      <p>{t('loading.subtitle')}</p>
    </div>
  );
}
