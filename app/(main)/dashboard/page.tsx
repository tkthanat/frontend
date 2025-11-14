'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import styles from './dashboard.module.css';
import { 
  Loader2, Users, BarChart, Clock, PieChart, TrendingUp, Calendar, ChevronDown, 
  CheckCircle, XCircle, AlertTriangle, Download
} from 'lucide-react';

// (Import Chart.js components)
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  PointElement, LineElement, ArcElement,
} from 'chart.js';

// Import Library สำหรับ Export
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// (ลงทะเบียน Components ของ Chart.js)
ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  PointElement, LineElement, ArcElement
);

// ⭐️ [ นี่คือบรรทัดที่เพิ่มเข้ามา ] ⭐️
ChartJS.defaults.color = '#000000'; // (ตั้งค่าสีตัวอักษรเริ่มต้นของกราฟทั้งหมดเป็นสีดำ)


// --- Interfaces (กำหนดโครงสร้างข้อมูลที่คาดหวังจาก API ใหม่) ---
const BACKEND_URL = 'http://localhost:8000';

interface ISubject {
  id: string;
  name: string; // e.g., "[2024] SP405 (Sec: 1)"
}

// === 1. Semester Overview Data ===
interface ISemesterOverviewData {
  kpis: {
    totalRoster: number;
    avgAttendance: number; // (88.5)
    avgLateness: number;   // (12)
    sessionsTaught: number;
  };
  trendGraph: { // 1B. กราฟแนวโน้ม
    labels: string[]; // ["Week 1", "Week 2", ...]
    datasets: [{
      label: '% การเข้าเรียน',
      data: number[]; // [90, 85, 88, ...]
      borderColor: string;
      fill: boolean;
    }];
  };
  studentsAtRisk: { // 1C. ตารางนักศึกษา
    studentId: string;
    name: string;
    absences: number;
    lates: number;
  }[];
}

// === 2. Session-Specific View Data ===
interface ISessionViewData {
  kpis: {
    present: number;
    total: number;
    absent: number;
    late: number;
  };
  summaryDonut: { // 2B. กราฟสรุป
    labels: string[]; // ["เข้าเรียน (ตรงเวลา)", "มาสาย", "ขาด"]
    datasets: [{
      data: number[]; // [23, 5, 2]
      backgroundColor: string[];
    }];
  };
  arrivalHistogram: { // 2C. กราฟการกระจายเวลา
    labels: string[]; // ["08:50", "09:00", "09:10", ...]
    datasets: [{
      label: 'จำนวนนักเรียน',
      data: number[];
      backgroundColor: string;
    }];
  };
  liveDataTable: { // 2D. ตารางข้อมูลสด
    studentId: string;
    name: string;
    status: "Present" | "Late" | "Absent";
    checkIn: string | null; // "09:01"
    checkOut: string | null; // "11:58"
    duration: string | null; // "177" (นาที)
  }[];
}

// --- Component: StatCard ---
const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className={styles.statCard}>
    <div className={styles.statIcon}>{icon}</div>
    <div className={styles.statContent}>
      <span className={styles.statTitle}>{title}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  </div>
);

// --- Component: ChartContainer ---
const ChartContainer: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`${styles.chartContainer} ${className}`}>
    <h3 className={styles.chartTitle}>{title}</h3>
    <div className={styles.chartContent}>
      {children}
    </div>
  </div>
);

// --- Component: ตารางนักศึกษาที่ต้องติดตาม (1C) ---
const StudentsAtRiskTable: React.FC<{ data: ISemesterOverviewData['studentsAtRisk'] }> = ({ data }) => (
  <div className={styles.tableContainer}>
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>ชื่อ-สกุล</th>
          <th>รหัสนักศึกษา</th>
          <th>ขาด (Absences)</th>
          <th>สาย (Lates)</th>
        </tr>
      </thead>
      <tbody>
        {data.map(student => (
          <tr key={student.studentId}>
            <td>{student.name}</td>
            <td>{student.studentId}</td>
            <td>{student.absences} ครั้ง</td>
            <td>{student.lates} ครั้ง</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// --- Component: ตารางข้อมูลสด (2D) ---
const LiveSessionTable: React.FC<{ data: ISessionViewData['liveDataTable'] }> = ({ data }) => (
  <div className={styles.tableContainer}>
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>ชื่อ-สกุล</th>
          <th>สถานะ</th>
          <th>เวลาเข้า</th>
          <th>เวลาออก</th>
          <th>ระยะเวลา (นาที)</th>
        </tr>
      </thead>
      <tbody>
        {data.map(student => (
          <tr key={student.studentId}>
            <td>{student.name}</td>
            <td>
              <span className={`${styles.statusBadge} ${styles[student.status.toLowerCase()]}`}>
                {student.status === 'Present' && <CheckCircle size={14} />}
                {student.status === 'Late' && <AlertTriangle size={14} />}
                {student.status === 'Absent' && <XCircle size={14} />}
                {student.status}
              </span>
            </td>
            <td>{student.checkIn || '---'}</td>
            <td>{student.checkOut || '---'}</td>
            <td>{student.duration || '---'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// --- Component: หน้าหลัก Dashboard ---
const FacultyDashboardPage = () => {
  // --- State สำหรับ Filters ---
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // --- State สำหรับ Data Section 1 ---
  const [semesterData, setSemesterData] = useState<ISemesterOverviewData | null>(null);
  const [isSemesterLoading, setIsSemesterLoading] = useState(true);

  // --- State สำหรับ Data Section 2 ---
  const [sessionData, setSessionData] = useState<ISessionViewData | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  // --- State และ Ref สำหรับ Export ---
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const contentAreaRef = useRef<HTMLDivElement>(null); // (Ref สำหรับหุ้มเนื้อหา)

  // --- Fetching Data ---

  // (1) Fetch รายวิชา (Subjects) ตอนโหลดหน้า
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/faculty/subjects`);
        if (!response.ok) throw new Error('Failed to fetch subjects');
        const data: ISubject[] = await response.json();
        
        setSubjects(data);
        if (data.length > 0) {
          setSelectedSubject(data[0].id);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };
    fetchSubjects();
  }, []); 

  // (2) Fetch ข้อมูลภาพรวมเทอม (Section 1) เมื่อ "วิชา" เปลี่ยน
  useEffect(() => {
    if (!selectedSubject) return;

    const fetchSemesterData = async () => {
      setIsSemesterLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/faculty/semester-overview?subjectId=${selectedSubject}`);
        if (!response.ok) throw new Error('Failed to fetch semester data');
        const data: ISemesterOverviewData = await response.json();

        setSemesterData(data);

      } catch (error) {
        console.error("Error fetching semester data:", error);
        setSemesterData(null); 
      } finally {
        setIsSemesterLoading(false);
      }
    };
    
    fetchSemesterData();
  }, [selectedSubject]); 

  // (3) Fetch ข้อมูลรายคาบ (Section 2) เมื่อ "วิชา" หรือ "วันที่" เปลี่ยน
  useEffect(() => {
    if (!selectedSubject || !selectedDate) return;

    const fetchSessionData = async () => {
      setIsSessionLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/faculty/session-view?subjectId=${selectedSubject}&date=${selectedDate}`);
        if (!response.ok) throw new Error('Failed to fetch session data');
        const data: ISessionViewData = await response.json();
        
        setSessionData(data);

      } catch (error) {
        console.error("Error fetching session data:", error);
        setSessionData(null); 
      } finally {
        setIsSessionLoading(false);
      }
    };
    
    fetchSessionData();
  }, [selectedSubject, selectedDate]); 


  // --- ฟังก์ชัน Export ---
  const handleExport = async (format: 'pdf' | 'png' | 'summary_xlsx' | 'raw_logs_xlsx') => {
    setShowExportMenu(false);

    // --- (A. Visual Formats - PDF/PNG) ---
    if (format === 'pdf' || format === 'png') {
      if (!contentAreaRef.current) {
        alert("Error: Cannot find dashboard content.");
        return;
      }
      
      console.log(`Exporting visual as ${format}...`);
      setIsExporting(true);

      try {
        const canvas = await html2canvas(contentAreaRef.current, {
          useCORS: true,
          scale: 2,
        });
        
        const imgData = canvas.toDataURL('image/png');

        if (format === 'png') {
          const link = document.createElement('a');
          link.download = `faculty_report_${selectedSubject}.png`;
          link.href = imgData;
          link.click();
        } 
        else if (format === 'pdf') {
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          const ratio = canvasWidth / pdfWidth;
          const pdfImgHeight = canvasHeight / ratio;

          let position = 0;
          if (pdfImgHeight > pdfHeight) {
            let tempHeight = pdfImgHeight;
            while(tempHeight > 0) {
              pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
              tempHeight -= pdfHeight;
              position -= pdfHeight;
              if (tempHeight > 0) pdf.addPage();
            }
          } else {
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfImgHeight);
          }
          pdf.save(`faculty_report_${selectedSubject}.pdf`);
        }

      } catch (err) {
        console.error("Failed to create visual export:", err);
        alert("Failed to create visual export.");
      } finally {
        setIsExporting(false);
      }
      return;
    }

    // --- (B. Raw Log Format - API เดิม) ---
    if (format === 'raw_logs_xlsx') {
      console.log(`Exporting all raw logs as XLSX...`);
      const params = new URLSearchParams();
      params.append("format", "xlsx");
      
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
      return;
    }
    
    // --- (C. Summary Data Format - [ปรับปรุงใหม่!]) ---
    if (format === 'summary_xlsx') {
      if (!semesterData || !sessionData) {
        alert("Data is not fully loaded. Cannot export summary.");
        return;
      }
      console.log('Exporting summary data as XLSX...');
      setIsExporting(true);
      
      try {
        const wb = utils.book_new();

        // Sheet 1: Semester KPIs
        const ws_sem_kpi = utils.json_to_sheet([
          { "Metric": "Total Roster", "Value": semesterData.kpis.totalRoster, "Unit": "คน" },
          { "Metric": "Avg. Attendance", "Value": semesterData.kpis.avgAttendance, "Unit": "%" },
          { "Metric": "Avg. Lateness", "Value": semesterData.kpis.avgLateness, "Unit": "%" },
          { "Metric": "Sessions Taught", "Value": semesterData.kpis.sessionsTaught, "Unit": "คาบ" },
        ]);
        utils.book_append_sheet(wb, ws_sem_kpi, "Semester KPIs");

        // Sheet 2: Semester Trend
        const sem_trend_data = semesterData.trendGraph.labels.map((label, index) => ({
          "Week": label,
          "Attendance (%)": semesterData.trendGraph.datasets[0].data[index]
        }));
        const ws_sem_trend = utils.json_to_sheet(sem_trend_data);
        utils.book_append_sheet(wb, ws_sem_trend, "Semester Trend");
        
        // Sheet 3: Students at Risk
        const ws_sem_risk = utils.json_to_sheet(semesterData.studentsAtRisk);
        utils.book_append_sheet(wb, ws_sem_risk, "Students at Risk");

        // Sheet 4: Session KPIs (for selected date)
        const ws_ses_kpi = utils.json_to_sheet([
          { "Metric": "Date", "Value": selectedDate },
          { "Metric": "Present", "Value": sessionData.kpis.present },
          { "Metric": "Absent", "Value": sessionData.kpis.absent },
          { "Metric": "Late", "Value": sessionData.kpis.late },
          { "Metric": "Total", "Value": sessionData.kpis.total },
        ]);
        utils.book_append_sheet(wb, ws_ses_kpi, "Session KPIs");

        // Sheet 5: Session Arrival
        const ses_arrival_data = sessionData.arrivalHistogram.labels.map((label, index) => ({
          "Time": label,
          "Student Count": sessionData.arrivalHistogram.datasets[0].data[index]
        }));
        const ws_ses_arrival = utils.json_to_sheet(ses_arrival_data);
        utils.book_append_sheet(wb, ws_ses_arrival, "Session Arrival");
        
        // Sheet 6: Session Live Table
        const ws_ses_live = utils.json_to_sheet(sessionData.liveDataTable);
        utils.book_append_sheet(wb, ws_ses_live, "Session Live Table");

        // บันทึกไฟล์
        writeFile(wb, `Faculty_Summary_${selectedSubject}_${selectedDate}.xlsx`);

      } catch (err) {
        console.error("Failed to create summary export:", err);
        alert("Failed to create summary export.");
      } finally {
        setIsExporting(false);
      }
      return;
    }
  };


  // --- Render ---
  return (
    <div className={styles.pageContainer}>
      
      {/* Overlay ตอนกำลัง Export */}
      {isExporting && (
        <div className={styles.exportLoadingOverlay}>
          <Loader2 className={styles.spinner} />
          <p>Generating Report...</p>
        </div>
      )}
      
      {/* Header (Title + Export Button) */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Faculty Dashboard</h1>

        <div className={styles.exportControls}>
          <div style={{ position: 'relative' }}>
            <button 
              className={styles.exportButton} 
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
            >
              <Download size={16} />
              <span>Export Report</span>
            </button>
            
            {showExportMenu && (
              <div className={styles.exportMenu}>
                <button onClick={() => handleExport('pdf')}>Export Visual as .pdf</button>
                <button onClick={() => handleExport('png')}>Export Visual as .png</button>
                <hr className={styles.menuSeparator} />
                <button onClick={() => handleExport('summary_xlsx')}>Export Summary as .xlsx</button>
                <button onClick={() => handleExport('raw_logs_xlsx')}>Export Raw Logs as .xlsx</button>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* === 1. ส่วนควบคุมหลัก (Global Filters) === */}
      <div className={styles.filtersContainer}>
        <div className={styles.filterGroup}>
          <label htmlFor="subject-select">
            <ChevronDown size={16} /> วิชา (Subject):
          </label>
          <select 
            id="subject-select" 
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="date-picker">
            <Calendar size={16} /> วันที่ (Date):
          </label>
          <input 
            type="date" 
            id="date-picker"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* === เนื้อหา Dashboard (สำหรับ Export) === */}
      <div ref={contentAreaRef}>
        <hr className={styles.sectionSeparator} />

        {/* === 2. (Mockup แท็บ 1) ภาพรวมวิชา (Semester Overview) === */}
        <section>
          <h2 className={styles.sectionTitle}>ภาพรวมวิชา (Semester Overview)</h2>
          {isSemesterLoading ? (
            <div className={styles.loadingBox}><Loader2 className={styles.spinner} /> Loading...</div>
          ) : !semesterData ? (
            <p>No data available for this semester.</p>
          ) : (
            <>
              {/* 1A. KPI สรุปทั้งเทอม */}
              <div className={styles.statsGrid}>
                <StatCard title="นักเรียนทั้งหมด (Total Roster)" value={`${semesterData.kpis.totalRoster} คน`} icon={<Users size={24} />} />
                <StatCard title="อัตราเข้าเรียนเฉลี่ย (Avg. Attendance)" value={`${semesterData.kpis.avgAttendance}%`} icon={<BarChart size={24} />} />
                <StatCard title="อัตรามาสายเฉลี่ย (Avg. Lateness)" value={`${semesterData.kpis.avgLateness}%`} icon={<Clock size={24} />} />
                <StatCard title="จำนวนคาบที่สอนแล้ว (Sessions Taught)" value={`${semesterData.kpis.sessionsTaught} คาบ`} icon={<TrendingUp size={24} />} />
              </div>

              {/* 1B. กราฟแนวโน้ม */}
              <ChartContainer title="แนวโน้มการเข้าเรียน (Attendance Trend Over Semester)" className={styles.fullWidthContainer}>
                <Line data={semesterData.trendGraph} options={{ responsive: true, maintainAspectRatio: false }} />
              </ChartContainer>

              {/* 1C. ตารางนักศึกษาที่ต้องติดตาม */}
              <ChartContainer title="นักศึกษาที่ขาด/สาย บ่อยที่สุด (Top 5)" className={styles.fullWidthContainer}>
                <StudentsAtRiskTable data={semesterData.studentsAtRisk} />
              </ChartContainer>
            </>
          )}
        </section>

        <hr className={styles.sectionSeparator} />

        {/* === 3. (Mockup แท็บ 2) สรุปรายคาบ (Session-Specific View) === */}
        <section>
          <h2 className={styles.sectionTitle}>สรุปรายคาบ (Session-Specific View)</h2>
          <p className={styles.sectionSubtitle}>ข้อมูลสำหรับวันที่: {new Date(selectedDate).toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
          
          {isSessionLoading ? (
            <div className={styles.loadingBox}><Loader2 className={styles.spinner} /> Loading...</div>
          ) : !sessionData ? (
            <p>No data available for this session.</p>
          ) : (
            <>
              {/* 2A. KPI สรุปประจำคาบ */}
              <div className={styles.statsGrid} style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
                <StatCard title="เข้าเรียน (Present)" value={`${sessionData.kpis.present} / ${sessionData.kpis.total} คน`} icon={<CheckCircle size={24} />} />
                <StatCard title="ขาดเรียน (Absent)" value={`${sessionData.kpis.absent} คน`} icon={<XCircle size={24} />} />
                <StatCard title="มาสาย (Late)" value={`${sessionData.kpis.late} คน`} icon={<AlertTriangle size={24} />} />
              </div>

              {/* 2B. กราฟสรุป (Donut) & 2C. กราฟกระจายเวลา (Histogram) */}
              <div className={styles.chartsGrid}>
                <ChartContainer title={`สรุปการเข้าเรียน (${new Date(selectedDate).toLocaleDateString('th-TH')})`}>
                  <Pie data={sessionData.summaryDonut} options={{ responsive: true, maintainAspectRatio: false, cutout: '50%' }} />
                </ChartContainer>
                <ChartContainer title="นักเรียนเข้าห้องตอนไหน (Arrival Time Distribution)">
                  <Bar data={sessionData.arrivalHistogram} options={{ responsive: true, maintainAspectRatio: false }} />
                </ChartContainer>
              </div>

              {/* 2D. ตารางข้อมูลสด */}
              <ChartContainer title={`รายชื่อการเข้าเรียน (${new Date(selectedDate).toLocaleDateString('th-TH')})`} className={styles.fullWidthContainer}>
                <LiveSessionTable data={sessionData.liveDataTable} />
              </ChartContainer>
            </>
          )}
        </section>
        
        <hr className={styles.sectionSeparator} />

        {/* === 4. (Mockup แท็บ 3) วิเคราะห์พฤติกรรม (Behavioral Analysis) === */}
        {/* (TODO: ส่วนนี้มีความซับซ้อนสูง (Student Filter, Heatmap, CSV Upload) จะต้องทำใน Step ถัดไป) */}
        <section>
          <h2 className={styles.sectionTitle}>วิเคราะห์พฤติกรรม (Behavioral Analysis)</h2>
          <p><i>(ส่วนของ Student Deep Dive และ Correlation Plot จะถูกพัฒนาในส่วนถัดไป)</i></p>
        </section>
      </div> {/* (สิ้นสุด contentAreaRef) */}

    </div>
  );
};

export default FacultyDashboardPage;