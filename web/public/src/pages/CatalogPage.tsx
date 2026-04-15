import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useModules, useRegions, useModalities } from '../api/hooks';

export default function CatalogPage() {
  const { lang = 'ru', region } = useParams();
  const [page, setPage] = useState(1);
  const [regionFilter, setRegionFilter] = useState<number | undefined>();
  const [modalityFilter, setModalityFilter] = useState<number | undefined>();
  const [accessFilter, setAccessFilter] = useState<string | undefined>();

  const { data: regions } = useRegions();
  const { data: modalities } = useModalities();
  const { data: modules, isLoading } = useModules({
    region: regionFilter,
    modality: modalityFilter,
    access: accessFilter,
    lang,
    page,
    limit: 12,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Каталог модулей</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Регион</label>
              <select
                value={regionFilter || ''}
                onChange={(e) => setRegionFilter(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Все регионы</option>
                {regions?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name_translations?.ru || r.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Модальность</label>
              <select
                value={modalityFilter || ''}
                onChange={(e) => setModalityFilter(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Все</option>
                {modalities?.map((m) => (
                  <option key={m.id} value={m.id}>{m.name_translations?.ru || m.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Доступ</label>
              <select
                value={accessFilter || ''}
                onChange={(e) => setAccessFilter(e.target.value || undefined)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Все</option>
                <option value="free">Бесплатные</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Загрузка...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {modules?.items?.map((mod) => (
                  <Link
                    key={mod.id}
                    to={`/${lang}/atlas/${mod.region?.slug || 'all'}/${mod.slug}`}
                    className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-slate-200"
                  >
                    <div className="h-36 bg-slate-200 flex items-center justify-center">
                      <span className="text-slate-400 text-sm">Preview</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {mod.access_level === 'premium' && (
                          <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">Premium</span>
                        )}
                      </div>
                      <h3 className="font-medium text-slate-900">{mod.meta_title_translations?.ru || mod.slug}</h3>
                    </div>
                  </Link>
                ))}
              </div>
              {modules && modules.total > modules.limit && (
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50"
                  >←</button>
                  <span className="px-4 py-2 text-sm text-slate-600">
                    {page} / {Math.ceil(modules.total / modules.limit)}
                  </span>
                  <button
                    disabled={page >= Math.ceil(modules.total / modules.limit)}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50"
                  >→</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
