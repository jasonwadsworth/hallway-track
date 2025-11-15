import React, { useState, useEffect } from 'react';
import { canInstall, showInstallPrompt, isInstalled, isIOS, getIOSInstallInstructions } from '../utils/pwa';

const PWAInstallButton: React.FC = () => {
  const [canShowPrompt, setCanShowPrompt] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check initial state
    setCanShowPrompt(canInstall());
    setIsAppInstalled(isInstalled());

    // Listen for PWA events
    const handleBeforeInstallPrompt = () => {
      setCanShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setCanShowPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS()) {
      setShowIOSInstructions(true);
      return;
    }

    const installed = await showInstallPrompt();
    if (installed) {
      setCanShowPrompt(false);
      setIsAppInstalled(true);
    }
  };

  // Don't show button if app is already installed
  if (isAppInstalled) {
    return null;
  }

  return (
    <div className="pwa-install-container">
      {canShowPrompt || isIOS() ? (
        <button
          onClick={handleInstallClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          📱 Install App
        </button>
      ) : null}

      {showIOSInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="font-semibold mb-3">Install Hallway Track</h3>
            <p className="text-sm text-gray-600 mb-4">
              {getIOSInstallInstructions()}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PWAInstallButton;