import { useCallback, useEffect, useState } from 'react';
import { get, push, ref, remove, set, update } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const EMPTY_FORM = { email: '', name: '', subject: '', password: '' };

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadTeachers = useCallback(async () => {
    const snap = await get(ref(db, 'users'));
    const list = [];
    snap.forEach((c) => {
      const v = c.val();
      if (v.role === 'teacher') list.push({ id: c.key, ...v });
    });
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    setTeachers(list);
  }, []);

  useEffect(() => {
    loadTeachers();
    const interval = setInterval(loadTeachers, 8000);
    return () => clearInterval(interval);
  }, [loadTeachers]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const email = form.email.trim().toLowerCase();
    if (!email.includes('@')) {
      setError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    const duplicate = teachers.find((t) => t.username === email && t.id !== editingId);
    if (duplicate) {
      setError('มีครูที่ใช้อีเมลนี้อยู่แล้วในระบบ');
      return;
    }

    const payload = {
      username: email,
      email,
      name: form.name.trim(),
      subject: form.subject.trim(),
      role: 'teacher'
    };
    if (form.password) payload.password_hash = form.password;

    if (editingId) {
      await update(ref(db, `users/${editingId}`), payload);
    } else {
      if (!form.password) {
        setError('กรุณาตั้งรหัสผ่านสำหรับครูที่เพิ่มใหม่');
        return;
      }
      await set(push(ref(db, 'users')), payload);
    }
    await loadTeachers();
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function edit(teacher) {
    setEditingId(teacher.id);
    setForm({ email: teacher.email || teacher.username || '', name: teacher.name || '', subject: teacher.subject || '', password: '' });
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function del(id) {
    if (confirm('ยืนยันการลบบัญชีครูคนนี้? ครูจะไม่สามารถเข้าสู่ระบบได้อีก')) {
      await remove(ref(db, `users/${id}`));
      await loadTeachers();
    }
  }

  const filtered = teachers.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${t.name} ${t.email || t.username} ${t.subject}`.toLowerCase().includes(q);
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="🧑‍🏫" title="จัดการครู" subtitle="เพิ่มบัญชีครูเพื่อให้เข้าจัดการข้อสอบในวิชาของตนเองได้" />

        <div className="p-6 grid lg:grid-cols-3 gap-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-3 h-fit">
            <h3 className="font-semibold text-slate-800">{editingId ? 'แก้ไขข้อมูลครู' : 'เพิ่มครูใหม่'}</h3>

            <div>
              <label className="text-xs text-slate-500">อีเมล (ใช้เป็น Username เข้าสู่ระบบ)</label>
              <input required type="email" placeholder="teacher@school.ac.th" className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">ชื่อ-นามสกุล</label>
              <input required placeholder="ชื่อ-นามสกุลครู" className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">วิชาที่สอน</label>
              <input required placeholder="เช่น คณิตศาสตร์พื้นฐาน" className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">
                รหัสผ่าน{editingId ? ' (เว้นว่างถ้าไม่ต้องการเปลี่ยน)' : ''}
              </label>
              <input type="text" placeholder="ตั้งรหัสผ่านให้ครู" className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-2">
              <button className="flex-1 bg-primary text-white py-2 rounded-lg text-sm hover:bg-primary-light">
                {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มครู'}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="px-3 py-2 rounded-lg text-sm border">ยกเลิก</button>
              )}
            </div>

            <p className="text-xs text-slate-400 pt-2 border-t">
              เมื่อเพิ่มแล้ว ครูสามารถล็อกอินที่หน้า "เข้าสู่ระบบผู้ดูแล" ด้วยอีเมลและรหัสผ่านนี้
              ระบบจะพาไปหน้า "จัดการข้อสอบ" และกรองให้เห็นเฉพาะข้อสอบวิชาของตนเองโดยอัตโนมัติ
            </p>
          </form>

          <div className="lg:col-span-2 bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h3 className="font-semibold text-slate-800">รายชื่อครูทั้งหมด ({teachers.length})</h3>
              <input
                className="border rounded-lg px-3 py-1.5 text-sm"
                placeholder="🔍 ค้นหา ชื่อ/อีเมล/วิชา"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              {filtered.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">ยังไม่มีบัญชีครูในระบบ</p>}
              {filtered.map((t) => (
                <div key={t.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                  <div>
                    <div className="font-medium text-slate-800">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.email || t.username} · สอนวิชา {t.subject}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => edit(t)} className="text-xs text-primary underline">แก้ไข</button>
                    <button onClick={() => del(t.id)} className="text-xs text-red-500 underline">ลบ</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
