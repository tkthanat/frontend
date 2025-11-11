'use client';

import React, { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { Settings, Plus, Trash2, X, UploadCloud, Image as ImageIcon, Loader2 } from 'lucide-react';
import styles from './liststudent.module.css';

// URL ของ Backend (FastAPI)
const BACKEND_URL = 'http://localhost:8000';

// --- Interfaces ---
interface UserFace {
  face_id: number;
  file_path: string;
}

// ✨ [แก้ไข] เพิ่ม subject_id
interface User {
  user_id: number;
  name: string;
  student_code: string | null;
  role: string;
  faces: UserFace[];
  subject_id: number | null; // (เพิ่ม)
}

// ✨ [เพิ่ม] Interface สำหรับ Subject
interface Subject {
  subject_id: number;
  subject_name: string;
  section?: string | null;
}

// --- Component: StudentCard ---
interface StudentCardProps {
  student: User;
  onDelete: (userId: number, name: string) => void;
  onEdit: (student: User) => void;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, onDelete, onEdit }) => {
  const gridFaces = student.faces.slice(0, 4);
  const placeholders = new Array(Math.max(0, 4 - gridFaces.length)).fill(null);

  return (
    <div className={styles.studentCard} onClick={() => onEdit(student)}>
      <button
        className={styles.deleteButton}
        onClick={(e) => { e.stopPropagation(); onDelete(student.user_id, student.name); }}
        title="Delete Student"
      >
        <Trash2 size={16} />
      </button>

      <div className={styles.imageGrid}>
        {gridFaces.map(face => (
          <img
            key={face.face_id}
            src={`${BACKEND_URL}/static/faces/train/${student.user_id}/${encodeURIComponent(face.file_path)}`}
            alt={student.name}
            className={styles.studentImage}
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.png'; }}
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
  subjects: Subject[]; // ✨ [เพิ่ม] รับ props subjects
}

const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onStudentAdded, subjects }) => {
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [subjectId, setSubjectId] = useState<string>(''); // ✨ [เพิ่ม] State สำหรับ Subject
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setName('');
    setStudentCode('');
    setSubjectId(''); // ✨ [เพิ่ม] Reset
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
      setFiles(prev => [...prev, ...selectedFiles]);
      const newUrls = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newUrls]);
      setError('');
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    const urlToRemove = previewUrls[index];
    URL.revokeObjectURL(urlToRemove);
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('กรุณากรอกชื่อนักศึกษา'); return; }
    if (!studentCode.trim()) { setError('กรุณากรอกรหัสนักศึกษา'); return; }
    if (files.length < 4) { setError('กรุณาอัปโหลดรูปภาพอย่างน้อย 4 รูป'); return; }
    setIsSubmitting(true);

    try {
      // ✨ [แก้ไข] ส่ง subject_id ไปด้วย
      const userResponse = await fetch(`${BACKEND_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          student_code: studentCode,
          role: 'viewer',
          subject_id: subjectId ? parseInt(subjectId, 10) : null // (ส่ง ID)
        }),
      });
      if (!userResponse.ok) {
        const errData = await userResponse.json();
        throw new Error(errData.detail || 'Failed to create user.');
      }
      const newUserResult = await userResponse.json();
      const uploadFormData = new FormData();
      uploadFormData.append('user_id', newUserResult.user.user_id.toString());
      files.forEach((file) => uploadFormData.append('images', file));

      const uploadResponse = await fetch(`${BACKEND_URL}/faces/upload`, {
        method: 'POST',
        body: uploadFormData,
      });
      if (!uploadResponse.ok) throw new Error('Failed to upload images.');

      await fetch(`${BACKEND_URL}/train/refresh`, { method: 'POST' });
      onStudentAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setIsSubmitting(false);
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
            <label>Student ID</label>
            <input type="text" value={studentCode} onChange={(e) => /^[0-9]*$/.test(e.target.value) && setStudentCode(e.target.value)} inputMode="numeric" disabled={isSubmitting} />
          </div>
          <div className={styles.formGroup}>
            <label>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={isSubmitting} />
          </div>

          {/* ✨ [เพิ่ม] Dropdown เลือกวิชา */}
          <div className={styles.formGroup}>
            <label>Subject (Optional)</label>
            <select
              className={styles.controlSelect}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">-- Assign to a Subject --</option>
              {subjects.map(s => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.subject_name} {s.section ? `(${s.section})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Upload Images (Min 4)</label>
            <div className={styles.fileDropArea} onClick={() => !isSubmitting && fileInputRef.current?.click()}>
              <UploadCloud size={40} /><p>Click to upload</p><p>({files.length} selected)</p>
            </div>
            <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} disabled={isSubmitting} />
          </div>
          {previewUrls.length > 0 && (
            <div className={styles.imagePreviewContainer}>
              {previewUrls.map((url, index) => (
                <div key={index} className={styles.imagePreviewItem}>
                  <img src={url} alt="Preview" />
                  <button type="button" className={styles.removeImageButton} onClick={() => !isSubmitting && removeFile(index)}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
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
  subjects: Subject[]; // ✨ [เพิ่ม] รับ props subjects
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({ student, isOpen, onClose, onStudentUpdated, subjects }) => {
  if (!student) return null;
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [subjectId, setSubjectId] = useState<string>(''); // ✨ [เพิ่ม] State สำหรับ Subject
  const [existingFaces, setExistingFaces] = useState<UserFace[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviewUrls, setNewPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (student && isOpen) {
      setName(student.name);
      setStudentCode(student.student_code || '');
      setSubjectId(student.subject_id?.toString() || ''); // ✨ [เพิ่ม] Set ค่า Subject
      setExistingFaces(student.faces || []);
      setNewFiles([]);
      setNewPreviewUrls([]);
      setError('');
    }
  }, [student, isOpen]);

  useEffect(() => {
    return () => { newPreviewUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [newPreviewUrls]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      if (existingFaces.length + newFiles.length + selectedFiles.length > 50) {
        setError("สามารถอัปโหลดได้สูงสุด 50 รูป");
        return;
      }
      setNewFiles(prev => [...prev, ...selectedFiles]);
      const newUrls = selectedFiles.map(file => URL.createObjectURL(file));
      setNewPreviewUrls(prev => [...prev, ...newUrls]);
      setError('');
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(newPreviewUrls[index]);
    setNewPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExistingFace = async (faceId: number) => {
    if (!window.confirm("Delete this image?")) return;

    // ✨ [แก้ไข] แก้เงื่อนไขเป็นอย่างน้อย 4 รูป
    if (existingFaces.length + newFiles.length <= 4) {
      setError(`ต้องมีรูปภาพอย่างน้อย 4 รูป (ห้ามลบ)`);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/faces/${faceId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setExistingFaces(prev => prev.filter(f => f.face_id !== faceId));
      setError('');
    } catch (err: any) { setError(err.message); }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const totalImages = existingFaces.length + newFiles.length;

    if (totalImages < 4) {
      setError(`กรุณาเพิ่มรูปภาพให้ครบอย่างน้อย 4 รูป (ขาดอีก ${4 - totalImages} รูป)`);
      return;
    }

    if (!name.trim()) { setError('กรุณากรอกชื่อนักศึกษา'); return; }
    if (!studentCode.trim()) { setError('กรุณากรอกรหัสนักศึกษา'); return; }

    setIsSubmitting(true);
    try {
      // ✨ [แก้ไข] ตรวจสอบว่ามีอะไรเปลี่ยนบ้าง
      const infoChanged =
        name !== student.name ||
        studentCode !== student.student_code ||
        (student.subject_id?.toString() || '') !== subjectId;
        
      const newSubjectId = subjectId ? parseInt(subjectId, 10) : null;
      let needsTrain = false;

      if (infoChanged) {
        const res = await fetch(`${BACKEND_URL}/users/${student.user_id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            student_code: studentCode,
            subject_id: newSubjectId
          }),
        });
        if (!res.ok) throw new Error('Failed to update info');
        // (ถ้าเปลี่ยนชื่อ หรือ ย้ายวิชา ก็ควร Train ใหม่)
        if (name !== student.name) needsTrain = true;
      }
      
      if (newFiles.length > 0) {
        const formData = new FormData();
        formData.append('user_id', student.user_id.toString());
        newFiles.forEach(f => formData.append('images', f));
        const res = await fetch(`${BACKEND_URL}/faces/upload`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Failed to upload images');
        needsTrain = true; // (เพิ่มรูปใหม่ ต้อง Train)
      }
      
      // (Train ครั้งเดียวถ้าจำเป็น)
      if (needsTrain) {
        await fetch(`${BACKEND_URL}/train/refresh`, { method: 'POST' });
      }
      
      onStudentUpdated(); onClose();
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
        <h2>Edit Student</h2>
        <form onSubmit={handleSave} className={styles.modalForm}>
          <div className={styles.formGroup}><label>Student ID</label><input type="text" value={studentCode} onChange={e => /^[0-9]*$/.test(e.target.value) && setStudentCode(e.target.value)} disabled={isSubmitting} /></div>
          <div className={styles.formGroup}><label>Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} disabled={isSubmitting} /></div>

          {/* ✨ [เพิ่ม] Dropdown เลือกวิชา */}
          <div className={styles.formGroup}>
            <label>Subject</label>
            <select
              className={styles.controlSelect}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">-- Assign to a Subject --</option>
              {subjects.map(s => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.subject_name} {s.section ? `(${s.section})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Existing Images ({existingFaces.length})</label>
            <div className={styles.imagePreviewContainer}>
              {existingFaces.map(face => (
                <div key={face.face_id} className={styles.imagePreviewItem}>
                  <img src={`${BACKEND_URL}/static/faces/train/${student.user_id}/${encodeURIComponent(face.file_path)}`} alt="Face" />
                  <button type="button" className={styles.removeImageButton} onClick={() => !isSubmitting && handleDeleteExistingFace(face.face_id)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Add More Images</label>
            <div className={styles.fileDropArea} onClick={() => !isSubmitting && fileInputRef.current?.click()}><UploadCloud size={30} /><p>Click to add</p></div>
            <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} disabled={isSubmitting} />
          </div>
          {newPreviewUrls.length > 0 && (
            <div className={styles.imagePreviewContainer}>
              {newPreviewUrls.map((url, i) => (
                <div key={i} className={styles.imagePreviewItem}><img src={url} alt="New" /><button type="button" className={styles.removeImageButton} onClick={() => removeNewFile(i)}><X size={14} /></button></div>
              ))}
            </div>
          )}

          {error && <p className={styles.errorText}>{error}</p>}
          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>{isSubmitting ? <Loader2 className={styles.spinner} /> : 'Save Changes'}</button>
        </form>
      </div>
    </div>
  );
};

// --- Page Component ---
const ListStudentPage = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]); // ✨ [เพิ่ม] State
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<User | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/users`);
      if (!res.ok) throw new Error('Failed to fetch students');
      setStudents(await res.json());
    } catch (err) { 
      console.error(err); 
      setStudents([]); // (Set เป็นค่าว่างถ้า Error)
    }
  }, []);

  // ✨ [เพิ่ม] ฟังก์ชันดึง Subjects
  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/subjects`);
      if (!res.ok) throw new Error('Failed to fetch subjects');
      setSubjects(await res.json());
    } catch (err) { 
      console.error(err); 
      setSubjects([]); // (Set เป็นค่าว่างถ้า Error)
    }
  }, []);

  // ✨ [แก้ไข] ให้ดึง 2 อย่างพร้อมกัน
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchStudents(),
        fetchSubjects()
      ]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchStudents, fetchSubjects]);

  // (รวม Callback 2 อัน)
  const handleDataUpdated = () => {
    fetchStudents();
    fetchSubjects();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setStudents(prev => prev.filter(s => s.user_id !== id));
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className={styles.pageContainer}>
      {/* ✨ [แก้ไข] ส่ง prop 'subjects' เข้าไป */}
      <AddStudentModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onStudentAdded={handleDataUpdated} subjects={subjects} />
      <EditStudentModal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} student={editingStudent} onStudentUpdated={handleDataUpdated} subjects={subjects} />

      <header className={styles.header}>
        <h1 className={styles.headerTitle}>List Students</h1>
        <div className={styles.headerActions}>
          <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}><Plus size={20} /><span>Add Student</span></button>
          <button className={styles.settingsButton}><Settings size={20} /><span>SETTINGS</span></button>
        </div>
      </header>

      <main className={styles.studentGrid}>
        {isLoading ? <p>Loading...</p> : students.length === 0 ? <p>No students found.</p> :
          students.map(s => <StudentCard key={s.user_id} student={s} onDelete={handleDelete} onEdit={setEditingStudent} />)
        }
      </main>
    </div>
  );
};

export default ListStudentPage;