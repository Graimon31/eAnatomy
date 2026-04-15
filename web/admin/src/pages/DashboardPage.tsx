import { useAdminUsers, useAdminModules } from '../api/hooks';
import Card from '../components/ui/Card';
import { Users, BookOpen, Clock, CheckCircle } from 'lucide-react';

export default function DashboardPage() {
  const { data: users } = useAdminUsers({ limit: 1 });
  const { data: allModules } = useAdminModules({ limit: 1 });
  const { data: reviewModules } = useAdminModules({ status: 'review', limit: 1 });
  const { data: publishedModules } = useAdminModules({ status: 'published', limit: 1 });

  const stats = [
    { label: 'Total Users', value: users?.total ?? '—', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Modules', value: allModules?.total ?? '—', icon: BookOpen, color: 'text-green-600 bg-green-50' },
    { label: 'Pending Review', value: reviewModules?.total ?? '—', icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Published', value: publishedModules?.total ?? '—', icon: CheckCircle, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${color}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
