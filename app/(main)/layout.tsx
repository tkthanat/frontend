// app/(main)/layout.tsx  <-- ไฟล์ใหม่

import Sidebar from "../components/sidebar"; // <-- ตรวจสอบ Path ให้ถูกต้อง

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // นี่คือ Layout ที่มี Sidebar
    <div className="flex h-screen bg-slate-50"> 
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}