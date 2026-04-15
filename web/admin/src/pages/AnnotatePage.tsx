import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Image as KImage, Circle, Text, Group } from 'react-konva';
import type Konva from 'konva';
import {
  useEditorModules, useEditorSlices, useAnnotations,
  useCreateAnnotation, useUpdateAnnotation, useDeleteAnnotation,
  useCopyAnnotations, useTermAutocomplete,
} from '../api/hooks';
import type { Module, Slice, Annotation, Projection } from '../api/types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const CANVAS_W = 800;
const CANVAS_H = 800;

export default function AnnotatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const stageRef = useRef<Konva.Stage>(null);

  const { data: modulesData } = useEditorModules({});
  const module = modulesData?.items.find((m: Module) => m.id === id);

  const [selectedProjection, setSelectedProjection] = useState<Projection | null>(null);
  const { data: slicesData } = useEditorSlices(selectedProjection?.id ?? null);
  const slices = slicesData?.items ?? [];

  const [sliceIndex, setSliceIndex] = useState(0);
  const currentSlice: Slice | undefined = slices[sliceIndex];

  const { data: annotationsData, refetch: refetchAnnotations } = useAnnotations(currentSlice?.id ?? null);
  const annotations = annotationsData?.items ?? [];

  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();
  const copyAnnotations = useCopyAnnotations();

  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: termsData } = useTermAutocomplete(searchQuery);
  const [showTermPicker, setShowTermPicker] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [copySourceIndex, setCopySourceIndex] = useState<number | null>(null);

  // Load image
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!currentSlice?.images?.[0]) { setImage(null); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = currentSlice.images[0].image_url;
    img.onload = () => setImage(img);
  }, [currentSlice]);

  // Auto-select first projection
  useEffect(() => {
    if (module?.projections?.length && !selectedProjection) {
      setSelectedProjection(module.projections[0]);
    }
  }, [module, selectedProjection]);

  const scale = image ? Math.min(CANVAS_W / image.width, CANVAS_H / image.height) : 1;
  const imgW = image ? image.width * scale : CANVAS_W;
  const imgH = image ? image.height * scale : CANVAS_H;

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage || !currentSlice) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Normalized coordinates (0..1)
    const x = pos.x / imgW;
    const y = pos.y / imgH;

    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    setPendingPoint({ x, y });
    setShowTermPicker(true);
    setSearchQuery('');
    setSelectedAnnotation(null);
  }, [currentSlice, imgW, imgH]);

  const handleSelectTerm = useCallback(async (termId: string) => {
    if (!pendingPoint || !currentSlice) return;
    await createAnnotation.mutateAsync({
      slice_id: currentSlice.id,
      term_id: termId,
      x: pendingPoint.x,
      y: pendingPoint.y,
    });
    setPendingPoint(null);
    setShowTermPicker(false);
    refetchAnnotations();
  }, [pendingPoint, currentSlice, createAnnotation, refetchAnnotations]);

  const handleDragEnd = useCallback(async (ann: Annotation, e: Konva.KonvaEventObject<DragEvent>) => {
    const newX = e.target.x() / imgW;
    const newY = e.target.y() / imgH;
    await updateAnnotation.mutateAsync({ id: ann.id, x: newX, y: newY });
    refetchAnnotations();
  }, [imgW, imgH, updateAnnotation, refetchAnnotations]);

  const handleDelete = useCallback(async (annId: string) => {
    await deleteAnnotation.mutateAsync(annId);
    setSelectedAnnotation(null);
    refetchAnnotations();
  }, [deleteAnnotation, refetchAnnotations]);

  const handleCopyAnnotations = useCallback(async () => {
    if (copySourceIndex === null || !currentSlice) return;
    const sourceSlice = slices[copySourceIndex];
    if (!sourceSlice) return;
    await copyAnnotations.mutateAsync({ targetId: currentSlice.id, sourceId: sourceSlice.id });
    setCopySourceIndex(null);
    refetchAnnotations();
  }, [copySourceIndex, currentSlice, slices, copyAnnotations, refetchAnnotations]);

  if (!module) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="flex gap-4">
      {/* Left Panel — Canvas */}
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Annotate: {module.slug}</h1>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/modules/${id}/edit`)}>
              Back to Edit
            </Button>
          </div>
          <div className="flex gap-2">
            {module.projections?.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedProjection(p); setSliceIndex(0); }}
                className={`rounded px-3 py-1 text-sm ${selectedProjection?.id === p.id ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                {p.type}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-black">
          <Stage
            ref={stageRef}
            width={imgW}
            height={imgH}
            onClick={handleStageClick}
            style={{ cursor: 'crosshair' }}
          >
            <Layer>
              {image && <KImage image={image} width={imgW} height={imgH} />}
              {annotations.map((ann) => {
                const px = ann.x * imgW;
                const py = ann.y * imgH;
                const isSelected = selectedAnnotation?.id === ann.id;
                const color = ann.term?.category?.color_hex || '#00ff00';
                return (
                  <Group
                    key={ann.id}
                    x={px}
                    y={py}
                    draggable
                    onDragEnd={(e) => handleDragEnd(ann, e)}
                    onClick={(e) => { e.cancelBubble = true; setSelectedAnnotation(ann); }}
                  >
                    <Circle
                      radius={isSelected ? 8 : 6}
                      fill={color}
                      stroke={isSelected ? '#fff' : 'rgba(0,0,0,0.5)'}
                      strokeWidth={isSelected ? 3 : 1}
                    />
                    <Text
                      text={ann.term?.translations?.['en'] || ann.term_id.slice(0, 6)}
                      x={10}
                      y={-8}
                      fontSize={12}
                      fill="#fff"
                      shadowColor="#000"
                      shadowBlur={3}
                    />
                  </Group>
                );
              })}
              {pendingPoint && (
                <Circle
                  x={pendingPoint.x * imgW}
                  y={pendingPoint.y * imgH}
                  radius={8}
                  fill="rgba(255,255,0,0.8)"
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </Layer>
          </Stage>
        </div>

        {/* Slice navigation */}
        {slices.length > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <Button size="sm" variant="secondary" disabled={sliceIndex <= 0} onClick={() => setSliceIndex(sliceIndex - 1)}>
              Prev
            </Button>
            <input
              type="range"
              min={0}
              max={slices.length - 1}
              value={sliceIndex}
              onChange={(e) => setSliceIndex(Number(e.target.value))}
              className="flex-1"
            />
            <Button size="sm" variant="secondary" disabled={sliceIndex >= slices.length - 1} onClick={() => setSliceIndex(sliceIndex + 1)}>
              Next
            </Button>
            <span className="text-sm text-gray-500">
              {sliceIndex + 1} / {slices.length}
            </span>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div className="w-80 space-y-4">
        {/* Term picker */}
        {showTermPicker && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <h3 className="mb-2 text-sm font-semibold">Select Term for Pin</h3>
            <Input
              placeholder="Search terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="mt-2 max-h-60 overflow-y-auto">
              {termsData?.terms?.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTerm(t.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-yellow-100"
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color_hex || '#ccc' }} />
                  <span className="font-medium">{t.en || t.ru}</span>
                  {t.la && <span className="text-gray-400">({t.la})</span>}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => { setShowTermPicker(false); setPendingPoint(null); }}>
              Cancel
            </Button>
          </div>
        )}

        {/* Selected annotation */}
        {selectedAnnotation && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-semibold">Selected Annotation</h3>
            <p className="text-sm">
              <span className="font-medium">{selectedAnnotation.term?.translations?.['en'] || 'Unknown'}</span>
            </p>
            <p className="text-xs text-gray-500">
              Position: ({selectedAnnotation.x.toFixed(3)}, {selectedAnnotation.y.toFixed(3)})
            </p>
            <Button variant="danger" size="sm" className="mt-2" onClick={() => handleDelete(selectedAnnotation.id)}>
              Delete Annotation
            </Button>
          </div>
        )}

        {/* Annotations list */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold">Annotations ({annotations.length})</h3>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {annotations.map((ann) => (
              <button
                key={ann.id}
                onClick={() => setSelectedAnnotation(ann)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs ${selectedAnnotation?.id === ann.id ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ann.term?.category?.color_hex || '#ccc' }}
                />
                {ann.term?.translations?.['en'] || ann.term_id.slice(0, 8)}
              </button>
            ))}
          </div>
        </div>

        {/* Copy annotations */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold">Copy Annotations</h3>
          <p className="mb-2 text-xs text-gray-500">Copy from another slice to current</p>
          <div className="flex items-end gap-2">
            <select
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              value={copySourceIndex ?? ''}
              onChange={(e) => setCopySourceIndex(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select source slice</option>
              {slices.map((s, i) => (
                <option key={s.id} value={i} disabled={i === sliceIndex}>
                  Slice {s.slice_number}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={copySourceIndex === null} onClick={handleCopyAnnotations} loading={copyAnnotations.isPending}>
              Copy
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
