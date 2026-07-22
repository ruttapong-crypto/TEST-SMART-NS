import { createContext, useContext, useEffect, useState } from 'react';
import { get, ref, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../firebase';

const AuthContext = createContext(null);

// หมายเหตุความปลอดภัย: การเทียบรหัสผ่านฝั่ง client แบบนี้เหมาะสำหรับต้นแบบ/ใช้งานภายในเท่านั้น
// สำหรับ production ควรย้าย logic การตรวจสอบรหัสผ่านไปที่ Cloud Functions หรือ Firebase Auth
// พร้อม Security Rules ที่ปิดการอ่าน field password_hash จากฝั่ง client

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('smartexam_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem('smartexam_user', JSON.stringify(user));
    else localStorage.removeItem('smartexam_user');
  }, [user]);

  async function loginAdmin(username, password) {
    setLoading(true);
    try {
      const usersRef = ref(db, 'users');
      const q = query(usersRef, orderByChild('username'), equalTo(username));
      const snap = await get(q);
      if (!snap.exists()) throw new Error('ไม่พบชื่อผู้ใช้นี้ในระบบ');

      let found = null;
      snap.forEach((child) => {
        found = { id: child.key, ...child.val() };
      });

      if (!found || found.password_hash !== password) {
        throw new Error('รหัสผ่านไม่ถูกต้อง');
      }

      const profile = {
        id: found.id,
        username: found.username,
        role: found.role, // admin | teacher | monitor | staff
        level_scope: found.level_scope || null,
        name: found.name || null,
        subject: found.subject || null
      };
      setUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  }

  async function loginStudent(studentCode) {
    setLoading(true);
    try {
      const studentsRef = ref(db, 'students');
      const q = query(studentsRef, orderByChild('student_code'), equalTo(studentCode));
      const snap = await get(q);
      if (!snap.exists()) throw new Error('ไม่พบรหัสนักเรียนนี้ในระบบ');

      let found = null;
      snap.forEach((child) => {
        found = { id: child.key, ...child.val() };
      });

      const profile = {
        id: found.id,
        role: 'student',
        student_code: found.student_code,
        name: found.name,
        level: found.level,
        class_room: found.class_room
      };
      setUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginAdmin, loginStudent, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
