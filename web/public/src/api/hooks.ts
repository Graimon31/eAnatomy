import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type {
  Region,
  Modality,
  Module,
  Slice,
  Annotation,
  AuthResponse,
  PaginatedResponse,
  ModuleResponse,
  SlicesResponse,
  SearchResponse,
  ModuleFilter,
} from './types';

/* ------------------------------------------------------------------ */
/*  Catalog & Reference Data                                          */
/* ------------------------------------------------------------------ */

export function useRegions() {
  return useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data } = await client.get<{ items: Region[] }>('/regions');
      return data.items;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useModalities() {
  return useQuery<Modality[]>({
    queryKey: ['modalities'],
    queryFn: async () => {
      const { data } = await client.get<{ items: Modality[] }>('/modalities');
      return data.items;
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useModules(filters: ModuleFilter = {}) {
  return useQuery<PaginatedResponse<Module>>({
    queryKey: ['modules', filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (filters.region) params.region = filters.region;
      if (filters.modality) params.modality = filters.modality;
      if (filters.access) params.access = filters.access;
      if (filters.lang) params.lang = filters.lang;
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;

      const { data } = await client.get<PaginatedResponse<Module>>('/modules', { params });
      return data;
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Module Detail                                                     */
/* ------------------------------------------------------------------ */

export function useModule(slug: string | undefined) {
  return useQuery<ModuleResponse>({
    queryKey: ['module', slug],
    queryFn: async () => {
      const { data } = await client.get<ModuleResponse>(`/modules/${slug}`);
      return data;
    },
    enabled: !!slug,
  });
}

export function useModuleSlices(
  slug: string | undefined,
  projectionId?: number,
  modeId?: number,
) {
  return useQuery<SlicesResponse>({
    queryKey: ['moduleSlices', slug, projectionId, modeId],
    queryFn: async () => {
      const params: Record<string, number> = {};
      if (projectionId) params.projection = projectionId;
      if (modeId) params.mode = modeId;

      const { data } = await client.get<SlicesResponse>(
        `/modules/${slug}/slices`,
        { params },
      );
      return data;
    },
    enabled: !!slug,
  });
}

/* ------------------------------------------------------------------ */
/*  Annotations                                                       */
/* ------------------------------------------------------------------ */

export function useSliceAnnotations(sliceId: string | undefined, lang: string = 'en') {
  return useQuery<Annotation[]>({
    queryKey: ['annotations', sliceId, lang],
    queryFn: async () => {
      const { data } = await client.get<Annotation[]>(
        `/slices/${sliceId}/annotations`,
        { params: { lang } },
      );
      return data;
    },
    enabled: !!sliceId,
  });
}

/* ------------------------------------------------------------------ */
/*  Search                                                            */
/* ------------------------------------------------------------------ */

export function useSearch(q: string, lang: string = 'en') {
  return useQuery<SearchResponse>({
    queryKey: ['search', q, lang],
    queryFn: async () => {
      const { data } = await client.get<SearchResponse>('/search', {
        params: { q, lang },
      });
      return data;
    },
    enabled: q.length >= 2,
  });
}

/* ------------------------------------------------------------------ */
/*  Auth                                                              */
/* ------------------------------------------------------------------ */

export function useMe() {
  return useQuery<{ id: string; email: string; role: string; name: string }>({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await client.get('/auth/me');
      return data;
    },
    enabled: !!localStorage.getItem('access_token'),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<AuthResponse, Error, { email: string; password: string }>({
    mutationFn: async (credentials) => {
      const { data } = await client.post<AuthResponse>('/auth/login', credentials);
      return data;
    },
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation<
    AuthResponse,
    Error,
    { email: string; password: string; name: string }
  >({
    mutationFn: async (input) => {
      const { data } = await client.post<AuthResponse>('/auth/register', input);
      return data;
    },
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
