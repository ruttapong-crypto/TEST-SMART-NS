import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { admin: 'Administrator', teacher: 'Teacher', monitor: 'Monitor', staff: 'ผู้ดูและระบบ' };

export default function Topbar({ title, subtitle, icon }) {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="flex items-center justify-between bg-white border-b px-6 py-3">
      <div>
        <div className="text-sm text-slate-500">
          {icon} <span className="mx-1">›</span> <span className="font-semibold text-slate-700">{title}</span>
        </div>
        {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm text-slate-600">
          <div className="font-semibold">{time}</div>
          <div className="text-xs">{date}</div>
        </div>
        <button
          onClick={() => document.documentElement.requestFullscreen?.()}
          className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-slate-50"
          title="ขยายเต็มจอ"
        >
          ⛶
        </button>
        <Link to="/student-login" className="px-3 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary-light">
          หน้าเข้าสอบ
        </Link>
        {user && (
          <span className="text-sm text-slate-500 hidden sm:inline">
            {ROLE_LABEL[user.role] || user.role}
          </span>
        )}
      </div>
    </div>
  );
}
