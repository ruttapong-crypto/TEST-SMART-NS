import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function StudentLogin() {
  const { loginStudent } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const level = params.get('level'); // เช่น M1 จาก QR Code
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginStudent(code.trim());
      navigate('/student/exam');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-light px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-800 text-center">SmartExam</h1>
        <p className="text-center text-slate-500 text-sm mb-6">หน้าเข้าสอบนักเรียน</p>

        {level && (
          <div className="text-center text-sm bg-blue-50 text-primary rounded-lg py-2 mb-4">
            กำลังเข้าสอบระดับชั้น <strong>{level}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-500">รหัสนักเรียน</label>
            <input
              className="w-full mt-1 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-light"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="กรอกรหัสนักเรียน"
              required
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {busy ? 'กำลังตรวจสอบ...' : 'เข้าสอบ'}
          </button>
        </form>

        <Link to="/login" className="block text-center text-xs text-slate-400 mt-6 hover:underline">
          เข้าสู่ระบบผู้ดูแล
        </Link>
      </div>
    </div>
  );
}
