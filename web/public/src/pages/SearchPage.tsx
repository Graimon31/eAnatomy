import { useSearchParams } from 'react-router-dom';
import { useSearch } from '../api/hooks';

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q') || '';
  const { data, isLoading } = useSearch(query, 'ru');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Результаты поиска</h1>
      <p className="text-slate-500 mb-8">По запросу «{query}»</p>

      {isLoading ? (
        <p className="text-slate-500">Поиск...</p>
      ) : data?.terms?.length ? (
        <div className="space-y-3">
          {data.terms.map((term) => (
            <div key={term.id} className="bg-white rounded-lg p-4 border border-slate-200">
              <h3 className="font-medium text-slate-900">{term.ru || term.en}</h3>
              {term.la && (
                <p className="text-sm text-slate-500 italic">{term.la}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">Ничего не найдено</p>
      )}
    </div>
  );
}
