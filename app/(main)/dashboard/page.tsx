'use client';

import React from 'react';
import { Download, Camera, Users, Award, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import styles from './dashboard.module.css';

// Mock Data
const dashboardStats = [
  { icon: Camera, title: 'Total Attendance (All Time)', value: '2,350 ครั้ง', color: 'text-blue-600' },
  { icon: Users, title: 'Average Attendance per Day', value: '120 ครั้ง/วัน', color: 'text-green-600' },
  { icon: Award, title: 'Unique Students Attended', value: '480 คน', color: 'text-purple-600' },
  { icon: TrendingUp, title: 'Average Attendance per Student', value: '5 ครั้ง', color: 'text-orange-600' },
];

const attendanceByDayData = [
  { name: 'Monday', attendance: 120 },
  { name: 'Tuesday', attendance: 150 },
  { name: 'Wednesday', attendance: 170 },
  { name: 'Thursday', attendance: 200 },
  { name: 'Friday', attendance: 160 },
];

const trendAttendanceData = [
  { name: 'Jan', value: 1000 },
  { name: 'Feb', value: 1200 },
  { name: 'Mar', value: 1400 },
  { name: 'Apr', value: 1500 },
  { name: 'May', value: 1900 },
  { name: 'Jun', value: 1700 },
];

const attendanceByTimeData = [
  { time: '8.30', count: 20 },
  { time: '9.30', count: 25 },
  { time: '10.30', count: 35 },
  { time: '11.30', count: 20 },
  { time: '13.30', count: 15 },
  { time: '14.30', count: 10 },
];

const attendanceByCourseData = [
  { name: 'Course A', value: 400, color: '#8884d8' },
  { name: 'Course B', value: 300, color: '#82ca9d' },
  { name: 'Course C', value: 200, color: '#ffc658' },
];

const DashboardPage = () => {
  return (
    <div className={styles.contentContainer}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Dashboard Preview</h1>
        <button className={styles.exportButton}>
          <Download className="w-5 h-5" />
          <span>Export data</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        {dashboardStats.map((stat, index) => (
          <div key={index} className={styles.statCard}>
            <div className={`${styles.statIconWrapper} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className={styles.statTitle}>{stat.title}</p>
              <p className={styles.statValue}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        {/* Attendance by Day (Bar Chart) */}
        <div className={styles.chartBox}>
          <h2 className={styles.chartTitle}>Attendance by Day</h2>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={attendanceByDayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="attendance" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trend Attendance (Line Chart) */}
        <div className={styles.chartBox}>
          <h2 className={styles.chartTitle}>Trend Attendance</h2>
          <ResponsiveContainer width="100%" height="80%">
            <LineChart data={trendAttendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#82ca9d" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        {/* Attendance by Time of Day (Bar Chart) */}
        <div className={styles.chartBox}>
          <h2 className={styles.chartTitle}>Attendance by Time of Day</h2>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={attendanceByTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ffc658" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance by Course/Class (Pie Chart) */}
        <div className={`${styles.chartBox} ${styles.pieChartBox}`}>
          <h2 className={styles.chartTitle}>Attendance by Course/Class</h2>
          <ResponsiveContainer width="100%" height="80%">
            <PieChart>
              <Pie
                data={attendanceByCourseData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
              >
                {attendanceByCourseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;