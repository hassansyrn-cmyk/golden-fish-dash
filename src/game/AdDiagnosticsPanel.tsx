import { useState, useSyncExternalStore } from 'react';
import { getAdDiagnosticsSnapshot, subscribeToAdDiagnostics } from './managers/AdManager';

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
  right: 12,
  zIndex: 10000,
  width: 'min(360px, calc(100vw - 24px))',
  color: '#e9f5ff',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  lineHeight: 1.4,
  pointerEvents: 'auto',
};

const buttonStyle: React.CSSProperties = {
  border: '1px solid rgba(125, 211, 252, .65)',
  borderRadius: 10,
  background: 'rgba(3, 22, 38, .96)',
  color: '#e9f5ff',
  padding: '9px 12px',
  font: '600 12px system-ui, sans-serif',
  boxShadow: '0 6px 24px rgba(0,0,0,.35)',
};

const labelStyle: React.CSSProperties = { color: '#9db8cc', minWidth: 94, flexShrink: 0 };

function reportText(snapshot: ReturnType<typeof getAdDiagnosticsSnapshot>) {
  return JSON.stringify(
    {
      capturedAt: snapshot.updatedAt,
      app: { native: snapshot.native, testAds: snapshot.testAds },
      sdk: snapshot.sdk,
      ump: snapshot.consent,
      rewardedAdLoad: snapshot.rewarded,
    },
    null,
    2,
  );
}

export default function AdDiagnosticsPanel() {
  const snapshot = useSyncExternalStore(subscribeToAdDiagnostics, getAdDiagnosticsSnapshot, getAdDiagnosticsSnapshot);
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const summary = snapshot.rewarded.status === 'error'
    ? 'REWARDED LOAD FAILED'
    : snapshot.consent.status === 'blocked'
      ? 'CONSENT BLOCKED ADS'
      : snapshot.rewarded.status === 'loaded'
        ? 'REWARDED TEST AD LOADED'
        : 'AD DIAGNOSTICS';

  async function copyReport() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(reportText(snapshot));
      setCopyStatus('Copied. Send the report with your test result.');
    } catch {
      setCopyStatus('Copy unavailable; you can select the report text below.');
    }
  }

  const row = (label: string, value: string, detail?: string) => (
    <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(157,184,204,.16)' }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere', color: '#f4f9ff' }}>
        <strong>{value}</strong>
        {detail && <div style={{ marginTop: 2, color: '#b9cedd', overflowWrap: 'anywhere' }}>{detail}</div>}
      </span>
    </div>
  );

  return (
    <div style={panelStyle}>
      <button type="button" style={buttonStyle} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {snapshot.testAds ? 'TEST ADS' : 'DIAGNOSTIC BUILD'} · {summary}
      </button>
      {open && (
        <section aria-label="Ad diagnostics" style={{ marginTop: 8, border: '1px solid rgba(125,211,252,.5)', borderRadius: 12, background: 'rgba(3,16,29,.97)', padding: 12, boxShadow: '0 12px 34px rgba(0,0,0,.45)', maxHeight: '58vh', overflowY: 'auto', touchAction: 'pan-y' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <strong style={{ fontSize: 14 }}>Ad diagnostics</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close ad diagnostics" style={{ ...buttonStyle, padding: '4px 8px' }}>Close</button>
          </header>
          <p style={{ margin: '3px 0 8px', color: '#fcd34d', fontWeight: 700 }}>Google sample ad units only. Do not click ads.</p>
          {row('Build mode', snapshot.testAds ? 'TEST ADS' : 'NOT TEST ADS', `Native app: ${snapshot.native ? 'yes' : 'no'}`)}
          {row('Mobile Ads SDK', snapshot.sdk.status.toUpperCase(), snapshot.sdk.detail)}
          {row('UMP consent', snapshot.consent.consentStatus, `canRequestAds: ${snapshot.consent.canRequestAds === null ? 'not reported' : String(snapshot.consent.canRequestAds)} · form available: ${snapshot.consent.isConsentFormAvailable === null ? 'not reported' : String(snapshot.consent.isConsentFormAvailable)}`)}
          {row('Consent detail', snapshot.consent.status.toUpperCase(), snapshot.consent.detail)}
          {row('Rewarded load', snapshot.rewarded.status.toUpperCase(), `${snapshot.rewarded.placement}: ${snapshot.rewarded.detail}`)}
          <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void copyReport()} style={{ ...buttonStyle, padding: '7px 10px' }}>Copy diagnostic report</button>
            {copyStatus && <span style={{ color: '#b9cedd' }}>{copyStatus}</span>}
          </div>
          <pre style={{ margin: '8px 0 0', padding: 8, borderRadius: 8, background: 'rgba(0,0,0,.3)', color: '#c7d8e5', fontSize: 10, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' }}>{reportText(snapshot)}</pre>
          <p style={{ margin: '8px 0 0', color: '#9db8cc', fontSize: 10 }}>Updated: {new Date(snapshot.updatedAt).toLocaleTimeString()}</p>
        </section>
      )}
    </div>
  );
}
