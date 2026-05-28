import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import HCPanel from './pages/HCPanel';
import WHPanel from './pages/WHPanel';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminCodes from './pages/AdminCodes';

function RequireAdmin({ children }) {
  const token = sessionStorage.getItem('admin_token');
  if (!token) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/hc" element={<HCPanel />} />
      <Route path="/wh" element={<WHPanel />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/codes" element={<RequireAdmin><AdminCodes /></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
