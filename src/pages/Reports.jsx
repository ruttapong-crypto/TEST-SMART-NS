import { useCallback, useEffect, useMemo, useState } from 'react';
import { get, ref, update } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const COLUMN_DEFS = [
  { key: 'student_code', label: 'รหัสนักเรียน' },
  { key: 'student_name', label: 'ชื่อ-นามสกุล' },
  { key: 'level', label: 'ระดับชั้น' },
  { key: 'class_room', label: 'ห้อง' },
  { key: 'subject', label: 'วิชา' },
  { key: 'start_time', label: 'เวลาเริ่ม' },
  { key: 'submit_time', label: 'เวลาส่ง' },
  { key: 'duration', label: 'เวลาที่ใช้ทำ' },
  { key: 'device_info', label: 'อุปกรณ์' },
  { key: 'status', label: 'สถานะ' },
  { key: 'score', label: 'คะแนน' }
];
const DEFAULT_COLUMNS = ['student_code', 'student_name', 'subject', 'start_time', 'duration', 'status', 'score'];

function fmtTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtDuration(startMs, endMs) {
  if (!startMs || !endMs || endMs < startMs) return '-';
  const secs = Math.round((endMs - startMs) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m} นาที ${s} วินาที`;
}

export default function Reports() {
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState({});
  const [exams, setExams] = useState({});
  const [levelFilter, setLevelFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const loadData = useCallback(async () => {
    const [sessionsSnap, studentsSnap, examsSnap] = await Promise.all([
      get(ref(db, 'exam_sessions')),
      get(ref(db, 'students')),
      get(ref(db, 'exams'))
    ]);
    const list = [];
    sessionsSnap.forEach((c) => list.push({ id: c.key, ...c.val() }));
    list.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
    setSessions(list);

    const studentMap = {};
    studentsSnap.forEach((c) => { studentMap[c.key] = c.val(); });
    setStudents(studentMap);

    const examMap = {};
    examsSnap.forEach((c) => { examMap[c.key] = c.val(); });
    setExams(examMap);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  // รวมข้อมูล session เข้ากับชื่อนักเรียน/วิชา ให้อ่านง่าย พร้อมคำนวณระยะเวลาที่ใช้ทำ
  const enriched = useMemo(() => sessions.map((s) => {
    const student = students[s.student_id] || {};
    const exam = exams[s.exam_id] || {};
    return {
      ...s,
      student_code: student.student_code || '-',
      student_name: student.name || '(ไม่พบข้อมูลนักเรียน)',
      level: student.level || exam.level || '-',
      class_room: student.class_room || '-',
      subject: exam.subject || '(ไม่พบข้อมูลวิชา)',
      duration: fmtDuration(s.start_time, s.submit_time)
    };
  }), [sessions, students, exams]);

  const levels = [...new Set(enriched.map((s) => s.level).filter((l) => l && l !== '-'))].sort();
  const subjects = [...new Set(enriched.map((s) => s.subject).filter(Boolean))].sort();

  const filtered = enriched.filter((s) => {
    if (levelFilter !== 'all' && s.level !== levelFilter) return false;
    if (subjectFilter !== 'all' && s.subject !== subjectFilter) return false;
    return true;
  });

  // สรุปคะแนน/จำนวนผู้เข้าสอบแยกตามวิชา
  const summaryBySubject = useMemo(() => {
    const map = new Map();
    for (const s of filtered) {
      const cur = map.get(s.subject) || { subject: s.subject, started: 0, submitted: 0, totalDurationSec: 0, durationCount: 0 };
      cur.started += 1;
      if (s.status === 'submitted') {
        cur.submitted += 1;
        if (s.start_time && s.submit_time && s.submit_time > s.start_time) {
          cur.totalDurationSec += Math.round((s.submit_time - s.start_time) / 1000);
          cur.durationCount += 1;
        }
      }
      map.set(s.subject, cur);
    }
    return [...map.values()];
  }, [filtered]);

  function toggleColumn(key) {
    setColumns((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  function cellValue(row, key) {
    if (key === 'start_time') return fmtTime(row.start_time);
    if (key === 'submit_time') return fmtTime(row.submit_time);
    if (key === 'status') return row.status === 'submitted' ? 'ส่งแล้ว' : 'กำลังทำ';
    if (key === 'score') return row.score ?? '';
    return row[key] ?? '';
  }

  async function saveScore(sessionId, value) {
    const num = value === '' ? null : Number(value);
    await update(ref(db, `exam_sessions/${sessionId}`), { score: num });
  }

  function exportCsv() {
    const header = columns.map((c) => COLUMN_DEFS.find((d) => d.key === c)?.label || c).join(',');
    const rows = filtered.map((row) =>
      columns.map((c) => `"${String(cellValue(row, c)).replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob(['\uFEFF' + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartexam_รายงาน.csv';
    a.click();
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="📁" title="ข้อมูลและรายงาน" subtitle="สรุปคะแนน ประวัติการเข้าสอบ และจำนวนผู้เข้าทำโดยละเอียด" />

        <div className="p-6 space-y-6">
          {/* สรุปตามวิชา */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-slate-800 mb-3">สรุปจำนวนผู้เข้าทำและเวลาเฉลี่ยแยกตามวิชา</h3>
            {summaryBySubject.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีข้อมูลการเข้าสอบ</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {summaryBySubject.map((s) => (
                <div key={s.subject} className="border rounded-lg p-3">
                  <div className="font-medium text-slate-800 text-sm">{s.subject}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    เข้าทำ {s.started} คน · ส่งแล้ว {s.submitted} คน
                  </div>
                  <div className="text-xs text-slate-400">
                    เวลาเฉลี่ย {s.durationCount > 0 ? `${Math.round(s.totalDurationSec / s.durationCount / 60)} นาที` : '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ตัวกรอง + เลือกคอลัมน์ + export */}
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <select className="border rounded-lg px-3 py-1.5 text-sm" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                <option value="all">ทุกระดับชั้น</option>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <select className="border rounded-lg px-3 py-1.5 text-sm" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                <option value="all">ทุกวิชา</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <div className="relative">
                <button
                  onClick={() => setShowColumnPicker((v) => !v)}
                  className="border rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  🧩 เลือกรายละเอียดที่จะแสดง ({columns.length})
                </button>
                {showColumnPicker && (
                  <div className="absolute z-10 mt-1 bg-white border rounded-lg shadow-lg p-3 w-56 grid grid-cols-1 gap-1">
                    {COLUMN_DEFS.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={exportCsv} className="ml-auto bg-primary text-white px-4 py-1.5 rounded-lg text-sm hover:bg-primary-light">
                ⬇ Export CSV
              </button>
            </div>
          </div>

          {/* ตารางรายละเอียด */}
          <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b">
                  {columns.map((c) => (
                    <th key={c} className="py-2 pr-2 whitespace-nowrap">{COLUMN_DEFS.find((d) => d.key === c)?.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={columns.length || 1} className="py-8 text-center text-slate-400">ยังไม่มีข้อมูลการเข้าสอบ</td></tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                    {columns.map((c) => (
                      <td key={c} className="py-2 pr-2 whitespace-nowrap">
                        {c === 'status' ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            s.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {s.status === 'submitted' ? 'ส่งแล้ว' : 'กำลังทำ'}
                          </span>
                        ) : c === 'score' ? (
                          <input
                            type="number"
                            className="w-16 border rounded px-1 py-0.5 text-xs"
                            defaultValue={s.score ?? ''}
                            onBlur={(e) => saveScore(s.id, e.target.value)}
                            placeholder="-"
                          />
                        ) : (
                          cellValue(s, c)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {columns.includes('score') && (
              <p className="text-xs text-slate-400 mt-2">
                * คะแนนกรอกเองโดยครู/แอดมิน (ระบบยังไม่เชื่อมคะแนนอัตโนมัติจาก Google Form) — พิมพ์แล้วคลิกออกจากช่องเพื่อบันทึก
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
