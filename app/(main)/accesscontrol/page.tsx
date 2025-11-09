'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Settings, Download, X, VideoOff } from 'lucide-react';
import styles from './accesscontrol.module.css';
// ❌ ลบ useClass ออก (เราไม่ใช้ Pop-up เลือกคลาสแล้ว)

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


// --- (Custom Hook WebSocket - เหมือนเดิม) ---
interface AIResult { name: string; box: [number, number, number, number]; similarity?: number | null; matched: boolean; display_name: string; }
interface AIData { results: AIResult[]; ai_width: number; ai_height: number; }
const useAIResults = (camId: string) => {
  const [data, setData] = useState<AIData>({ results: [], ai_width: 640, ai_height: 480 });
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!camId) { return; }
    const connect = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) { return; }
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
        wsRef.current = null;
        setData({ results: [], ai_width: 640, ai_height: 480 });
        setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
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
  const streamUrl = (streamKey) ? `${BACKEND_URL}/cameras/${camId}/mjpeg?key=${streamKey}` : null;
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
      {!streamUrl ? (
        <div className={styles.errorOverlay}><VideoOff size={48} /><p>Stream error or no source.</p></div>
      ) : error ? (
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
        <button 
          className={styles.cameraSettingsButton} 
          onClick={onSettingsClick}
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
};
// --- (จบ CameraBox) ---


// --- Interface สำหรับ Log ---
interface LogEntry { log_id: number; user_id: number; user_name: string; student_code: string; action: "enter" | "exit"; timestamp: string; confidence: number | null; }

// --- (Main Page Component) ---
const AccessControlPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTargetCamera, setCurrentTargetCamera] = useState<'entrance' | 'exit' | null>(null);
  const [selectedSources, setSelectedSources] = useState({ entrance: '', exit: '' });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [className, setClassName] = useState('SP403-61');
  const [lateTime, setLateTime] = useState('09:30');
  
  // ✨ [ใหม่] State สำหรับวันที่เลือก และเช็คว่าเป็น "วันนี้" หรือไม่
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isViewingToday = selectedDate.toDateString() === new Date().toDateString();

  // ✨ [ใหม่] Helper function: แปลง Date เป็น "YYYY-MM-DD"
  const formatDateForAPI = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // ✨ [แก้ไข] fetchInitialLogs: ให้ดึงข้อมูลตาม selectedDate
  const fetchInitialLogs = useCallback(async () => {
    // (เราจะสมมติว่า API /attendance/logs กรองตาม subject_id ได้
    // แต่ในโค้ด main.py ล่าสุด มันกรองตาม subject_id... ซึ่งเราไม่มี)
    // ดังนั้น เราจะโหลด Log ทั้งหมดของวันนั้นๆ มาก่อน
    const dateString = formatDateForAPI(selectedDate);
    
    try {
      const response = await fetch(`${BACKEND_URL}/attendance/logs?start_date=${dateString}&end_date=${dateString}`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      const data: LogEntry[] = await response.json();
      setLogs(data); // เซ็ต Log ของวันที่เลือก
      console.log(`Fetched logs for ${dateString}:`, data);
    } catch (err) {
      console.error("Failed to fetch initial logs:", err);
    }
  }, [selectedDate]); // ✨ ทำงานใหม่เมื่อ selectedDate เปลี่ยน

  // ✨ [แก้ไข] pollNewLogs: ให้ Poll ต่อเมื่อดู "วันนี้"
  const pollNewLogs = useCallback(async () => {
    if (!isViewingToday) return; // ถ้าไม่ได้ดู "วันนี้" ก็ไม่ต้อง poll

    try {
      const response = await fetch(`${BACKEND_URL}/attendance/poll`);
      if (!response.ok) throw new Error("Failed to poll logs");
      const newLogs: LogEntry[] = await response.json();
      
      if (newLogs.length > 0) {
        console.log("Polled new logs:", newLogs);
        // เพิ่ม Log ใหม่เข้าไป (เพราะเรากำลังดู "วันนี้")
        setLogs(prevLogs => [...newLogs, ...prevLogs]);
      }
    } catch (err) {
      console.error("Failed to poll new logs:", err);
    }
  }, [isViewingToday]); // ✨ ทำงานใหม่เมื่อ isViewingToday เปลี่ยน

  // ✨ [แก้ไข] useEffect สำหรับ Polling
  useEffect(() => {
    fetchInitialLogs(); // 1. ดึง Log ของวันที่เลือก (จะทำงานเมื่อ selectedDate เปลี่ยน)
    
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    // 2. ถ้ากำลังดู "วันนี้" ให้เริ่ม Polling
    if (isViewingToday) {
      pollIntervalRef.current = setInterval(pollNewLogs, 3000); 
    }

    // 3. Cleanup: หยุด Polling
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchInitialLogs, pollNewLogs, isViewingToday]); // ✨ ทำงานใหม่เมื่อ isViewingToday เปลี่ยน

  // (useEffect สำหรับ config กล้อง)
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
  
  // (useEffect สำหรับนาฬิกา)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => { clearInterval(timer); };
  }, []);

  // (โค้ด handleOpenModal และ handleSelectDevice)
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

  // (ฟังก์ชันสำหรับปุ่ม Start/Stop)
  const handleStartAttendance = async () => {
    try {
      await fetch(`${BACKEND_URL}/attendance/start`, { method: 'POST' });
      alert('Attendance Started!');
    } catch (err) {
      console.error(err);
      alert('Failed to start attendance.');
    }
  };
  const handleStopAttendance = async () => {
    try {
      await fetch(`${BACKEND_URL}/attendance/stop`, { method: 'POST' });
      alert('Attendance Stopped!');
    } catch (err) {
      console.error(err);
      alert('Failed to stop attendance.');
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
      
      {/* (Control Panel - นำช่อง Input กลับมา) */}
      <div className={styles.controlPanel}>
        <div className={styles.controlGroup}>
          <label htmlFor="className">Class :</label>
          <input
            type="text"
            id="className"
            className={styles.controlInput}
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          />
        </div>
        
        <div className={styles.controlGroup}>
          <label htmlFor="lateTime">After :</label>
          <input
            type="time" 
            id="lateTime"
            className={styles.controlInput}
            value={lateTime}
            onChange={(e) => setLateTime(e.target.value)}
          />
          <span className={styles.lateTag}>Late</span>
        </div>
        
        <span className={styles.realTimeClock}>
          {currentTime.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
          })}
        </span>

        <button 
          className={`${styles.controlButton} ${styles.startButton}`}
          onClick={handleStartAttendance}
          disabled={!isViewingToday} // ✨ [แก้ไข] ปิดปุ่มถ้าดูย้อนหลัง
        >
          Start Attendance
        </button>
        <button 
          className={`${styles.controlButton} ${styles.stopButton}`}
          onClick={handleStopAttendance}
          disabled={!isViewingToday} // ✨ [แก้ไข] ปิดปุ่มถ้าดูย้อนหลัง
        >
          Stop Attendance
        </button>
      </div>
      
      <div className={styles.logCard}>
        <div className={styles.logHeader}>
          <h2 className={styles.logTitle}>Attendance Log</h2>
          
          {/* ✨ [ใหม่] เพิ่ม Date Picker */}
          <div className={styles.datePickerContainer}>
            <label htmlFor="logDate">Select Date:</label>
            <input
              type="date"
              id="logDate"
              className={styles.dateInput}
              value={formatDateForAPI(selectedDate)}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
            />
          </div>

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
            {/* ✨ [ใหม่] เพิ่มเงื่อนไข ถ้า logs ว่าง */}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.noLogs}>
                  No logs found for this day.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.log_id}>
                  <td className={styles.tableCellText}>
                    {new Date(log.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit', hour12: true 
                    })}
                  </td>
                  <td className={styles.tableCellText}>{log.user_name}</td>
                  <td className={styles.tableCellText}>{log.student_code}</td>
                  <td className={styles.tableCellStatus}>
                    <span className={log.action === 'enter' ? styles.statusPresent : styles.statusLate}>
                      {log.action}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccessControlPage;