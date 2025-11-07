import React from 'react';
import { User, Lock } from 'lucide-react';
import styles from './login.module.css';
import Link from 'next/link';

const LoginPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        
        {/* --- Logo and Title --- */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <span>FR</span>
          </div>
          <h2>Welcome Back!</h2>
          <p>Please sign in to access your account.</p>
        </div>

        {/* --- Form --- */}
        <form className={styles.form}>
          <div className={styles.inputGroup}>
            <User size={20} className={styles.icon} />
            <input type="email" placeholder="Email" required />
          </div>
          <div className={styles.inputGroup}>
            <Lock size={20} className={styles.icon} />
            <input type="password" placeholder="Password" required />
          </div>

          <div className={styles.actions}>
            <label className={styles.rememberMe}>
              <input type="checkbox" />
              Remember me
            </label>
            <Link href="/forgot-password" className={styles.link}>
              Forgot Password?
            </Link>
          </div>

          <button type="submit" className={styles.loginButton}>
            <Link href="/accesscontrol" className={styles.loginLink}>
              submit
            </Link>
          </button>
        </form>

        {/* --- Footer Link --- */}
        <div className={styles.footer}>
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className={styles.link}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;