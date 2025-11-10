'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
// อย่าลืมตรวจสอบ path นี้ให้ตรงกับไฟล์ CSS ที่คุณต้องการใช้จริง
import styles from '../liststudent/liststudent.module.css';

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubjectAdded: () => void;
}

const BACKEND_URL = 'http://localhost:8000';

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

  // ✨ ฟังก์ชันสำหรับตรวจสอบให้กรอกได้เฉพาะตัวเลข
  const handleSectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Regex /^\d*$/ หมายถึง อนุญาตเฉพาะตัวเลข (digits) เท่านั้น หรือเป็นค่าว่าง
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
             {/* ✨ อัปเดต input ของ Section */}
             <input 
               id="section"
               type="text" 
               inputMode="numeric" // ช่วยให้มือถือแสดงแป้นตัวเลข
               value={section} 
               onChange={handleSectionChange} // ใช้ฟังก์ชันใหม่ที่สร้างขึ้น
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

export default AddSubjectModal;