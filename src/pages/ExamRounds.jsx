import { useCallback, useEffect, useState } from 'react';
import { get, push, ref, remove, set } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const EMPTY = { name: '', date: '', start_time: '', end_time: '', note: '' };

export default function ExamRounds() {
  const [rounds, setRounds] = useState([]);
  const [form, setForm] = useState(EMPTY);

  const loadRounds = useCallback(async () => {
    const snap = await get(ref(db, 'exam_rounds'));
    const list = [];
    snap.forEach((c) => list.push({ id: c.key, ...c.val() }));
    setRounds(list);
  }, []);

  useEffect(() => {
    loadRounds();
    const interval = setInterval(loadRounds, 8000);
    return () => clearInterval(interval);
  }, [loadRounds]);

  async function handleSubmit(e) {
    e.preventDefault();
    await set(push(ref(db, 'exam_rounds')), form);
    await loadRounds();
    setForm(EMPTY);
  }

  async function del(id) {
    if (confirm('ยืนยันการลบรอบสอบนี้?')) {
      await remove(ref(db, `exam_rounds/${id}`));
      await loadRounds();
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="🗓️" title="รอบสอบ" subtitle="สร้างและกำหนดรอบสอบ" />
        <div className="p-6 grid lg:grid-cols-3 gap-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-3 h-fit">
            <h3 className="font-semibold text-slate-800">สร้างรอบสอบใหม่</h3>
            <input required placeholder="ชื่อรอบสอบ" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input type="time" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              <input type="time" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <textarea placeholder="หมายเหตุ" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button className="w-full bg-primary text-white py-2 rounded-lg text-sm hover:bg-primary-light">เพิ่มรอบสอบ</button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-slate-800 mb-3">รายการรอบสอบ</h3>
            {rounds.length === 0 && <p className="text-slate-400 text-sm">ยังไม่มีรอบสอบ</p>}
            <div className="space-y-2">
              {rounds.map((r) => (
                <div key={r.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                  <div>
                    <div className="font-medium text-slate-800">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.date} · {r.start_time}-{r.end_time}</div>
                  </div>
                  <button onClick={() => del(r.id)} className="text-xs text-red-500 underline">ลบ</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
