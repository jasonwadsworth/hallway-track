import { useState, useEffect } from 'react';
import { isIOS, isAndroid, isInstalled, canInstall, showInstallPrompt } from '../utils/pwa';
import './PWAInstallPrompt.css';

// Helper function to safely access localStorage
const getStorageValue = (key: string, defaultValue: string): string => {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch (error) {
    console.warn('localStorage access failed:', error);
    return defaultValue;
  }
};

const setStorageValue = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn('localStorage write failed:', error);
  }
};

export function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return getStorageValue('pwa-install-dismissed', 'false') === 'true';
  });
  useEffect(() => {
    // Debug logging for test environments
    const debugInfo = {
      userAgent: navigator.userAgent,
      isIOSCheck: isIOS(),
      isInstalledCheck: isInstalled(),
      canInstallCheck: canInstall(),
      dismissedState: dismissed,
      localStorageDismissed: getStorageValue('pwa-install-dismissed', 'false'),
    };
    console.log('PWA Install Prompt - Mount Debug:', debugInfo);

    // Re-check localStorage on mount to handle any timing issues
    const isDismissed = getStorageValue('pwa-install-dismissed', 'false') === 'true';
    
    if (isDismissed) {
      console.log('PWA Install Prompt - Dismissed in localStorage, not showing');
      if (!dismissed) {
        setDismissed(true);
      }
      return;
    }

    // Don't show if already installed
    if (isInstalled()) {
      console.log('PWA Install Prompt - Already installed, not showing');
      return;
    }

    // Show for iOS users or when install prompt is available
    const shouldShow = isIOS() || canInstall();
    console.log('PWA Install Prompt - Should show?', shouldShow, '(iOS:', isIOS(), ', canInstall:', canInstall(), ')');
    
    if (shouldShow) {
      console.log('PWA Install Prompt - Setting 3-second timer to show prompt');
      
      // Delay showing to avoid overwhelming user immediately
      const timer = setTimeout(() => {
        console.log('PWA Install Prompt - Timer fired, showing prompt now');
        setShow(true);
      }, 3000);
      
      return () => {
        console.log('PWA Install Prompt - Cleaning up timer');
        clearTimeout(timer);
      };
    } else {
      console.log('PWA Install Prompt - Conditions not met, not showing');
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
    console.log('PWA Install Prompt - User dismissed prompt');
    setShow(false);
    setDismissed(true);
    setStorageValue('pwa-install-dismissed', 'true');
  };

  console.log('PWA Install Prompt - Render, show:', show);
  
  if (!show) return null;

  const platform = isIOS() ? 'ios' : isAndroid() ? 'android' : 'other';
  console.log('PWA Install Prompt - Rendering with platform:', platform);

  return (
    <div className="pwa-install-prompt" data-testid="pwa-install-prompt">
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
