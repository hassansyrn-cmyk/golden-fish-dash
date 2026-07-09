import { VERSION } from './constants';

export default function Footer() {
  return (
    <footer className="game-footer">
      <span className="footer-links">
        <a href="#" onClick={(e) => e.preventDefault()}>
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
