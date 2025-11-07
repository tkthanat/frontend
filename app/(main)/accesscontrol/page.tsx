'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Settings, Download, X, VideoOff } from 'lucide-react';
import styles from './accesscontrol.module.css';

// ✨ ตั้งค่า URL ของ Backend (FastAPI ปกติรันที่ 8000)
const BACKEND_URL = 'http://localhost:8000';
const WS_BACKEND_URL = 'ws://localhost:8000';

// --- (SettingsModal Component - เหมือนเดิม) ---
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDevice: (src: string) => void;
}
interface DiscoveredDevice { src: string; width: number; height: number; readable: boolean; }

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSelectDevice }) => {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const getBackendDevices = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/cameras/discover`);
        if (!response.ok) throw new Error("Failed to fetch devices");
        const data: { devices: DiscoveredDevice[] } = await response.json();
        setDevices(data.devices.filter(d => d.readable));
      } catch (err) { console.error("Could not get video devices from backend:", err); }
    };
    if (isOpen) { getBackendDevices(); }
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
        <h2>Select Camera Source</h2>
        <p>Choose a video source from the server's available devices.</p>
        <select ref={selectRef} className={styles.deviceSelect} defaultValue="">
          <option value="" disabled>-- Please choose a camera --</option>
          {devices.map((device) => (
            <option key={device.src} value={device.src}>
              {`Camera (src: ${device.src}) - ${device.width}x${device.height}`}
            </option>
          ))}
        </select>
        <button className={styles.confirmButton} onClick={handleConfirm}>Confirm Selection</button>
      </div>
    </div>
  );
};
// --- (จบ SettingsModal) ---


// --- (Custom Hook สำหรับ WebSocket AI Results - เหมือนเดิม) ---
interface AIResult {
  name: string; // ชื่อจริง หรือ "Unknown"
  box: [number, number, number, number]; // [x, y, w, h]
  similarity?: number | null;
  matched: boolean;
  display_name: string; // ชื่อ + % หรือ "Unknown"
}
interface AIData {
  results: AIResult[];
  ai_width: number;
  ai_height: number;
}

const useAIResults = (camId: string) => {
  const [data, setData] = useState<AIData>({ results: [], ai_width: 640, ai_height: 480 });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!camId) return;
    const connect = () => {
      const ws = new WebSocket(`${WS_BACKEND_URL}/ws/ai_results/${camId}`);
      wsRef.current = ws;
      ws.onopen = () => console.log(`[WS AI ${camId}] Connected.`);
      ws.onmessage = (event) => {
        const data: AIData = JSON.parse(event.data);
        if (data.results) { setData(data); }
      };
      ws.onerror = (err) => console.error(`[WS AI ${camId}] Error:`, err);
      ws.onclose = () => {
        console.log(`[WS AI ${camId}] Disconnected. Reconnecting in 3s...`);
        setData({ results: [], ai_width: 640, ai_height: 480 });
        setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      wsRef.current?.close(1000, "Component unmounting");
    };
  }, [camId]);
  return data;
};
// --- (จบ Custom Hook) ---


// --- (CameraBox Component - เหมือนเดิม) ---
interface CameraBoxProps {
  camId: 'entrance' | 'exit';
  streamKey: string;
  onSettingsClick: () => void;
}

const CameraBox: React.FC<CameraBoxProps> = ({ camId, streamKey, onSettingsClick }) => {
  const [error, setError] = useState(false);
  const { results: aiResults, ai_width, ai_height } = useAIResults(camId);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamUrl = `${BACKEND_URL}/cameras/${camId}/mjpeg?key=${streamKey}`;

  const calculateBoxStyle = (box: [number, number, number, number]): React.CSSProperties => {
    if (!box || !Array.isArray(box) || box.length < 4) { return { display: 'none' }; }
    if (!containerRef.current) return { display: 'none' };
    const clientWidth = containerRef.current.clientWidth;
    const clientHeight = containerRef.current.clientHeight;
    const scaleX = clientWidth / ai_width;
    const scaleY = clientHeight / ai_height;
    const [x, y, w, h] = box;
    return {
      left: `${x * scaleX}px`, top: `${y * scaleY}px`,
      width: `${w * scaleX}px`, height: `${h * scaleY}px`,
    };
  };

  return (
    <div className={styles.cameraBox} ref={containerRef}>
      {error ? (
        <div className={styles.errorOverlay}><VideoOff size={48} /><p>Stream error or no source.</p></div>
      ) : (
        <img
          key={streamUrl} src={streamUrl} className={styles.videoFeed}
          onError={() => setError(true)} onLoad={() => setError(false)}
          alt={`Stream for ${camId}`}
        />
      )}
      <div className={styles.aiOverlayContainer}>
        {aiResults.map((result, index) => (
          <div
            key={index}
            className={`${styles.aiBox} ${result.matched ? styles.matchedBox : styles.unknownBox}`}
            style={calculateBoxStyle(result.box)}
          >
            <span className={`${styles.aiNameTag} ${result.matched ? styles.matchedTag : styles.unknownTag}`}>
              {result.display_name}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.cameraOverlay}>
        <div className={styles.recIndicator}><div className={styles.recDot}></div><span>REC</span></div>
        <button className={styles.cameraSettingsButton} onClick={onSettingsClick}><Settings size={20} /></button>
      </div>
    </div>
  );
};


// --- ✨ [ใหม่] Interface สำหรับ Log ที่ดึงมาจาก Backend ---
interface LogEntry {
  log_id: number;
  user_id: number;
  user_name: string;
  student_code: string;
  action: "enter" | "exit";
  timestamp: string; // ISO string
  confidence: number | null;
}

// --- (Main Page Component - แก้ไขใหม่) ---
const AccessControlPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTargetCamera, setCurrentTargetCamera] = useState<'entrance' | 'exit' | null>(null);
  const [selectedSources, setSelectedSources] = useState({ entrance: '', exit: '' });

  // --- ✨ [ใหม่] สร้าง State สำหรับเก็บ Logs ---
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- ✨ [ใหม่] 1. ดึงข้อมูล Log ทั้งหมดที่มีอยู่ตอนโหลดหน้า ---
  const fetchInitialLogs = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/attendance/logs`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      const data: LogEntry[] = await response.json();
      setLogs(data);
      console.log("Fetched initial logs:", data);
    } catch (err) {
      console.error("Failed to fetch initial logs:", err);
    }
  }, []);

  // --- ✨ [ใหม่] 2. ฟังก์ชันสำหรับ Polling (เรียกซ้ำๆ) เพื่อดึง Log ใหม่ ---
  const pollNewLogs = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/attendance/poll`);
      if (!response.ok) throw new Error("Failed to poll logs");
      const newLogs: LogEntry[] = await response.json();

      if (newLogs.length > 0) {
        console.log("Polled new logs:", newLogs);
        // เพิ่ม Log ใหม่เข้าไปด้านบนสุดของ List
        setLogs(prevLogs => [...newLogs, ...prevLogs]);
      }
    } catch (err) {
      console.error("Failed to poll new logs:", err);
    }
  }, []);

  // --- ✨ [ใหม่] 3. สั่งให้ฟังก์ชันทำงาน ---
  useEffect(() => {
    // 1. ดึงข้อมูลเก่ามาก่อน
    fetchInitialLogs();

    // 2. เริ่ม Polling ทุก 3 วินาที
    // (ล้าง interval เก่าก่อน ถ้ามี)
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    pollIntervalRef.current = setInterval(pollNewLogs, 3000); // 3000ms = 3 วินาที

    // 3. Cleanup: หยุด Polling เมื่อออกจากหน้านี้
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchInitialLogs, pollNewLogs]); // ใส่ dependencies

  // (useEffect สำหรับดึง config กล้อง - เหมือนเดิม)
  useEffect(() => {
    const fetchCurrentConfig = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/cameras/config`);
        const data: { mapping: { entrance: string, exit: string } } = await response.json();
        setSelectedSources(data.mapping);
      } catch (err) { console.error("Failed to fetch camera config:", err); }
    };
    fetchCurrentConfig();
  }, []);

  const handleOpenModal = (target: 'entrance' | 'exit') => {
    setCurrentTargetCamera(target);
    setIsModalOpen(true);
  };

  const handleSelectDevice = async (src: string) => {
    if (currentTargetCamera) {
      try {
        const newMapping = { ...selectedSources, [currentTargetCamera]: src };
        const response = await fetch(`${BACKEND_URL}/cameras/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMapping),
        });
        if (!response.ok) throw new Error("Failed to configure backend");
        setSelectedSources(newMapping);
      } catch (err) { console.error("Failed to set new camera source:", err); }
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
        <CameraBox 
          camId="entrance" 
          streamKey={selectedSources.entrance}
          onSettingsClick={() => handleOpenModal('entrance')} 
        />
        <CameraBox 
          camId="exit" 
          streamKey={selectedSources.exit}
          onSettingsClick={() => handleOpenModal('exit')} 
        />
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
            {/* ✨ [ใหม่] Map ข้อมูลจาก State 'logs' แทน Mock Data */}
            {logs.map((log) => (
              <tr key={log.log_id}>
                {/* ✨ [ใหม่] แปลง ISO date เป็นเวลาที่อ่านง่าย */}
                <td className={styles.tableCellText}>
                  {new Date(log.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: true 
                  })}
                </td>
                <td className={styles.tableCellText}>{log.user_name}</td>
                <td className={styles.tableCellText}>{log.student_code}</td>
                <td className={styles.tableCellStatus}>
                  {/* ✨ [ใหม่] เปลี่ยนสีตาม 'action' */}
                  <span className={log.action === 'enter' ? styles.statusPresent : styles.statusLate}>
                    {log.action}
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