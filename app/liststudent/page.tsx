import React from 'react';
import { Settings } from 'lucide-react';
import styles from './liststudent.module.css';

// Mock Data
const studentData = [
  { id: '2210511101036', name: 'Deaw' },
  { id: '2210511101021', name: 'Kahnoon' },
  { id: '2210511101045', name: 'Bank' },
  { id: '2210511101011', name: 'Somchai' },
  { id: '2210511101012', name: 'Somsri' },
  { id: '2210511101013', name: 'Bordin' },
  { id: '2210511101014', name: 'Alice' },
  { id: '2210511101015', name: 'Bob' },
];

const StudentCard = ({ student }: { student: { id: string; name: string } }) => (
  <div className={styles.studentCard}>
    <div className={styles.imageGrid}>
      <div className={styles.imagePlaceholder}></div>
      <div className={styles.imagePlaceholder}></div>
      <div className={styles.imagePlaceholder}></div>
      <div className={styles.imagePlaceholder}></div>
    </div>
    <div className={styles.studentInfo}>
      <span>{student.id}</span>
      <span>{student.name}</span>
    </div>
  </div>
);


const ListStudentPage = () => {
  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>List Students</h1>
        <button className={styles.settingsButton}>
          <Settings size={20} />
          <span>SETTINGS</span>
        </button>
      </header>

      {/* Grid show ListStudent */}
      <main className={styles.studentGrid}>
        {studentData.map((student) => (
          <StudentCard key={student.id} student={student} />
        ))}
      </main>
    </div>
  );
};

export default ListStudentPage;