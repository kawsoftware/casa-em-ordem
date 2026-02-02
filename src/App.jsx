import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ServiceManager from './pages/ServiceManager';
import Collaborators from './pages/Collaborators';
import { Toaster } from 'sonner';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-gray-500">Iniciando aplicação...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout><Outlet /></Layout>;
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
            <Route path="/signup" element={<SignUp />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/services" element={<ServiceManager />} />
            <Route path="/collaborators" element={<Collaborators />} />
            <Route path="/reports" element={<Reports />} />
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
