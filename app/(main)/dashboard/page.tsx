'use client';

import React, { useEffect, useState, useCallback } from 'react';
// (เราจะลบ useClass ออกก่อน เพราะ Dashboard หน้านี้จะแสดงข้อมูล "ทั้งหมด" 
//  เราจะเพิ่มการกรองตามคลาสในอนาคต ถ้าคุณต้องการครับ)
// import { useClass } from '@/app/contexts/ClassContext'; 
import styles from './dashboard.module.css';
import { Download, Users, BarChart, TrendingUp, PieChart, Clock } from 'lucide-react';

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
  subject_name: string | null; // (อาจจะเป็น null)
}

// Interface สำหรับเก็บข้อมูลที่คำนวณแล้ว
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
  // const { selectedSubject } = useClass(); // (เราจะยังไม่ใช้ในขั้นตอนนี้)
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- [ใหม่] ฟังก์ชันประมวลผลข้อมูล Log ---
  const processLogData = (logs: LogEntry[]): DashboardData => {
    // (นับเฉพาะการ "enter")
    const enterLogs = logs.filter(log => log.action === 'enter');
    const totalAttendance = enterLogs.length;

    // 1. Unique Students
    const uniqueStudentIds = new Set(enterLogs.map(log => log.user_id));
    const uniqueStudents = uniqueStudentIds.size;

    // 2. Avg per Student
    const avgPerStudent = (uniqueStudents > 0) ? (totalAttendance / uniqueStudents).toFixed(1) : '0';

    // 3. Avg per Day
    const uniqueDays = new Set(enterLogs.map(log => log.timestamp.split('T')[0]));
    const avgPerDay = (uniqueDays.size > 0) ? (totalAttendance / uniqueDays.size).toFixed(1) : '0';

    // 4. Attendance by Day (Mon-Fri)
    const dayCounts: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    enterLogs.forEach(log => {
      const day = new Date(log.timestamp).getDay(); // Sun=0, Mon=1, ...
      dayCounts[day] += 1;
    });
    const byDayData = {
      labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      datasets: [{
        label: 'Attendance',
        data: [dayCounts[1], dayCounts[2], dayCounts[3], dayCounts[4], dayCounts[5]], // (แสดงเฉพาะ จ-ศ)
        backgroundColor: 'rgba(99, 102, 241, 0.7)', // Indigo
      }],
    };

    // 5. Trend Attendance (by Month)
    const monthCounts = new Array(6).fill(0); // (สมมติว่าเอา 6 เดือน Jan-Jun)
    enterLogs.forEach(log => {
      const month = new Date(log.timestamp).getMonth(); // Jan=0, ... Jun=5
      if (month < 6) {
        monthCounts[month] += 1;
      }
    });
    const trendData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Attendance Trend',
        data: monthCounts,
        fill: false,
        borderColor: 'rgb(34, 197, 94)', // Green
        tension: 0.1,
      }],
    };
    
    // 6. Attendance by Time of Day
    const timeLabels = ['08:30', '09:30', '10:30', '11:30', '13:30', '14:30']; // (ตามรูป)
    const timeCounts = new Array(timeLabels.length).fill(0);
    enterLogs.forEach(log => {
      const date = new Date(log.timestamp);
      const hour = date.getHours();
      const minutes = date.getMinutes();
      
      // (Logic การจัดกลุ่มเวลาแบบง่ายๆ)
      if (hour < 9) timeCounts[0]++; // 8.30 (ก่อน 9.00)
      else if (hour < 10) timeCounts[1]++; // 9.30 (9.00 - 9.59)
      else if (hour < 11) timeCounts[2]++; // 10.30
      else if (hour < 12) timeCounts[3]++; // 11.30
      else if (hour < 14) timeCounts[4]++; // 13.30 (ข้ามเที่ยง)
      else if (hour < 15) timeCounts[5]++; // 14.30
    });
    const byTimeData = {
      labels: timeLabels,
      datasets: [{
        label: 'Attendance by Time',
        data: timeCounts,
        backgroundColor: 'rgba(245, 158, 11, 0.7)', // Amber
      }],
    };
    
    // 7. By Course/Class
    const courseCounts: { [key: string]: number } = {};
    enterLogs.forEach(log => {
      const courseName = log.subject_name || 'Unassigned';
      courseCounts[courseName] = (courseCounts[courseName] || 0) + 1;
    });
    const byCourseData = {
      labels: Object.keys(courseCounts),
      datasets: [{
        label: 'By Course',
        data: Object.values(courseCounts),
        backgroundColor: [
          'rgba(99, 102, 241, 0.7)', // Indigo
          'rgba(34, 197, 94, 0.7)',  // Green
          'rgba(245, 158, 11, 0.7)', // Amber
        ],
        hoverOffset: 4,
      }],
    };
    
    return {
      totalAttendance,
      uniqueStudents,
      avgPerDay: parseFloat(avgPerDay),
      avgPerStudent: parseFloat(avgPerStudent),
      byDayData,
      trendData,
      byTimeData,
      byCourseData,
    };
  };

  // --- [ใหม่] Fetch & Process Data ---
  const fetchAndProcessData = useCallback(async () => {
    // (ถ้าอนาคตจะกรอง ให้เพิ่มเงื่อนไข if (!selectedSubject) ... )
    
    setIsLoading(true);
    try {
      // (ดึง Log ทั้งหมด)
      const response = await fetch(`${BACKEND_URL}/attendance/logs`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      const logs: LogEntry[] = await response.json();
      
      const processedData = processLogData(logs);
      setData(processedData);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []); // (ลบ selectedSubject ออกจาก dependency)

  useEffect(() => {
    fetchAndProcessData();
  }, [fetchAndProcessData]);

  // --- Render ---
  if (isLoading) {
    return <div className={styles.pageContainer}><p>Loading dashboard data...</p></div>;
  }
  
  if (!data || data.totalAttendance === 0) {
     return (
      <div className={styles.pageContainer}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Dashboard Preview</h1>
          <button className={styles.exportButton}><Download size={16} /> Export data</button>
        </div>
        <p>No attendance data found to display.</p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Dashboard Preview</h1>
        <button className={styles.exportButton}><Download size={16} /> Export data</button>
      </div>

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
    </div>
  );
};

export default DashboardPage;