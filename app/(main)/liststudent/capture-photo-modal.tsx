'use client'; 

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, Loader2, VideoOff } from 'lucide-react'; 
import styles from './liststudent.module.css'; 

const BACKEND_URL = 'http://localhost:8000'; 

interface CapturePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageFile: File) => void; 
  authToken: string | null;
  camId: string;
}

const CapturePhotoModal: React.FC<CapturePhotoModalProps> = ({ isOpen, onClose, onCapture, authToken, camId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [mode, setMode] = useState<'loading' | 'live' | 'error' | 'preview'>('loading');
  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string>('');

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (capturedImageBlob) {
        URL.revokeObjectURL(URL.createObjectURL(capturedImageBlob));
    }
  }, [capturedImageBlob]);

  const controlBackendCamera = useCallback(async (action: 'open' | 'close') => {
    if (!authToken || !camId) return;
    try {
        const res = await fetch(`${BACKEND_URL}/cameras/${camId}/${action}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) console.warn(`Failed to ${action} backend camera: ${res.status}`);
    } catch (e) {
        console.error(`Error controlling backend camera: ${e}`);
    }
  }, [authToken, camId]);

  const startLivePreview = useCallback(async () => {
    setMode('loading');
    setCameraError('');
    cleanupStream();

    if (!authToken) {
       setCameraError("Authentication failed. Please re-login.");
       setMode('error');
       return;
    }

    await controlBackendCamera('close');
    
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 } }, 
        audio: false 
      });
      streamRef.current = stream;
      
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.muted = true;
        
        videoElement.onloadedmetadata = async () => {
            try {
                await videoElement.play();
                setMode('live');
            } catch (playError) {
                console.warn("Autoplay was prevented.", playError);
                setMode('live'); 
            }
        };
      }

    } catch (err: any) {
      console.error("Error accessing camera: ", err);
      controlBackendCamera('open'); 
      setCameraError('Device is currently in use by another application or permission is denied.');
      setMode('error');
    }
  }, [controlBackendCamera, cleanupStream, authToken]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || mode !== 'live') return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
          setCapturedImageBlob(blob);
          setMode('preview');
          cleanupStream(); 
        } else {
          setCameraError("Failed to process image.");
          setMode('error');
        }
      }, 'image/jpeg', 0.95);
    }
  }, [mode, cleanupStream]);
  
  const handleUsePhoto = useCallback(() => {
    if (capturedImageBlob) {
      const imageFile = new File([capturedImageBlob], `captured_face_${Date.now()}.jpeg`, { type: 'image/jpeg' });
      onCapture(imageFile); 
      startLivePreview(); 
    }
  }, [capturedImageBlob, onCapture, startLivePreview]);

  const handleRetry = () => {
    startLivePreview();
  };
  
  const handleModalClose = useCallback(() => {
    cleanupStream();
    cleanup();
    controlBackendCamera('open'); 
    onClose();
  }, [cleanupStream, cleanup, controlBackendCamera, onClose]);

  useEffect(() => {
    if (isOpen) {
        startLivePreview();
    } else {
        cleanupStream();
    }
    return () => {
        cleanupStream();
        controlBackendCamera('open');
    }
  }, [isOpen, cleanupStream, controlBackendCamera, startLivePreview]);
  
  if (!isOpen) return null;

  const isLive = mode === 'live';

  return (
    <div 
      className={styles.modalBackdrop} 
      onClick={handleModalClose} 
      style={{ zIndex: 100 }} 
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleModalClose}><X size={20} /></button>
        <h2>Capture Student Photo</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '450px', margin: '0 auto' }}>
          
          <div style={{ padding: '1rem 0', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            
            {(mode === 'loading' || mode === 'live' || mode === 'error') && (
              <div style={{ position: 'relative', width: '100%', maxWidth: '400px', height: '300px', backgroundColor: '#333', borderRadius: '0.5rem' }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={styles.videoFeed}
                  style={{ display: mode === 'live' ? 'block' : 'none', width: '100%', height: '100%', borderRadius: '0.5rem', objectFit: 'cover' }}
                />
                
                {(mode === 'loading' || mode === 'error') && (
                  <div className={styles.imagePlaceholder} style={{ position: 'absolute', inset: 0 }}>
                    {mode === 'loading' ? (
                       <>
                        <Loader2 size={48} className={styles.spinner} color="#fff" />
                        <p style={{ color: '#fff', marginTop: '0.5rem' }}>Awaiting access to camera...</p>
                       </>
                    ) : (
                       <>
                        <VideoOff size={48} color="#ef4444" />
                        <p style={{fontSize: '0.875rem', color: '#ef4444', textAlign: 'center', marginTop: '0.5rem'}}>
                            {cameraError || 'An unknown error occurred.'}
                        </p>
                       </>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === 'preview' && capturedImageBlob && (
                <img 
                    src={URL.createObjectURL(capturedImageBlob)} 
                    alt="Captured Preview"
                    style={{ width: '100%', maxWidth: '400px', maxHeight: '400px', objectFit: 'contain', borderRadius: '0.5rem' }}
                />
            )}
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        
          {isLive && (
             <button 
                type="button" 
                className={styles.addButton} 
                onClick={handleCapture}
                style={{ flexGrow: 1, maxWidth: '400px' }}
              >
                <Camera size={20} /> Take Photo
             </button>
          )}

          {mode === 'preview' && (
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', maxWidth: '400px', width: '100%' }}>
              <button 
                type="button" 
                className={styles.settingsButton} 
                onClick={handleRetry}
                style={{ flexGrow: 1 }}
              >
                Retry (Retake)
              </button>
              <button 
                type="button" 
                className={styles.addButton} 
                onClick={handleUsePhoto}
                style={{ flexGrow: 1 }}
              >
                Submit Photo (Add to list)
              </button>
            </div>
          )}

          {(mode === 'error' || mode === 'loading') && (
            <button onClick={handleRetry} className={styles.submitButton} style={{ marginTop: '1rem', maxWidth: '400px' }}>
                Try Again
            </button>
          )}
          
          <button 
            type="button" 
            className={styles.settingsButton} 
            onClick={handleModalClose}
            style={{ marginTop: '0.5rem', maxWidth: '400px' }}
          >
            Close (and Restart Backend Camera)
          </button>
        </div>
      </div>
    </div>
  );
};

export default CapturePhotoModal;