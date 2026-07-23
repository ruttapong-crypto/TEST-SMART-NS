import { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function Settings() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState(null); // { type, text }
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);

    if (newPassword.length < 6) {
      setMsg({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' });
      return;
    }

    setBusy(true);
    try {
      await update(ref(db, `users/${user.id}`), { password_hash: newPassword });
      setMsg({ type: 'success', text: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ใช้รหัสใหม่ในการล็อกอินครั้งถัดไป' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMsg({ type: 'error', text: 'เกิดข้อผิดพลาด ไม่สามารถเปลี่ยนรหัสผ่านได้' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="⚙️" title="ตั้งค่าระบบ" subtitle="เปลี่ยนรหัสผ่านผู้ดูแลระบบ" />
        <div className="p-6 max-w-md">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-4">
            <h3 className="font-semibold text-slate-800">เปลี่ยนรหัสผ่าน</h3>
            <p className="text-xs text-slate-400">
              บัญชี: <span className="font-medium text-slate-600">{user?.username}</span>
            </p>

            <div>
              <label className="text-sm text-slate-500">รหัสผ่านใหม่</label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
            </div>
            <div>
              <label className="text-sm text-slate-500">ยืนยันรหัสผ่านใหม่</label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              />
            </div>

            {msg && (
              <div className={`text-sm rounded-lg px-3 py-2 ${
                msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {msg.type === 'success' ? '✅ ' : '⚠️ '}{msg.text}
              </div>
            )}

            <button
              disabled={busy}
              className="w-full bg-primary hover:bg-primary-light text-white py-2.5 rounded-lg text-sm disabled:opacity-60"
            >
              {busy ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
