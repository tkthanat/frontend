'use client';

import React, { useEffect, useRef, useState, useCallback, FormEvent } from 'react';
import { Settings, Download, X, VideoOff, Plus, Loader2, Save } from 'lucide-react';
import styles from './accesscontrol.module.css';
// import AddSubjectModal from './AddSubjectModal'; // (ย้าย AddSubjectModal มารวมในไฟล์นี้เลยเพื่อง่ายต่อการจัดการ)

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

// --- (AddSubjectModal Component) ---
// ✨ (ย้าย AddSubjectModal มารวมในไฟล์นี้ และใช้ CSS class จาก styles)
interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubjectAdded: () => void;
}

const AddSubjectModal: React.FC<AddSubjectModalProps> = ({ isOpen, onClose, onSubjectAdded }) => {
  const [subjectName, setSubjectName] = useState('');
  const [section, setSection] = useState('');
  const [schedule, setSchedule] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSubjectName('');
      setSection('');
      setSchedule('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!subjectName.trim()) { setError('Subject Name is required'); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_name: subjectName,
          section: section || null,
          schedule: schedule || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create subject');
      }
      onSubjectAdded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setSection(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose} style={{ zIndex: 1100 }}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
        <h2>Create New Subject</h2>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="subjectName">Subject Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input 
              id="subjectName"
              type="text" 
              value={subjectName} 
              onChange={e => setSubjectName(e.target.value)} 
              placeholder="e.g. Computer Vision"
              disabled={isSubmitting} 
              required 
            />
          </div>
          
          <div className={styles.formGroup}>
             <label htmlFor="section">Section (Optional)</label>
             <input 
               id="section"
               type="text" 
               inputMode="numeric"
               value={section} 
               onChange={handleSectionChange}
               placeholder="e.g. 001"
               disabled={isSubmitting} 
             />
          </div>

          <div className={styles.formGroup}>
             <label htmlFor="schedule">Schedule (Optional)</label>
             <input 
               id="schedule"
               type="text" 
               value={schedule} 
               onChange={e => setSchedule(e.target.value)} 
               placeholder="e.g. Monday 09:00-12:00"
               disabled={isSubmitting} 
             />
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className={styles.spinner} /> : 'Create'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- (Custom Hook WebSocket) ---
interface AIResult { name: string; box: [number, number, number, number]; similarity?: number | null; matched: boolean; display_name: string; }
interface AIData { results: AIResult[]; ai_width: number; ai_height: number; }

const useAIResults = (camId: string, streamKey: string) => {
  const [data, setData] = useState<AIData>({ results: [], ai_width: 640, ai_height: 480 });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!streamKey || !camId) {
        if (wsRef.current) {
            wsRef.current.close(1000, "Stream key changed to null");
            wsRef.current = null;
        }
        setData({ results: [], ai_width: 640, ai_height: 480 });
        return; 
    }
    
    const connect = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        return;
      }
      
      const ws = new WebSocket(`${WS_BACKEND_URL}/ws/ai_results/${camId}`);
      wsRef.current = ws;
      
      ws.onopen = () => console.log(`[WS AI ${camId}] Connected (Source: ${streamKey}).`);
      ws.onmessage = (event) => {
        const data: AIData = JSON.parse(event.data);
        if (data.results) { setData(data); }
      };
      ws.onerror = (err) => console.error(`[WS AI ${camId}] Error:`, err);
      ws.onclose = () => {
        wsRef.current = null; 
        setData({ results: [], ai_width: 640, ai_height: 480 });
        setTimeout(() => { if(streamKey) connect(); }, 3000);
      };
    };
    
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting or streamKey changed");
        wsRef.current = null;
      }
    };
  }, [camId, streamKey]);

  return data;
};

// --- (CameraBox Component) ---
interface CameraBoxProps {
  camId: 'entrance' | 'exit';
  streamKey: string;
  onSettingsClick: () => void;
}
const CameraBox: React.FC<CameraBoxProps> = ({ camId, streamKey, onSettingsClick }) => {
  const [error, setError] = useState(false);
  const { results: aiResults, ai_width, ai_height } = useAIResults(camId, streamKey); 
  const containerRef = useRef<HTMLDivElement>(null);
  const streamUrl = (streamKey) ? `${BACKEND_URL}/cameras/${camId}/mjpeg?key=${streamKey}` : null;

  useEffect(() => { setError(false); }, [streamUrl]);

  const calculateBoxStyle = (box: [number, number, number, number]): React.CSSProperties => {
    if (!box || !Array.isArray(box) || box.length < 4) { return { display: 'none' }; }
    if (!containerRef.current) return { display: 'none' };
    const clientWidth = containerRef.current.clientWidth;
    const clientHeight = containerRef.current.clientHeight;
    const scaleX = clientWidth / ai_width;
    const scaleY = clientHeight / ai_height;
    const [x, y, w, h] = box;
    return { left: `${x * scaleX}px`, top: `${y * scaleY}px`, width: `${w * scaleX}px`, height: `${h * scaleY}px` };
  };

  return (
    <div className={styles.cameraBox} ref={containerRef}>
      {!streamUrl ? (
        <div className={styles.errorOverlay}><VideoOff size={48} /><p>Stream error or no source.</p></div>
      ) : error ? (
        <div className={styles.errorOverlay}><VideoOff size={48} /><p>Stream error or no source.</p></div>
      ) : (
        <img key={streamUrl} src={streamUrl} className={styles.videoFeed} onError={() => setError(true)} onLoad={() => setError(false)} alt={`Stream for ${camId}`} />
      )}
      <div className={styles.aiOverlayContainer}>
        {aiResults.map((result, index) => (
          <div key={index} className={`${styles.aiBox} ${result.matched ? styles.matchedBox : styles.unknownBox}`} style={calculateBoxStyle(result.box)}>
            <span className={`${styles.aiNameTag} ${result.matched ? styles.matchedTag : styles.unknownTag}`}>{result.display_name}</span>
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

// --- (Interfaces) ---
interface LogEntry { log_id: number; user_id: number; user_name: string; student_code: string; action: "enter" | "exit"; timestamp: string; confidence: number | null; }
// ✨ เพิ่ม Interface สำหรับ Subject
interface Subject {
  subject_id: number;
  subject_name: string;
  section?: string | null;
  schedule?: string | null;
}

// --- (Main Page Component) ---
const AccessControlPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTargetCamera, setCurrentTargetCamera] = useState<'entrance' | 'exit' | null>(null);
  const [selectedSources, setSelectedSources] = useState({ entrance: '', exit: '' });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // const [className, setClassName] = useState('SP403-61'); // 👈 ลบ state นี้
  const [lateTime, setLateTime] = useState('09:30');
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isViewingToday = selectedDate.toDateString() === new Date().toDateString();
  
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);

  // ✨ เพิ่ม State สำหรับ Subjects
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(''); // เก็บ ID ของวิชาที่เลือก

  const formatDateForAPI = (date: Date): string => { return date.toISOString().split('T')[0]; };

  // ✨ ฟังก์ชันสำหรับดึงรายชื่อวิชา
  const fetchSubjects = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/subjects`);
      if (!response.ok) throw new Error("Failed to fetch subjects");
      const data: Subject[] = await response.json();
      setSubjects(data);
      
      // ถ้ายังไม่ได้เลือกวิชา (เช่น โหลดหน้าครั้งแรก) และมีข้อมูลวิชา ให้เลือกวิชาแรก
      if (data.length > 0 && selectedSubjectId === '') {
          setSelectedSubjectId(data[0].subject_id.toString());
      }
    } catch (err) {
      console.error("Failed to fetch subjects:", err);
    }
  }, [selectedSubjectId]); // ให้ re-check เมื่อ selectedSubjectId เปลี่ยน (แต่ส่วนใหญ่จะใช้ตอนโหลด)

  // ✨ อัปเดต fetchInitialLogs ให้กรองตาม subject_id ที่เลือก
  const fetchInitialLogs = useCallback(async () => {
    const dateString = formatDateForAPI(selectedDate);
    
    // สร้าง URL
    let url = `${BACKEND_URL}/attendance/logs?start_date=${dateString}&end_date=${dateString}`;
    
    // ถ้ามีวิชาถูกเลือก (ไม่ใช่ค่าว่าง) ให้เพิ่ม subject_id เข้าไปใน query
    if (selectedSubjectId) {
      url += `&subject_id=${selectedSubjectId}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch logs");
      setLogs(await response.json());
    } catch (err) { 
      console.error("Failed to fetch initial logs:", err); 
      setLogs([]); // เคลียร์ logs ถ้า fetch ไม่สำเร็จ
    }
  }, [selectedDate, selectedSubjectId]); // 👈 เพิ่ม selectedSubjectId เป็น dependency

  const pollNewLogs = useCallback(async () => {
    if (!isViewingToday) return; 
    try {
      // (Poll อาจจะไม่จำเป็นต้องกรอง subject_id เพราะมันดึงแค่ของใหม่ไม่กี่วินาที)
      const response = await fetch(`${BACKEND_URL}/attendance/poll`);
      if (!response.ok) throw new Error("Failed to poll logs");
      const newLogs: LogEntry[] = await response.json();
      
      if (newLogs.length > 0) { 
        // กรอง newLogs ให้ตรงกับ subject ที่เลือกก่อนเพิ่มเข้าไป
        const filteredNewLogs = newLogs.filter(log => 
          !selectedSubjectId || (log as any).subject_id?.toString() === selectedSubjectId
        );
        if (filteredNewLogs.length > 0) {
          setLogs(prevLogs => [...filteredNewLogs, ...prevLogs]); 
        }
      }
    } catch (err) { console.error("Failed to poll new logs:", err); }
  }, [isViewingToday, selectedSubjectId]); // 👈 เพิ่ม selectedSubjectId เป็น dependency

  // Effect สำหรับดึง Log (จะรันใหม่เมื่อ fetchInitialLogs หรือ pollNewLogs เปลี่ยน)
  useEffect(() => {
    fetchInitialLogs(); 
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (isViewingToday) { 
      pollIntervalRef.current = setInterval(pollNewLogs, 3000); 
    }
    return () => { if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); } };
  }, [fetchInitialLogs, pollNewLogs, isViewingToday]); 

  // Effect สำหรับดึง Config กล้อง (รันครั้งเดียว)
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
  
  // Effect สำหรับดึงรายชื่อวิชา (รันครั้งเดียว)
  useEffect(() => {
    fetchSubjects();
  }, []); // 👈 ดึงวิชาแค่ครั้งเดียวตอนโหลดหน้า

  // Effect สำหรับนาฬิกา (รันครั้งเดียว)
  useEffect(() => {
    const timer = setInterval(() => { setCurrentTime(new Date()); }, 1000);
    return () => { clearInterval(timer); };
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
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newMapping),
        });
        if (!response.ok) throw new Error("Failed to configure backend");
        setSelectedSources(newMapping); 
      } catch (err) { console.error("Failed to set new camera source:", err); }
    }
  };

  const handleStartAttendance = async () => {
    try { await fetch(`${BACKEND_URL}/attendance/start`, { method: 'POST' }); alert('Attendance Started!'); } 
    catch (err) { console.error(err); alert('Failed to start attendance.'); }
  };
  const handleStopAttendance = async () => {
    try { await fetch(`${BACKEND_URL}/attendance/stop`, { method: 'POST' }); alert('Attendance Stopped!'); } 
    catch (err) { console.error(err); alert('Failed to stop attendance.'); }
  };
  
  // ✨ อัปเดต Callback นี้ให้เรียก fetchSubjects
  const handleSubjectAdded = () => {
     alert("Subject created successfully!");
     fetchSubjects(); // 👈 สั่งให้ดึงรายชื่อวิชาใหม่
  };

  return (
    <div className={styles.pageContainer}>
      <SettingsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSelectDevice={handleSelectDevice} />
      
      <AddSubjectModal isOpen={isAddSubjectModalOpen} onClose={() => setIsAddSubjectModalOpen(false)} onSubjectAdded={handleSubjectAdded} />

      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Camera Preview</h1>
      </header>
      <div className={styles.cameraGrid}>
        <CameraBox camId="entrance" streamKey={selectedSources.entrance} onSettingsClick={() => handleOpenModal('entrance')} />
        <CameraBox camId="exit" streamKey={selectedSources.exit} onSettingsClick={() => handleOpenModal('exit')} />
      </div>
      
      <div className={styles.controlPanel}>
        <div className={styles.controlGroup}>
          <label htmlFor="subjectSelect" style={{ whiteSpace: 'nowrap' }}>Class&nbsp;:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            
            {/* ✨ เปลี่ยน Input เป็น Select */}
            <select
              id="subjectSelect"
              className={styles.controlSelect} // 👈 ใช้ Class ใหม่ (ต้องเพิ่มใน CSS)
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              style={{ flex: 1, minWidth: '150px' }} // 👈 กำหนด flex และ min-width
            >
              <option value="">-- All Subjects --</option>
              {subjects.map((subj) => (
                <option key={subj.subject_id} value={subj.subject_id}>
                  {subj.subject_name} {subj.section ? `(${subj.section})` : ''}
                </option>
              ))}
            </select>
            
            <button 
                onClick={() => setIsAddSubjectModalOpen(true)}
                title="Create new subject"
                className={styles.iconButton} // 👈 ใช้ Class ใหม่ (ต้องเพิ่มใน CSS)
            >
                <Plus size={18} />
            </button>
          </div>
        </div>
        
        <div className={styles.controlGroup}>
          <label htmlFor="lateTime" style={{ whiteSpace: 'nowrap' }}>After :</label>
          <input type-="time" id="lateTime" className={styles.controlInput} value={lateTime} onChange={(e) => setLateTime(e.target.value)} style={{ width: '130px' }}/>
          <span className={styles.lateTag}>Late</span>
        </div>
        
        <span className={styles.realTimeClock}>
          {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
        </span>

        <button className={`${styles.controlButton} ${styles.startButton}`} onClick={handleStartAttendance} disabled={!isViewingToday}>Start Attendance</button>
        <button className={`${styles.controlButton} ${styles.stopButton}`} onClick={handleStopAttendance} disabled={!isViewingToday}>Stop Attendance</button>
      </div>
      
      <div className={styles.logCard}>
        <div className={styles.logHeader}>
          <h2 className={styles.logTitle}>Attendance Log</h2>
          <div className={styles.datePickerContainer}>
            <label htmlFor="logDate">Select Date:</label>
            <input type="date" id="logDate" className={styles.dateInput} value={formatDateForAPI(selectedDate)} onChange={(e) => setSelectedDate(new Date(e.target.value))} />
          </div>
          <button className={styles.exportButton}><Download size={16} /><span>Export data</span></button>
        </div>
        
        <div className={styles.tableContainer}> {/* 👈 เพิ่ม Container นี้ */}
          <table className={styles.attendanceTable}>
            <thead><tr><th>Time</th><th>Name</th><th>ID</th><th>Status</th></tr></thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={4} className={styles.noLogs}>No logs found for this day.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.log_id}>
                    <td className={styles.tableCellText}>{new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                    <td className={styles.tableCellText}>{log.user_name}</td>
                    <td className={styles.tableCellText}>{log.student_code}</td>
                    <td className={styles.tableCellStatus}><span className={log.action === 'enter' ? styles.statusPresent : styles.statusLate}>{log.action}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div> {/* 👈 ปิด Container */}
      </div>
    </div>
  );
};

export default AccessControlPage;