import { useEffect, useMemo, useState, useCallback } from 'react';
import { get, ref } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import StatCard from '../components/StatCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const LEVELS = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

const EVENT_LABEL = {
  disconnect: 'ขาดการเชื่อมต่อ',
  leave_screen: 'ออกจากหน้าจอ',
  suspicious: 'พฤติกรรมผิดปกติ',
  submitted: 'ส่งข้อสอบแล้ว'
};

export default function Monitor() {
  const [events, setEvents] = useState([]);
  const [studentsCount, setStudentsCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const [levelFilter, setLevelFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [quickLevel, setQuickLevel] = useState('all');

  // หมายเหตุ: ใช้ get() แบบ polling แทน onValue (realtime listener) เพราะบางเครือข่าย
  // (เช่นเครือข่ายโรงเรียนที่มีไฟร์วอลล์บล็อก WebSocket) ทำให้ onValue ค้างได้ข้อมูลไม่ครบ
  // แบบเงียบๆ โดยไม่ error ส่วน get() ทำงานผ่าน HTTPS request ปกติ เชื่อถือได้กว่าในทุกเครือข่าย
  const loadData = useCallback(async () => {
    try {
      const [eventsSnap, studentsSnap] = await Promise.all([
        get(ref(db, 'events_log')),
        get(ref(db, 'students'))
      ]);
      const list = [];
      eventsSnap.forEach((child) => list.push({ id: child.key, ...child.val() }));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setEvents(list);
      setStudentsCount(studentsSnap.exists() ? Object.keys(studentsSnap.val()).length : 0);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[Monitor] โหลดข้อมูลไม่สำเร็จ:', err.message);
    }
  }, []);

  useEffect(() => {
    loadData();
    // อัปเดตทุก 5 วินาที ให้ใกล้เคียง real-time มากที่สุดสำหรับหน้า Monitor สด
    const interval = setInterval(loadData, 5000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const rooms = useMemo(() => [...new Set(events.map((e) => e.class_room).filter(Boolean))], [events]);
  const subjects = useMemo(() => [...new Set(events.map((e) => e.subject).filter(Boolean))], [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const effLevel = quickLevel !== 'all' ? quickLevel : levelFilter;
      if (effLevel !== 'all' && e.level !== effLevel) return false;
      if (roomFilter !== 'all' && e.class_room !== roomFilter) return false;
      if (subjectFilter !== 'all' && e.subject !== subjectFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${e.student_name || ''} ${e.student_code || ''} ${e.class_room || ''} ${e.subject || ''} ${
          EVENT_LABEL[e.event_type] || e.event_type || ''
        }`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [events, levelFilter, roomFilter, subjectFilter, search, quickLevel]);

  // warning_count สูงสุดต่อคน (ใช้ student_code เป็น key)
  const perStudentMaxWarning = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const key = e.student_code || e.session_id;
      const cur = map.get(key) || { name: e.student_name, level: e.level, class_room: e.class_room, max: 0 };
      cur.max = Math.max(cur.max, e.warning_count || 0);
      map.set(key, cur);
    }
    return map;
  }, [events]);

  const watchlist = [...perStudentMaxWarning.values()].filter((s) => s.max >= 4 && s.max < 6);
  const highRisk = [...perStudentMaxWarning.values()].filter((s) => s.max >= 6);

  const levelSummary = LEVELS.map((lv) => ({
    level: lv,
    count: filtered.filter((e) => e.level === lv).length
  }));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="🖥️" title="Monitor สด" subtitle="ดูเหตุการณ์ผิดปกติและติดตามการคุมสอบแบบเรียลไทม์" />

        <div className="p-6">
          {/* Live Control Room banner */}
          <div className="rounded-xl bg-gradient-to-r from-primary to-primary-light text-white p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">LIVE CONTROL ROOM</span>
              <h2 className="text-xl font-bold mt-2">ศูนย์ควบคุมและเฝ้าระวังการสอบ</h2>
              <p className="text-sm text-white/90 mt-1">
                ติดตามเหตุการณ์สด คัดกรองนักเรียนเสี่ยง และตรวจสอบคำเตือนจากหน้าจอเดียว
              </p>
            </div>
            <div className="text-right text-xs text-white/90">
              <div className="bg-white/15 px-2 py-1 rounded-full inline-block mb-1">อัปเดตอัตโนมัติทุก 5 วินาที</div>
              <div>รีเฟรชล่าสุด {lastRefresh.toLocaleTimeString('th-TH')}</div>
              <button
                onClick={loadData}
                className="mt-1 bg-white text-primary px-3 py-1 rounded-lg font-semibold"
              >
                รีเฟรชทันที
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              color="blue"
              title="นักเรียนที่พบในข้อมูล"
              value={studentsCount}
              badge="ข้อมูล"
              note="ไม่จำกัดรหัสนักเรียน"
              linkLabel="ผู้เข้าสอบ"
            />
            <StatCard
              color="darkblue"
              title="เหตุการณ์ตามตัวกรอง"
              value={filtered.length}
              badge="LIVE"
              note="เหตุการณ์ที่แสดงอยู่"
              linkLabel="ข้อมูลสด"
            />
            <StatCard
              color="orange"
              title="นักเรียนเฝ้าระวัง"
              value={watchlist.length}
              badge="4+"
              note="มีคำเตือน 4 ครั้งขึ้นไป"
              linkLabel="การติดตาม"
            />
            <StatCard
              color="red"
              title="ความเสี่ยงสูง"
              value={highRisk.length}
              badge="6+"
              note="มีคำเตือน 6 ครั้งขึ้นไป"
              linkLabel="เฝ้าระวัง"
            />
          </div>

          {/* Filter bar */}
          <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap gap-3 items-center">
            <select className="border rounded-lg px-3 py-2 text-sm" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
              <option value="all">ทุกระดับชั้น</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="all">ทุกห้อง</option>
              {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="all">ทุกรายวิชา</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
              placeholder="🔍 ค้นหา ชื่อ/รหัส/ห้อง/วิชา หรือรายละเอียด"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              onClick={() => { setLevelFilter('all'); setRoomFilter('all'); setSubjectFilter('all'); setSearch(''); setQuickLevel('all'); }}
              className="text-slate-400 hover:text-red-500 text-lg"
              title="ล้างตัวกรอง"
            >
              🗑️
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {['all', ...LEVELS].map((l) => (
              <button
                key={l}
                onClick={() => setQuickLevel(l)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  quickLevel === l ? 'bg-primary text-white border-primary' : 'text-slate-600 border-slate-300'
                }`}
              >
                {l === 'all' ? 'ทั้งหมด' : l}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Event table */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">เหตุการณ์สอบแบบเรียลไทม์</h3>
                  <p className="text-xs text-slate-400">เรื่องจากเหตุการณ์ล่าสุดและเน้นติดตามระดับความเสี่ยง</p>
                </div>
                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">LIVE</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b">
                      <th className="py-2 pr-2">เวลา</th>
                      <th className="py-2 pr-2">ชั้น/ห้อง</th>
                      <th className="py-2 pr-2">นักเรียน</th>
                      <th className="py-2 pr-2">รายวิชา</th>
                      <th className="py-2 pr-2">เหตุการณ์</th>
                      <th className="py-2 pr-2">คำเตือน</th>
                      <th className="py-2 pr-2">เหลือเวลา</th>
                      <th className="py-2 pr-2">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา
                        </td>
                      </tr>
                    )}
                    {filtered.map((e) => (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {e.timestamp ? new Date(e.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="py-2 pr-2">{e.level} / {e.class_room}</td>
                        <td className="py-2 pr-2">{e.student_name || e.student_code}</td>
                        <td className="py-2 pr-2">{e.subject}</td>
                        <td className="py-2 pr-2">{EVENT_LABEL[e.event_type] || e.event_type}</td>
                        <td className="py-2 pr-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            e.warning_count >= 6 ? 'bg-red-100 text-red-600' :
                            e.warning_count >= 4 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {e.warning_count ?? 0}
                          </span>
                        </td>
                        <td className="py-2 pr-2">{e.remaining_time || '-'}</td>
                        <td className="py-2 pr-2 text-primary underline cursor-pointer">ดู</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right panel */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-slate-800 mb-3">รายชื่อเฝ้าระวัง</h3>
                {watchlist.length === 0 && highRisk.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    <div className="text-2xl text-green-500 mb-1">✔️</div>
                    ยังไม่มีนักเรียนที่ต้องเฝ้าระวัง
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {[...highRisk, ...watchlist].map((s, i) => (
                      <li key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <div className="font-medium text-slate-700">{s.name}</div>
                          <div className="text-xs text-slate-400">{s.level} / {s.class_room}</div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          s.max >= 6 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {s.max} ครั้ง
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-slate-800 mb-3">ภาพรวมตามระดับชั้น</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={levelSummary}>
                    <XAxis dataKey="level" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2E75B6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
