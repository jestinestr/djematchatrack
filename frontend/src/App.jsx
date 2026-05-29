import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import HCPanel from './pages/HCPanel';
import WHPanel from './pages/WHPanel';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import AdminOverview from './pages/AdminOverview';
import AdminHC from './pages/AdminHC';
import AdminWH from './pages/AdminWH';
import AdminArchive from './pages/AdminArchive';
import AdminCodes from './pages/AdminCodes';
import AdminRequests from './pages/AdminRequests';
import AdminGallery from './pages/AdminGallery';

function RequireAdmin({ children }) {
  const token = sessionStorage.getItem('admin_token');
  if (!token) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* User routes */}
      <Route path="/" element={<Home />} />
      <Route path="/hc" element={<HCPanel />} />
      <Route path="/wh" element={<WHPanel />} />

      {/* Admin login */}
      <Route path="/admin" element={<AdminLogin />} />

      {/* Admin panel with sidebar layout */}
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/admin/dashboard" element={<AdminOverview />} />
        <Route path="/admin/hc" element={<AdminHC />} />
        <Route path="/admin/wh" element={<AdminWH />} />
        <Route path="/admin/gallery"  element={<AdminGallery />} />
        <Route path="/admin/requests" element={<AdminRequests />} />
        <Route path="/admin/archive" element={<AdminArchive />} />
        <Route path="/admin/codes" element={<AdminCodes />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
