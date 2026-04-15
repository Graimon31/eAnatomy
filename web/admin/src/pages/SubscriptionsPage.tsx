import { useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useAdminSubscriptions } from '../api/hooks';
import type { Subscription } from '../api/types';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const col = createColumnHelper<Subscription>();

const statusColor: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  active: 'green', trialing: 'yellow', cancelled: 'red', expired: 'gray',
};

export default function SubscriptionsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminSubscriptions({ page, limit: 20 });

  const columns = [
    col.accessor('user_id', { header: 'User ID', cell: ({ getValue }) => getValue().slice(0, 8) + '...' }),
    col.accessor('plan', { header: 'Plan', cell: ({ getValue }) => <Badge color="blue">{getValue()}</Badge> }),
    col.accessor('status', {
      header: 'Status',
      cell: ({ getValue }) => <Badge color={statusColor[getValue()] ?? 'gray'}>{getValue()}</Badge>,
    }),
    col.accessor('expires_at', {
      header: 'Expires',
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    }),
  ];

  const table = useReactTable({ data: data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Subscriptions</h1>

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
