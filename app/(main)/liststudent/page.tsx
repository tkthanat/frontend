'use client';

import React, { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { Settings, Plus, Trash2, X, UploadCloud, Image as ImageIcon, User, Loader2, Edit } from 'lucide-react';
import styles from './liststudent.module.css';

// URL ของ Backend (FastAPI)
const BACKEND_URL = 'http://localhost:8000';

// --- Interfaces (ประเภทข้อมูล) ---
interface UserFace {
  face_id: number;
  file_path: string;
}

interface User {
  user_id: number;
  name: string;
  student_code: string | null;
  role: string;
  faces: UserFace[]; 
}

// --- Component: StudentCard ---
interface StudentCardProps {
  student: User;
  onDelete: (userId: number, name: string) => void;
  onEdit: (student: User) => void;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, onDelete, onEdit }) => {
  
  // ✨ [แก้ไข] ดึงรูปมา 4 รูปแรก (หรือน้อยกว่า)
  const gridFaces = student.faces.slice(0, 4);
  
  // ✨ [ใหม่] สร้าง Array ของ Placeholder ตามจำนวนที่ขาด
  const placeholders = new Array(Math.max(0, 4 - gridFaces.length)).fill(null);

  return (
    <div className={styles.studentCard} onClick={() => onEdit(student)}>
      <button 
        className={styles.deleteButton} 
        onClick={(e) => {
          e.stopPropagation(); 
          onDelete(student.user_id, student.name);
        }}
        title="Delete Student"
      >
        <Trash2 size={16} />
      </button>
      
      {/* ✨ [แก้ไข] วนลูปแสดงรูปจริงก่อน แล้วค่อยแสดง Placeholder */}
      <div className={styles.imageGrid}>
        {gridFaces.map(face => (
           <img 
             key={face.face_id}
             src={`${BACKEND_URL}/static/faces/train/${student.user_id}/${face.file_path}`} 
             alt={student.name} 
             className={styles.studentImage} 
           />
        ))}
        {placeholders.map((_, index) => (
          <div key={`placeholder-${index}`} className={styles.imagePlaceholder}>
            <ImageIcon size={32} />
          </div>
        ))}
      </div>

      <div className={styles.studentInfo}>
        <span className={styles.studentId}>{student.student_code || 'N/A'}</span>
        <span className={styles.studentName}>{student.name}</span>
      </div>
    </div>
  );
};

// --- Component: AddStudentModal ---
interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: () => void; 
}

const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onStudentAdded }) => {
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setName('');
    setStudentCode('');
    setFiles([]);
    setError('');
    setIsSubmitting(false);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
  }, [previewUrls]);

  useEffect(() => {
    if (!isOpen) { setTimeout(resetForm, 300); }
    return () => { previewUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [isOpen, resetForm, previewUrls]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      if (files.length + selectedFiles.length > 50) {
        setError("สามารถอัปโหลดได้สูงสุด 50 รูป"); return;
      }
      setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
      const newUrls = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prevUrls => [...prevUrls, ...newUrls]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    const urlToRemove = previewUrls[index];
    URL.revokeObjectURL(urlToRemove);
    setPreviewUrls(prevUrls => prevUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('กรุณากรอกชื่อนักศึกษา'); return; }
    if (!studentCode.trim()) { setError('กรุณากรอกรหัสนักศึกษา'); return; }
    if (files.length < 4) { setError('กรุณาอัปโหลดรูปภาพอย่างน้อย 4 รูป'); return; }
    if (files.length > 50) { setError('สามารถอัปโหลดได้สูงสุด 50 รูป'); return; }
    setIsSubmitting(true);
    
    try {
      const userResponse = await fetch(`${BACKEND_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, student_code: studentCode, role: 'viewer' }),
      });
      if (!userResponse.ok) {
        const errData = await userResponse.json();
        throw new Error(errData.detail || 'Failed to create user.');
      }
      const newUserResult = await userResponse.json();
      const newUserId = newUserResult.user.user_id;
      const uploadFormData = new FormData();
      uploadFormData.append('user_id', newUserId.toString());
      files.forEach((file) => uploadFormData.append('images', file));
      const uploadResponse = await fetch(`${BACKEND_URL}/faces/upload`, {
        method: 'POST',
        body: uploadFormData,
      });
      if (!uploadResponse.ok) throw new Error('User created, but failed to upload images.');
      await fetch(`${BACKEND_URL}/train/refresh`, { method: 'POST' });
      onStudentAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการสร้างนักศึกษา");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ✨ [ใหม่] ฟังก์ชันสำหรับ Validation
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // อนุญาตเฉพาะตัวเลข
    if (/^[0-9]*$/.test(e.target.value)) {
      setStudentCode(e.target.value);
    }
  };
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // อนุญาตเฉพาะตัวอักษร (รวมภาษาไทย) และเว้นวรรค
    if (/^[\p{L}\s]*$/u.test(e.target.value)) {
      setName(e.target.value);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
        <h2>Add New Student</h2>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="studentCode">Student ID</label>
            <input 
              id="studentCode" 
              type="text" 
              value={studentCode} 
              onChange={handleIdChange} // ✨ [แก้ไข]
              inputMode="numeric" // ✨ [ใหม่] (สำหรับ Mobile)
              placeholder="e.g. 2210511101036" 
              disabled={isSubmitting}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="name">Student Name</label>
            <input 
              id="name" 
              type="text" 
              value={name} 
              onChange={handleNameChange} // ✨ [แก้ไข]
              placeholder="e.g. Bank Bank" 
              disabled={isSubmitting}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Upload Face Images (Min 4, Max 50)</label>
            <div className={styles.fileDropArea} onClick={() => !isSubmitting && fileInputRef.current?.click()}>
              <UploadCloud size={40} />
              <p>Click or Drag & Drop files here</p>
              <p>({files.length} files selected)</p>
            </div>
            <input
              type="file" ref={fileInputRef} multiple
              accept="image/jpeg, image/png, image/jpg"
              onChange={handleFileChange} style={{ display: 'none' }}
              disabled={isSubmitting}
            />
          </div>
          <div className={styles.imagePreviewContainer}>
            {previewUrls.map((url, index) => (
              <div key={index} className={styles.imagePreviewItem}>
                <img src={url} alt={`Preview ${index + 1}`} />
                <button type="button" className={styles.removeImageButton} onClick={() => !isSubmitting && removeFile(index)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          {error && <p className={styles.errorText}>{error}</p>}
          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={20} className={styles.spinner} /> : 'Create Student'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Component: EditStudentModal ---
interface EditStudentModalProps {
  student: User | null;
  isOpen: boolean;
  onClose: () => void;
  onStudentUpdated: () => void;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({ student, isOpen, onClose, onStudentUpdated }) => {
  if (!student) return null; 

  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [existingFaces, setExistingFaces] = useState<UserFace[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviewUrls, setNewPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setStudentCode(student.student_code || '');
      setExistingFaces(student.faces || []);
      newPreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setNewFiles([]);
      setNewPreviewUrls([]);
      setError('');
      setIsSubmitting(false);
    }
  }, [student, isOpen]); // (แก้ Dependency)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      if (existingFaces.length + newFiles.length + selectedFiles.length > 50) {
        setError("สามารถอัปโหลดได้สูงสุด 50 รูป"); return;
      }
      setNewFiles(prev => [...prev, ...selectedFiles]);
      const newUrls = selectedFiles.map(file => URL.createObjectURL(file));
      setNewPreviewUrls(prev => [...prev, ...newUrls]);
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
    const urlToRemove = newPreviewUrls[index];
    URL.revokeObjectURL(urlToRemove);
    setNewPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleDeleteExistingFace = async (faceId: number) => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;
    if (existingFaces.length + newFiles.length - 1 < 4) {
      setError("ต้องมีรูปภาพอย่างน้อย 4 รูป");
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/faces/${faceId}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to delete image');
      }
      setExistingFaces(prev => prev.filter(face => face.face_id !== faceId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (existingFaces.length + newFiles.length < 4) {
      setError('ต้องมีรูปภาพอย่างน้อย 4 รูป'); return;
    }
    if (!name.trim()) { setError('กรุณากรอกชื่อนักศึกษา'); return; }
    if (!studentCode.trim()) { setError('กรุณากรอกรหัสนักศึกษา'); return; }

    setIsSubmitting(true);
    try {
      if (name !== student?.name || studentCode !== student?.student_code) {
        const userUpdateResponse = await fetch(`${BACKEND_URL}/users/${student?.user_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, student_code: studentCode }),
        });
        if (!userUpdateResponse.ok) {
          const err = await userUpdateResponse.json();
          throw new Error(err.detail || 'Failed to update user info');
        }
      }

      if (newFiles.length > 0) {
        const uploadFormData = new FormData();
        uploadFormData.append('user_id', student!.user_id.toString());
        newFiles.forEach((file) => uploadFormData.append('images', file));
        
        const uploadResponse = await fetch(`${BACKEND_URL}/faces/upload`, {
          method: 'POST',
          body: uploadFormData,
        });
        if (!uploadResponse.ok) throw new Error('Failed to upload new images.');
      }
      
      if (newFiles.length > 0) { // Train ใหม่ต่อเมื่อมีไฟล์ใหม่เท่านั้น
        await fetch(`${BACKEND_URL}/train/refresh`, { method: 'POST' });
      }
      
      onStudentUpdated(); 
      onClose(); 

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✨ [ใหม่] ฟังก์ชันสำหรับ Validation
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // อนุญาตเฉพาะตัวเลข
    if (/^[0-9]*$/.test(e.target.value)) {
      setStudentCode(e.target.value);
    }
  };
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // อนุญาตเฉพาะตัวอักษร (รวมภาษาไทย) และเว้นวรรค
    if (/^[\p{L}\s]*$/u.test(e.target.value)) {
      setName(e.target.value);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
        <h2>Edit Student</h2>
        
        <form onSubmit={handleSave} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="editStudentCode">Student ID</label>
            <input 
              id="editStudentCode" 
              type="text" 
              value={studentCode} 
              onChange={handleIdChange} // ✨ [แก้ไข]
              inputMode="numeric" // ✨ [ใหม่]
              disabled={isSubmitting}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="editName">Student Name</label>
            <input 
              id="editName" 
              type="text" 
              value={name} 
              onChange={handleNameChange} // ✨ [แก้ไข]
              disabled={isSubmitting}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Existing Images ({existingFaces.length})</label>
            <div className={styles.imagePreviewContainer}>
              {existingFaces.map((face) => (
                <div key={face.face_id} className={styles.imagePreviewItem}>
                  <img src={`${BACKEND_URL}/static/faces/train/${student.user_id}/${face.file_path}`} alt={`Face ${face.face_id}`} />
                  <button 
                    type="button" 
                    className={styles.removeImageButton}
                    title="Delete this image"
                    onClick={() => !isSubmitting && handleDeleteExistingFace(face.face_id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className={styles.formGroup}>
            <label>Add More Images ({newFiles.length})</label>
            <div 
              className={styles.fileDropArea}
              onClick={() => !isSubmitting && fileInputRef.current?.click()}
            >
              <UploadCloud size={30} />
              <p>Click to add new images</p>
            </div>
            <input
              type="file" ref={fileInputRef} multiple
              accept="image/jpeg, image/png, image/jpg"
              onChange={handleFileChange} style={{ display: 'none' }}
              disabled={isSubmitting}
            />
          </div>
          
          {newPreviewUrls.length > 0 && (
            <div className={styles.imagePreviewContainer}>
              {newPreviewUrls.map((url, index) => (
                <div key={index} className={styles.imagePreviewItem}>
                  <img src={url} alt={`Preview ${index + 1}`} />
                  <button type="button" className={styles.removeImageButton} onClick={() => !isSubmitting && removeNewFile(index)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className={styles.errorText}>{error}</p>}

          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={20} className={styles.spinner} /> : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};


// --- Component: หน้าหลัก ---
const ListStudentPage = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<User | null>(null);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/users`);
      if (!response.ok) throw new Error('Failed to fetch students');
      const data: User[] = await response.json();
      setStudents(data);
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleDeleteStudent = async (userId: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" (ID: ${userId})?`)) {
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/users/${userId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
         const err = await response.json();
         throw new Error(err.detail || 'Failed to delete student');
      }
      setStudents(prev => prev.filter(s => s.user_id !== userId));
    } catch (error: any) {
      console.error("Failed to delete student:", error);
      alert(`Failed to delete student: ${error.message}`);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={fetchStudents} 
      />
      
      <EditStudentModal
        isOpen={!!editingStudent} 
        onClose={() => setEditingStudent(null)}
        student={editingStudent}
        onStudentUpdated={fetchStudents}
      />
      
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>List Students</h1>
        <div className={styles.headerActions}>
          <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
            <Plus size={20} />
            <span>Add Student</span>
          </button>
          <button className={styles.settingsButton}>
            <Settings size={20} />
            <span>SETTINGS</span>
          </button>
        </div>
      </header>

      <main className={styles.studentGrid}>
        {isLoading ? (
          <p>Loading students...</p>
        ) : students.length === 0 ? (
          <p>No students found. Click "Add Student" to begin.</p>
        ) : (
          students.map((student) => (
            <StudentCard 
              key={student.user_id} 
              student={student} 
              onDelete={handleDeleteStudent}
              onEdit={setEditingStudent} 
            />
          ))
        )}
      </main>
    </div>
  );
};

export default ListStudentPage;