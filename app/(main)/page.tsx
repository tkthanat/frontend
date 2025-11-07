// app/page.tsx

import { redirect } from 'next/navigation';

export default function HomePage() {
  // เมื่อผู้ใช้เข้ามาที่หน้าแรก ('/')
  // ให้ทำการ redirect ไปยังหน้า /accesscontrol ทันที
  redirect('/accesscontrol');

  // ไม่จำเป็นต้อง return JSX อะไรออกมา เพราะจะเกิดการ redirect ก่อน
  return null;
}