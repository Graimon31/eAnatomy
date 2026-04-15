import { useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useAdminIPRanges, useCreateIPRange, useDeleteIPRange } from '../api/hooks';
import type { IPAccessRange } from '../api/types';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

const col = createColumnHelper<IPAccessRange>();

export default function IPRangesPage() {
  const { data, isLoading } = useAdminIPRanges();
  const createRange = useCreateIPRange();
  const deleteRange = useDeleteIPRange();
  const [cidr, setCidr] = useState('');
  const [institution, setInstitution] = useState('');

  const columns = [
    col.accessor('cidr', { header: 'CIDR' }),
    col.accessor('institution_name', { header: 'Institution' }),
    col.accessor('expires_at', {
      header: 'Expires',
      cell: ({ getValue }) => {
        const v = getValue();
        return v ? new Date(v).toLocaleDateString() : 'Never';
      },
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="danger"
          onClick={() => { if (confirm('Delete this IP range?')) deleteRange.mutate(row.original.id); }}
        >
          Delete
        </Button>
      ),
    }),
  ];

  const table = useReactTable({ data: data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cidr.trim() || !institution.trim()) return;
    await createRange.mutateAsync({ cidr, institution_name: institution });
    setCidr('');
    setInstitution('');
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">IP Access Ranges</h1>

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold">Add IP Range</h2>
        <form onSubmit={handleAdd} className="flex items-end gap-4">
          <Input label="CIDR" placeholder="192.168.1.0/24" value={cidr} onChange={(e) => setCidr(e.target.value)} />
          <Input label="Institution" placeholder="University of..." value={institution} onChange={(e) => setInstitution(e.target.value)} />
          <Button type="submit" loading={createRange.isPending}>Add</Button>
        </form>
      </Card>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <DataTable table={table} />
      )}
    </div>
  );
}
