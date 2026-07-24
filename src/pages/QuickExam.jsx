import { useCallback, useEffect, useState } from 'react';
import { get, ref, update } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function QuickExam() {
  const [exams, setExams] = useState([]);

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

  async function toggle(exam) {
    await update(ref(db, `exams/${exam.id}`), { status: exam.status === 'open' ? 'closed' : 'open' });
    await loadExams();
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="⚡" title="เปิดสอบด่วน" subtitle="เปิด/ปิดข้อสอบแบบทันทีแยกตามระดับชั้น" />
        <div className="p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map((exam) => (
            <div key={exam.id} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-800">{exam.subject}</div>
                <div className="text-xs text-slate-400">{exam.level} · ห้อง {exam.room}</div>
              </div>
              <button
                onClick={() => toggle(exam)}
                className={`relative w-12 h-6 rounded-full transition ${exam.status === 'open' ? 'bg-green-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${
                  exam.status === 'open' ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>
          ))}
          {exams.length === 0 && <p className="text-slate-400 text-sm">ยังไม่มีข้อสอบในระบบ ไปที่หน้า "จัดการข้อสอบ" เพื่อเพิ่ม</p>}
        </div>
      </div>
    </div>
  );
}
