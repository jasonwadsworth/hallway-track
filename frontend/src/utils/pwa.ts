// PWA Installation utilities

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

// Listen for the beforeinstallprompt event
export const initializePWA = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('PWA: beforeinstallprompt event fired');
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e as BeforeInstallPromptEvent;
  });

  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    console.log('PWA: App was installed');
    deferredPrompt = null;
  });

  // Check if app is already installed
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('PWA: App is running in standalone mode');
  }

  // Log PWA support information
  console.log('PWA Debug Info:', {
    isSecureContext: window.isSecureContext,
    hasServiceWorker: 'serviceWorker' in navigator,
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    userAgent: navigator.userAgent,
    platform: navigator.platform
  });
};

// Function to trigger install prompt
export const showInstallPrompt = async (): Promise<boolean> => {
  if (!deferredPrompt) {
    console.log('PWA: No install prompt available');
    return false;
  }

  try {
    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`PWA: User ${outcome} the install prompt`);

    // Clear the deferredPrompt
    deferredPrompt = null;

    return outcome === 'accepted';
  } catch (error) {
    console.error('PWA: Error showing install prompt:', error);
    return false;
  }
};

// Check if install prompt is available
export const canInstall = (): boolean => {
  return deferredPrompt !== null;
};

// Check if app is installed
export const isInstalled = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches;
};

// iOS-specific installation instructions
export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const getIOSInstallInstructions = (): string => {
  return 'To install this app on your iOS device, tap the Share button and then "Add to Home Screen".';
};