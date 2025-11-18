import { useState, useEffect } from 'react';
import { isIOS, isAndroid, isInstalled, canInstall, showInstallPrompt } from '../utils/pwa';
import './PWAInstallPrompt.css';

export function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('pwa-install-dismissed') === 'true';
  });

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isInstalled() || dismissed) {
      return;
    }

    // Show for iOS users or when install prompt is available
    if (isIOS() || canInstall()) {
      // Delay showing to avoid overwhelming user immediately
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [dismissed]);

  const handleInstall = async () => {
    if (canInstall()) {
      const installed = await showInstallPrompt();
      if (installed) {
        setShow(false);
      }
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!show) return null;

  const platform = isIOS() ? 'ios' : isAndroid() ? 'android' : 'other';

  return (
    <div className="pwa-install-prompt">
      <button className="pwa-dismiss" onClick={handleDismiss} aria-label="Dismiss">
        ×
      </button>
      
      <div className="pwa-content">
        <img src="/icons/icon-120x120.png" alt="HallwayTrak" className="pwa-icon" />
        
        <div className="pwa-text">
          <strong>Install HallwayTrak</strong>
          
          {platform === 'ios' && (
            <div className="pwa-instructions">
              <p>Tap <span className="share-icon ios-share">
                <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor">
                  <path d="M8 0L8 12M8 0L4 4M8 0L12 4M2 8V18C2 19.1 2.9 20 4 20H12C13.1 20 14 19.1 14 18V8"/>
                </svg>
              </span> then "Add to Home Screen"</p>
            </div>
          )}
          
          {platform === 'android' && (
            <div className="pwa-instructions">
              <p>Tap <span className="share-icon android-share">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <circle cx="3" cy="9" r="2"/>
                  <circle cx="15" cy="9" r="2"/>
                  <circle cx="9" cy="3" r="2"/>
                </svg>
              </span> then "Add to Home screen"</p>
            </div>
          )}
          
          {platform === 'other' && canInstall() && (
            <button className="pwa-install-button" onClick={handleInstall}>
              Install App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
