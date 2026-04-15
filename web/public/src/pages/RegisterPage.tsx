import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister } from '../api/hooks';
import { useAuthStore } from '../store/auth';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const register = useRegister();
  const authLogin = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await register.mutateAsync({ name, email, password });
      authLogin(data.user, data.access_token, data.refresh_token);
      navigate('/');
    } catch {
      setError('Ошибка регистрации. Возможно, email уже занят.');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900 mb-8 text-center">Регистрация</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
        {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Имя</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full border border-slate-300 rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full border border-slate-300 rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
            className="w-full border border-slate-300 rounded-lg px-3 py-2" />
        </div>
        <button type="submit" disabled={register.isPending}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {register.isPending ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
        <p className="text-center text-sm text-slate-500">
          Уже есть аккаунт? <Link to="/login" className="text-blue-600 hover:underline">Войти</Link>
        </p>
      </form>
    </div>
  );
}
