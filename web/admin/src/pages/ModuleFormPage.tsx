import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useCreateModule, useRegions, useModalities } from '../api/hooks';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

interface FormData {
  slug: string;
  region_id: string;
  modality_id: string;
  access_level: 'free' | 'premium';
  meta_title_ru: string;
  meta_title_en: string;
  meta_desc_ru: string;
  meta_desc_en: string;
}

export default function ModuleFormPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const create = useCreateModule();
  const { data: regions } = useRegions();
  const { data: modalities } = useModalities();

  const onSubmit = async (d: FormData) => {
    await create.mutateAsync({
      slug: d.slug,
      region_id: d.region_id ? Number(d.region_id) : null,
      modality_id: d.modality_id ? Number(d.modality_id) : null,
      access_level: d.access_level,
      meta_title_translations: { ru: d.meta_title_ru, en: d.meta_title_en },
      meta_desc_translations: { ru: d.meta_desc_ru, en: d.meta_desc_en },
    });
    navigate('/admin/modules');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">New Module</h1>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Slug" {...register('slug', { required: 'Required' })} error={errors.slug?.message} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Region</label>
              <select className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" {...register('region_id')}>
                <option value="">— None —</option>
                {regions?.items.map((r) => (
                  <option key={r.id} value={r.id}>{r.name_translations?.['en'] || r.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Modality</label>
              <select className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" {...register('modality_id')}>
                <option value="">— None —</option>
                {modalities?.items.map((m) => (
                  <option key={m.id} value={m.id}>{m.name_translations?.['en'] || m.code}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Access Level</label>
            <select className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" {...register('access_level')}>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Title (RU)" {...register('meta_title_ru', { required: 'Required' })} error={errors.meta_title_ru?.message} />
            <Input label="Title (EN)" {...register('meta_title_en')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Description (RU)" {...register('meta_desc_ru')} />
            <Input label="Description (EN)" {...register('meta_desc_en')} />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => navigate('/admin/modules')}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Create Module</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
