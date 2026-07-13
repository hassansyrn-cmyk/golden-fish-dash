import { VERSION } from './constants';

export default function Footer() {
  const openPrivacy = () => {
    window.open('/privacy.html', '_blank');
  };

  return (
    <footer className="game-footer">
      <span className="footer-links">
        <a href="#" onClick={(e) => { e.preventDefault(); openPrivacy(); }}>
          Privacy Policy
        </a>
        <a href="#" onClick={(e) => e.preventDefault()}>
          Terms
        </a>
        <a href="#" onClick={(e) => e.preventDefault()}>
          Contact
        </a>
      </span>
      <span className="footer-version">{VERSION}</span>
    </footer>
  );
}
