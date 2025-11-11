'use client';

// ✨ 1. เพิ่ม Trash2 และ Import Modal ใหม่
import React, { useEffect, useRef, useState, useCallback, FormEvent } from 'react';
import { Settings, Download, X, VideoOff, Plus, Loader2, Save, Trash2 } from 'lucide-react';
import styles from './accesscontrol.module.css';
import { DeleteSubjectModal } from './DeleteSubjectModal'; // (Import ไฟล์ใหม่)

const BACKEND_URL = 'http://localhost:8000';
const WS_BACKEND_URL = 'ws://localhost:8000';

// --- (SettingsModal Component) ---
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
interface LogEntry { 
  log_id: number; 
  user_id: number; 
  user_name: string; 
  student_code: string; 
  action: "enter" | "exit"; 
  timestamp: string; 
  confidence: number | null; 
  subject_id: number | null;
}
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
  
  const [lateTime, setLateTime] = useState('09:30');
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isViewingToday = selectedDate.toDateString() === new Date().toDateString();
  
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);

  // ✨ 2. เพิ่ม State สำหรับ Modal ลบ
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  
  const [showExportMenu, setShowExportMenu] = useState(false);


  const formatDateForAPI = (date: Date): string => { return date.toISOString().split('T')[0]; };

  const fetchSubjects = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/subjects`);
      if (!response.ok) throw new Error("Failed to fetch subjects");
      const data: Subject[] = await response.json();
      setSubjects(data);
    } catch (err) {
      console.error("Failed to fetch subjects:", err);
    }
  }, []); 

  const fetchInitialLogs = useCallback(async () => {
    const dateString = formatDateForAPI(selectedDate);
    let url = `${BACKEND_URL}/attendance/logs?start_date=${dateString}&end_date=${dateString}`;
    if (selectedSubjectId) {
      url += `&subject_id=${selectedSubjectId}`;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch logs");
      setLogs(await response.json());
    } catch (err) { 
      console.error("Failed to fetch initial logs:", err); 
      setLogs([]); 
    }
  }, [selectedDate, selectedSubjectId]); 

  const pollNewLogs = useCallback(async () => {
    if (!isViewingToday) return; 
    try {
      const response = await fetch(`${BACKEND_URL}/attendance/poll`);
      if (!response.ok) throw new Error("Failed to poll logs");
      const newLogs: LogEntry[] = await response.json();
      
      if (newLogs.length > 0) { 
        const filteredNewLogs = newLogs.filter(log => 
          !selectedSubjectId || log.subject_id?.toString() === selectedSubjectId
        );
        if (filteredNewLogs.length > 0) {
          setLogs(prevLogs => [...filteredNewLogs, ...prevLogs]); 
        }
      }
    } catch (err) { console.error("Failed to poll new logs:", err); }
  }, [isViewingToday, selectedSubjectId]);

  useEffect(() => {
    fetchInitialLogs(); 
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (isViewingToday) { 
      pollIntervalRef.current = setInterval(pollNewLogs, 3000); 
    }
    return () => { if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); } };
  }, [fetchInitialLogs, pollNewLogs, isViewingToday]); 

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
  
  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

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
  
  const handleSubjectAdded = () => {
     alert("Subject created successfully!");
     fetchSubjects(); // สั่งให้ดึงรายชื่อวิชาใหม่
  };

  // ✨ 3. เพิ่มฟังก์ชัน Callback เมื่อลบสำเร็จ
  const handleSubjectDeleted = () => {
     fetchSubjects(); // (แค่สั่งให้ดึงรายชื่อวิชาใหม่)
     // (ถ้าวิชาที่เลือกลบ เป็นวิชาที่เลือกค้างไว้ใน Dropdown ให้ Clear)
     if (selectedSubjectId && !subjects.find(s => s.subject_id.toString() === selectedSubjectId)) {
        setSelectedSubjectId('');
     }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    console.log(`Exporting data as ${format}...`);
    setShowExportMenu(false); // (สั่งปิดเมนู)
    
    const dateString = formatDateForAPI(selectedDate);
    const subjectId = selectedSubjectId;
    
    const params = new URLSearchParams();
    params.append("start_date", dateString);
    params.append("end_date", dateString);
    if (subjectId) {
      params.append("subject_id", subjectId);
    }
    params.append("format", format); // (ใช้ format ที่ส่งเข้ามา)
    
    const url = `${BACKEND_URL}/attendance/export?${params.toString()}`;

    try {
      const link = document.createElement("a");
      link.href = url;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Export failed:", err);
      alert(`Export failed: ${err.message}`);
    }
  };


  return (
    <div className={styles.pageContainer}>
      <SettingsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSelectDevice={handleSelectDevice} />
      <AddSubjectModal isOpen={isAddSubjectModalOpen} onClose={() => setIsAddSubjectModalOpen(false)} onSubjectAdded={handleSubjectAdded} />
      
      {/* ✨ 4. Render Modal ใหม่ */}
      <DeleteSubjectModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onSubjectDeleted={handleSubjectDeleted}
      />

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
            
            <select
              id="subjectSelect"
              className={styles.controlSelect} 
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              style={{ flex: 1, minWidth: '150px' }} 
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
                className={styles.iconButton}
            >
                <Plus size={18} />
            </button>

            {/* ✨ 5. เพิ่มปุ่มถังขยะ */}
            <button 
                onClick={() => setIsDeleteModalOpen(true)}
                title="Delete a subject"
                className={`${styles.iconButton} ${styles.deleteButton}`}
            >
                <Trash2 size={18} />
            </button>
            
          </div>
        </div>
        
        <div className={styles.controlGroup}>
          <label htmlFor="lateTime" style={{ whiteSpace: 'nowrap' }}>After :</label>
          <input type="time" id="lateTime" className={styles.controlInput} value={lateTime} onChange={(e) => setLateTime(e.target.value)} style={{ width: '130px' }}/>
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

          <div className={styles.exportControls}>
            <div style={{ position: 'relative' }}>
              <button 
                className={styles.exportButton} 
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                <Download size={16} />
                <span>Export data</span>
              </button>
              
              {showExportMenu && (
                <div className={styles.exportMenu}>
                  <button onClick={() => handleExport('csv')}>Export as .csv</button>
                  <button onClick={() => handleExport('xlsx')}>Export as .xlsx</button>
                </div>
              )}
            </div>
          </div>

        </div>
        
        <div className={styles.tableContainer}>
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
        </div>
      </div>
    </div>
  );
};

export default AccessControlPage;