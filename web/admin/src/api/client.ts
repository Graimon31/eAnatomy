import axios from 'axios';

const client = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const rt = localStorage.getItem('admin_refresh_token');
      if (rt) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refresh_token: rt });
          localStorage.setItem('admin_token', data.access_token);
          localStorage.setItem('admin_refresh_token', data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return client(error.config);
        } catch {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_refresh_token');
          window.location.href = '/admin/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default client;
