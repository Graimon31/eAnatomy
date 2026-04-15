import { Link } from 'react-router-dom';
import { useRegions, useModules } from '../api/hooks';

export default function HomePage() {
  const { data: regions } = useRegions();
  const { data: modules } = useModules({ limit: 6 });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <section className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Интерактивный анатомический атлас
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Изучайте анатомию с помощью медицинских снимков МРТ, КТ и рентгена
          с интерактивными аннотациями
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">Регионы</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {regions?.map((region) => (
            <Link
              key={region.id}
              to={`/ru/atlas/${region.slug}`}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-slate-200 text-center"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                <span className="text-2xl">🧠</span>
              </div>
              <h3 className="font-medium text-slate-900">
                {region.name_translations?.ru || region.slug}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">Модули</h2>
          <Link to="/ru/atlas" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Все модули →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules?.items?.map((mod) => (
            <Link
              key={mod.id}
              to={`/ru/atlas/${mod.region?.slug || 'all'}/${mod.slug}`}
              className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-slate-200"
            >
              <div className="h-40 bg-slate-200 flex items-center justify-center">
                <span className="text-slate-400 text-sm">Preview</span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {mod.access_level === 'premium' && (
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">
                      Premium
                    </span>
                  )}
                  {mod.modality && (
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                      {mod.modality.code}
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-slate-900">
                  {mod.meta_title_translations?.ru || mod.slug}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
