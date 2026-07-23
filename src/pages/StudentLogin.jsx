import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { equalTo, get, orderByChild, push, query, ref, serverTimestamp, set, update } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { n: 1, label: 'ระบุตัวตน' },
  { n: 2, label: 'เลือกรายวิชา' },
  { n: 3, label: 'เริ่มทำข้อสอบ' }
];

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

function StepBadge({ current }) {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-10 py-4">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            s.n === current ? 'bg-primary text-white' : s.n < current ? 'bg-green-100 text-primary' : 'bg-slate-100 text-slate-400'
          }`}>
            {s.n < current ? '✓' : s.n}
          </div>
          <span className={`text-xs sm:text-sm ${s.n === current ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="w-6 sm:w-12 h-px bg-slate-200 ml-2 sm:ml-6" />}
        </div>
      ))}
    </div>
  );
}

export default function StudentLogin() {
  const { user, loginStudent, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const levelFromQr = params.get('level');

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [exams, setExams] = useState([]);
  const [submittedExamIds, setSubmittedExamIds] = useState(new Set());
  const [examsLoading, setExamsLoading] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState('');

  const [selectedExamId, setSelectedExamId] = useState('');
  const [session, setSession] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const warningCountRef = useRef(0);

  const isVerified = Boolean(user && user.role === 'student');
  const selectedExam = exams.find((e) => e.id === selectedExamId) || null;
  const step = submitted || session ? 3 : selectedExamId ? 3 : isVerified ? 2 : 1;

  // เมื่อยืนยันตัวตนนักเรียนแล้ว โหลดรายวิชาที่เปิดสอบของระดับชั้นนั้น + ประวัติที่เคยส่งไปแล้ว
  useEffect(() => {
    if (!isVerified) return;
    setExamsLoading(true);
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

      const sessionsRef = ref(db, 'exam_sessions');
      const sq = query(sessionsRef, orderByChild('student_id'), equalTo(user.id));
      const sSnap = await get(sq);
      const done = new Set();
      sSnap.forEach((child) => {
        const v = child.val();
        if (v.status === 'submitted') done.add(v.exam_id);
      });
      setSubmittedExamIds(done);
      setExamsLoading(false);
    })();
  }, [isVerified, user]);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginStudent(code.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function chooseExam(exam) {
    if (submittedExamIds.has(exam.id)) {
      setBlockedMsg('คุณส่งข้อสอบวิชานี้ไปแล้ว ไม่สามารถเข้าสอบซ้ำได้');
      return;
    }
    setBlockedMsg('');
    setSelectedExamId(exam.id);
  }

  async function startExam() {
    if (!selectedExam) return;
    const sessionsRef = ref(db, 'exam_sessions');
    const newRef = push(sessionsRef);
    const deviceInfo = `${navigator.platform || 'unknown'} · ${navigator.userAgent.slice(0, 60)}`;
    const payload = {
      student_id: user.id,
      exam_id: selectedExam.id,
      start_time: serverTimestamp(),
      device_info: deviceInfo,
      status: 'in_progress'
    };
    await set(newRef, payload);
    setSession({ id: newRef.key, ...payload });
    warningCountRef.current = 0;
  }

  const logEvent = async (eventType) => {
    if (!session || !selectedExam) return;
    warningCountRef.current += 1;
    await set(push(ref(db, 'events_log')), {
      session_id: session.id,
      student_code: user.student_code,
      student_name: user.name,
      level: user.level,
      class_room: user.class_room,
      subject: selectedExam.subject,
      event_type: eventType,
      warning_count: warningCountRef.current,
      timestamp: Date.now()
    });
  };
  useExamWatcher(Boolean(session) && !submitted, logEvent);

  async function submitExam() {
    if (!session || !selectedExam) return;
    await update(ref(db, `exam_sessions/${session.id}`), {
      submit_time: serverTimestamp(),
      status: 'submitted'
    });
    // บันทึกเหตุการณ์ "ส่งข้อสอบแล้ว" เพื่อให้ขึ้นในหน้า Monitor สดทันที
    await set(push(ref(db, 'events_log')), {
      session_id: session.id,
      student_code: user.student_code,
      student_name: user.name,
      level: user.level,
      class_room: user.class_room,
      subject: selectedExam.subject,
      event_type: 'submitted',
      warning_count: warningCountRef.current,
      timestamp: Date.now()
    });
    setSubmittedExamIds((prev) => new Set(prev).add(selectedExam.id));
    setSubmitted(true);
  }

  function pickAnotherSubject() {
    setSubmitted(false);
    setSession(null);
    setSelectedExamId('');
    warningCountRef.current = 0;
  }

  function goToAdminLogin() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-50 via-white to-yellow-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-light text-white px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <div>
            <div className="font-bold leading-tight">SmartExam</div>
            <div className="text-[10px] opacity-80 leading-tight">SCHOOLWIDE EXAMINATION SYSTEM</div>
          </div>
        </div>
        <button onClick={goToAdminLogin} className="bg-white/15 hover:bg-white/25 text-sm px-3 py-1.5 rounded-lg">
          👤 ผู้ดูแลระบบ
        </button>
      </div>

      {/* Banner */}
      <div className="bg-gradient-to-r from-primary to-primary-light text-white px-4 sm:px-8 py-8">
        <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">ระบบสอบออนไลน์ระดับโรงเรียน</span>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">เข้าสู่ระบบสอบออนไลน์</h1>
        <p className="text-sm text-white/90 mt-1">
          Smart Examination — กรอกรหัสนักเรียน ตรวจสอบข้อมูล และเลือกรายวิชาที่เปิดสอบ
        </p>
      </div>

      {/* Main card */}
      <div className="max-w-2xl mx-auto -mt-4 px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="border-b px-4">
            <StepBadge current={step} />
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Step 1: ระบุตัวตน */}
            <div>
              <h3 className="font-semibold text-slate-700 text-sm mb-2">📇 กรอกรหัสนักเรียน</h3>
              {levelFromQr && !isVerified && (
                <div className="text-xs bg-lime-50 text-primary rounded-lg py-2 px-3 mb-2">
                  กำลังเข้าสอบระดับชั้น <strong>{levelFromQr}</strong>
                </div>
              )}
              <form onSubmit={handleVerify} className="flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-light disabled:bg-slate-50"
                  placeholder="กรอกรหัสนักเรียน เช่น 10001"
                  value={isVerified ? user.student_code : code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={isVerified || busy}
                  required
                />
                {!isVerified && (
                  <button
                    disabled={busy}
                    className="bg-primary hover:bg-primary-light text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-60"
                  >
                    {busy ? '...' : '🔍 ค้นหา'}
                  </button>
                )}
                {isVerified && (
                  <button
                    type="button"
                    onClick={() => { logout(); setCode(''); setSelectedExamId(''); setSession(null); setSubmitted(false); }}
                    className="border px-3 rounded-lg text-sm text-slate-500 hover:bg-slate-50"
                  >
                    เปลี่ยนรหัส
                  </button>
                )}
              </form>
              {error && <div className="text-sm text-red-600 mt-2">{error}</div>}

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="border rounded-lg px-3 py-2">
                  <div className="text-[11px] text-slate-400">ชื่อ-นามสกุลผู้เข้าสอบ</div>
                  <div className="text-sm font-medium text-slate-700">{isVerified ? user.name : '—'}</div>
                </div>
                <div className="border rounded-lg px-3 py-2">
                  <div className="text-[11px] text-slate-400">ระดับชั้น / ห้อง</div>
                  <div className="text-sm font-medium text-slate-700">
                    {isVerified ? `${user.level} / ${user.class_room}` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: เลือกรายวิชา */}
            <div className={!isVerified ? 'opacity-40 pointer-events-none' : ''}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-700 text-sm">📚 เลือกรายวิชาที่ต้องการสอบ</h3>
                <span className="text-[11px] text-slate-400">แสดงตามระดับชั้นของนักเรียน</span>
              </div>

              {blockedMsg && (
                <div className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-2">
                  {blockedMsg}
                </div>
              )}

              {examsLoading && <p className="text-sm text-slate-400">กำลังโหลดรายวิชา...</p>}
              {isVerified && !examsLoading && exams.length === 0 && (
                <p className="text-sm text-slate-400">ยังไม่มีรายวิชาที่เปิดสอบสำหรับระดับชั้นของคุณ</p>
              )}

              <div className="grid gap-2">
                {exams.map((exam) => {
                  const isDone = submittedExamIds.has(exam.id);
                  const isSelected = selectedExamId === exam.id;
                  return (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => chooseExam(exam)}
                      disabled={isDone}
                      className={`text-left border rounded-lg px-3 py-2 transition ${
                        isDone
                          ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-primary ring-2 ring-primary-light bg-lime-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{exam.subject}</span>
                        {isDone && <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ ส่งแล้ว</span>}
                      </div>
                      <div className="text-[11px] text-slate-400">ห้อง {exam.room} · {exam.start_time}-{exam.end_time}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: เริ่มทำข้อสอบ */}
            <div className={!selectedExam ? 'opacity-40 pointer-events-none' : ''}>
              <h3 className="font-semibold text-slate-700 text-sm mb-2">🚀 เริ่มทำข้อสอบ</h3>

              {!session && !submitted && (
                <button
                  onClick={startExam}
                  disabled={!selectedExam}
                  className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
                >
                  เริ่มทำข้อสอบวิชา {selectedExam ? selectedExam.subject : '—'}
                </button>
              )}

              {session && !submitted && selectedExam && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{selectedExam.subject}</span>
                    <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">กำลังทำข้อสอบ</span>
                  </div>
                  {selectedExam.google_form_link ? (
                    <iframe
                      title="google-form-exam"
                      src={selectedExam.google_form_link}
                      className="w-full h-[500px] border rounded-lg"
                    />
                  ) : (
                    <p className="text-sm text-slate-400">ยังไม่มีลิงก์ข้อสอบสำหรับวิชานี้</p>
                  )}
                  <button
                    onClick={submitExam}
                    className="w-full mt-3 bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg"
                  >
                    ส่งข้อสอบ / สิ้นสุดการสอบ
                  </button>
                </div>
              )}

              {submitted && (
                <div className="text-center py-4">
                  <div className="text-3xl mb-1">✅</div>
                  <p className="font-semibold text-slate-800">ส่งข้อสอบเรียบร้อยแล้ว</p>
                  <p className="text-xs text-slate-400 mt-1">ขอบคุณสำหรับการเข้าสอบวิชา {selectedExam?.subject}</p>
                  <button
                    onClick={pickAnotherSubject}
                    className="mt-4 bg-primary hover:bg-primary-light text-white text-sm font-semibold px-4 py-2 rounded-lg"
                  >
                    เลือกวิชาอื่นต่อ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <Link to="/login" className="block text-center text-xs text-slate-400 mt-6 hover:underline">
          เข้าสู่ระบบผู้ดูแล
        </Link>
        <p className="text-center text-[11px] text-slate-300 mt-4">ผู้พัฒนาระบบ นายรัฐพงศ์ วะสุรีย์</p>
      </div>
    </div>
  );
}
