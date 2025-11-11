'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import styles from './dashboard.module.css';
import { Download, Users, BarChart, TrendingUp, PieChart, Clock, Loader2 } from 'lucide-react';

// (Import Chart.js components)
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
} from 'chart.js';

// ✨ 1. Import Library ที่ติดตั้งใหม่
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// (ลงทะเบียน Components ของ Chart.js)
ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  PointElement, LineElement, ArcElement
);

// --- Interfaces ---
const BACKEND_URL = 'http://localhost:8000';

interface LogEntry {
  log_id: number;
  user_id: number;
  subject_id: number;
  action: "enter" | "exit";
  timestamp: string; // ISO string
  user_name: string;
  student_code: string;
  subject_name: string | null;
}
interface DashboardData {
  totalAttendance: number;
  uniqueStudents: number;
  avgPerDay: number;
  avgPerStudent: number;
  byDayData: { labels: string[], datasets: any[] };
  trendData: { labels: string[], datasets: any[] };
  byTimeData: { labels: string[], datasets: any[] };
  byCourseData: { labels: string[], datasets: any[] };
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
const ChartContainer: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className={styles.chartContainer}>
    <h3 className={styles.chartTitle}>{title}</h3>
    <div className={styles.chartContent}>
      {children}
    </div>
  </div>
);

// --- Component: หน้าหลัก Dashboard ---
const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // ✨ 2. แก้ไขชื่อ Ref
  const dashboardContentRef = useRef<HTMLDivElement>(null); // (Ref สำหรับชี้ไปที่ "เนื้อหา" ที่จะถ่ายรูป)
  const [isExporting, setIsExporting] = useState(false);

  // --- (ฟังก์ชัน processLogData - เหมือนเดิม) ---
  const processLogData = (logs: LogEntry[]): DashboardData => {
    // ... (โค้ดเหมือนเดิม) ...
    const enterLogs = logs.filter(log => log.action === 'enter');
    const totalAttendance = enterLogs.length;
    const uniqueStudentIds = new Set(enterLogs.map(log => log.user_id));
    const uniqueStudents = uniqueStudentIds.size;
    const avgPerStudent = (uniqueStudents > 0) ? (totalAttendance / uniqueStudents).toFixed(1) : '0';
    const uniqueDays = new Set(enterLogs.map(log => log.timestamp.split('T')[0]));
    const avgPerDay = (uniqueDays.size > 0) ? (totalAttendance / uniqueDays.size).toFixed(1) : '0';
    const dayCounts: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    enterLogs.forEach(log => { const day = new Date(log.timestamp).getDay(); dayCounts[day] += 1; });
    const byDayData = {
      labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      datasets: [{ label: 'Attendance', data: [dayCounts[1], dayCounts[2], dayCounts[3], dayCounts[4], dayCounts[5]], backgroundColor: 'rgba(99, 102, 241, 0.7)', }],
    };
    const monthCounts = new Array(6).fill(0);
    enterLogs.forEach(log => { const month = new Date(log.timestamp).getMonth(); if (month < 6) { monthCounts[month] += 1; }});
    const trendData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{ label: 'Attendance Trend', data: monthCounts, fill: false, borderColor: 'rgb(34, 197, 94)', tension: 0.1, }],
    };
    const timeLabels = ['08:30', '09:30', '10:30', '11:30', '13:30', '14:30'];
    const timeCounts = new Array(timeLabels.length).fill(0);
    enterLogs.forEach(log => {
      const date = new Date(log.timestamp); const hour = date.getHours();
      if (hour < 9) timeCounts[0]++; else if (hour < 10) timeCounts[1]++; else if (hour < 11) timeCounts[2]++;
      else if (hour < 12) timeCounts[3]++; else if (hour < 14) timeCounts[4]++; else if (hour < 15) timeCounts[5]++;
    });
    const byTimeData = {
      labels: timeLabels, datasets: [{ label: 'Attendance by Time', data: timeCounts, backgroundColor: 'rgba(245, 158, 11, 0.7)', }],
    };
    const courseCounts: { [key: string]: number } = {};
    enterLogs.forEach(log => { const courseName = log.subject_name || 'Unassigned'; courseCounts[courseName] = (courseCounts[courseName] || 0) + 1; });
    const byCourseData = {
      labels: Object.keys(courseCounts),
      datasets: [{ label: 'By Course', data: Object.values(courseCounts), backgroundColor: ['rgba(99, 102, 241, 0.7)', 'rgba(34, 197, 94, 0.7)', 'rgba(245, 158, 11, 0.7)',], hoverOffset: 4, }],
    };
    return { totalAttendance, uniqueStudents, avgPerDay: parseFloat(avgPerDay), avgPerStudent: parseFloat(avgPerStudent), byDayData, trendData, byTimeData, byCourseData };
  };
  
  // --- (ฟังก์ชัน fetchAndProcessData - เหมือนเดิม) ---
  const fetchAndProcessData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/attendance/logs`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      const logs: LogEntry[] = await response.json();
      const processedData = processLogData(logs);
      setData(processedData);
    } catch (err) { console.error(err); } 
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchAndProcessData();
  }, [fetchAndProcessData]);

  // ✨ [ 3. แก้ไขฟังก์ชันนี้ทั้งหมด ]
  const handleExport = async (format: 'pdf' | 'png' | 'summary_xlsx' | 'raw_logs_xlsx') => {
    setShowExportMenu(false); // (สั่งปิดเมนู)

    // --- (A. Visual Formats - แก้ไขให้ถ่ายรูปเฉพาะเนื้อหา) ---
    if (format === 'pdf' || format === 'png') {
      if (!dashboardContentRef.current) {
        alert("Error: Cannot find dashboard content.");
        return;
      }
      
      console.log(`Exporting visual as ${format}...`);
      setIsExporting(true); // (แสดง Loading)

      try {
        const canvas = await html2canvas(dashboardContentRef.current, { // (ใช้ Ref ใหม่)
          useCORS: true,
          scale: 2,
        });
        
        const imgData = canvas.toDataURL('image/png');

        if (format === 'png') {
          const link = document.createElement('a');
          link.download = 'dashboard_report.png';
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
          pdf.save('dashboard_report.pdf');
        }

      } catch (err) {
        console.error("Failed to create visual export:", err);
        alert("Failed to create visual export.");
      } finally {
        setIsExporting(false); // (ซ่อน Loading)
      }
      return; // (จบการทำงาน)
    }

    // --- (B. Raw Log Format - เหมือนเดิม) ---
    if (format === 'raw_logs_xlsx') {
      console.log(`Exporting all raw logs as XLSX...`);
      const params = new URLSearchParams();
      params.append("format", "xlsx"); // (บังคับเป็น XLSX)
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
      return; // (จบการทำงาน)
    }
    
    // --- (C. Summary Data Format - [ใหม่!] สร้างจาก Frontend) ---
    if (format === 'summary_xlsx') {
      if (!data) return;
      console.log('Exporting summary data as XLSX...');
      setIsExporting(true);
      
      try {
        // 1. สร้าง Workbook
        const wb = utils.book_new();

        // 2. Sheet 1: Stats
        const statsData = [
          { "Statistic": "Total Attendance (All Time)", "Value": data.totalAttendance },
          { "Statistic": "Average Attendance per Day", "Value": data.avgPerDay },
          { "Statistic": "Unique Students Attended", "Value": data.uniqueStudents },
          { "Statistic": "Average Attendance per Student", "Value": data.avgPerStudent },
        ];
        const ws_stats = utils.json_to_sheet(statsData);
        utils.book_append_sheet(wb, ws_stats, "Key Stats");

        // 3. Sheet 2: By Day
        const byDayExport = data.byDayData.labels.map((label, index) => ({
          "Day": label,
          "Attendance": data.byDayData.datasets[0].data[index]
        }));
        const ws_byDay = utils.json_to_sheet(byDayExport);
        utils.book_append_sheet(wb, ws_byDay, "Attendance by Day");

        // 4. Sheet 3: By Time
        const byTimeExport = data.byTimeData.labels.map((label, index) => ({
          "Time Slot": label,
          "Attendance": data.byTimeData.datasets[0].data[index]
        }));
        const ws_byTime = utils.json_to_sheet(byTimeExport);
        utils.book_append_sheet(wb, ws_byTime, "Attendance by Time");

        // 5. Sheet 4: By Course
        const byCourseExport = data.byCourseData.labels.map((label, index) => ({
          "Course / Subject": label,
          "Attendance": data.byCourseData.datasets[0].data[index]
        }));
        const ws_byCourse = utils.json_to_sheet(byCourseExport);
        utils.book_append_sheet(wb, ws_byCourse, "Attendance by Course");
        
        // 6. บันทึกไฟล์
        writeFile(wb, "Dashboard_Summary_Report.xlsx");

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
  if (isLoading) {
    return <div className={styles.pageContainer}><p>Loading dashboard data...</p></div>;
  }
  
  if (!data || data.totalAttendance === 0) {
     return (
      <div className={styles.pageContainer}>
        <div className={styles.header}><h1 className={styles.pageTitle}>Dashboard Preview</h1></div>
        <p>No attendance data found to display.</p>
      </div>
    );
  }

  return (
    // ✨ 4. ย้าย Ref ออกจาก Container หลัก
    <div className={styles.pageContainer}>
      {isExporting && (
        <div className={styles.exportLoadingOverlay}>
          <Loader2 className={styles.spinner} />
          <p>Generating Report...</p>
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Dashboard Preview</h1>
        
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
                {/* ✨ 5. แก้ไขเมนู Dropdown ให้ชัดเจน */}
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

      {/* ✨ 6. เพิ่ม Ref ที่นี่ (หุ้มเฉพาะเนื้อหา) */}
      <div ref={dashboardContentRef}>
        {/* --- Stat Cards --- */}
        <div className={styles.statsGrid}>
          <StatCard title="Total Attendance (All Time)" value={`${data.totalAttendance} ครั้ง`} icon={<BarChart size={24} />} />
          <StatCard title="Average Attendance per Day" value={`${data.avgPerDay} ครั้ง/วัน`} icon={<Clock size={24} />} />
          <StatCard title="Unique Students Attended" value={`${data.uniqueStudents} คน`} icon={<Users size={24} />} />
          <StatCard title="Average Attendance per Student" value={`${data.avgPerStudent} ครั้ง`} icon={<PieChart size={24} />} />
        </div>

        {/* --- Charts Grid --- */}
        <div className={styles.chartsGrid}>
          <ChartContainer title="Attendance by Day">
            <Bar data={data.byDayData} options={{ responsive: true, maintainAspectRatio: false }} />
          </ChartContainer>
          <ChartContainer title="Trend Attendance">
            <Line data={data.trendData} options={{ responsive: true, maintainAspectRatio: false }} />
          </ChartContainer>
          <ChartContainer title="Attendance by Time of Day">
            <Bar data={data.byTimeData} options={{ responsive: true, maintainAspectRatio: false }} />
          </ChartContainer>
          <ChartContainer title="Attendance by Course/Class">
            <Pie data={data.byCourseData} options={{ responsive: true, maintainAspectRatio: false }} />
          </ChartContainer>
        </div>
      </div> {/* (สิ้นสุด div ของ dashboardContentRef) */}
      
    </div>
  );
};

export default DashboardPage;