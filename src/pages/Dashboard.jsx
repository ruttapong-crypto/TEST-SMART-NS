import { useEffect, useState } from 'react';
import { get, ref } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [counts, setCounts] = useState({ students: 0, exams: 0, sessions: 0, events: 0 });

  useEffect(() => {
    (async () => {
      const paths = ['students', 'exams', 'exam_sessions', 'events_log'];
      const results = await Promise.all(paths.map((p) => get(ref(db, p))));
      setCounts({
        students: results[0].exists() ? Object.keys(results[0].val()).length : 0,
        exams: results[1].exists() ? Object.keys(results[1].val()).length : 0,
        sessions: results[2].exists() ? Object.keys(results[2].val()).length : 0,
        events: results[3].exists() ? Object.keys(results[3].val()).length : 0
      });
    })();
  }, []);

  const cards = [
    { label: 'นักเรียนทั้งหมด', value: counts.students, to: '/reports', color: 'bg-blue-600' },
    { label: 'ข้อสอบที่เปิดใช้งาน', value: counts.exams, to: '/exams', color: 'bg-indigo-600' },
    { label: 'ผู้เข้าสอบสะสม', value: counts.sessions, to: '/reports', color: 'bg-orange-500' },
    { label: 'เหตุการณ์ผิดปกติ', value: counts.events, to: '/monitor', color: 'bg-red-500' }
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="🏠" title="แดชบอร์ด" subtitle="ภาพรวมการสอบและสถานะระบบ" />
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Link key={c.label} to={c.to} className={`rounded-xl p-5 text-white shadow ${c.color}`}>
              <div className="text-sm opacity-90">{c.label}</div>
              <div className="text-3xl font-bold mt-2">{c.value}</div>
            </Link>
          ))}
        </div>

        <div className="px-6 pb-6 grid md:grid-cols-2 gap-4">
          <Link to="/monitor" className="bg-white rounded-xl shadow p-5 hover:ring-2 hover:ring-primary-light">
            <div className="text-lg font-semibold text-slate-800">🔍 Monitor สด</div>
            <p className="text-sm text-slate-500 mt-1">ติดตามเหตุการณ์และนักเรียนเฝ้าระวังแบบเรียลไทม์</p>
          </Link>
          <Link to="/qr-codes" className="bg-white rounded-xl shadow p-5 hover:ring-2 hover:ring-primary-light">
            <div className="text-lg font-semibold text-slate-800">🔲 QR Code แยกระดับชั้น</div>
            <p className="text-sm text-slate-500 mt-1">สร้าง/จัดการ QR Code สำหรับเข้าสอบ ม.1–ม.6</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
