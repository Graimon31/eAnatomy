import { useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useAdminUsers, useChangeRole, useDeleteUser } from '../api/hooks';
import type { User } from '../api/types';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const col = createColumnHelper<User>();

const roleBadge: Record<string, 'blue' | 'purple' | 'green' | 'gray'> = {
  super_admin: 'purple',
  moderator: 'blue',
  editor: 'green',
  subscriber: 'gray',
};

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAdminUsers({ page, limit: 20, search });
  const changeRole = useChangeRole();
  const deleteUser = useDeleteUser();

  const columns = [
    col.accessor('name', { header: 'Name' }),
    col.accessor('email', { header: 'Email' }),
    col.accessor('role', {
      header: 'Role',
      cell: ({ getValue }) => {
        const role = getValue();
        return <Badge color={roleBadge[role] ?? 'gray'}>{role}</Badge>;
      },
    }),
    col.accessor('is_active', {
      header: 'Active',
      cell: ({ getValue }) => (
        <Badge color={getValue() ? 'green' : 'red'}>{getValue() ? 'Yes' : 'No'}</Badge>
      ),
    }),
    col.accessor('created_at', {
      header: 'Created',
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <select
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            value={row.original.role}
            onChange={(e) => changeRole.mutate({ id: row.original.id, role: e.target.value })}
          >
            {['super_admin', 'moderator', 'editor', 'subscriber', 'guest'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <Button
            variant="danger"
            size="sm"
            onClick={() => { if (confirm('Delete this user?')) deleteUser.mutate(row.original.id); }}
          >
            Delete
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Input
          placeholder="Search users..."
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
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="flex items-center text-sm text-gray-600">Page {page}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={(data?.items.length ?? 0) < 20}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
