import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import './QRCodeScanner.css';

interface CameraDevice {
  id: string;
  label: string;
}

interface ScannerState {
  isScanning: boolean;
  isInitializing: boolean;
  error: string | null;
  cameraId: string | null;
  cameras: CameraDevice[];
  scanResult: string | null;
  isNavigating: boolean;
}

export const QRCodeScanner = () => {
  const [state, setState] = useState<ScannerState>({
    isScanning: false,
    isInitializing: true,
    error: null,
    cameraId: null,
    cameras: [],
    scanResult: null,
    isNavigating: false,
  });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const navigate = useNavigate();

  // Initialize scanner instance
  const initializeScanner = async (): Promise<void> => {
    try {
      // Create scanner instance with configuration
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      // Enumerate available cameras
      await enumerateCameras();
    } catch (error) {
      console.error('Scanner initialization error:', error);
      setState(prev => ({
        ...prev,
        isInitializing: false,
        error: 'Unable to initialize camera. Please try again or use a different browser.',
      }));
    }
  };

  // Enumerate available cameras
  const enumerateCameras = async (): Promise<void> => {
    try {
      const devices = await Html5Qrcode.getCameras();

      if (devices && devices.length > 0) {
        const cameraList: CameraDevice[] = devices.map(device => ({
          id: device.id,
          label: device.label || `Camera ${device.id}`,
        }));

        // Select rear camera by default on mobile devices
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        let selectedCameraId: string;

        if (isMobile) {
          // Try to find rear/back/environment camera
          const rearCamera = cameraList.find(camera =>
            /back|rear|environment/i.test(camera.label)
          );
          selectedCameraId = rearCamera ? rearCamera.id : cameraList[0].id;
        } else {
          // On desktop, use first available camera
          selectedCameraId = cameraList[0].id;
        }

        setState(prev => ({
          ...prev,
          cameras: cameraList,
          cameraId: selectedCameraId,
          isInitializing: false,
        }));

        // Start scanning with selected camera
        await startScanning(selectedCameraId);
      } else {
        setState(prev => ({
          ...prev,
          isInitializing: false,
          error: 'No camera detected. Please ensure your device has a camera and it\'s not being used by another application.',
        }));
      }
    } catch (error) {
      console.error('Camera enumeration error:', error);

      // Check if permission was denied
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setState(prev => ({
          ...prev,
          isInitializing: false,
          error: 'Camera access is required to scan QR codes. Please enable camera permissions in your browser settings.',
        }));
      } else {
        setState(prev => ({
          ...prev,
          isInitializing: false,
          error: 'Unable to access camera. Please check your browser permissions and try again.',
        }));
      }
    }
  };

  // Start scanning with specified camera
  const startScanning = async (cameraId: string): Promise<void> => {
    if (!scannerRef.current) return;

    try {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await scannerRef.current.start(
        cameraId,
        config,
        onScanSuccess,
        onScanError
      );

      setState(prev => ({
        ...prev,
        isScanning: true,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to start scanning:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to start camera. Please try again.',
      }));
    }
  };

  // Extract profile ID from scanned URL
  const extractProfileId = (scannedUrl: string): string | null => {
    try {
      const url = new URL(scannedUrl);
      const pathMatch = url.pathname.match(/^\/profile\/([a-zA-Z0-9-]+)$/);
      return pathMatch ? pathMatch[1] : null;
    } catch {
      return null;
    }
  };

  // Stop scanning
  const stopScanning = async (): Promise<void> => {
    if (scannerRef.current && state.isScanning) {
      try {
        await scannerRef.current.stop();
        setState(prev => ({
          ...prev,
          isScanning: false,
        }));
      } catch (error) {
        console.error('Failed to stop scanner:', error);
      }
    }
  };

  // Handle successful QR code scan
  const onScanSuccess = async (decodedText: string): Promise<void> => {
    console.log('QR Code detected:', decodedText);

    // Extract profile ID from scanned URL
    const profileId = extractProfileId(decodedText);

    if (profileId) {
      try {
        // Valid profile URL detected
        setState(prev => ({
          ...prev,
          scanResult: profileId,
          isNavigating: true,
        }));

        // Stop camera stream
        await stopScanning();

        // Show brief success feedback before navigation
        setTimeout(() => {
          try {
            navigate(`/profile/${profileId}`);
          } catch (navError) {
            console.error('Navigation error:', navError);
            setState(prev => ({
              ...prev,
              isNavigating: false,
              error: 'Unable to navigate to profile. Please try again.',
            }));
            // Restart scanning after error
            if (state.cameraId) {
              startScanning(state.cameraId);
            }
          }
        }, 500);
      } catch (error) {
        console.error('Error processing scan:', error);
        setState(prev => ({
          ...prev,
          isNavigating: false,
          error: 'An error occurred while processing the QR code. Please try again.',
        }));
        // Restart scanning after error
        if (state.cameraId) {
          startScanning(state.cameraId);
        }
      }
    } else {
      // Invalid QR code format
      setState(prev => ({
        ...prev,
        error: 'This QR code doesn\'t appear to be a valid Hallway Track profile. Please scan a profile QR code.',
      }));

      // Stop scanning temporarily to show error
      await stopScanning();

      // Allow user to scan again after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
        if (state.cameraId) {
          startScanning(state.cameraId);
        }
      }, 3000);
    }
  };

  // Handle scan errors
  const onScanError = (errorMessage: string): void => {
    // Ignore continuous scanning errors (expected behavior when no QR code is in view)
    // These errors occur constantly while the camera is searching for a QR code
    // Only log actual errors, not the "No QR code found" messages
    if (errorMessage && !errorMessage.includes('NotFoundException')) {
      console.error('QR scan error:', errorMessage);
    }
    // Don't update state for these errors as they're expected during normal scanning
  };

  // Switch camera
  const switchCamera = async (newCameraId: string): Promise<void> => {
    if (!scannerRef.current || !state.isScanning) return;

    try {
      // Stop current camera
      await scannerRef.current.stop();

      setState(prev => ({
        ...prev,
        isScanning: false,
        cameraId: newCameraId,
      }));

      // Start with new camera
      await startScanning(newCameraId);
    } catch (error) {
      console.error('Failed to switch camera:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to switch camera. Please try again.',
      }));
    }
  };

  // Initialize on component mount
  useEffect(() => {
    initializeScanner();

    // Cleanup function to stop camera and release resources on unmount
    return () => {
      const cleanup = async () => {
        if (scannerRef.current) {
          try {
            // Check if scanner is currently running
            const scannerState = scannerRef.current.getState();
            if (scannerState === 2) { // Html5QrcodeScannerState.SCANNING = 2
              await scannerRef.current.stop();
              console.log('Camera stopped on component unmount');
            }
            // Clear the scanner instance
            scannerRef.current.clear();
          } catch (error) {
            console.error('Error during camera cleanup:', error);
          }
        }
      };

      cleanup();
    };
    // initializeScanner is stable and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle orientation changes - maintain camera stream
  useEffect(() => {
    const handleOrientationChange = () => {
      // The camera stream is maintained automatically by html5-qrcode
      // We just need to ensure the layout adjusts properly via CSS
      console.log('Orientation changed, layout adjusting via CSS');
    };

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    // Also listen for resize events (covers more cases)
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  // Handle exit/close scanner
  const handleClose = async (): Promise<void> => {
    try {
      // Stop camera stream before navigating away
      if (scannerRef.current) {
        const scannerState = scannerRef.current.getState();
        if (scannerState === 2) { // Html5QrcodeScannerState.SCANNING = 2
          await scannerRef.current.stop();
          console.log('Camera stopped on exit');
        }
        // Clear the scanner instance
        await scannerRef.current.clear();
      }
    } catch (error) {
      console.error('Error stopping camera on exit:', error);
    } finally {
      // Navigate back regardless of cleanup success
      navigate(-1);
    }
  };

  return (
    <div className="qr-scanner-container">
      <div className="qr-scanner-header">
        <h2>Scan QR Code</h2>
        <button
          className="close-button"
          onClick={handleClose}
          aria-label="Close scanner"
        >
          ✕
        </button>
      </div>

      <div className="qr-scanner-content">
        <div id="qr-reader" className="qr-reader"></div>

        {state.isNavigating && (
          <div className="scanner-success">
            <div className="success-icon">✓</div>
            <p>QR Code scanned successfully!</p>
            <p className="success-subtext">Loading profile...</p>
          </div>
        )}

        {state.error && (
          <ErrorMessage
            message={state.error}
            onRetry={() => {
              setState(prev => ({ ...prev, error: null, isInitializing: true }));
              initializeScanner();
            }}
            onDismiss={!state.isScanning && state.cameraId ? () => {
              setState(prev => ({ ...prev, error: null }));
              if (state.cameraId) {
                startScanning(state.cameraId);
              }
            } : undefined}
          />
        )}

        {state.isInitializing && !state.error && (
          <LoadingSpinner message="Initializing camera..." />
        )}

        {state.isScanning && !state.error && !state.isNavigating && (
          <div className="scanning-overlay">
            <div className="scanning-indicator">
              <div className="scanning-line"></div>
              <p className="scanning-text">Scanning for QR code...</p>
            </div>
          </div>
        )}

        {state.cameras.length > 1 && state.isScanning && (
          <>
            <div className="camera-selector">
              <label htmlFor="camera-select">Camera:</label>
              <select
                id="camera-select"
                value={state.cameraId || ''}
                onChange={(e) => switchCamera(e.target.value)}
                aria-label="Select camera"
              >
                {state.cameras.map(camera => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="camera-switch-button"
              onClick={() => {
                const currentIndex = state.cameras.findIndex(c => c.id === state.cameraId);
                const nextIndex = (currentIndex + 1) % state.cameras.length;
                switchCamera(state.cameras[nextIndex].id);
              }}
              aria-label="Switch camera"
              title="Switch camera"
            >
              🔄
            </button>
          </>
        )}
      </div>

      <div className="qr-scanner-instructions">
        <p>Point your camera at a Hallway Track profile QR code</p>
      </div>
    </div>
  );
};
