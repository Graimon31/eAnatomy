import { useAuthStore } from '../store/auth';

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">Необходимо войти в аккаунт</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Профиль</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-500">Имя</label>
          <p className="text-slate-900">{user?.name || '—'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500">Email</label>
          <p className="text-slate-900">{user?.email || '—'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500">Роль</label>
          <p className="text-slate-900">{user?.role || '—'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500">Организация</label>
          <p className="text-slate-900">{user?.institution || '—'}</p>
        </div>
      </div>
    </div>
  );
}
