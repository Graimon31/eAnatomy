import { createBrowserRouter } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import ModulesPage from './pages/ModulesPage';
import ModuleFormPage from './pages/ModuleFormPage';
import ModuleEditPage from './pages/ModuleEditPage';
import AnnotatePage from './pages/AnnotatePage';
import TermsPage from './pages/TermsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import IPRangesPage from './pages/IPRangesPage';

export const router = createBrowserRouter([
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'modules', element: <ModulesPage /> },
      { path: 'modules/new', element: <ModuleFormPage /> },
      { path: 'modules/:id/edit', element: <ModuleEditPage /> },
      { path: 'modules/:id/annotate', element: <AnnotatePage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'subscriptions', element: <SubscriptionsPage /> },
      { path: 'ip-ranges', element: <IPRangesPage /> },
    ],
  },
]);
