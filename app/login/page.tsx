import React from 'react';
import styles from './login.module.css';
import Link from 'next/link';
import Image from 'next/image';

const LoginPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        
        {/* --- Header Section (Logo & Title) --- */}
        <div className={styles.header}>
          <div className={styles.logoWrapper}>
            {/* โลโก้ Microsoft (รูปยาว) */}
            <Image 
              src="/Microsoft_logo.png" // ตรวจสอบ path รูปภาพให้ถูกต้อง
              alt="Microsoft Logo" 
              width={200}
              height={50}
              className={styles.headerLogo}
              priority 
            />
          </div>
          <h2>Sign In</h2>
          <p>Use your Microsoft account to continue.</p>
        </div>

        {/* --- Sign-in Button Section --- */}
        <div className={styles.signInWrapper}>
          <button className={styles.microsoftButton}>
            {/* ไอคอน Microsoft ในปุ่ม (มักเป็นสี่เหลี่ยม 4 สี) */}
            <Image 
              src="/microsoft-logo.png" // ตรวจสอบ path รูปภาพให้ถูกต้อง
              alt="Microsoft Icon" 
              width={22} 
              height={22} 
            />
            <span>Sign in with Microsoft</span>
          </button>
        </div>

        {/* --- Footer Section --- */}
        <div className={styles.footer}>
          <p>
            Having trouble?{' '}
            <Link href="/support" className={styles.link}>
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;