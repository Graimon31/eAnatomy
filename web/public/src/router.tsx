import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import ViewerPage from './pages/ViewerPage';
import SearchPage from './pages/SearchPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: ':lang/atlas', element: <CatalogPage /> },
      { path: ':lang/atlas/:region', element: <CatalogPage /> },
      { path: ':lang/atlas/:region/:slug', element: <ViewerPage /> },
      { path: ':lang/search', element: <SearchPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'account/profile', element: <ProfilePage /> },
      { path: 'account/subscription', element: <ProfilePage /> },
    ],
  },
]);
