import { useEffect, useState } from 'react';
import { get, ref, set } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const DEFAULTS = { school_name: '', primary_color: '#1F4E79', accent_color: '#2E75B6', watch_threshold: 4, risk_threshold: 6 };

export default function Settings() {
  const [form, setForm] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await get(ref(db, 'settings'));
      if (snap.exists()) setForm({ ...DEFAULTS, ...snap.val() });
    })();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await set(ref(db, 'settings'), form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="⚙️" title="ตั้งค่าระบบ" subtitle="ปรับแต่ง Branding และค่าพื้นฐาน" />
        <div className="p-6 max-w-xl">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-4">
            <div>
              <label className="text-sm text-slate-500">ชื่อโรงเรียน</label>
              <input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500">สีหลัก</label>
                <input type="color" className="w-full h-10 border rounded-lg mt-1"
                  value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-slate-500">สีรอง</label>
                <input type="color" className="w-full h-10 border rounded-lg mt-1"
                  value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500">เกณฑ์เฝ้าระวัง (คำเตือน)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                  value={form.watch_threshold} onChange={(e) => setForm({ ...form, watch_threshold: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm text-slate-500">เกณฑ์ความเสี่ยงสูง (คำเตือน)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                  value={form.risk_threshold} onChange={(e) => setForm({ ...form, risk_threshold: Number(e.target.value) })} />
              </div>
            </div>
            <button className="w-full bg-primary text-white py-2.5 rounded-lg text-sm hover:bg-primary-light">
              {saved ? '✓ บันทึกแล้ว' : 'บันทึกการตั้งค่า'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
