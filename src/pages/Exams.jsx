import { useCallback, useEffect, useState } from 'react';
import { get, push, ref, remove, set, update } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const LEVELS = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
const EMPTY = { subject: '', level: 'ม.1', room: '', start_time: '', end_time: '', google_form_link: '', status: 'closed' };

// ยอมรับเฉพาะลิงก์ Google Form จริง เช่น https://docs.google.com/forms/... หรือ https://forms.gle/...
function isValidGoogleFormLink(url) {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (host === 'forms.gle') return true;
    if (host === 'docs.google.com' && u.pathname.toLowerCase().includes('/forms/')) return true;
    return false;
  } catch {
    return false;
  }
}

export default function Exams() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [exams, setExams] = useState([]);
  const [form, setForm] = useState(() => (isTeacher ? { ...EMPTY, subject: user.subject || '' } : EMPTY));
  const [editingId, setEditingId] = useState(null);
  const [formMsg, setFormMsg] = useState(null); // { type: 'success' | 'error', text }

  const loadExams = useCallback(async () => {
    const snap = await get(ref(db, 'exams'));
    const list = [];
    snap.forEach((c) => list.push({ id: c.key, ...c.val() }));
    setExams(list);
  }, []);

  useEffect(() => {
    loadExams();
    const interval = setInterval(loadExams, 8000);
    return () => clearInterval(interval);
  }, [loadExams]);

  // ครูเห็นและจัดการได้เฉพาะข้อสอบวิชาของตนเอง
  const visibleExams = isTeacher ? exams.filter((e) => e.subject === user.subject) : exams;

  async function handleSubmit(e) {
    e.preventDefault();
    setFormMsg(null);

    if (!isValidGoogleFormLink(form.google_form_link)) {
      setFormMsg({ type: 'error', text: 'ลงข้อสอบไม่สำเร็จ — ลิงก์ Google Form ไม่ถูกต้อง กรุณาวางลิงก์รูปแบบ https://docs.google.com/forms/... หรือ https://forms.gle/...' });
      return;
    }

    const payload = isTeacher ? { ...form, subject: user.subject } : form;
    try {
      if (editingId) {
        await update(ref(db, `exams/${editingId}`), payload);
      } else {
        await set(push(ref(db, 'exams')), payload);
      }
      await loadExams();
      setForm(isTeacher ? { ...EMPTY, subject: user.subject || '' } : EMPTY);
      setEditingId(null);
      setFormMsg({ type: 'success', text: 'ลงข้อสอบสำเร็จ' });
      setTimeout(() => setFormMsg(null), 3000);
    } catch (err) {
      setFormMsg({ type: 'error', text: 'ลงข้อสอบไม่สำเร็จ — เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
  }

  function edit(exam) {
    setEditingId(exam.id);
    setForm({ ...EMPTY, ...exam });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(isTeacher ? { ...EMPTY, subject: user.subject || '' } : EMPTY);
    setFormMsg(null);
  }

  async function toggleStatus(exam) {
    await update(ref(db, `exams/${exam.id}`), { status: exam.status === 'open' ? 'closed' : 'open' });
    await loadExams();
  }

  async function del(id) {
    if (confirm('ยืนยันการลบข้อสอบนี้?')) {
      await remove(ref(db, `exams/${id}`));
      await loadExams();
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar
          icon="📝"
          title="จัดการข้อสอบ / Google Form"
          subtitle={isTeacher ? `แสดงเฉพาะข้อสอบวิชา ${user.subject}` : 'เพิ่มข้อสอบ กำหนดระดับชั้น ห้อง เวลา และลิงก์ข้อสอบ'}
        />
        <div className="p-6 grid lg:grid-cols-3 gap-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-3 h-fit">
            <h3 className="font-semibold text-slate-800">{editingId ? 'แก้ไขข้อสอบ' : 'เพิ่มข้อสอบใหม่'}</h3>
            {isTeacher ? (
              <div>
                <label className="text-xs text-slate-500">รายวิชา</label>
                <input disabled className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-slate-50 text-slate-500"
                  value={user.subject || ''} />
              </div>
            ) : (
              <input required placeholder="รายวิชา" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            )}
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input placeholder="ห้องเรียน" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input type="time" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              <input type="time" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <input placeholder="ลิงก์ Google Form" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.google_form_link} onChange={(e) => setForm({ ...form, google_form_link: e.target.value })} />

            {formMsg && (
              <div className={`text-sm rounded-lg px-3 py-2 ${
                formMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {formMsg.type === 'success' ? '✅ ' : '⚠️ '}{formMsg.text}
              </div>
            )}

            <div className="flex gap-2">
              <button className="flex-1 bg-primary text-white py-2 rounded-lg text-sm hover:bg-primary-light">
                {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มข้อสอบ'}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit}
                  className="px-3 py-2 rounded-lg text-sm border">ยกเลิก</button>
              )}
            </div>
          </form>

          <div className="lg:col-span-2 bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-slate-800 mb-3">
              รายการข้อสอบ {isTeacher ? `(วิชา ${user.subject})` : `(${visibleExams.length})`}
            </h3>
            <div className="space-y-2">
              {visibleExams.length === 0 && <p className="text-slate-400 text-sm">ยังไม่มีข้อสอบในระบบ</p>}
              {visibleExams.map((exam) => (
                <div key={exam.id} className="flex items-center justify-between border rounded-lg px-4 py-3 flex-wrap gap-2">
                  <div>
                    <div className="font-medium text-slate-800">{exam.subject}</div>
                    <div className="text-xs text-slate-400">{exam.level} · ห้อง {exam.room} · {exam.start_time}-{exam.end_time}</div>
                    {exam.google_form_link ? (
                      <a
                        href={exam.google_form_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline break-all"
                      >
                        🔗 เปิดลิงก์ข้อสอบ
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300">ยังไม่มีลิงก์ข้อสอบ</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleStatus(exam)}
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        exam.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                      {exam.status === 'open' ? 'เปิดสอบ' : 'ปิด'}
                    </button>
                    <button onClick={() => edit(exam)} className="text-xs text-primary underline">แก้ไข</button>
                    <button onClick={() => del(exam.id)} className="text-xs text-red-500 underline">ลบ</button>
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
