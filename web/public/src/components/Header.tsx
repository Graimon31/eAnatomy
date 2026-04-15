import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function Header() {
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState('ru');
  const { isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/${lang}/search?q=${encodeURIComponent(search)}`);
  };

  return (
    <header className="bg-slate-900 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-bold tracking-tight shrink-0">
          eAnatomy
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск анатомических структур..."
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
          >
            <option value="ru">RU</option>
            <option value="en">EN</option>
            <option value="la">LA</option>
          </select>

          {isAuthenticated ? (
            <>
              <Link to="/account/profile" className="text-sm hover:text-blue-400">Профиль</Link>
              <button onClick={logout} className="text-sm text-slate-400 hover:text-white">Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm hover:text-blue-400">Войти</Link>
              <Link to="/register" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
                Подписаться
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
