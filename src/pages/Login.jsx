import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: '🛠️', label: 'Administrator' },
  { icon: '👁️', label: 'Live Monitor' },
  { icon: '🔒', label: 'Secure Access' },
  { icon: '📊', label: 'Smart Dashboard' }
];

const ROLE_HOME = {
  admin: '/dashboard',
  teacher: '/exams',
  monitor: '/monitor',
  staff: '/monitor'
};

export default function Login() {
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const profile = await loginAdmin(username, password);
      navigate(ROLE_HOME[profile.role] || '/monitor');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* ฝั่งซ้าย */}
      <div className="relative hidden md:flex flex-col justify-center px-12 text-white bg-[url('https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=60')] bg-cover bg-center">
        <div className="absolute inset-0 bg-primary/80" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold">SmartExam</h1>
          <p className="text-lg mt-1 opacity-90">Schoolwide Control Center</p>
          <p className="mt-4 text-white/90">ควบคุมการสอบอย่างเป็นระบบ</p>
          <div className="grid grid-cols-2 gap-3 mt-8">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-white/10 rounded-lg px-4 py-3 backdrop-blur-sm">
                <div className="text-xl">{f.icon}</div>
                <div className="text-sm mt-1">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ฝั่งขวา */}
      <div className="flex flex-col justify-center px-8 md:px-16 bg-white">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">เข้าสู่ระบบผู้ดูแล</h2>
        <p className="text-sm text-slate-400 mb-6">
          กรอกชื่อผู้ใช้และรหัสผ่าน ระบบจะพาไปยังหน้าที่ตรงกับสิทธิ์ของคุณโดยอัตโนมัติ
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-500">Username</label>
            <div className="mt-1 flex items-center border rounded-lg px-3">
              <span className="text-slate-400">👤</span>
              <input
                className="w-full px-2 py-2 outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้ หรืออีเมล (สำหรับครู)"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-500">Password</label>
            <div className="mt-1 flex items-center border rounded-lg px-3">
              <span className="text-slate-400">🔒</span>
              <input
                type={showPw ? 'text' : 'password'}
                className="w-full px-2 py-2 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="text-slate-400 text-sm">
                {showPw ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-6 border rounded-lg p-3">
          <div><span className="font-semibold text-slate-500">Administrator</span><br />บริหารจัดการระบบทั้งหมด</div>
          <div><span className="font-semibold text-slate-500">Teacher</span><br />จัดการข้อสอบวิชาของตนเอง</div>
          <div><span className="font-semibold text-slate-500">Monitor</span><br />ดูสถานะการสอบเท่านั้น</div>
          <div><span className="font-semibold text-slate-500">Staff</span><br />ดูสถานะการสอบตามระดับชั้น</div>
        </div>

        <Link to="/student-login" className="text-sm text-primary text-center mt-6 hover:underline">
          ← กลับหน้าเข้าสอบนักเรียน
        </Link>

        <div className="text-xs text-slate-400 text-center mt-8 border-t pt-4">
          ระบบรักษาความปลอดภัยด้วย Password Hash และ Session
          <br />
          ผู้พัฒนาระบบ นายรัฐพงศ์ วะสุรีย์
        </div>
      </div>
    </div>
  );
}
