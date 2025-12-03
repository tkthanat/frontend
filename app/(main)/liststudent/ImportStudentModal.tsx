// ImportStudentModal.tsx (แก้ไขสมบูรณ์สำหรับ XLSX Roster Import)
'use client'; 

import React, { useState, FormEvent, useCallback, useEffect, useRef } from 'react';
import { X, UploadCloud, Loader2, Download, FileText, Camera, FileUp } from 'lucide-react'; 
import { useMsal } from "@azure/msal-react";
import { getAuthToken } from "../../authConfig";

import * as XLSX from 'xlsx'; 
import { saveAs } from 'file-saver'; 
import styles from './liststudent.module.css';

const BACKEND_URL = 'http://localhost:8000';

// --- Interfaces ---
interface Subject {
  subject_id: number;
  subject_name: string;
  section?: string | null;
  academic_year?: string | null;
}

interface ImportStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  subjects: Subject[];
}

// --- Helper Function: Generate Template (สำหรับ XLSX) ---
const generateTemplate = (subjectId: number | '') => {
    // Column Header ที่จำเป็นสำหรับการ Import (ตามที่ Backend main.py คาดหวัง: student_code, name)
    const headers = ["student_code", "name"]; 
    
    // ข้อมูลตัวอย่าง
    const data = [
        headers,
        ['22045', 'สมชาย ใจดี'],
        ['22046', 'สมหญิง สุขใจ'],
        ['22xxx', 'Example Name'] 
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    ws['!cols'] = [
        { wch: 15 }, 
        { wch: 20 }, 
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student_Roster");
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); 
};


// --- Component ---
const ImportStudentModal: React.FC<ImportStudentModalProps> = ({ isOpen, onClose, onImportSuccess, subjects }) => {
  const { instance, accounts } = useMsal();
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [rosterFile, setRosterFile] = useState<File | null>(null); // ✨ [แก้ไข] รับ rosterFile
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const rosterInputRef = useRef<HTMLInputElement>(null); // ✨ [แก้ไข] เปลี่ยนชื่อ ref
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Get Auth Token on mount
  useEffect(() => {
    if (isOpen && accounts.length > 0) {
      getAuthToken(instance, accounts[0]).then(setAuthToken).catch(() => setAuthToken(null));
    }
  }, [isOpen, instance, accounts]);

  const resetForm = useCallback(() => {
    setSelectedSubjectId('');
    setRosterFile(null);
    setError('');
    setIsSubmitting(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(resetForm, 300);
    }
  }, [isOpen, resetForm]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const nameLower = file.name.toLowerCase();

      // ✨ [แก้ไข] รับไฟล์ XLSX/CSV
      if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls') || nameLower.endsWith('.csv')) {
        setRosterFile(file);
        setError('');
      } else {
        setError('กรุณาอัปโหลดไฟล์ในรูปแบบ .xlsx, .xls, หรือ .csv เท่านั้น');
        setRosterFile(null);
      }
    }
  };
  
  const handleDownloadTemplate = () => {
      if (!selectedSubjectId) {
          setError('กรุณาเลือก Subject ก่อนดาวน์โหลด Template');
          return;
      }
      const blob = generateTemplate(selectedSubjectId);
      const subjectName = subjects.find(s => s.subject_id === selectedSubjectId)?.subject_name || 'Roster_Template';
      saveAs(blob, `${subjectName}_Roster_Template.xlsx`); 
  };


  // --- Submission Logic: Import Roster Only (.xlsx/.csv) ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedSubjectId) { setError('กรุณาเลือก Subject ที่ต้องการ Import'); return; }
    if (!rosterFile) { setError('กรุณาอัปโหลดไฟล์บัญชีรายชื่อ'); return; }
    if (!authToken) { setError("Authentication token is missing. Please re-login."); return; }

    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('subject_id', selectedSubjectId.toString());
      formData.append('roster_file', rosterFile); // ✨ [แก้ไข] ส่ง roster_file
      
      // ✨ [สำคัญ] Endpoint ใหม่สำหรับ Import Roster เท่านั้น
      const res = await fetch(`${BACKEND_URL}/users/import/roster`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to import students roster');
      }

      // ไม่จำเป็นต้อง Train AI/Refresh หน้าหลัก เนื่องจากไม่มีรูปภาพเข้ามา
      
      onImportSuccess(); // Refresh หน้าหลัก
      onClose();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการ Import ข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose} style={{ zIndex: 1200 }}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
        <h2>Import Students Roster (Batch)</h2>
        <p>นำเข้าบัญชีรายชื่อนักศึกษาจำนวนมาก (ไม่รวมรูปภาพ) เพื่อสร้างบัญชีผู้ใช้</p>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          
          <div className={styles.formGroup}>
            <label>1. Select Target Subject <span style={{ color: '#ef4444' }}>*</span></label>
            <select
              className={styles.controlSelect}
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')}
              disabled={isSubmitting || subjects.length === 0}
              required
            >
              <option value="">-- Choose Subject --</option>
              {subjects.map(s => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.academic_year ? `[${s.academic_year}] ` : ''}
                  {s.subject_name} {s.section ? `(Sec: ${s.section})` : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div className={styles.formGroup}>
              <label>Template & Instructions</label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      <FileText size={14} style={{ display: 'inline', marginRight: '5px' }} />
                      ดาวน์โหลด Template (.xlsx) เพื่อกรอกรายชื่อ
                  </p>
                  <button 
                      type="button" 
                      onClick={handleDownloadTemplate} 
                      className={styles.settingsButton} 
                      disabled={isSubmitting || !selectedSubjectId} 
                  >
                      <Download size={16} /> Template
                  </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#ef4444' }}>
                  **คำเตือน:** Template ที่กรอกแล้วต้องมีคอลัมน์ **student\_code** และ **name** ตรงตามที่กำหนดเท่านั้น
              </p>
          </div>
          
          <div className={styles.formGroup}>
            <label>2. Upload Roster File (.xlsx/.csv) <span style={{ color: '#ef4444' }}>*</span></label>
            <div className={styles.fileDropArea} onClick={() => !isSubmitting && rosterInputRef.current?.click()}>
              <FileUp size={30} />
              <p>{rosterFile ? rosterFile.name : 'Click to select XLSX/CSV file'}</p>
            </div>
            {/* ✨ [แก้ไข] Accept file types ให้รองรับ XLSX/CSV */}
            <input type="file" ref={rosterInputRef} accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} disabled={isSubmitting} />
          </div>
          
          {error && <p className={styles.errorText}>{error}</p>}

          <button type="submit" className={styles.submitButton} disabled={isSubmitting || !rosterFile || !selectedSubjectId}>
            {isSubmitting ? <Loader2 size={20} className={styles.spinner} /> : 'Process Roster Import'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImportStudentModal;