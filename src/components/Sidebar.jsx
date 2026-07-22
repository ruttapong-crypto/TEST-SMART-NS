import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ICONS = {
  home: '🏠',
  dashboard: '📊',
  exams: '📝',
  reports: '📁',
  chart: '📈',
  filter: '🔍',
  users: '👥',
  teachers: '🧑‍🏫',
  qr: '🔲',
  logout: '🚪'
};

const ITEMS = [
  { to: '/dashboard', icon: 'home', label: 'หน้าหลัก', roles: ['admin'] },
  { to: '/monitor', icon: 'home', label: 'หน้าหลัก', roles: ['monitor', 'staff'] },
  { to: '/students', icon: 'users', label: 'จัดการนักเรียน', roles: ['admin'] },
  { to: '/teachers', icon: 'teachers', label: 'จัดการครู', roles: ['admin'] },
  { to: '/exams', icon: 'exams', label: 'จัดการข้อสอบ', roles: ['admin', 'teacher'] },
  { to: '/monitor', icon: 'filter', label: 'Monitor สด', roles: ['admin'] },
  { to: '/qr-codes', icon: 'qr', label: 'QR Code', roles: ['admin'] },
  { to: '/reports', icon: 'reports', label: 'รายงาน', roles: ['admin'] },
  { to: '/settings', icon: 'users', label: 'ตั้งค่าระบบ', roles: ['admin'] }
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <aside className="flex flex-col items-center gap-4 bg-primary text-white w-16 py-6 min-h-screen shrink-0">
      {ITEMS.filter((i) => i.roles.includes(user.role)).map((item) => (
        <NavLink
          key={`${item.to}-${item.label}`}
          to={item.to}
          title={item.label}
          className={({ isActive }) =>
            `w-10 h-10 flex items-center justify-center rounded-lg text-lg hover:bg-white/20 transition ${
              isActive ? 'bg-white/25' : ''
            }`
          }
        >
          <span>{ICONS[item.icon]}</span>
        </NavLink>
      ))}
      <button
        onClick={logout}
        title="ออกจากระบบ"
        className="mt-auto w-10 h-10 flex items-center justify-center rounded-lg text-lg hover:bg-white/20 transition"
      >
        {ICONS.logout}
      </button>
    </aside>
  );
}
