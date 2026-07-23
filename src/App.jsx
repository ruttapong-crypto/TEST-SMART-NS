import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import StudentLogin from './pages/StudentLogin';
import Dashboard from './pages/Dashboard';
import Monitor from './pages/Monitor';
import Exams from './pages/Exams';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import ExamRounds from './pages/ExamRounds';
import QuickExam from './pages/QuickExam';
import QRCodes from './pages/QRCodes';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/student-login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/student/exam" element={<Navigate to="/student-login" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allow={['admin']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitor"
          element={
            <ProtectedRoute allow={['admin', 'monitor', 'staff']}>
              <Monitor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exams"
          element={
            <ProtectedRoute allow={['admin', 'teacher']}>
              <Exams />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teachers"
          element={
            <ProtectedRoute allow={['admin']}>
              <Teachers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students"
          element={
            <ProtectedRoute allow={['admin']}>
              <Students />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam-rounds"
          element={
            <ProtectedRoute allow={['admin']}>
              <ExamRounds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quick-exam"
          element={
            <ProtectedRoute allow={['admin']}>
              <QuickExam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/qr-codes"
          element={
            <ProtectedRoute allow={['admin']}>
              <QRCodes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allow={['admin']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allow={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/student-login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
