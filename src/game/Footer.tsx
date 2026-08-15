import { VERSION } from './constants';
import { useI18n } from './i18n';

export default function Footer() {
  const { t } = useI18n();
  const openPrivacy = () => {
    window.open('/privacy.html', '_blank');
  };

  return (
    <footer className="game-footer">
      <span className="footer-links">
        <a href="#" onClick={(e) => { e.preventDefault(); openPrivacy(); }}>
          {t('footer.privacy')}
        </a>
        <a href="#" onClick={(e) => e.preventDefault()}>
          {t('footer.terms')}
        </a>
        <a href="#" onClick={(e) => e.preventDefault()}>
          {t('footer.contact')}
        </a>
      </span>
      <span className="footer-version">{VERSION}</span>
    </footer>
  );
}
