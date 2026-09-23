import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import HCPanel from './pages/HCPanel';
import WHPanel from './pages/WHPanel';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import AdminOverview from './pages/AdminOverview';
import AdminHC from './pages/AdminHC';
import AdminWarehouse from './pages/AdminWarehouse';
import AdminArchive from './pages/AdminArchive';
import AdminCodes from './pages/AdminCodes';
import AdminRequests from './pages/AdminRequests';
import AdminGallery from './pages/AdminGallery';
import AdminInvoice from './pages/AdminInvoice';
import AdminLog from './pages/AdminLog';
import AdminPackages from './pages/AdminPackages';
import AdminSettings from './pages/AdminSettings';
import AdminTarif from './pages/AdminTarif';
import PhotoAdmin from './pages/PhotoAdmin';
import { getToken, isUploader } from './utils/auth';

function RequireAdmin({ children }) {
  if (!getToken()) return <Navigate to="/admin" replace />;
  // Akun foto tidak punya urusan dengan panel admin penuh
  if (isUploader()) return <Navigate to="/foto" replace />;
  return children;
}

// Panel upload foto: boleh dibuka akun foto maupun admin
function RequireUploader({ children }) {
  if (!getToken()) return <Navigate to="/admin" replace />;
  return children;
}

function RequireAccess({ panel, children }) {
  const ok = sessionStorage.getItem(`access_${panel}`);
  if (!ok) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* User routes */}
      <Route path="/" element={<Home />} />
      <Route path="/hc" element={<RequireAccess panel="hc"><HCPanel /></RequireAccess>} />
      <Route path="/wh" element={<RequireAccess panel="wh"><WHPanel /></RequireAccess>} />

      {/* Admin login */}
      <Route path="/admin" element={<AdminLogin />} />

      {/* Panel upload foto (mobile) */}
      <Route path="/foto" element={<RequireUploader><PhotoAdmin /></RequireUploader>} />

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
        <Route path="/admin/wh" element={<AdminWarehouse />} />
        <Route path="/admin/gallery"  element={<AdminGallery />} />
        <Route path="/admin/requests" element={<AdminRequests />} />
        <Route path="/admin/archive" element={<AdminArchive />} />
        <Route path="/admin/invoice" element={<AdminInvoice />} />
        <Route path="/admin/tarif" element={<AdminTarif />} />
        <Route path="/admin/codes" element={<AdminCodes />} />
        <Route path="/admin/log" element={<AdminLog />} />
        <Route path="/admin/packages" element={<AdminPackages />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
