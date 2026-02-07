import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import SignUpCompany from './pages/SignUpCompany';
import ServiceManager from './pages/ServiceManager';
import Collaborators from './pages/Collaborators';
import AuditQueue from './pages/AuditQueue';
import SetPassword from './pages/SetPassword';
import { Toaster } from 'sonner';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-gray-500">Iniciando aplicação...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />; // Removed Layout wrapper to allow full-screen pages
};

const PublicRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-gray-500">Iniciando aplicação...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUpCompany />} />
          </Route>

          <Route path="/definir-senha" element={<SetPassword />} />

          <Route element={<ProtectedRoute />}>
            {/* Pages with Main Layout */}
            <Route element={<Layout><Outlet /></Layout>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/services" element={<ServiceManager />} />
              <Route path="/collaborators" element={<Collaborators />} />
              <Route path="/reports" element={<Reports />} />
            </Route>

            {/* Full Screen Pages */}
            <Route path="/audit" element={<AuditQueue />} />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}

export default App;
