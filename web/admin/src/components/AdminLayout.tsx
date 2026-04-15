import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import Sidebar from './Sidebar';

export default function AdminLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
