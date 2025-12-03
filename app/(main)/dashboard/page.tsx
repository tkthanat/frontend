'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import styles from './dashboard.module.css';
import { 
  Loader2, Users, BarChart, Clock, PieChart, TrendingUp, Calendar, ChevronDown, 
  CheckCircle, XCircle, AlertTriangle, Download
} from 'lucide-react';

import { Bar, Line, Pie } from 'react-chartjs-2'; 
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  PointElement, LineElement, ArcElement,
} from 'chart.js';

import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { useMsal } from "@azure/msal-react";
import { getAuthToken } from "../../authConfig";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  PointElement, LineElement, ArcElement
);

ChartJS.defaults.color = '#000000'; 

// --- Interfaces ---
const BACKEND_URL = 'http://localhost:8000';

interface ISubject {
  id: string;
  name: string;
}
interface IStudentLateRisk {
  studentId: string;
  name: string;
  lates_percent: number;
  lates_count: number;
}
interface IStudentAbsentRisk {
  studentId: string;
  name: string;
  absences_percent: number;
  absences_count: number;
}
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
  studentsLate: IStudentLateRisk[];
  studentsAbsent: IStudentAbsentRisk[];
}
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
      label: 'จำนวนนักเรียน', 
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

// --- Sub-Components ---
const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; iconClass: string }> = ({ title, value, icon, iconClass }) => (
  <div className={styles.statCard}>
    <div className={`${styles.statIcon} ${styles[iconClass]}`}>{icon}</div>
    <div className={styles.statContent}>
      <span className={styles.statTitle}>{title}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  </div>
);
const ChartContainer: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`${styles.chartContainer} ${className}`}>
    <h3 className={styles.chartTitle}>{title}</h3>
    <div className={styles.chartContent}>
      {children}
    </div>
  </div>
);
const StudentsLateTable: React.FC<{ data: IStudentLateRisk[] }> = ({ data }) => (
  <div className={styles.tableContainer}>
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>ชื่อ-สกุล</th>
          <th>รหัสนักศึกษา</th>
          <th>จำนวนครั้งที่สาย</th>
          <th>คิดเป็นร้อยละ (สาย)</th>
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr><td colSpan={4} style={{textAlign: 'center', color: '#64748b'}}>ไม่พบนักเรียนที่มาสาย</td></tr>
        ) : (
          data.map(student => (
            <tr key={student.studentId}>
              <td>{student.name}</td>
              <td>{student.studentId}</td>
              <td>{student.lates_count} ครั้ง</td>
              <td>{student.lates_percent.toFixed(1)} %</td> 
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);
const StudentsAbsentTable: React.FC<{ data: IStudentAbsentRisk[] }> = ({ data }) => (
  <div className={styles.tableContainer}>
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>ชื่อ-สกุล</th>
          <th>รหัสนักศึกษา</th>
          <th>จำนวนครั้งที่ขาด</th>
          <th>คิดเป็นร้อยละ (ขาด)</th>
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr><td colSpan={4} style={{textAlign: 'center', color: '#64748b'}}>ไม่พบนักเรียนที่ขาดเรียน</td></tr>
        ) : (
          data.map(student => (
            <tr key={student.studentId}>
              <td>{student.name}</td>
              <td>{student.studentId}</td>
              <td>{student.absences_count} ครั้ง</td>
              <td>{student.absences_percent.toFixed(1)} %</td> 
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);
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

// --- Main Page Component ---
const FacultyDashboardPage = () => {
  const { instance, accounts } = useMsal();

  // --- State ---
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const getDaysAgo = (days: number, fromDate?: string) => {
    const baseDate = fromDate ? new Date(fromDate) : new Date();
    const date = new Date(baseDate.toISOString().split('T')[0] + 'T12:00:00Z');
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
  
  const [semesterStartDate, setSemesterStartDate] = useState<string>(getDaysAgo(30));
  const [semesterEndDate, setSemesterEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [semesterData, setSemesterData] = useState<ISemesterOverviewData | null>(null);
  const [isSemesterLoading, setIsSemesterLoading] = useState(true);
  const [sessionData, setSessionData] = useState<ISessionViewData | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const contentAreaRef = useRef<HTMLDivElement>(null); 

  // --- Fetch Data ---
  useEffect(() => {
    const fetchSubjects = async () => {
      if (accounts.length === 0) return;
      try {
        const accessToken = await getAuthToken(instance, accounts[0]);
        const headers = { "Authorization": `Bearer ${accessToken}` };
        
        const response = await fetch(`${BACKEND_URL}/api/faculty/subjects`, { headers });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch subjects: ${response.status} - ${errorText}`);
        }
        
        const data: ISubject[] = await response.json();
        setSubjects(data);
        if (data.length > 0) {
          setSelectedSubject(data[0].id);
        }
      } catch (error) { 
        console.error("Error fetching subjects:", error); 
        setSubjects([]);
      }
    };
    fetchSubjects();
  }, [instance, accounts]); 

  useEffect(() => {
    if (!selectedSubject || !semesterStartDate || !semesterEndDate || accounts.length === 0) return; 
    
    const fetchSemesterData = async () => {
      setIsSemesterLoading(true);
      console.log(`Fetching SEMESTER data from ${semesterStartDate} to ${semesterEndDate}`);
      try {
        const accessToken = await getAuthToken(instance, accounts[0]);
        const headers = { "Authorization": `Bearer ${accessToken}` };

        const params = new URLSearchParams({
          subjectId: selectedSubject,
          start_date: semesterStartDate,
          end_date: semesterEndDate,
        });
        const response = await fetch(`${BACKEND_URL}/api/faculty/semester-overview?${params.toString()}`, { headers });
        if (!response.ok) throw new Error('Failed to fetch semester data');
        const data: ISemesterOverviewData = await response.json();
        setSemesterData(data);
      } catch (error) { console.error("Error fetching semester data:", error); setSemesterData(null); 
      } finally { setIsSemesterLoading(false); }
    };
    fetchSemesterData();
  }, [selectedSubject, semesterStartDate, semesterEndDate, instance, accounts]); 

  useEffect(() => {
    if (!selectedSubject || !selectedDate || accounts.length === 0) return;
    
    const fetchSessionData = async () => {
      setIsSessionLoading(true);
      console.log(`Fetching SESSION data for ${selectedDate}`);
      try {
        const accessToken = await getAuthToken(instance, accounts[0]);
        const headers = { "Authorization": `Bearer ${accessToken}` };

        const params = new URLSearchParams({
            subjectId: selectedSubject,
            date: selectedDate,
        });
        const response = await fetch(`${BACKEND_URL}/api/faculty/session-view?${params.toString()}`, { headers });
        if (!response.ok) throw new Error('Failed to fetch session data');
        const data: ISessionViewData = await response.json();
        setSessionData(data);
      } catch (error) { console.error("Error fetching session data:", error); setSessionData(null); 
      } finally { setIsSessionLoading(false); }
    };
    fetchSessionData();
  }, [selectedSubject, selectedDate, instance, accounts]); 
  
  const handleSessionDateChange = (newDate: string) => {
    const validNewDate = newDate || new Date().toISOString().split('T')[0];
    setSelectedDate(validNewDate);
    setSemesterEndDate(validNewDate);
    setSemesterStartDate(getDaysAgo(30, validNewDate)); 
  };
  
  // --- Export Functions ---
  const handleExport = async (format: 'pdf' | 'png' | 'dashboard_data') => {
    setShowExportMenu(false);
    
    // PDF / PNG Export
    if (format === 'pdf' || format === 'png') {
      if (!contentAreaRef.current) { alert("Error: Cannot find dashboard content."); return; }
      console.log(`Exporting visual as ${format}...`);
      setIsExporting(true);
      try {
        const canvas = await html2canvas(contentAreaRef.current, { 
          useCORS: true, 
          scale: 2,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        if (format === 'png') {
          const link = document.createElement('a');
          link.download = `faculty_report_${selectedSubject}_${selectedDate}.png`;
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
          pdf.save(`faculty_report_${selectedSubject}_${selectedDate}.pdf`);
        }
      } catch (err) { console.error("Failed to create visual export:", err); alert("Failed to create visual export.");
      } finally { setIsExporting(false); }
      return;
    }
    
    if (accounts.length === 0) {
      alert("Please log in again to export data.");
      return;
    }
    
    // Excel Data Export
    if (format === 'dashboard_data') {
      if (!semesterData || !sessionData) { 
        alert("Data is not fully loaded. Cannot export dashboard data."); 
        return; 
      }
      console.log('Exporting Dashboard Data (Summary) as XLSX...');
      setIsExporting(true);
      try {
        const wb = utils.book_new();
        
        // 1. Semester KPIs
        const ws_sem_kpi = utils.json_to_sheet([
          { "Metric": "Total Roster", "Value": semesterData.kpis.totalRoster, "Unit": "คน" },
          { "Metric": "Avg. Attendance", "Value": semesterData.kpis.avgAttendance, "Unit": "%" },
          { "Metric": "Avg. Lateness", "Value": semesterData.kpis.avgLateness, "Unit": "%" },
          { "Metric": "Sessions Taught", "Value": semesterData.kpis.sessionsTaught, "Unit": "คาบ" },
        ]);
        utils.book_append_sheet(wb, ws_sem_kpi, "Semester KPIs");
        
        // 2. Semester Trend
        const sem_trend_data = semesterData.trendGraph.labels.map((label, index) => ({
          "Session": label,
          "Present (%)": semesterData.trendGraph.datasets[0].data[index],
          "Late (%)": semesterData.trendGraph.datasets[1].data[index],
          "Absent (%)": semesterData.trendGraph.datasets[2].data[index],
        }));
        const ws_sem_trend = utils.json_to_sheet(sem_trend_data);
        utils.book_append_sheet(wb, ws_sem_trend, "Semester Trend");
        
        // 3. Students Late
        const ws_sem_late = utils.json_to_sheet(semesterData.studentsLate.map(s => ({
            "Student ID": s.studentId, "Name": s.name,
            "Lates (Count)": s.lates_count, "LATES (%)": s.lates_percent,
        })));
        utils.book_append_sheet(wb, ws_sem_late, "Students Late");

        // 4. Students Absent
        const ws_sem_absent = utils.json_to_sheet(semesterData.studentsAbsent.map(s => ({
            "Student ID": s.studentId, "Name": s.name,
            "Absences (Count)": s.absences_count, "Absences (%)": s.absences_percent,
        })));
        utils.book_append_sheet(wb, ws_sem_absent, "Students Absent");

        // 5. Session KPIs
        const ws_ses_kpi = utils.json_to_sheet([
          { "Metric": "Date", "Value": selectedDate },
          { "Metric": "Present", "Value": sessionData.kpis.present },
          { "Metric": "Absent", "Value": sessionData.kpis.absent },
          { "Metric": "Late", "Value": sessionData.kpis.late },
          { "Metric": "Total", "Value": sessionData.kpis.total },
        ]);
        utils.book_append_sheet(wb, ws_ses_kpi, "Session KPIs");

        // 6. Session Summary
        const ses_donut_data = sessionData.summaryDonut.labels.map((label, index) => ({
          "Status": label,
          "Count": sessionData.summaryDonut.datasets[0].data[index]
        }));
        const ws_ses_donut = utils.json_to_sheet(ses_donut_data);
        utils.book_append_sheet(wb, ws_ses_donut, "Session Summary");
        
        // 7. Session Arrival
        const ses_arrival_data = sessionData.arrivalHistogram.labels.map((label, index) => ({
          "Time": label,
          "Student Count": sessionData.arrivalHistogram.datasets[0].data[index] 
        }));
        const ws_ses_arrival = utils.json_to_sheet(ses_arrival_data);
        utils.book_append_sheet(wb, ws_ses_arrival, "Session Arrival (Count)");

        // 8. Session Live Table
        const ws_ses_live = utils.json_to_sheet(sessionData.liveDataTable);
        utils.book_append_sheet(wb, ws_ses_live, "Session Live Table");
        
        writeFile(wb, `Faculty_Dashboard_Data_${selectedSubject}_${selectedDate}.xlsx`);
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
                <button onClick={() => handleExport('dashboard_data')}>Export Dashboard Data (.xlsx)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.filtersContainer}>
        <div className={styles.filterGroup}>
          <label htmlFor="subject-select">
            <ChevronDown size={16} /> วิชา (Subject):
          </label>
          <select id="subject-select" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={subjects.length === 0}>
            {subjects.length === 0 && <option value="" disabled>No subjects found</option>}
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
            onChange={(e) => handleSessionDateChange(e.target.value)} 
          />
        </div>
      </div>

      <div ref={contentAreaRef}>
        
        {/* === 2. Session-Specific View === */}
        <section>
          <h2 className={styles.sectionTitle}>สรุปรายคาบ (Session-Specific View)</h2>
          <p className={styles.sectionSubtitle}>ข้อมูลสำหรับวันที่: {new Date(selectedDate).toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
          
          {isSessionLoading ? (
            <div className={styles.loadingBox}><Loader2 className={styles.spinner} /> Loading...</div>
          ) : subjects.length === 0 ? (
            <p>Please create a subject on the List Student page first.</p>
          ) : !sessionData ? (
            <p>No data available for this session or subject.</p>
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
                  title="ช่วงเวลาที่เข้าห้องเรียน (Arrival Time Distribution)"
                >
                  <Bar 
                    data={{
                      labels: sessionData.arrivalHistogram.labels,
                      datasets: [{
                        ...sessionData.arrivalHistogram.datasets[0],
                        backgroundColor: '#6366f1',
                      }]
                    }} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: { 
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'จำนวนนักศึกษา (คน)'
                          },
                          ticks: {
                            stepSize: 1 
                          }
                        }
                      },
                      plugins: {
                        legend: { display: false }, 
                        tooltip: {
                          callbacks: {
                            label: (context) => ` จำนวน: ${context.formattedValue} คน`
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

        {/* === 3. Attendance Behavior === */}
        <section>
          <h2 className={styles.sectionTitle}>พฤติกรรมการเข้าเรียน (Attendance Behavior)</h2>
          
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
          ) : subjects.length === 0 ? (
            <p>Please create a subject on the List Student page first.</p>
          ) : !semesterData ? (
            <p>No data available for this semester or subject.</p>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <StatCard title="นักเรียนทั้งหมด (Total Roster)" value={`${semesterData.kpis.totalRoster} คน`} icon={<Users size={24} />} iconClass="kpiIconRoster" />
                <StatCard title="อัตราเข้าเรียนเฉลี่ย (Avg. Attendance)" value={`${semesterData.kpis.avgAttendance.toFixed(1)}%`} icon={<BarChart size={24} />} iconClass="kpiIconAvgAttendance" />
                <StatCard title="อัตรามาสายเฉลี่ย (Avg. Lateness)" value={`${semesterData.kpis.avgLateness.toFixed(1)}%`} icon={<Clock size={24} />} iconClass="kpiIconAvgLateness" />
                <StatCard title="จำนวนครั้งที่สอนแล้ว (Sessions Taught)" value={`${semesterData.kpis.sessionsTaught} ครั้ง`} icon={<TrendingUp size={24} />} iconClass="kpiIconSessions" />
              </div>

              <ChartContainer 
                title="ร้อยละของจำนวนนักศึกษาที่เข้าเรียน (ตามช่วงวันที่)" 
                className={styles.fullWidthContainer}
              >
                <Line 
                  data={{
                    labels: semesterData.trendGraph.labels,
                    datasets: semesterData.trendGraph.datasets.map((ds, index) => ({
                      ...ds,
                      fill: index === 0 ? 'origin' : '-1', 
                    })),
                  }} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { 
                        max: 100, 
                        ticks: { callback: (value) => `${value}%` },
                        stacked: true 
                      } 
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

              <div className={styles.chartsGrid}>
                <ChartContainer title="นักศึกษาที่มาสาย (เรียงตาม % สาย)">
                  <StudentsLateTable data={semesterData.studentsLate} />
                </ChartContainer>

                <ChartContainer title="นักศึกษาที่ขาดเรียน (เรียงตาม % ขาด)">
                  <StudentsAbsentTable data={semesterData.studentsAbsent} />
                </ChartContainer>
              </div>
            </>
          )}
        </section>
      </div> 

    </div>
  );
};

export default FacultyDashboardPage;