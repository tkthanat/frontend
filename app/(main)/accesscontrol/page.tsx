'use client';

// (Imports ทั้งหมดเหมือนเดิม)
import React, { useEffect, useRef, useState, useCallback, FormEvent } from 'react';
import { Settings, Download, X, VideoOff, Plus, Loader2, Save, Trash2 } from 'lucide-react';
import styles from './accesscontrol.module.css';
import { DeleteSubjectModal } from './DeleteSubjectModal'; // (Assume this file exists)

const BACKEND_URL = 'http://localhost:8000';
const WS_BACKEND_URL = 'ws://localhost:8000';

// --- (SettingsModal Component) ---
// (โค้ดส่วนนี้เหมือนเดิม)
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
// (โค้ดส่วนนี้เหมือนเดิม)
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
            <input id="subjectName" type="text" value={subjectName} onChange={e => setSubjectName(e.target.value)} placeholder="e.g. Computer Vision" disabled={isSubmitting} required />
          </div>
          <div className={styles.formGroup}>
             <label htmlFor="section">Section (Optional)</label>
             <input id="section" type="text" inputMode="numeric" value={section} onChange={handleSectionChange} placeholder="e.g. 001" disabled={isSubmitting} />
          </div>
          <div className={styles.formGroup}>
             <label htmlFor="schedule">Schedule (Optional)</label>
             <input id="schedule" type="text" value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="e.g. Monday 09:00-12:00" disabled={isSubmitting} />
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

// --- (SnapshotModal Component) ---
// (โค้ดส่วนนี้เหมือนเดิม)
interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
}
const SnapshotModal: React.FC<SnapshotModalProps> = ({ isOpen, onClose, imageUrl }) => {
  if (!isOpen || !imageUrl) return null;
  return (
    <div className={styles.modalBackdrop} onClick={onClose} style={{ zIndex: 1200 }}>
      <div className={styles.snapshotModalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} style={{ color: '#fff', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}><X size={24} /></button>
        <img src={imageUrl} alt="Full Snapshot" className={styles.snapshotModalImage} />
      </div>
    </div>
  );
};

// --- (Custom Hook WebSocket) ---
// (โค้ดส่วนนี้เหมือนเดิม)
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
// (โค้ดส่วนนี้เหมือนเดิม)
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
// (โค้ดส่วนนี้เหมือนเดิม)
interface LogEntry { 
  log_id: number; 
  user_id: number; 
  user_name: string; 
  student_code: string; 
  action: "enter" | "exit"; 
  timestamp: string; 
  confidence: number | null; 
  subject_id: number | null;
  snapshot_path: string | null;
}
interface Subject {
  subject_id: number;
  subject_name: string;
  section?: string | null;
  schedule?: string | null;
}

// --- (Main Page Component) ---
const AccessControlPage = () => {
  // (โค้ด state เดิม)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTargetCamera, setCurrentTargetCamera] = useState<'entrance' | 'exit' | null>(null);
  const [selectedSources, setSelectedSources] = useState({ entrance: '', exit: '' });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [lateTime, setLateTime] = useState('09:30'); // 👈 (State นี้คือตัวกำหนดเวลาสาย)
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isViewingToday = selectedDate.toDateString() === new Date().toDateString();
  
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [snapshotModalUrl, setSnapshotModalUrl] = useState<string | null>(null);


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
      const data: LogEntry[] = await response.json();
      setLogs(data);
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

  const handleSubjectChange = async (newSubjectId: string) => {
    setSelectedSubjectId(newSubjectId);
  };

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
     fetchSubjects();
  };
  
  const handleSubjectDeleted = () => {
     fetchSubjects();
     if (selectedSubjectId && !subjects.find(s => s.subject_id.toString() === selectedSubjectId)) {
       handleSubjectChange('');
     }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'txt') => {
    // (โค้ดส่วนนี้เหมือนเดิม)
    console.log(`Exporting data as ${format}...`);
    setShowExportMenu(false);
    const dateString = formatDateForAPI(selectedDate);
    const subjectId = selectedSubjectId;
    const params = new URLSearchParams();
    params.append("start_date", dateString);
    params.append("end_date", dateString);
    if (subjectId) {
      params.append("subject_id", subjectId);
    }
    const url = `${BACKEND_URL}/attendance/export?${params.toString()}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch export data');
        const data: any[] = await response.json();
        if (data.length === 0) { alert("No data to export"); return; }
        let fileContent = "";
        const headers = Object.keys(data[0]);
        fileContent += headers.join('\t') + '\r\n';
        data.forEach(row => {
            const values = headers.map(header => {
            let val = row[header];
            if (val === null || val === undefined) val = "N/A";
            return `"${String(val).replace(/"/g, '""')}"`;
            });
            fileContent += values.join('\t') + '\r\n';
        });
        let mimeType = 'text/plain;charset=utf-8;';
        let fileExtension = 'txt';
        if (format === 'csv') {
            mimeType = 'text/csv;charset=utf-8;';
            fileExtension = 'csv';
        } else if (format === 'xlsx') {
             mimeType = 'application/vnd.ms-excel';
             fileExtension = 'xls';
        }
        const blob = new Blob([fileContent], { type: mimeType });
        const link = document.createElement("a");
        const blobUrl = URL.createObjectURL(blob);
        link.setAttribute("href", blobUrl);
        link.setAttribute("download", `attendance_export_${dateString}.${fileExtension}`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
         console.error("Export failed:", err);
         alert(`Export failed: ${err.message}`);
    }
  };


  return (
    <div className={styles.pageContainer}>
      <SettingsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSelectDevice={handleSelectDevice} />
      <AddSubjectModal isOpen={isAddSubjectModalOpen} onClose={() => setIsAddSubjectModalOpen(false)} onSubjectAdded={handleSubjectAdded} />
      
      <DeleteSubjectModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onSubjectDeleted={handleSubjectDeleted}
      />
      
      <SnapshotModal 
        isOpen={!!snapshotModalUrl}
        onClose={() => setSnapshotModalUrl(null)}
        imageUrl={snapshotModalUrl}
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
              onChange={(e) => handleSubjectChange(e.target.value)}
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
                  <button onClick={() => handleExport('txt')}>Export as .txt (Raw)</button>
                  <button onClick={() => handleExport('csv')}>Export as .csv (Raw)</button>
                  <button onClick={() => handleExport('xlsx')}>Export as .xls (Raw)</button>
                </div>
              )}
            </div>
          </div>

        </div>
        
        <div className={styles.tableContainer}>
          <table className={styles.attendanceTable}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Name</th>
                <th>ID</th>
                <th>Status</th>
                <th>Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={5} className={styles.noLogs}>No logs found for this day.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.log_id}>
                    <td className={styles.tableCellText}>{new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                    <td className={styles.tableCellText}>{log.user_name}</td>
                    <td className={styles.tableCellText}>{log.student_code}</td>
                    
                    {/* ✨ --- [ นี่คือส่วนที่แก้ไข ] --- ✨ */}
                    <td className={styles.tableCellStatus}>
                      {(() => {
                        // 1. ถ้าเป็น 'exit' ให้แสดง 'exit' (สีแดง)
                        if (log.action === 'exit') {
                          return <span className={styles.statusLate}>Exit</span>;
                        }
                        
                        // 2. ถ้าเป็น 'enter' ให้เปรียบเทียบเวลา
                        try {
                          // ดึงเวลาสายที่ตั้งค่าไว้ (เช่น "09:30")
                          const [lateHour, lateMinute] = lateTime.split(':').map(Number);
                          // ดึงเวลาที่เช็คชื่อ
                          const logTime = new Date(log.timestamp);
                          
                          // เปรียบเทียบ
                          const isLate = logTime.getHours() > lateHour || 
                                         (logTime.getHours() === lateHour && logTime.getMinutes() > lateMinute);

                          if (isLate) {
                            return <span className={styles.statusLate}>Enter (Late)</span>;
                          } else {
                            return <span className={styles.statusPresent}>Enter (On-Time)</span>;
                          }
                        } catch (e) {
                          // กรณีเกิด Error (เช่น lateTime ว่างเปล่า)
                          return <span className={styles.statusPresent}>Enter</span>;
                        }
                      })()}
                    </td>
                    
                    <td className={styles.tableCellSnapshot}>
                      {log.snapshot_path ? (
                        <img 
                          src={`${BACKEND_URL}/${log.snapshot_path?.replace(/\\/g, '/')}`} 
                          alt="Snapshot"
                          className={styles.snapshotImage} 
                          loading="lazy"
                          onClick={() => setSnapshotModalUrl(`${BACKEND_URL}/${log.snapshot_path?.replace(/\\/g, '/')}`)}
                        />
                      ) : (
                        'N/A'
                      )}
                    </td>
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