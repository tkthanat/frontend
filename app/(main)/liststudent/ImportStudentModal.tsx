'use client'; 

import React, { useState, FormEvent, useCallback, useEffect, useRef } from 'react';
import { X, Loader2, FileUp, ExternalLink } from 'lucide-react'; 
import { useMsal } from "@azure/msal-react";
import { getAuthToken } from "../../authConfig";

import styles from './liststudent.module.css';

const BACKEND_URL = 'http://localhost:8000';

const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/1CwqFKXeUwgAhlgDdirAoKOhSN1cMvZ3VzZDFGXKuOkw/copy"; 

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

const ImportStudentModal: React.FC<ImportStudentModalProps> = ({ isOpen, onClose, onImportSuccess, subjects }) => {
  const { instance, accounts } = useMsal();
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [rosterFile, setRosterFile] = useState<File | null>(null); 
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const rosterInputRef = useRef<HTMLInputElement>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

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

      if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls') || nameLower.endsWith('.csv')) {
        setRosterFile(file);
        setError('');
      } else {
        setError('กรุณาอัปโหลดไฟล์ในรูปแบบ .xlsx, .xls, หรือ .csv เท่านั้น');
        setRosterFile(null);
      }
    }
  };
  
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
      formData.append('roster_file', rosterFile); 
      
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
      
      onImportSuccess(); 
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
  
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          
          <div className={styles.formGroup}>
            <label>1. Select Target Subject <span style={{ color: '#dc2626' }}>*</span></label>
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
              <label>Registration Form / Sheet Source</label>
              <div className={styles.formInstructionBox} style={{padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                  
                  <a 
                      href={GOOGLE_FORM_URL} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={styles.openFormButton} 
                      style={{ 
                          width: '100%', 
                          justifyContent: 'center', 
                          padding: '0.75rem 1rem' 
                      }}
                  >
                      <ExternalLink size={20} /> Open Registration Form
                  </a>
              </div>
              
              <p className={styles.rosterWarningText}>
                  **คำเตือน** ไฟล์ที่ Export จาก Google Sheet ต้องมีคอลัมน์ student_code, name, และ face_id_1 ถึง face_id_4 (รวม 6 คอลัมน์) โดยลิงก์รูปภาพต้องเป็นสาธารณะ
              </p>
          </div>
          
          <div className={styles.formGroup}>
            <label>2. Upload Roster File (.xlsx/.csv) <span style={{ color: '#dc2626' }}>*</span></label>
            <div className={styles.fileDropArea} onClick={() => !isSubmitting && rosterInputRef.current?.click()}>
              <FileUp size={30} />
              <p>{rosterFile ? rosterFile.name : 'Click to select XLSX/CSV file'}</p>
            </div>
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