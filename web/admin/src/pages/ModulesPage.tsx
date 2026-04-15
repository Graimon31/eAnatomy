import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useEditorModules, useAdminModules, usePublishModule, useRejectModule, useSubmitForReview } from '../api/hooks';
import type { Module } from '../api/types';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const col = createColumnHelper<Module>();

const statusColor: Record<string, 'gray' | 'yellow' | 'green' | 'red'> = {
  draft: 'gray', review: 'yellow', published: 'green', archived: 'red',
};

export default function ModulesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'my' | 'all'>('my');
  const [page, setPage] = useState(1);

  const { data: myData, isLoading: myLoading } = useEditorModules({ page, limit: 20 });
  const { data: allData, isLoading: allLoading } = useAdminModules({ page, limit: 20 });

  const publish = usePublishModule();
  const reject = useRejectModule();
  const submit = useSubmitForReview();

  const data = tab === 'my' ? myData : allData;
  const isLoading = tab === 'my' ? myLoading : allLoading;

  const columns = [
    col.accessor((r) => r.meta_title_translations?.['en'] || r.meta_title_translations?.['ru'] || r.slug, {
      id: 'title',
      header: 'Title',
    }),
    col.accessor('slug', { header: 'Slug' }),
    col.accessor('status', {
      header: 'Status',
      cell: ({ getValue }) => <Badge color={statusColor[getValue()]}>{getValue()}</Badge>,
    }),
    col.accessor('access_level', {
      header: 'Access',
      cell: ({ getValue }) => <Badge color={getValue() === 'premium' ? 'purple' : 'green'}>{getValue()}</Badge>,
    }),
    col.accessor('created_at', {
      header: 'Created',
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/modules/${m.id}/edit`)}>
              Edit
            </Button>
            {m.status === 'draft' && (
              <Button size="sm" onClick={() => submit.mutate(m.id)}>Submit</Button>
            )}
            {tab === 'all' && m.status === 'review' && (
              <>
                <Button size="sm" onClick={() => publish.mutate(m.id)}>Publish</Button>
                <Button size="sm" variant="danger" onClick={() => {
                  const reason = prompt('Rejection reason:');
                  if (reason) reject.mutate({ id: m.id, reason });
                }}>
                  Reject
                </Button>
              </>
            )}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({ data: data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Modules</h1>
        <Button onClick={() => navigate('/admin/modules/new')}>+ New Module</Button>
      </div>

      <div className="mb-4 flex gap-2">
        {(['my', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`rounded-md px-4 py-2 text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {t === 'my' ? 'My Modules' : 'All Modules'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <DataTable table={table} />
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">Total: {data?.total ?? 0}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="flex items-center text-sm text-gray-600">Page {page}</span>
              <Button variant="secondary" size="sm" disabled={(data?.items.length ?? 0) < 20} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
