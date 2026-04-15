import { useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useAdminTerms } from '../api/hooks';
import type { AnatomicalTerm } from '../api/types';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const col = createColumnHelper<AnatomicalTerm>();

export default function TermsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAdminTerms({ page, limit: 20, search });

  const columns = [
    col.accessor('fma_id', { header: 'FMA ID' }),
    col.accessor((r) => {
      const t = r.translations as Record<string, string> | undefined;
      return t?.['en'] || '—';
    }, { id: 'en', header: 'English' }),
    col.accessor((r) => {
      const t = r.translations as Record<string, string> | undefined;
      return t?.['ru'] || '—';
    }, { id: 'ru', header: 'Russian' }),
    col.accessor((r) => {
      const t = r.translations as Record<string, string> | undefined;
      return t?.['la'] || '—';
    }, { id: 'la', header: 'Latin' }),
    col.accessor('category', {
      header: 'Category',
      cell: ({ getValue }) => {
        const cat = getValue();
        if (!cat) return '—';
        return (
          <Badge color="blue">
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cat.color_hex }} />
            {(cat.name_translations as Record<string, string>)?.['en'] || 'Category'}
          </Badge>
        );
      },
    }),
  ];

  const table = useReactTable({ data: data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Anatomical Terms</h1>
        <Input
          placeholder="Search terms..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-64"
        />
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
