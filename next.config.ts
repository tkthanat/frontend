// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... การตั้งค่าอื่นๆ (ถ้ามี)

  async redirects() {
    return [
      {
        // เมื่อมีคนเข้าถึงเส้นทางนี้
        source: '/', 
        // ให้เปลี่ยนไปที่เส้นทางนี้แทน
        destination: '/login', 
        // ต้องเปลี่ยนเส้นทางแบบถาวรหรือไม่ (false สำหรับชั่วคราว/เปลี่ยนได้)
        permanent: false, 
      },
    ]
  },
};

module.exports = nextConfig;