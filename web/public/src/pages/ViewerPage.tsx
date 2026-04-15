import { useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useModule, useModuleSlices, useSliceAnnotations } from '../api/hooks';
import { useViewerStore } from '../store/viewer';
import type { Annotation } from '../api/types';

export default function ViewerPage() {
  const { slug, lang = 'ru' } = useParams();
  const { data: moduleData } = useModule(slug);
  const {
    currentSliceIndex, currentProjectionId, currentModeId,
    activeAnnotation, visibleCategories,
    setSliceIndex, setProjectionId, setModeId, setActiveAnnotation, toggleCategory,
  } = useViewerStore();

  const mod = moduleData?.module;
  const projections = mod?.projections || [];
  const modes = mod?.modes || [];

  // Set default projection
  useEffect(() => {
    if (projections.length > 0 && !currentProjectionId) {
      setProjectionId(projections[0].id);
    }
  }, [projections, currentProjectionId, setProjectionId]);

  const { data: slicesData } = useModuleSlices(slug, currentProjectionId ?? undefined, currentModeId ?? undefined);
  const slices = slicesData?.items || [];
  const currentSlice = slices[currentSliceIndex];
  const { data: annotations } = useSliceAnnotations(currentSlice?.id, lang);

  // Preload adjacent slices
  useEffect(() => {
    const range = slices.slice(
      Math.max(0, currentSliceIndex - 3),
      Math.min(slices.length, currentSliceIndex + 4),
    );
    range.forEach((s) => {
      const img = s.images?.[0];
      if (img) {
        const preload = new Image();
        preload.src = img.image_url;
      }
    });
  }, [currentSliceIndex, slices]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentSliceIndex < slices.length - 1) {
        setSliceIndex(currentSliceIndex + 1);
      }
      if (e.key === 'ArrowLeft' && currentSliceIndex > 0) {
        setSliceIndex(currentSliceIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentSliceIndex, slices.length, setSliceIndex]);

  const currentImage = currentSlice?.images?.[0];

  // Collect unique categories from annotations
  const categories = useMemo(() => {
    if (!annotations) return [];
    const cats = new Map<string, string>();
    annotations.forEach((a) => {
      if (a.category && !cats.has(a.category)) {
        cats.set(a.category, a.color_hex || '#6b7280');
      }
    });
    return Array.from(cats.entries()).map(([name, color]) => ({ name, color }));
  }, [annotations]);

  const filteredAnnotations = useMemo(() => {
    if (!annotations) return [];
    if (visibleCategories.size === 0) return annotations;
    return annotations.filter((a) => visibleCategories.has(a.category));
  }, [annotations, visibleCategories]);

  const handleAnnotationClick = useCallback((a: Annotation) => {
    setActiveAnnotation(activeAnnotation?.id === a.id ? null : a);
  }, [activeAnnotation, setActiveAnnotation]);

  if (!mod) return <div className="flex items-center justify-center h-96 text-slate-500">Загрузка...</div>;

  if (moduleData?.locked) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">{mod.meta_title_translations?.ru || mod.slug}</h1>
        <p className="text-slate-600 mb-6">Этот модуль доступен только по подписке. Доступен предпросмотр первых 3 срезов.</p>
        <a href="/register" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700">
          Оформить подписку
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Top info bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between text-sm">
        <h1 className="font-semibold text-slate-900">{mod.meta_title_translations?.ru || mod.slug}</h1>
        <span className="text-slate-500">
          Срез {currentSliceIndex + 1} / {slices.length}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Projections sidebar */}
        <div className="w-20 bg-slate-100 border-r flex flex-col items-center py-4 gap-2 shrink-0">
          {projections.map((p) => (
            <button
              key={p.id}
              onClick={() => setProjectionId(p.id)}
              className={`w-14 h-14 rounded-lg text-xs font-medium flex items-center justify-center transition-colors ${
                currentProjectionId === p.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border'
              }`}
            >
              {p.type.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>

        {/* Canvas area */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          {currentImage ? (
            <>
              <img
                src={currentImage.image_url}
                alt={`Slice ${currentSlice.slice_number}`}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
              {/* SVG Annotation Layer */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {filteredAnnotations.map((a) => (
                  <g key={a.id} className="pointer-events-auto cursor-pointer" onClick={() => handleAnnotationClick(a)}>
                    <circle
                      cx={`${a.x * 100}%`}
                      cy={`${a.y * 100}%`}
                      r="8"
                      fill={a.color_hex || '#3b82f6'}
                      fillOpacity={0.8}
                      stroke="white"
                      strokeWidth="2"
                      className="transition-all hover:r-10"
                    />
                    <line
                      x1={`${a.x * 100}%`}
                      y1={`${a.y * 100}%`}
                      x2={`${Math.min(a.x * 100 + 10, 95)}%`}
                      y2={`${a.y * 100}%`}
                      stroke="white"
                      strokeWidth="1.5"
                      opacity={0.7}
                    />
                    <text
                      x={`${Math.min(a.x * 100 + 12, 95)}%`}
                      y={`${a.y * 100}%`}
                      fill="white"
                      fontSize="11"
                      dominantBaseline="middle"
                      className="select-none"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                    >
                      {a.term_name}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Active annotation card */}
              {activeAnnotation && (
                <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg p-4 max-w-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: activeAnnotation.color_hex || '#3b82f6' }}
                    />
                    <span className="text-xs text-slate-500">{activeAnnotation.category}</span>
                  </div>
                  <p className="font-semibold text-slate-900">{activeAnnotation.term_name}</p>
                </div>
              )}
            </>
          ) : (
            <span className="text-slate-500">Нет изображения</span>
          )}
        </div>

        {/* Controls sidebar */}
        <div className="w-56 bg-white border-l overflow-y-auto shrink-0 hidden lg:block">
          {/* Imaging modes */}
          {modes.length > 0 && (
            <div className="p-4 border-b">
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Режим</h3>
              <div className="flex flex-wrap gap-1">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModeId(currentModeId === m.id ? null : m.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      currentModeId === m.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category filters */}
          {categories.length > 0 && (
            <div className="p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Структуры</h3>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <label key={cat.name} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={visibleCategories.size === 0 || visibleCategories.has(cat.name)}
                      onChange={() => toggleCategory(cat.name)}
                      className="rounded"
                    />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm text-slate-700">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Module description */}
          <div className="p-4 border-t">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Описание</h3>
            <p className="text-sm text-slate-600">
              {mod.meta_desc_translations?.ru || 'Нет описания'}
            </p>
          </div>
        </div>
      </div>

      {/* Slider panel */}
      <div className="bg-white border-t px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSliceIndex(Math.max(0, currentSliceIndex - 1))}
            disabled={currentSliceIndex <= 0}
            className="p-2 rounded hover:bg-slate-100 disabled:opacity-30"
          >◄</button>
          <input
            type="range"
            min={0}
            max={Math.max(0, slices.length - 1)}
            value={currentSliceIndex}
            onChange={(e) => setSliceIndex(Number(e.target.value))}
            className="flex-1"
          />
          <button
            onClick={() => setSliceIndex(Math.min(slices.length - 1, currentSliceIndex + 1))}
            disabled={currentSliceIndex >= slices.length - 1}
            className="p-2 rounded hover:bg-slate-100 disabled:opacity-30"
          >►</button>
          <span className="text-sm text-slate-600 w-16 text-center">
            {currentSliceIndex + 1}/{slices.length}
          </span>
        </div>
        {/* Thumbnail strip */}
        <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
          {slices.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSliceIndex(i)}
              className={`w-12 h-12 rounded shrink-0 bg-slate-200 border-2 transition-colors ${
                i === currentSliceIndex ? 'border-blue-600' : 'border-transparent hover:border-slate-400'
              }`}
            >
              {s.images?.[0]?.thumbnail_url ? (
                <img src={s.images[0].thumbnail_url} className="w-full h-full object-cover rounded" alt="" />
              ) : (
                <span className="text-[8px] text-slate-400">{s.slice_number}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
