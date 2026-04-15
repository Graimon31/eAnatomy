import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { User, Module, Slice, Annotation, AnatomicalTerm, TermCategory, Subscription, IPAccessRange, PaginatedResponse, TaskProgress, Region, Modality } from './types';

// Auth
export function useLogin() {
  return useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      const { data } = await client.post('/auth/login', creds);
      return data;
    },
  });
}

// Admin Users
export function useAdminUsers(params: Record<string, string | number> = {}) {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['admin', 'users', params],
    queryFn: async () => (await client.get('/admin/users', { params })).data,
  });
}
export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => (await client.put(`/admin/users/${id}/role`, { role })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await client.delete(`/admin/users/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

// Admin Modules
export function useAdminModules(params: Record<string, string | number> = {}) {
  return useQuery<PaginatedResponse<Module>>({
    queryKey: ['admin', 'modules', params],
    queryFn: async () => (await client.get('/admin/modules', { params })).data,
  });
}
export function usePublishModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await client.put(`/admin/modules/${id}/publish`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'modules'] }),
  });
}
export function useRejectModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => (await client.put(`/admin/modules/${id}/reject`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'modules'] }),
  });
}

// Editor Modules
export function useEditorModules(params: Record<string, string | number> = {}) {
  return useQuery<PaginatedResponse<Module>>({
    queryKey: ['editor', 'modules', params],
    queryFn: async () => (await client.get('/editor/modules', { params })).data,
  });
}
export function useCreateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => (await client.post('/editor/modules', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['editor', 'modules'] }),
  });
}
export function useUpdateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => (await client.put(`/editor/modules/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['editor', 'modules'] }),
  });
}
export function useSubmitForReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await client.post(`/editor/modules/${id}/submit`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['editor', 'modules'] }),
  });
}

// Projections & Modes
export function useCreateProjection() {
  return useMutation({ mutationFn: async ({ moduleId, ...input }: { moduleId: string; type: string; sort_order: number }) => (await client.post(`/editor/modules/${moduleId}/projections`, input)).data });
}
export function useCreateMode() {
  return useMutation({ mutationFn: async ({ moduleId, name }: { moduleId: string; name: string }) => (await client.post(`/editor/modules/${moduleId}/modes`, { name })).data });
}

// Upload
export function useUploadSlices() {
  return useMutation({
    mutationFn: async ({ projectionId, files, modeId }: { projectionId: number; files: File[]; modeId?: number }) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const { data } = await client.post(`/editor/projections/${projectionId}/upload?mode_id=${modeId || 0}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data as { task_id: string; status: string };
    },
  });
}
export function useTaskProgress(taskId: string | null) {
  return useQuery<TaskProgress>({
    queryKey: ['task', taskId],
    queryFn: async () => (await client.get(`/editor/tasks/${taskId}`)).data,
    enabled: !!taskId,
    refetchInterval: (query) => query.state.data?.status === 'processing' ? 2000 : false,
  });
}

// Slices
export function useEditorSlices(projectionId: number | null) {
  return useQuery<{ items: Slice[] }>({
    queryKey: ['editor', 'slices', projectionId],
    queryFn: async () => (await client.get(`/editor/projections/${projectionId}/slices`)).data,
    enabled: !!projectionId,
  });
}

// Annotations
export function useAnnotations(sliceId: string | null) {
  return useQuery<{ items: Annotation[] }>({
    queryKey: ['annotations', sliceId],
    queryFn: async () => (await client.get(`/editor/slices/${sliceId}/annotations`)).data,
    enabled: !!sliceId,
  });
}
export function useCreateAnnotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { slice_id: string; term_id: string; x: number; y: number }) => (await client.post('/editor/annotations', input)).data,
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['annotations', v.slice_id] }),
  });
}
export function useUpdateAnnotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; x?: number; y?: number; term_id?: string }) => (await client.put(`/editor/annotations/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annotations'] }),
  });
}
export function useDeleteAnnotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await client.delete(`/editor/annotations/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annotations'] }),
  });
}
export function useCopyAnnotations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, sourceId }: { targetId: string; sourceId: string }) => (await client.post(`/editor/slices/${targetId}/annotations/copy-from/${sourceId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annotations'] }),
  });
}

// Terms
export function useTermAutocomplete(q: string, lang = 'ru') {
  return useQuery<{ terms: Array<{ id: string; ru: string; en: string; la: string; category_id: number; color_hex: string }> }>({
    queryKey: ['autocomplete', q, lang],
    queryFn: async () => (await client.get('/terms/autocomplete', { params: { q, lang } })).data,
    enabled: q.length > 1,
    staleTime: 60000,
  });
}
export function useAdminTerms(params: Record<string, string | number> = {}) {
  return useQuery<PaginatedResponse<AnatomicalTerm>>({
    queryKey: ['admin', 'terms', params],
    queryFn: async () => (await client.get('/admin/terms', { params })).data,
  });
}

// Subscriptions & IP Ranges
export function useAdminSubscriptions(params: Record<string, string | number> = {}) {
  return useQuery<PaginatedResponse<Subscription>>({
    queryKey: ['admin', 'subscriptions', params],
    queryFn: async () => (await client.get('/admin/subscriptions', { params })).data,
  });
}
export function useAdminIPRanges() {
  return useQuery<{ items: IPAccessRange[] }>({
    queryKey: ['admin', 'ip-ranges'],
    queryFn: async () => (await client.get('/admin/ip-ranges')).data,
  });
}
export function useCreateIPRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cidr: string; institution_name: string }) => (await client.post('/admin/ip-ranges', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ip-ranges'] }),
  });
}
export function useDeleteIPRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await client.delete(`/admin/ip-ranges/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ip-ranges'] }),
  });
}

// Regions & Modalities
export function useRegions() {
  return useQuery<{ items: Region[] }>({ queryKey: ['regions'], queryFn: async () => (await client.get('/regions')).data, staleTime: 3600000 });
}
export function useModalities() {
  return useQuery<{ items: Modality[] }>({ queryKey: ['modalities'], queryFn: async () => (await client.get('/modalities')).data, staleTime: 3600000 });
}
