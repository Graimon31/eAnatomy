import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useEditorModules, useUpdateModule, useCreateProjection, useCreateMode,
  useUploadSlices, useTaskProgress, useEditorSlices,
} from '../api/hooks';
import type { Module, Projection } from '../api/types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

export default function ModuleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data } = useEditorModules({});
  const module = data?.items.find((m: Module) => m.id === id);

  const updateModule = useUpdateModule();
  const createProjection = useCreateProjection();
  const createMode = useCreateMode();
  const uploadSlices = useUploadSlices();

  const [projType, setProjType] = useState('axial');
  const [modeName, setModeName] = useState('');
  const [selectedProjection, setSelectedProjection] = useState<Projection | null>(null);
  const [selectedModeId, setSelectedModeId] = useState<number>(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const { data: taskProgress } = useTaskProgress(taskId);
  const { data: slicesData } = useEditorSlices(selectedProjection?.id ?? null);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || !selectedProjection) return;
    const result = await uploadSlices.mutateAsync({
      projectionId: selectedProjection.id,
      files: Array.from(files),
      modeId: selectedModeId || undefined,
    });
    setTaskId(result.task_id);
  }, [selectedProjection, selectedModeId, uploadSlices]);

  if (!module) return <p className="text-gray-500">Loading module...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{module.slug}</h1>
          <Badge color={module.status === 'published' ? 'green' : module.status === 'review' ? 'yellow' : 'gray'}>
            {module.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(`/admin/modules/${id}/annotate`)}>
            Annotate
          </Button>
          <Button variant="secondary" onClick={() => navigate('/admin/modules')}>Back</Button>
        </div>
      </div>

      {/* Module Info */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Module Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Access Level</label>
            <select
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={module.access_level}
              onChange={(e) => updateModule.mutate({ id: module.id, access_level: e.target.value })}
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Projections */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Projections</h2>
        <div className="mb-4 flex gap-2">
          {module.projections?.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjection(p)}
              className={`rounded-md px-4 py-2 text-sm ${selectedProjection?.id === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {p.type}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={projType} onChange={(e) => setProjType(e.target.value)}>
            {['axial', 'coronal', 'sagittal'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button size="sm" onClick={async () => {
            await createProjection.mutateAsync({
              moduleId: module.id,
              type: projType,
              sort_order: (module.projections?.length ?? 0) + 1,
            });
            window.location.reload();
          }}>
            Add Projection
          </Button>
        </div>
      </Card>

      {/* Modes */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Imaging Modes</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {module.modes?.map((m) => (
            <Badge key={m.id} color="blue">{m.name}</Badge>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Input placeholder="Mode name" value={modeName} onChange={(e) => setModeName(e.target.value)} />
          <Button size="sm" onClick={async () => {
            if (!modeName.trim()) return;
            await createMode.mutateAsync({ moduleId: module.id, name: modeName });
            setModeName('');
            window.location.reload();
          }}>
            Add Mode
          </Button>
        </div>
      </Card>

      {/* Upload */}
      {selectedProjection && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Upload Slices — {selectedProjection.type}</h2>
          {module.modes && module.modes.length > 0 && (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Mode</label>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={selectedModeId}
                onChange={(e) => setSelectedModeId(Number(e.target.value))}
              >
                <option value={0}>Default</option>
                {module.modes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <input
            type="file"
            multiple
            accept=".dcm,.dicom,image/*"
            onChange={(e) => handleUpload(e.target.files)}
            className="block text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {taskProgress && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-sm">
                <span className="capitalize">{taskProgress.status}</span>
                <span>{taskProgress.done}/{taskProgress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all"
                  style={{ width: taskProgress.total > 0 ? `${(taskProgress.done / taskProgress.total) * 100}%` : '0%' }}
                />
              </div>
              {taskProgress.error && <p className="mt-2 text-sm text-red-600">{taskProgress.error}</p>}
            </div>
          )}

          {/* Slice thumbnails */}
          {slicesData?.items && slicesData.items.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">{slicesData.items.length} slices</p>
              <div className="grid grid-cols-8 gap-2">
                {slicesData.items.slice(0, 24).map((s) => (
                  <div key={s.id} className="aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100">
                    {s.images?.[0] && (
                      <img src={s.images[0].thumbnail_url} alt={`Slice ${s.slice_number}`} className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
