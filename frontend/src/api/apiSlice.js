import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('adminToken') ||
        localStorage.getItem('managerToken');

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Department'],
  endpoints: (builder) => ({
    getDepartments: builder.query({
      query: () => '/departments',
      transformResponse: (response) =>
        response?.data?.departments ?? response?.departments ?? response,
      providesTags: (result) => {
        const list = Array.isArray(result)
          ? result
          : (result?.data?.departments || result?.departments || []);
        return [
          ...list.map(({ id }) => ({ type: 'Department', id })),
          { type: 'Department', id: 'LIST' },
        ];
      },
    }),
    getDepartmentById: builder.query({
      query: (departmentId) => `/departments/${departmentId}`,
      transformResponse: (response) =>
        response?.data?.department ?? response?.department ?? response,
      providesTags: (result, error, departmentId) => [
        { type: 'Department', id: departmentId },
      ],
    }),
    createDepartment: builder.mutation({
      query: (body) => ({
        url: '/admin/departments',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Department', id: 'LIST' }],
    }),
    updateDepartment: builder.mutation({
      query: ({ departmentId, ...body }) => ({
        url: `/admin/departments/${departmentId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, error, { departmentId }) => [
        { type: 'Department', id: departmentId },
        { type: 'Department', id: 'LIST' },
      ],
    }),
    deleteDepartment: builder.mutation({
      query: (departmentId) => ({
        url: `/admin/departments/${departmentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, departmentId) => [
        { type: 'Department', id: departmentId },
        { type: 'Department', id: 'LIST' },
      ],
    }),
    replaceDepartmentClubs: builder.mutation({
      query: ({ departmentId, clubIds }) => ({
        url: `/admin/departments/${departmentId}/clubs`,
        method: 'PUT',
        body: { clubIds },
      }),
      invalidatesTags: (result, error, { departmentId }) => [
        { type: 'Department', id: departmentId },
        { type: 'Department', id: 'LIST' },
      ],
    }),
    replaceClubDepartments: builder.mutation({
      query: ({ clubId, departmentIds }) => ({
        url: `/admin/clubs/${clubId}/departments`,
        method: 'PUT',
        body: { departmentIds },
      }),
      invalidatesTags: (result, error, { departmentIds }) => [
        { type: 'Department', id: 'LIST' },
        ...(Array.isArray(departmentIds)
          ? departmentIds.map((id) => ({ type: 'Department', id }))
          : []),
      ],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useGetDepartmentByIdQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useReplaceDepartmentClubsMutation,
  useReplaceClubDepartmentsMutation,
} = apiSlice;

export default apiSlice;

