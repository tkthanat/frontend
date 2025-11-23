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

ChartJS.defaults.color = '#000000'; 


// --- Interfaces (กำหนดโครงสร้างข้อมูลที่คาดหวังจาก API ใหม่) ---
const BACKEND_URL = 'http://localhost:8000';

interface ISubject {
  id: string;
  name: string;
}

// === 1. Semester Overview Data ===
interface ISemesterOverviewData {
  kpis: {
    totalRoster: number;
    avgAttendance: number; 
    avgLateness: number;   
    sessionsTaught: number;
  };
  trendGraph: { 
    labels: string[]; 
    datasets: {
      label: string;
      data: number[];
      borderColor?: string;
      fill?: boolean;
      backgroundColor?: string;
    }[];
  };
  studentsAtRisk: { 
    studentId: string;
    name: string;
    absences_percent: number; 
    lates_percent: number;   
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
  summaryDonut: {
    labels: string[]; 
    datasets: [{
      data: number[]; 
      backgroundColor: string[];
    }];
  };
  arrivalHistogram: {
    labels: string[];
    datasets: [{
      label: 'ร้อยละของนักเรียน', 
      data: number[]; 
      backgroundColor: string;
    }];
  };
  liveDataTable: {
    studentId: string;
    name: string;
    status: "Present" | "Late" | "Absent";
    checkIn: string | null;
    checkOut: string | null;
    duration: string | null;
  }[];
}

// --- Component: StatCard (⭐️ แก้ไข) ---
const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; iconClass: string }> = ({ title, value, icon, iconClass }) => (
  <div className={styles.statCard}>
    <div className={`${styles.statIcon} ${styles[iconClass]}`}>{icon}</div>
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

// --- Component: ตารางนักศึกษาที่ต้องติดตาม (1C) (⭐️ แก้ไข) ---
const StudentsAtRiskTable: React.FC<{ data: ISemesterOverviewData['studentsAtRisk'] }> = ({ data }) => (
  <div className={styles.tableContainer}>
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>ชื่อ-สกุล</th>
          <th>รหัสนักศึกษา</th>
          <th>ขาด (%)</th> 
          <th>สาย (%)</th> 
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr><td colSpan={4} style={{textAlign: 'center', color: '#64748b'}}>ไม่พบนักเรียนที่มีการขาดหรือสาย</td></tr>
        ) : (
          data.map(student => (
            <tr key={student.studentId}>
              <td>{student.name}</td>
              <td>{student.studentId}</td>
              <td>{student.absences_percent.toFixed(1)} %</td> 
              <td>{student.lates_percent.toFixed(1)} %</td> 
            </tr>
          ))
        )}
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
        {data.length === 0 ? (
          <tr><td colSpan={5} style={{textAlign: 'center', color: '#64748b'}}>ไม่พบข้อมูลการเข้าเรียนในวันนี้</td></tr>
        ) : (
          data.map(student => (
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
              <td>{student.checkIn ? new Date(student.checkIn).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '---'}</td>
              <td>{student.checkOut ? new Date(student.checkOut).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '---'}</td>
              <td>{student.duration || '---'}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

// --- Component: หน้าหลัก Dashboard ---
const FacultyDashboardPage = () => {
  // --- State (⭐️ แก้ไข) ---
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  
  // State สำหรับ Session (รายวัน)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const getDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
  const [semesterStartDate, setSemesterStartDate] = useState<string>(getDaysAgo(30));
  const [semesterEndDate, setSemesterEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // (State อื่นๆ เหมือนเดิม)
  const [semesterData, setSemesterData] = useState<ISemesterOverviewData | null>(null);
  const [isSemesterLoading, setIsSemesterLoading] = useState(true);
  const [sessionData, setSessionData] = useState<ISessionViewData | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const contentAreaRef = useRef<HTMLDivElement>(null); 

  // --- Fetching Data (เหมือนเดิม) ---
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
      } catch (error) { console.error("Error fetching subjects:", error); }
    };
    fetchSubjects();
  }, []); 

  useEffect(() => {
    if (!selectedSubject || !semesterStartDate || !semesterEndDate) return; 
    const fetchSemesterData = async () => {
      setIsSemesterLoading(true);
      try {
        const params = new URLSearchParams({
          subjectId: selectedSubject,
          start_date: semesterStartDate,
          end_date: semesterEndDate,
        });
        const response = await fetch(`${BACKEND_URL}/api/faculty/semester-overview?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch semester data');
        const data: ISemesterOverviewData = await response.json();
        setSemesterData(data);
      } catch (error) { console.error("Error fetching semester data:", error); setSemesterData(null); 
      } finally { setIsSemesterLoading(false); }
    };
    fetchSemesterData();
  }, [selectedSubject, semesterStartDate, semesterEndDate]); 

  useEffect(() => {
    if (!selectedSubject || !selectedDate) return;
    const fetchSessionData = async () => {
      setIsSessionLoading(true);
      try {
        const params = new URLSearchParams({
            subjectId: selectedSubject,
            date: selectedDate,
        });
        const response = await fetch(`${BACKEND_URL}/api/faculty/session-view?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch session data');
        const data: ISessionViewData = await response.json();
        setSessionData(data);
      } catch (error) { console.error("Error fetching session data:", error); setSessionData(null); 
      } finally { setIsSessionLoading(false); }
    };
    fetchSessionData();
  }, [selectedSubject, selectedDate]); 


  // --- ฟังก์ชัน Export (เหมือนเดิม) ---
  const handleExport = async (format: 'pdf' | 'png' | 'summary_xlsx' | 'raw_logs_xlsx') => {
    setShowExportMenu(false);
    if (format === 'pdf' || format === 'png') {
      if (!contentAreaRef.current) { alert("Error: Cannot find dashboard content."); return; }
      console.log(`Exporting visual as ${format}...`);
      setIsExporting(true);
      try {
        const canvas = await html2canvas(contentAreaRef.current, { useCORS: true, scale: 2, });
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
      } catch (err) { console.error("Failed to create visual export:", err); alert("Failed to create visual export.");
      } finally { setIsExporting(false); }
      return;
    }
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
      } catch (err: any) { console.error("Export failed:", err); alert(`Export failed: ${err.message}`); }
      return;
    }
    if (format === 'summary_xlsx') {
      if (!semesterData || !sessionData) { alert("Data is not fully loaded. Cannot export summary."); return; }
      console.log('Exporting summary data as XLSX...');
      setIsExporting(true);
      try {
        const wb = utils.book_new();
        const ws_sem_kpi = utils.json_to_sheet([
          { "Metric": "Total Roster", "Value": semesterData.kpis.totalRoster, "Unit": "คน" },
          { "Metric": "Avg. Attendance", "Value": semesterData.kpis.avgAttendance, "Unit": "%" },
          { "Metric": "Avg. Lateness", "Value": semesterData.kpis.avgLateness, "Unit": "%" },
          { "Metric": "Sessions Taught", "Value": semesterData.kpis.sessionsTaught, "Unit": "คาบ" },
        ]);
        utils.book_append_sheet(wb, ws_sem_kpi, "Semester KPIs");
        
        const sem_trend_data = semesterData.trendGraph.labels.map((label, index) => ({
          "Session": label,
          "Present (%)": semesterData.trendGraph.datasets[0].data[index],
          "Late (%)": semesterData.trendGraph.datasets[1].data[index],
          "Absent (%)": semesterData.trendGraph.datasets[2].data[index],
        }));
        const ws_sem_trend = utils.json_to_sheet(sem_trend_data);
        utils.book_append_sheet(wb, ws_sem_trend, "Semester Trend");
        
        const ws_sem_risk = utils.json_to_sheet(semesterData.studentsAtRisk.map(s => ({
            "Student ID": s.studentId, "Name": s.name,
            "Absences (%)": s.absences_percent, "Lates (%)": s.lates_percent,
        })));
        utils.book_append_sheet(wb, ws_sem_risk, "Students at Risk (%)");

        const ws_ses_kpi = utils.json_to_sheet([
          { "Metric": "Date", "Value": selectedDate },
          { "Metric": "Present", "Value": sessionData.kpis.present },
          { "Metric": "Absent", "Value": sessionData.kpis.absent },
          { "Metric": "Late", "Value": sessionData.kpis.late },
          { "Metric": "Total", "Value": sessionData.kpis.total },
        ]);
        utils.book_append_sheet(wb, ws_ses_kpi, "Session KPIs");
        const ses_arrival_data = sessionData.arrivalHistogram.labels.map((label, index) => ({
          "Time": label,
          "Student Count (%)": sessionData.arrivalHistogram.datasets[0].data[index] 
        }));
        const ws_ses_arrival = utils.json_to_sheet(ses_arrival_data);
        utils.book_append_sheet(wb, ws_ses_arrival, "Session Arrival (%)");
        const ws_ses_live = utils.json_to_sheet(sessionData.liveDataTable);
        utils.book_append_sheet(wb, ws_ses_live, "Session Live Table");
        writeFile(wb, `Faculty_Summary_${selectedSubject}_${selectedDate}.xlsx`);
      } catch (err) { console.error("Failed to create summary export:", err); alert("Failed to create summary export.");
      } finally { setIsExporting(false); }
      return;
    }
  };


  // --- Render ---
  return (
    <div className={styles.pageContainer}>
      
      {isExporting && (
        <div className={styles.exportLoadingOverlay}>
          <Loader2 className={styles.spinner} />
          <p>Generating Report...</p>
        </div>
      )}
      
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Faculty Dashboard</h1>
        <div className={styles.exportControls}>
          <div style={{ position: 'relative' }}>
            <button className={styles.exportButton} onClick={() => setShowExportMenu(!showExportMenu)} disabled={isExporting} >
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

      {/* (⭐️ แก้ไข) ย้ายตัวเลือก Semester ออกจากแถบนี้ */}
      <div className={styles.filtersContainer}>
        <div className={styles.filterGroup}>
          <label htmlFor="subject-select">
            <ChevronDown size={16} /> วิชา (Subject):
          </label>
          <select id="subject-select" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} >
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
        </div>
        
        {/* Filter สำหรับ Session (รายวัน) */}
        <div className={styles.filterGroup}>
          <label htmlFor="date-picker">
            <Calendar size={16} /> วันที่ (Date):
          </label>
          <input type="date" id="date-picker" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
        
        {/* (⭐️ ย้าย 2 บล็อกนี้ออกไปแล้ว ⭐️) */}
        
      </div>

      <div ref={contentAreaRef}>
        
        {/* === 2. สรุปรายคาบ (Session-Specific View) === */}
        <section>
          <h2 className={styles.sectionTitle}>สรุปรายคาบ (Session-Specific View)</h2>
          <p className={styles.sectionSubtitle}>ข้อมูลสำหรับวันที่: {new Date(selectedDate).toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
          
          {isSessionLoading ? (
            <div className={styles.loadingBox}><Loader2 className={styles.spinner} /> Loading...</div>
          ) : !sessionData ? (
            <p>No data available for this session.</p>
          ) : (
            <>
              <div className={styles.statsGrid} style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
                <StatCard title="เข้าเรียน (Present)" value={`${sessionData.kpis.present} / ${sessionData.kpis.total} คน`} icon={<CheckCircle size={24} />} iconClass="kpiIconPresent" />
                <StatCard title="ขาดเรียน (Absent)" value={`${sessionData.kpis.absent} คน`} icon={<XCircle size={24} />} iconClass="kpiIconAbsent" />
                <StatCard title="มาสาย (Late)" value={`${sessionData.kpis.late} คน`} icon={<AlertTriangle size={24} />} iconClass="kpiIconLate" />
              </div>

              <div className={styles.chartsGrid}>
                <ChartContainer 
                  title={`สรุปการเข้าเรียน (${new Date(selectedDate).toLocaleDateString('th-TH')})`}
                >
                  <Pie 
                    data={sessionData.summaryDonut} 
                    options={{ 
                      responsive: true, maintainAspectRatio: false, cutout: '50%',
                      plugins: {
                        tooltip: { callbacks: { label: (context) => ` ${context.label}` } }
                      }
                    }} 
                  />
                </ChartContainer>
                
                <ChartContainer 
                  title="ช่วงเวลาที่เข้าห้องเรียน (Arrival Time Distribution)" // (แก้ชื่อ)
                >
                  <Bar 
                    data={sessionData.arrivalHistogram} 
                    options={{
                      indexAxis: 'y', // <-- ทำให้เป็นแนวนอน
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: { // <-- แกน X เป็น %
                          max: 100,
                          ticks: { callback: (value) => `${value}%` }
                        }
                      },
                      plugins: {
                        legend: { display: false }, 
                        tooltip: {
                          callbacks: {
                            label: (context) => ` ร้อยละ: ${context.formattedValue}%`
                          }
                        }
                      }
                    }} 
                  />
                </ChartContainer>
              </div>

              <ChartContainer title={`รายชื่อการเข้าเรียน (${new Date(selectedDate).toLocaleDateString('th-TH')})`} className={styles.fullWidthContainer}>
                <LiveSessionTable data={sessionData.liveDataTable} />
              </ChartContainer>
            </>
          )}
        </section>
        
        <hr className={styles.sectionSeparator} />

        {/* === 3. พฤติกรรมการเข้าเรียน (ย้าย "ภาพรวมวิชา" มารวมที่นี่) === */}
        <section>
          <h2 className={styles.sectionTitle}>พฤติกรรมการเข้าเรียน (Attendance Behavior)</h2>
          
          {/* (⭐️ เพิ่ม) ย้ายตัวเลือกวันที่ของ Semester มาไว้ที่นี่ */}
          <div className={styles.semesterFilters}>
            <div className={styles.filterGroup}>
              <label htmlFor="semester-start-date">
                <Calendar size={16} /> เริ่ม (Semester):
              </label>
              <input type="date" id="semester-start-date" value={semesterStartDate} onChange={(e) => setSemesterStartDate(e.target.value)} />
            </div>
            <div className={styles.filterGroup}>
              <label htmlFor="semester-end-date">
                <Calendar size={16} /> สิ้นสุด (Semester):
              </label>
              <input type="date" id="semester-end-date" value={semesterEndDate} onChange={(e) => setSemesterEndDate(e.target.value)} />
            </div>
          </div>
          
          {isSemesterLoading ? (
            <div className={styles.loadingBox}><Loader2 className={styles.spinner} /> Loading...</div>
          ) : !semesterData ? (
            <p>No data available for this semester.</p>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <StatCard title="นักเรียนทั้งหมด (Total Roster)" value={`${semesterData.kpis.totalRoster} คน`} icon={<Users size={24} />} iconClass="kpiIconRoster" />
                <StatCard title="อัตราเข้าเรียนเฉลี่ย (Avg. Attendance)" value={`${semesterData.kpis.avgAttendance}%`} icon={<BarChart size={24} />} iconClass="kpiIconAvgAttendance" />
                <StatCard title="อัตรามาสายเฉลี่ย (Avg. Lateness)" value={`${semesterData.kpis.avgLateness}%`} icon={<Clock size={24} />} iconClass="kpiIconAvgLateness" />
                <StatCard title="จำนวนครั้งที่สอนแล้ว (Sessions Taught)" value={`${semesterData.kpis.sessionsTaught} คาบ`} icon={<TrendingUp size={24} />} iconClass="kpiIconSessions" />
              </div>

              <ChartContainer 
                title="ร้อยละของจำนวนนักศึกษาที่เข้าเรียน (ตามช่วงวันที่)" 
                className={styles.fullWidthContainer}
              >
                <Line 
                  data={semesterData.trendGraph} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { max: 100, ticks: { callback: (value) => `${value}%` } } 
                    },
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: (context) => ` ${context.dataset.label}: ${context.formattedValue}%`
                        }
                      }
                    }
                  }} 
                />
              </ChartContainer>

              <ChartContainer title="นักศึกษาที่ขาด/สาย (เรียงตาม % ขาด)" className={styles.fullWidthContainer}>
                <StudentsAtRiskTable data={semesterData.studentsAtRisk} />
              </ChartContainer>
            </>
          )}
        </section>
      </div> 

    </div>
  );
};

export default FacultyDashboardPage;