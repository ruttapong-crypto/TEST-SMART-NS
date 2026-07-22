import { useEffect, useRef, useState } from 'react';
import { equalTo, get, orderByChild, push, query, ref, serverTimestamp, set, update } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

// ตรวจจับพฤติกรรมผิดปกติระหว่างสอบ: ออกจากหน้าจอ / ขาดการเชื่อมต่อ
function useExamWatcher(active, onEvent) {
  useEffect(() => {
    if (!active) return;
    function handleVisibility() {
      if (document.hidden) onEvent('leave_screen');
    }
    function handleOffline() {
      onEvent('disconnect');
    }
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('offline', handleOffline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('offline', handleOffline);
    };
  }, [active, onEvent]);
}

export default function StudentExam() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const warningCountRef = useRef(0);

  const logEvent = async (eventType) => {
    if (!session || !selected) return;
    warningCountRef.current += 1;
    const evRef = push(ref(db, 'events_log'));
    await set(evRef, {
      session_id: session.id,
      student_code: user.student_code,
      student_name: user.name,
      level: user.level,
      class_room: user.class_room,
      subject: selected.subject,
      event_type: eventType,
      warning_count: warningCountRef.current,
      timestamp: Date.now()
    });
  };

  useExamWatcher(Boolean(session) && !submitted, logEvent);

  useEffect(() => {
    if (!user || user.role !== 'student') return;
    (async () => {
      const examsRef = ref(db, 'exams');
      const q = query(examsRef, orderByChild('level'), equalTo(user.level));
      const snap = await get(q);
      const list = [];
      snap.forEach((child) => {
        const v = child.val();
        if (v.status === 'open') list.push({ id: child.key, ...v });
      });
      setExams(list);
      setLoading(false);
    })();
  }, [user]);

  if (!user || user.role !== 'student') return <Navigate to="/student-login" replace />;

  async function startExam(exam) {
    setSelected(exam);
    const sessionsRef = ref(db, 'exam_sessions');
    const newRef = push(sessionsRef);
    const deviceInfo = `${navigator.platform || 'unknown'} · ${navigator.userAgent.slice(0, 60)}`;
    const payload = {
      student_id: user.id,
      exam_id: exam.id,
      start_time: serverTimestamp(),
      device_info: deviceInfo,
      status: 'in_progress'
    };
    await set(newRef, payload);
    setSession({ id: newRef.key, ...payload });
  }

  async function submitExam() {
    if (!session) return;
    await update(ref(db, `exam_sessions/${session.id}`), {
      submit_time: serverTimestamp(),
      status: 'submitted'
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-sm">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="text-lg font-bold text-slate-800">ส่งข้อสอบเรียบร้อยแล้ว</h2>
          <p className="text-sm text-slate-500 mt-1">ขอบคุณ {user.name} สำหรับการเข้าสอบ</p>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{selected.subject}</h2>
              <p className="text-sm text-slate-500">ระดับชั้น {selected.level} · ห้อง {selected.room}</p>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">กำลังทำข้อสอบ</span>
          </div>

          {selected.google_form_link ? (
            <iframe
              title="google-form-exam"
              src={selected.google_form_link}
              className="w-full h-[600px] border rounded-lg"
            />
          ) : (
            <p className="text-slate-500 text-sm">ยังไม่มีลิงก์ข้อสอบสำหรับวิชานี้</p>
          )}

          <button
            onClick={submitExam}
            className="w-full mt-4 bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg"
          >
            ส่งข้อสอบ / สิ้นสุดการสอบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-lg font-bold text-slate-800">สวัสดี {user.name}</h2>
          <p className="text-sm text-slate-500">ระดับชั้น {user.level} · ห้อง {user.class_room}</p>
        </div>

        <h3 className="font-semibold text-slate-700 mb-2">รายวิชาที่เปิดสอบ</h3>
        {loading && <p className="text-slate-400 text-sm">กำลังโหลด...</p>}
        {!loading && exams.length === 0 && (
          <p className="text-slate-400 text-sm">ยังไม่มีรายวิชาที่เปิดสอบสำหรับระดับชั้นของคุณ</p>
        )}
        <div className="grid gap-3">
          {exams.map((exam) => (
            <button
              key={exam.id}
              onClick={() => startExam(exam)}
              className="text-left bg-white rounded-xl shadow p-4 hover:ring-2 hover:ring-primary-light transition"
            >
              <div className="font-semibold text-slate-800">{exam.subject}</div>
              <div className="text-xs text-slate-500 mt-1">
                ห้อง {exam.room} · {exam.start_time} - {exam.end_time}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
