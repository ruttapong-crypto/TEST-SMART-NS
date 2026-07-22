import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function Reports() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    return onValue(ref(db, 'exam_sessions'), (snap) => {
      const list = [];
      snap.forEach((c) => list.push({ id: c.key, ...c.val() }));
      list.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
      setSessions(list);
    });
  }, []);

  function exportCsv() {
    const header = 'session_id,student_id,exam_id,start_time,submit_time,device_info,status\n';
    const rows = sessions
      .map((s) => [s.id, s.student_id, s.exam_id, s.start_time, s.submit_time || '', s.device_info || '', s.status].join(','))
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartexam_sessions.csv';
    a.click();
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="📁" title="ข้อมูลและรายงาน" subtitle="ตรวจสอบข้อมูลผู้เข้าสอบและประวัติ" />
        <div className="p-6">
          <div className="flex justify-end mb-3">
            <button onClick={exportCsv} className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-light">
              ⬇ Export CSV
            </button>
          </div>
          <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b">
                  <th className="py-2 pr-2">Session ID</th>
                  <th className="py-2 pr-2">Student</th>
                  <th className="py-2 pr-2">Exam</th>
                  <th className="py-2 pr-2">อุปกรณ์</th>
                  <th className="py-2 pr-2">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">ยังไม่มีข้อมูลการเข้าสอบ</td></tr>
                )}
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 text-xs text-slate-400">{s.id.slice(0, 8)}</td>
                    <td className="py-2 pr-2">{s.student_id}</td>
                    <td className="py-2 pr-2">{s.exam_id}</td>
                    <td className="py-2 pr-2 text-xs">{s.device_info}</td>
                    <td className="py-2 pr-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {s.status === 'submitted' ? 'ส่งแล้ว' : 'กำลังทำ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
