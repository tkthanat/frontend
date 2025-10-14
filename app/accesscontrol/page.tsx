'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Settings, Download, BatteryFull, Frame, VideoOff, X } from 'lucide-react';
import styles from './accesscontrol.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDevice: (deviceId: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSelectDevice }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    // ฟังก์ชันสำหรับดึงรายการกล้อง
    const getVideoDevices = async () => {
      try {
        // ต้องขอ permission ก่อน ถึงจะเห็น label ของ device
        await navigator.mediaDevices.getUserMedia({ video: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
      } catch (err) {
        console.error("Could not get video devices:", err);
      }
    };

    if (isOpen) {
      getVideoDevices();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectRef.current?.value) {
      onSelectDevice(selectRef.current.value);
      onClose();
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
        <h2>Select Camera</h2>
        <p>Choose a video source from the list below.</p>
        <select ref={selectRef} className={styles.deviceSelect} defaultValue="">
          <option value="" disabled>-- Please choose a camera --</option>
          {devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${index + 1}`}
            </option>
          ))}
        </select>
        <button className={styles.confirmButton} onClick={handleConfirm}>Confirm Selection</button>
      </div>
    </div>
  );
};

interface CameraBoxProps {
  deviceId: string; // รับ deviceId เพื่อระบุกล้อง
  onSettingsClick: () => void; // Callback เมื่อกดปุ่ม settings
}

const CameraBox: React.FC<CameraBoxProps> = ({ deviceId, onSettingsClick }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    setError(null);

    const startCamera = async () => {
      // สร้าง constraints จาก deviceId ที่ได้รับมา
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
        },
        audio: false,
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Cannot access camera. Check permissions or select a different source.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [deviceId]); // Re-run effect เมื่อ deviceId เปลี่ยน

  return (
    <div className={styles.cameraBox}>
      <video ref={videoRef} className={styles.videoFeed} autoPlay playsInline muted />
      <div className={styles.cameraOverlay}>
        {error ? (
          <div className={styles.errorOverlay}><VideoOff size={48} /><p>{error}</p></div>
        ) : (
          <>
            <div className={styles.recIndicator}><div className={styles.recDot}></div><span>REC</span></div>
            <button className={styles.cameraSettingsButton} onClick={onSettingsClick}><Settings size={20} /></button>
          </>
        )}
      </div>
    </div>
  );
};

const AccessControlPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTargetCamera, setCurrentTargetCamera] = useState<'cam1' | 'cam2' | null>(null);
  const [selectedDevices, setSelectedDevices] = useState({
    cam1: '',
    cam2: '',
  });
  
  // Mock Data
  const attendanceLog = [
    { time: '08:21 A.M.', name: 'Deaw', id: '2210511101036', status: 'Present' },
    { time: '08:36 A.M.', name: 'Kahnoon', id: '2210511101021', status: 'Present' },
    { time: '09:31 A.M.', name: 'Bank', id: '2210511101045', status: 'Late' },
  ];

  const handleOpenModal = (target: 'cam1' | 'cam2') => {
    setCurrentTargetCamera(target);
    setIsModalOpen(true);
  };

  const handleSelectDevice = (deviceId: string) => {
    if (currentTargetCamera) {
      setSelectedDevices(prev => ({
        ...prev,
        [currentTargetCamera]: deviceId,
      }));
    }
  };

  return (
    <div className={styles.pageContainer}>
      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectDevice={handleSelectDevice}
      />
      
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Camera Preview</h1>
      </header>

      <div className={styles.cameraGrid}>
        <CameraBox deviceId={selectedDevices.cam1} onSettingsClick={() => handleOpenModal('cam1')} />
        <CameraBox deviceId={selectedDevices.cam2} onSettingsClick={() => handleOpenModal('cam2')} />
      </div>
      
      <div className={styles.controlPanel}>
        <span>Class : <span className={styles.classText}>SP403-61</span></span>
        <span>After 9.30 :</span>
        <span className={styles.lateTag}>Late</span>
        <button className={`${styles.controlButton} ${styles.startButton}`}>Start Attendance</button>
        <button className={`${styles.controlButton} ${styles.stopButton}`}>Stop Attendance</button>
      </div>
      
      <div className={styles.logCard}>
        <div className={styles.logHeader}>
          <h2 className={styles.logTitle}>Attendance Log</h2>
          <button className={styles.exportButton}>
            <Download size={16} />
            <span>Export data</span>
          </button>
        </div>
        
        <table className={styles.attendanceTable}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Name</th>
              <th>ID</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendanceLog.map((log, index) => (
              <tr key={index}>
                <td>{log.time}</td>
                <td>{log.name}</td>
                <td>{log.id}</td>
                <td>
                  <span className={log.status === 'Present' ? styles.statusPresent : styles.statusLate}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccessControlPage;