'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import styles from './sidebar.module.css';
import {
  ScanFace,
  Camera,
  LayoutDashboard,
  Users,
  LogOut,
} from 'lucide-react';

const menuItems = [
  { name: 'Access control', icon: Camera, href: '/accesscontrol' },
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'List student', icon: Users, href: '/liststudent' },
];

const Sidebar = () => {
  const pathname = usePathname();
  const adjustedPathname = pathname === '/' ? '/accesscontrol' : pathname;

  return (
    <aside className={styles.sidebarContainer}>
      <div>
        {/* --- Logo Section --- */}
        <div className={styles.logoContainer}>
          <div className={styles.logoIconWrapper}>
            <ScanFace size={28} />
          </div>
          <h1 className={styles.logoText}>Face Recognition</h1>
        </div>

        {/* --- Navigation Menu --- */}
        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const isActive = adjustedPathname.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href} className={styles.navLink}>
                <div className={`${styles.navItem} ${isActive ? styles.active : ''}`}>
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={styles.navText}>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* --- Logout Section --- */}
      <div className={styles.logoutSection}>
        <Link href="/login" className={styles.navLink}>
          <div className={`${styles.navItem} ${styles.logoutButton}`}>
            <LogOut size={20} />
            <span className={styles.navText}>Logout</span>
          </div>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;