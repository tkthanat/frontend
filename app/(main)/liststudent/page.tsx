'use client';

import React, { useState, useEffect, useRef, FormEvent, useCallback, useMemo } from 'react';
import { Settings, Plus, Trash2, X, UploadCloud, Image as ImageIcon, Loader2, BookOpen, ChevronLeft, ExternalLink } from 'lucide-react'; // ✨ [แก้ไข] เพิ่ม ExternalLink
import styles from './liststudent.module.css';

import { useMsal } from "@azure/msal-react";
import { getAuthToken } from "../../authConfig";

import CapturePhotoModal from './capture-photo-modal'; 
import ImportStudentModal from './ImportStudentModal'; 
// ลบ SubjectFormModal/ExternalFormLinkModal ออก

const BACKEND_URL = 'http://localhost:8000';
// ✨ [ใหม่] URL ของ Google Form ที่ทำสำเนาได้ (Template Link)
const EXTERNAL_FORM_URL = "https://docs.google.com/forms/d/e/FORM_ID/viewform/TEMPLATE_FOR_COPY"; 


// --- Interfaces ---
interface UserFace { face_id: number; file_path: string; }
interface User {
  user_id: number; name: string; student_code: string | null; role: string; faces: UserFace[]; subject_id: number | null;
}
interface Subject {
  subject_id: number;
  subject_name: string;
  section?: string | null;
  academic_year?: string | null;
  student_count?: number; 
}


// --- Component: StudentCard ---
interface StudentCardProps {
  student: User;
  onDelete: (userId: number, name: string) => void;
  onEdit: (student: User) => void;
  subjectName: string | null; 
}
const StudentCard: React.FC<StudentCardProps> = ({ student, onDelete, onEdit, subjectName }) => {
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
        <span className={styles.studentName}>{student.name}</span>
        <span className={styles.studentId}>{student.student_code || 'N/A'}</span>
        <span className={styles.studentSubject}>
          {subjectName || 'No Subject Assigned'}
        </span>
      </div>
    </div>
  );
};


// --- Component: SubjectCard (ใหม่) ---
interface SubjectCardProps {
  subject: Subject;
  onClick: () => void;
}
const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onClick }) => (
    <div className={styles.subjectCard} onClick={onClick}>
      <div className={styles.cardHeader}>
        <BookOpen size={28} className={styles.cardIcon} />
        <span className={styles.cardCount}>{subject.student_count || 0} Students</span>
      </div>
      <div className={styles.cardInfo}>
        <span className={styles.cardTitle}>{subject.subject_name}</span>
        <span className={styles.cardSubtitle}>
          {subject.academic_year ? `[${subject.academic_year}] ` : ''}
          {subject.section ? `(Sec: ${subject.section})` : 'No Section'}
        </span>
      </div>
    </div>
);


// --- Component: AddStudentModal (โค้ดเดิม) ---
interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
  subjects: Subject[];
}

const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onStudentAdded, subjects }) => {
  const { instance, accounts } = useMsal();

  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  // ✨ [แก้ไข] กำหนดค่าเริ่มต้นเป็น '' ให้ตรงกับ Type (number | '')
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>(''); 
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  const [authToken, setAuthToken] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName(''); setStudentCode(''); setSelectedSubjectId(''); setUploadedFiles([]);
    setCapturedImages([]);
    setError(''); setIsSubmitting(false);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setAuthToken(null);
  }, [previewUrls]);

  useEffect(() => {
    if (!isOpen) { 
      setTimeout(resetForm, 300); 
    } else if (accounts.length > 0) {
      getAuthToken(instance, accounts[0]).then(setAuthToken).catch(() => setAuthToken(null));
    }
    return () => { previewUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [isOpen, resetForm, previewUrls, instance, accounts]);

  const updateFilesAndPreviews = useCallback((newFiles: File[], newCapturedImages: File[]) => {
    // Combine uploaded files and captured images
    const allFiles = [...newFiles, ...newCapturedImages];
    
    if (allFiles.length > 50) {
      setError("สามารถอัปโหลดได้สูงสุด 50 รูป"); 
      return false;
    }
    
    previewUrls.forEach(url => URL.revokeObjectURL(url));

    const allPreviews = allFiles.map(file => URL.createObjectURL(file));

    setUploadedFiles(newFiles);
    setCapturedImages(newCapturedImages);
    setPreviewUrls(allPreviews);
    setError('');
    return true;
  }, [previewUrls]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      const newFiles = [...uploadedFiles, ...selectedFiles];
      updateFilesAndPreviews(newFiles, capturedImages);
    }
  };

  const removeFile = (index: number) => {
    let newFiles = [...uploadedFiles];
    let newCapturedImages = [...capturedImages];
    
    const allFilesCount = uploadedFiles.length + capturedImages.length;

    if (allFilesCount - 1 < 4) {
      setError('ต้องมีรูปภาพอย่างน้อย 4 รูป');
      return;
    }
    
    if (index < uploadedFiles.length) {
      newFiles = newFiles.filter((_, i) => i !== index);
    } else {
      const capturedIndex = index - uploadedFiles.length;
      newCapturedImages = newCapturedImages.filter((_, i) => i !== capturedIndex);
    }
    
    updateFilesAndPreviews(newFiles, newCapturedImages);
  };

  const handleCapturedImage = useCallback((imageFile: File) => {
    const newCapturedImages = [...capturedImages, imageFile]; 
    updateFilesAndPreviews(uploadedFiles, newCapturedImages);
  }, [uploadedFiles, capturedImages, updateFilesAndPreviews]);
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const filesToUpload = [...uploadedFiles, ...capturedImages];
    
    if (!name.trim()) { setError('กรุณากรอกชื่อนักศึกษา'); return; }
    if (!studentCode.trim()) { setError('กรุณากรอกรหัสนักศึกษา'); return; }
    if (filesToUpload.length < 4) { setError('กรุณาอัปโหลดรูปภาพอย่างน้อย 4 รูป'); return; }
    if (!authToken) { setError("Authentication token is missing. Please re-login."); return; }

    setIsSubmitting(true);
    
    try {
      const accessToken = authToken;

      // 1. Create User
      const userResponse = await fetch(`${BACKEND_URL}/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name,
          student_code: studentCode,
          role: 'viewer', 
          subject_id: selectedSubjectId ? Number(selectedSubjectId) : null
        }),
      });
      if (!userResponse.ok) {
        const errData = await userResponse.json();
        throw new Error(errData.detail || 'Failed to create user.');
      }
      const newUserResult = await userResponse.json();
      const newUserId = newUserResult.user.user_id;
      
      // 2. Upload Images
      const uploadFormData = new FormData();
      uploadFormData.append('user_id', newUserId.toString());
      filesToUpload.forEach((file) => uploadFormData.append('images', file));

      const uploadResponse = await fetch(`${BACKEND_URL}/faces/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: uploadFormData,
      });
      if (!uploadResponse.ok) throw new Error('Failed to upload images.');

      // 3. Train
      await fetch(`${BACKEND_URL}/train/refresh`, { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
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
    <>
      <CapturePhotoModal 
        isOpen={isCaptureModalOpen} 
        onClose={() => setIsCaptureModalOpen(false)} 
        onCapture={handleCapturedImage} 
        authToken={authToken} 
        camId="entrance" 
      />
      
      {(isOpen && !isCaptureModalOpen) && ( 
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

              <div className={styles.formGroup}>
                <label>Subject (Optional)</label>
                <select
                  className={styles.controlSelect}
                  value={selectedSubjectId}
                  onChange={e => setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')}
                  disabled={isSubmitting}
                >
                  <option value="">-- Assign to a Subject --</option>
                  {subjects.map(s => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.academic_year ? `[${s.academic_year}] ` : ''}
                      {s.subject_name} {s.section ? `(Sec: ${s.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>Upload Images (Min 4)</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  
                  <button 
                    type="button" 
                    className={styles.settingsButton} 
                    onClick={() => { 
                      !isSubmitting && setIsCaptureModalOpen(true) 
                    }}
                    disabled={isSubmitting}
                    style={{ flexGrow: 1, padding: '0.75rem' }}
                  >
                    <ImageIcon size={20} /><span>Capture Photo</span>
                  </button>
                  
                  <button 
                    type="button" 
                    className={styles.settingsButton} 
                    onClick={() => !isSubmitting && fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    style={{ flexGrow: 1, padding: '0.75rem' }}
                  >
                    <UploadCloud size={20} /><span>Upload File</span>
                  </button>
                  <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} disabled={isSubmitting} />

                </div>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>({previewUrls.length} selected)</p>
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
      )}
    </>
  );
};


// --- Component: EditStudentModal (โค้ดเดิม) ---
interface EditStudentModalProps {
  student: User | null;
  isOpen: boolean;
  onClose: () => void;
  onStudentUpdated: () => void;
  subjects: Subject[];
}
const EditStudentModal: React.FC<EditStudentModalProps> = ({ student, isOpen, onClose, onStudentUpdated, subjects }) => {
  if (!student) return null;

  const { instance, accounts } = useMsal();
  
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [subjectId, setSubjectId] = useState<string>('');
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
      setSubjectId(student.subject_id?.toString() || '');
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
        setError("สามารถอัปโหลดได้สูงสุด 50 รูป"); return;
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
    if (existingFaces.length + newFiles.length <= 4) {
      setError(`ต้องมีรูปภาพอย่างน้อย 4 รูป (ห้ามลบ)`); return;
    }
    if (accounts.length === 0) {
      setError("Not logged in."); return;
    }
    
    try {
      const accessToken = await getAuthToken(instance, accounts[0]);
      
      const res = await fetch(`${BACKEND_URL}/faces/${faceId}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (!res.ok) throw new Error('Failed to delete');
      
      onStudentUpdated();
      
    } catch (err: any) { setError(err.message); }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const totalImages = existingFaces.length + newFiles.length;
    if (totalImages < 4) {
      setError(`กรุณาเพิ่มรูปภาพให้ครบอย่างน้อย 4 รูป (ขาดอีก ${4 - totalImages} รูป)`); return;
    }
    if (!name.trim()) { setError('กรุณากรอกชื่อนักศึกษา'); return; }
    if (!studentCode.trim()) { setError('กรุณากรอกรหัสนักศึกษา'); return; }
    
    if (accounts.length === 0) {
      setError("Not logged in."); return;
    }
    
    setIsSubmitting(true);
    
    try {
      const accessToken = await getAuthToken(instance, accounts[0]);
      
      const infoChanged =
        name !== student.name ||
        studentCode !== student.student_code ||
        (student.subject_id?.toString() || '') !== subjectId;
        
      const newSubjectId = subjectId ? parseInt(subjectId, 10) : null;
      let needsTrain = false;

      if (infoChanged) {
        const res = await fetch(`${BACKEND_URL}/users/${student.user_id}`, {
          method: 'PUT', 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            name,
            student_code: studentCode,
            subject_id: newSubjectId
          }),
        });
        if (!res.ok) throw new Error('Failed to update info');
        if (name !== student.name) needsTrain = true;
      }
      
      if (newFiles.length > 0) {
        const formData = new FormData();
        formData.append('user_id', student.user_id.toString());
        newFiles.forEach(f => formData.append('images', f));
        
        const res = await fetch(`${BACKEND_URL}/faces/upload`, { 
          method: 'POST', 
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          body: formData 
        });
        if (!res.ok) throw new Error('Failed to upload images');
        needsTrain = true;
      }
      
      if (needsTrain) {
        await fetch(`${BACKEND_URL}/train/refresh`, { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
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
                  {s.academic_year ? `[${s.academic_year}] ` : ''}
                  {s.subject_name} {s.section ? `(Sec: ${s.section})` : ''}
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
  const { instance, accounts } = useMsal();

  // State สำหรับการควบคุม View
  const [currentView, setCurrentView] = useState<'subjects' | 'students'>('subjects');
  const [students, setStudents] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false); 
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  const subjectMap = useMemo(() => {
    const map = new Map<number, string>();
    subjects.forEach(s => {
      const displayName = `${s.academic_year ? `[${s.academic_year}] ` : ''}${s.subject_name}${s.section ? ` (Sec: ${s.section})` : ''}`;
      map.set(s.subject_id, displayName);
    });
    return map;
  }, [subjects]); 
  
  const filteredStudents = useMemo(() => {
      if (currentView === 'subjects') return [];
      // กรองนักศึกษาตาม Subject ที่ถูกเลือก
      return students.filter(s => s.subject_id === selectedSubjectId);
  }, [students, selectedSubjectId, currentView]);


  const fetchStudents = useCallback(async (subjectId?: number) => {
    if (accounts.length === 0) return;
    
    try {
      const accessToken = await getAuthToken(instance, accounts[0]);
      const headers = { 'Authorization': `Bearer ${accessToken}` };
      
      // ถ้ามีการส่ง subjectId มา ให้ดึงเฉพาะนักศึกษาของ Subject นั้น
      const params = subjectId ? `?subject_id=${subjectId}` : '';
      const res = await fetch(`${BACKEND_URL}/users${params}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch students');
      
      setStudents(await res.json());
    } catch (err) { 
      console.error(err); 
      setStudents([]);
    }
  }, [instance, accounts]); 

  const fetchSubjects = useCallback(async () => {
    if (accounts.length === 0) return;
    
    try {
      const accessToken = await getAuthToken(instance, accounts[0]);
      const headers = { 'Authorization': `Bearer ${accessToken}` };
      
      const res = await fetch(`${BACKEND_URL}/subjects`, { headers });
      if (!res.ok) throw new Error('Failed to fetch subjects');
      
      const subjectList: Subject[] = await res.json();
      
      // ดึง Student Count สำหรับ Subject Cards
      const subjectsWithCount = await Promise.all(subjectList.map(async (s) => {
        // ใช้ fetchStudents เพื่อดึงจำนวนนักศึกษา
        const countRes = await fetch(`${BACKEND_URL}/subjects/${s.subject_id}/student_count`, { headers });
        if (countRes.ok) {
          const countData = await countRes.json();
          return { ...s, student_count: countData.total_students };
        }
        return s;
      }));
      
      setSubjects(subjectsWithCount);
    } catch (err) { 
      console.error(err); 
      setSubjects([]);
    }
  }, [instance, accounts]); 

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      if (accounts.length > 0) {
        await Promise.all([
          fetchSubjects(),
          // โหลดนักศึกษาทั้งหมด (ไม่ใส่ subjectId) เพื่อใช้ใน EditModal/AddModal
          fetchStudents() 
        ]);
        setIsLoading(false);
      }
    };
    loadData();
  }, [fetchStudents, fetchSubjects, accounts]); 

  const handleDataUpdated = () => {
    // เมื่อมีการอัปเดตข้อมูล ให้รีเฟรชข้อมูล Subject และ Student
    fetchSubjects();
    fetchStudents(selectedSubjectId || undefined);
  };

  const handleNavigateToSubject = (subjectId: number) => {
      setSelectedSubjectId(subjectId);
      setCurrentView('students');
      fetchStudents(subjectId); // ดึงเฉพาะนักศึกษาใน Subject นั้น
  };
  
  const handleBackToSubjects = () => {
      setCurrentView('subjects');
      setSelectedSubjectId(null);
      fetchStudents(); // โหลดนักศึกษาทั้งหมดอีกครั้ง
      fetchSubjects(); 
  }

  const handleDelete = async (id: number, name: string) => {
      if (!confirm(`Delete "${name}"?`)) return;
    
      if (accounts.length === 0) {
        alert("Not logged in."); return;
      }
      
      try {
        const accessToken = await getAuthToken(instance, accounts[0]);
        
        const res = await fetch(`${BACKEND_URL}/users/${id}`, { 
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (!res.ok) throw new Error('Failed to delete');
        // อัปเดต State โดยกรองนักศึกษาที่ถูกลบออก และรีเฟรช Subject Count
        setStudents(prev => prev.filter(s => s.user_id !== id));
        fetchSubjects(); 
      } catch (err: any) { alert(err.message); }
  };

  const currentSubject = subjects.find(s => s.subject_id === selectedSubjectId);
  const currentSubjectName = currentSubject ? subjectMap.get(currentSubject.subject_id) : 'All Students';


  // --- Render ---
  return (
    <div className={styles.pageContainer}>
      <AddStudentModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onStudentAdded={handleDataUpdated} subjects={subjects} />
      <EditStudentModal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} student={editingStudent} onStudentUpdated={handleDataUpdated} subjects={subjects} />
      {/* Import Modal */}
      <ImportStudentModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImportSuccess={handleDataUpdated} subjects={subjects} />

      <header className={styles.header}>
        <h1 className={styles.headerTitle}>
            {currentView === 'subjects' ? 'Manage Subjects & Roster' : (
                <button className={styles.backButton} onClick={handleBackToSubjects}>
                    <ChevronLeft size={24} />
                    {currentSubjectName}
                </button>
            )}
        </h1>
        <div className={styles.headerActions}>
           
           {/* ✨ [ใหม่] ปุ่มลิงก์ภายนอก */}
           {currentView === 'subjects' && (
             <a 
               href={"https://docs.google.com/forms/d/1CwqFKXeUwgAhlgDdirAoKOhSN1cMvZ3VzZDFGXKuOkw/edit"} 
               target="_blank" 
               rel="noopener noreferrer" 
               className={styles.settingsButton} 
               style={{ backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}
             >
                <ExternalLink size={20} /><span>Open Registration Form</span> 
             </a>
           )}

           <button className={styles.settingsButton} onClick={() => setIsImportModalOpen(true)}>
             <UploadCloud size={20} /><span>Import Students</span> 
           </button>
           
           <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
                <Plus size={20} /><span>Add Student</span>
           </button>
           
          <button className={styles.settingsButton}><Settings size={20} /><span>SETTINGS</span></button>
        </div>
      </header>

      <main className={styles.studentGrid}>
        {isLoading ? <p>Loading...</p> : (
            currentView === 'subjects' ? (
                // --- Subject View ---
                subjects.map(s => (
                    <SubjectCard 
                        key={s.subject_id} 
                        subject={s} 
                        onClick={() => handleNavigateToSubject(s.subject_id)} 
                    />
                ))
            ) : (
                // --- Student View ---
                filteredStudents.length === 0 ? (
                    <p>No students registered in this subject.</p>
                ) : (
                    filteredStudents.map(s => {
                        const subjectName = s.subject_id ? subjectMap.get(s.subject_id) || null : null;
                        return (
                            <StudentCard 
                                key={s.user_id} 
                                student={s} 
                                subjectName={subjectName} 
                                onDelete={handleDelete} 
                                onEdit={setEditingStudent} 
                            />
                        );
                    })
                )
            )
        )}
      </main>
    </div>
  );
};

export default ListStudentPage;