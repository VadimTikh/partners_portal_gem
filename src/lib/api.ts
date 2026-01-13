import axios, { AxiosError } from 'axios';
import { Course, CourseDate, User, CourseRequest, Partner, CourseRequestDate, CreateCourseFromRequest } from './types';
import { useAuthStore } from './auth';
import { mockApi } from './mock-data';

// Use mock data in development when no API is configured
const USE_MOCK = process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_USE_REAL_API;

if (USE_MOCK) {
  console.log('Running in MOCK mode. API calls will be simulated.');
}

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth header to requests
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle API errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    // Extract error message from response
    const message = error.response?.data?.error ||
                   error.response?.data?.message ||
                   error.message ||
                   'An error occurred';

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401) {
      // Clear auth state
      useAuthStore.getState().logout();
    }

    throw new Error(message);
  }
);

/**
 * API client for the Miomente Partner Portal
 *
 * Uses RESTful endpoints:
 * - /api/auth/* - Authentication
 * - /api/partner/* - Partner operations
 * - /api/manager/* - Manager operations
 */
export const api = {
  // ==================== Auth ====================

  login: async (email: string, password: string): Promise<User> => {
    if (USE_MOCK) return mockApi.login(email, password);

    const response = await apiClient.post<{
      success: boolean;
      user: {
        id: string;
        email: string;
        name: string;
        customerNumber: string | null;
        isManager: boolean;
      };
      token: string;
    }>('/auth/login', { email, password });

    // Store token
    useAuthStore.getState().setToken(response.data.token);

    // Transform to User type
    return {
      id: response.data.user.id,
      email: response.data.user.email,
      name: response.data.user.name,
      partnerId: response.data.user.customerNumber ? parseInt(response.data.user.customerNumber, 10) : undefined,
      role: response.data.user.isManager ? 'manager' : 'partner',
      token: response.data.token,
    };
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    useAuthStore.getState().logout();
  },

  resetPassword: async (email: string): Promise<void> => {
    if (USE_MOCK) return mockApi.resetPassword(email);
    await apiClient.post('/auth/reset-password', { email });
  },

  verifyResetToken: async (token: string): Promise<{ valid: boolean; email?: string }> => {
    if (USE_MOCK) return mockApi.verifyResetToken(token);
    const response = await apiClient.post<{ valid: boolean; email?: string }>('/auth/verify-reset-token', { token });
    return response.data;
  },

  setNewPassword: async (token: string, newPassword: string): Promise<void> => {
    if (USE_MOCK) return mockApi.setNewPassword(token, newPassword);
    const response = await apiClient.post<{ success: boolean; message?: string }>('/auth/set-new-password', { token, password: newPassword });
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to set new password');
    }
  },

  changePassword: async (password: string, newPassword: string): Promise<void> => {
    if (USE_MOCK) return mockApi.changePassword(password, newPassword);
    const response = await apiClient.post<{ success: boolean; message?: string }>('/auth/change-password', { password, newPassword });
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to change password');
    }
  },

  // ==================== Partner: Courses ====================

  getCourses: async (): Promise<Course[]> => {
    if (USE_MOCK) return mockApi.getCourses();
    const response = await apiClient.get<{ success: boolean; courses: Course[] }>('/partner/courses');
    return response.data.courses;
  },

  getCourse: async (id: string | number): Promise<Course | undefined> => {
    if (USE_MOCK) return mockApi.getCourse(id);
    const response = await apiClient.get<{ success: boolean; course: Course }>(`/partner/courses/${id}`);
    return response.data.course;
  },

  updateCourse: async (course: Pick<Course, 'id' | 'title' | 'status' | 'basePrice'>): Promise<Course> => {
    if (USE_MOCK) return mockApi.updateCourse(course);
    const response = await apiClient.patch<{ success: boolean; course: Course }>(`/partner/courses/${course.id}`, {
      title: course.title,
      status: course.status,
      basePrice: course.basePrice,
    });
    return response.data.course;
  },

  createCourse: async (course: Omit<Course, 'id' | 'available_dates'>): Promise<Course> => {
    if (USE_MOCK) return mockApi.createCourse(course);
    // Note: Partners can't create courses directly - they use course requests
    throw new Error('Partners cannot create courses directly. Please submit a course request.');
  },

  // ==================== Partner: Dates ====================

  getDates: async (courseId: string | number): Promise<CourseDate[]> => {
    if (USE_MOCK) return mockApi.getDates(courseId);
    const response = await apiClient.get<{ success: boolean; dates: CourseDate[] }>(`/partner/courses/${courseId}/dates`);
    return response.data.dates;
  },

  createDate: async (date: Omit<CourseDate, 'id' | 'booked'>): Promise<CourseDate> => {
    if (USE_MOCK) return mockApi.createDate(date);
    const response = await apiClient.post<{ success: boolean; date: CourseDate }>(`/partner/courses/${date.courseId}/dates`, {
      dateTime: date.dateTime,
      capacity: date.capacity,
      duration: date.duration,
      price: date.price,
    });
    return response.data.date;
  },

  deleteDate: async (dateId: number, courseId?: number): Promise<void> => {
    if (USE_MOCK) return mockApi.deleteDate(dateId);
    // We need courseId in the URL - if not provided, we'll have to look it up
    if (!courseId) {
      throw new Error('Course ID is required to delete a date');
    }
    await apiClient.delete(`/partner/courses/${courseId}/dates/${dateId}`);
  },

  updateDate: async (dateId: number, price: number, courseId?: number): Promise<void> => {
    if (USE_MOCK) return mockApi.updateDate(dateId, price);
    if (!courseId) {
      throw new Error('Course ID is required to update a date');
    }
    await apiClient.patch(`/partner/courses/${courseId}/dates/${dateId}`, { price });
  },

  updateSeats: async (dateId: number, seats: number, courseId?: number): Promise<void> => {
    if (USE_MOCK) return;
    if (!courseId) {
      throw new Error('Course ID is required to update seats');
    }
    await apiClient.patch(`/partner/courses/${courseId}/dates/${dateId}`, { seats });
  },

  // ==================== Partner: Contact ====================

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    if (USE_MOCK) return mockApi.sendContactMessage(subject, message);
    await apiClient.post('/partner/contact', { subject, message });
  },

  // ==================== Partner: Course Requests ====================

  getCourseRequests: async (): Promise<CourseRequest[]> => {
    if (USE_MOCK) return mockApi.getCourseRequests();
    const response = await apiClient.get<{ success: boolean; requests: CourseRequest[] }>('/partner/requests');
    return response.data.requests;
  },

  getCourseRequest: async (id: number): Promise<CourseRequest | undefined> => {
    if (USE_MOCK) return mockApi.getCourseRequest(id);
    const response = await apiClient.get<{ success: boolean; request: CourseRequest }>(`/partner/requests/${id}`);
    return response.data.request;
  },

  createCourseRequest: async (request: {
    name: string;
    location: string;
    basePrice: number;
    partnerDescription: string;
    requestedDates?: CourseRequestDate[];
  }): Promise<CourseRequest> => {
    if (USE_MOCK) return mockApi.createCourseRequest(request);
    const response = await apiClient.post<{ success: boolean; request: CourseRequest }>('/partner/requests', request);
    return response.data.request;
  },

  // ==================== Manager: Partners ====================

  getPartners: async (): Promise<Partner[]> => {
    if (USE_MOCK) return mockApi.getPartners();
    const response = await apiClient.get<{ success: boolean; partners: Partner[] }>('/manager/partners');
    return response.data.partners;
  },

  getPartner: async (id: number | string): Promise<Partner | undefined> => {
    if (USE_MOCK) return mockApi.getPartner(Number(id));
    const response = await apiClient.get<{ success: boolean; partner: Partner }>(`/manager/partners/${id}`);
    return response.data.partner;
  },

  getPartnerCourses: async (partnerId: number | string): Promise<Course[]> => {
    if (USE_MOCK) return mockApi.getPartnerCourses(Number(partnerId));
    const response = await apiClient.get<{ success: boolean; courses: Course[] }>(`/manager/partners/${partnerId}/courses`);
    return response.data.courses;
  },

  // ==================== Manager: Course Requests ====================

  getAllCourseRequests: async (): Promise<CourseRequest[]> => {
    if (USE_MOCK) return mockApi.getCourseRequests();
    const response = await apiClient.get<{ success: boolean; requests: CourseRequest[] }>('/manager/requests');
    return response.data.requests;
  },

  updateCourseRequestStatus: async (
    id: number,
    status: 'pending' | 'in_moderation' | 'approved' | 'rejected',
    data?: { rejectionReason?: string; rejectionRecommendations?: string; managerNotes?: string }
  ): Promise<CourseRequest> => {
    // Mock only supports non-pending status changes
    if (USE_MOCK && status !== 'pending') {
      return mockApi.updateCourseRequestStatus(id, status as 'in_moderation' | 'approved' | 'rejected', data);
    }
    if (USE_MOCK) {
      throw new Error('Mock API does not support changing status to pending');
    }
    const response = await apiClient.patch<{ success: boolean; request: CourseRequest }>(`/manager/requests/${id}`, {
      status,
      ...data,
    });
    return response.data.request;
  },

  createCourseFromRequest: async (data: CreateCourseFromRequest): Promise<Course> => {
    if (USE_MOCK) return mockApi.createCourseFromRequest(data);
    const response = await apiClient.post<{ success: boolean; course: Course }>(`/manager/requests/${data.requestId}/create-course`, {
      description: data.description,
      shortDescription: data.shortDescription,
    });
    return response.data.course;
  },
};
