// สคริปต์สำหรับใส่ข้อมูลตัวอย่างลง Firebase Realtime Database
// วิธีใช้: node scripts/seed.mjs
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAzAPUdsGOJfxxfTRpZqSKnkUK_q16_dZI",
  authDomain: "test-ns-smart.firebaseapp.com",
  databaseURL: "https://test-ns-smart-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "test-ns-smart",
  storageBucket: "test-ns-smart.firebasestorage.app",
  messagingSenderId: "215477003452",
  appId: "1:215477003452:web:acf4215ea1876cf7c7dcb9",
  measurementId: "G-VPJFGX4RJZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function seed() {
  // ผู้ใช้ผู้ดูแลระบบ (username/password เป็น plaintext เพื่อ demo เท่านั้น — โปรดเปลี่ยนก่อนใช้งานจริง)
  await set(ref(db, 'users'), {
    u1: { username: 'admin', password_hash: 'admin1234', role: 'admin' },
    u2: { username: 'monitor', password_hash: 'monitor1234', role: 'monitor' },
    u3: { username: 'staff_m1', password_hash: 'staff1234', role: 'staff', level_scope: 'ม.1' },
    u4: { username: 'teacher.math@school.ac.th', email: 'teacher.math@school.ac.th', password_hash: 'teacher1234', role: 'teacher', name: 'ครูสมศรี ตั้งใจสอน', subject: 'คณิตศาสตร์พื้นฐาน' }
  });

  // นักเรียนตัวอย่าง
  await set(ref(db, 'students'), {
    s1: { student_code: '10001', name: 'สมชาย ใจดี', level: 'ม.1', class_room: 'ม.1/1' },
    s2: { student_code: '10002', name: 'สมหญิง รักเรียน', level: 'ม.1', class_room: 'ม.1/2' },
    s3: { student_code: '20001', name: 'วิชัย ตั้งใจ', level: 'ม.2', class_room: 'ม.2/1' }
  });

  // ข้อสอบตัวอย่าง
  await set(ref(db, 'exams'), {
    e1: {
      subject: 'คณิตศาสตร์พื้นฐาน',
      level: 'ม.1', room: 'ม.1/1',
      start_time: '09:00', end_time: '10:30',
      google_form_link: '', status: 'open'
    },
    e2: {
      subject: 'วิทยาการคำนวณ',
      level: 'ม.2', room: 'ม.2/1',
      start_time: '10:30', end_time: '12:00',
      google_form_link: '', status: 'closed'
    }
  });

  // เหตุการณ์ตัวอย่างสำหรับหน้า Monitor (โครงสร้างแบบ denormalized เพื่อการแสดงผลแบบเรียลไทม์)
  const now = Date.now();
  await set(ref(db, 'events_log'), {
    ev1: {
      session_id: 'sess1', student_code: '10001', student_name: 'สมชาย ใจดี',
      level: 'ม.1', class_room: 'ม.1/1', subject: 'คณิตศาสตร์พื้นฐาน',
      event_type: 'leave_screen', warning_count: 2, remaining_time: '25:10', timestamp: now - 60000
    },
    ev2: {
      session_id: 'sess2', student_code: '10002', student_name: 'สมหญิง รักเรียน',
      level: 'ม.1', class_room: 'ม.1/2', subject: 'คณิตศาสตร์พื้นฐาน',
      event_type: 'disconnect', warning_count: 5, remaining_time: '12:40', timestamp: now - 30000
    }
  });

  console.log('Seed ข้อมูลตัวอย่างสำเร็จ');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
