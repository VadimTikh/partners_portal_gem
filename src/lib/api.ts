import axios, { AxiosError } from 'axios';
import { Course, CourseDate, User, CourseRequest, Partner, CourseRequestDate, CreateCourseFromRequest, AppLog, AppLogStatus, Booking, BookingStats, DeclineReason, BookingStatus } from './types';
import {
  Ticket,
  TicketMessage,
  HelpdeskStage,
  HelpdeskTicketType,
  HelpdeskAnalytics,
  TimePeriod,
  TicketAIAnalysis,
  TicketAIAnalysisPhase1,
} from './types/helpdesk';
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

// Add auth header and cache-busting to requests
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add cache-busting timestamp to GET requests
  if (config.method === 'get') {
    config.params = {
      ...config.params,
      _t: Date.now(),
    };
  }

  // Add no-cache headers
  config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  config.headers['Pragma'] = 'no-cache';

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

  updateDateTime: async (dateId: number, dateTime: string, courseId?: number): Promise<void> => {
    if (USE_MOCK) return;
    if (!courseId) {
      throw new Error('Course ID is required to update datetime');
    }
    await apiClient.patch(`/partner/courses/${courseId}/dates/${dateId}/datetime`, { dateTime });
  },

  updateDuration: async (dateId: number, duration: number, courseId?: number): Promise<void> => {
    if (USE_MOCK) return;
    if (!courseId) {
      throw new Error('Course ID is required to update duration');
    }
    await apiClient.patch(`/partner/courses/${courseId}/dates/${dateId}/duration`, { duration });
  },

  // ==================== Partner: Contact ====================

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    if (USE_MOCK) return mockApi.sendContactMessage(subject, message);
    await apiClient.post('/partner/contact', { subject, message });
  },

  // ==================== Partner: Course Requests ====================

  getCourseRequests: async (partnerId?: number): Promise<CourseRequest[]> => {
    if (USE_MOCK) return mockApi.getCourseRequests(partnerId);
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

  createPartner: async (data: {
    name: string;
    email: string;
    customerNumbers: string[];
  }): Promise<{ partner: { id: string; name: string; email: string }; generatedPassword: string }> => {
    const response = await apiClient.post<{
      success: boolean;
      partner: { id: string; name: string; email: string };
      generatedPassword: string;
    }>('/manager/partners', data);
    return { partner: response.data.partner, generatedPassword: response.data.generatedPassword };
  },

  getPartner: async (id: number | string): Promise<Partner | undefined> => {
    if (USE_MOCK) return mockApi.getPartner(String(id));
    const response = await apiClient.get<{ success: boolean; partner: Partner }>(`/manager/partners/${id}`);
    return response.data.partner;
  },

  getPartnerCourses: async (partnerId: number | string): Promise<Course[]> => {
    if (USE_MOCK) return mockApi.getPartnerCourses(String(partnerId));
    const response = await apiClient.get<{ success: boolean; courses: Course[] }>(`/manager/partners/${partnerId}/courses`);
    return response.data.courses;
  },

  // ==================== Manager: Course Requests ====================

  getAllCourseRequests: async (): Promise<CourseRequest[]> => {
    if (USE_MOCK) return mockApi.getCourseRequests();
    const response = await apiClient.get<{ success: boolean; requests: CourseRequest[] }>('/manager/requests');
    return response.data.requests;
  },

  getManagerCourseRequest: async (id: number): Promise<CourseRequest | undefined> => {
    if (USE_MOCK) return mockApi.getCourseRequest(id);
    const response = await apiClient.get<{ success: boolean; request: CourseRequest }>(`/manager/requests/${id}`);
    return response.data.request;
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

  // ==================== Manager: Activity Logs ====================

  getActivityLogs: async (params: {
    userId?: string;
    actionType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    logs: Array<{
      id: number;
      userId: string;
      partnerEmail: string;
      partnerName: string;
      actionType: string;
      entityType: string | null;
      entityId: number | null;
      details: Record<string, unknown> | null;
      customerNumber: string | null;
      ipAddress: string | null;
      createdAt: string;
    }>;
    total: number;
    partners: Array<{ userId: string; name: string; email: string }>;
    pagination: { limit: number; offset: number; hasMore: boolean };
  }> => {
    const searchParams = new URLSearchParams();
    if (params.userId) searchParams.set('userId', params.userId);
    if (params.actionType) searchParams.set('actionType', params.actionType);
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());

    const response = await apiClient.get(`/manager/activity-logs?${searchParams.toString()}`);
    return response.data;
  },

  // ==================== Manager: App Logs ====================

  getAppLogs: async (params: {
    status?: AppLogStatus | 'all_errors';
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    logs: AppLog[];
    total: number;
    actions: string[];
    stats: {
      totalLogs: number;
      errorCount: number;
      validationErrorCount: number;
      successCount: number;
      last24hErrors: number;
    };
    pagination: { limit: number; offset: number; hasMore: boolean };
  }> => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.action) searchParams.set('action', params.action);
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());

    const response = await apiClient.get(`/manager/app-logs?${searchParams.toString()}`);
    return response.data;
  },

  // ==================== Manager: Customer Numbers ====================

  getPartnerUsers: async (partnerId: string): Promise<Array<{
    id: string;
    email: string;
    name: string;
    customerNumbers: Array<{
      id: number;
      userId: string;
      customerNumber: string;
      label: string | null;
      isPrimary: boolean;
      createdAt: string;
    }>;
  }>> => {
    const response = await apiClient.get(`/manager/partners/${partnerId}/users`);
    return response.data.users || [];
  },

  addCustomerNumber: async (userId: string, customerNumber: string, label?: string): Promise<void> => {
    await apiClient.post(`/manager/partners/${userId}/customer-numbers`, { customerNumber, label });
  },

  removeCustomerNumber: async (userId: string, cnId: number): Promise<void> => {
    await apiClient.delete(`/manager/partners/${userId}/customer-numbers/${cnId}`);
  },

  // ==================== Partner: Bookings ====================

  getBookings: async (params: {
    status?: BookingStatus;
    future?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    bookings: Booking[];
    stats: BookingStats;
    declineReasons: DeclineReason[];
    pagination: { limit?: number; offset?: number; total: number };
  }> => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.future) searchParams.set('future', 'true');
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());

    const response = await apiClient.get(`/partner/bookings?${searchParams.toString()}`);
    return response.data;
  },

  getBooking: async (id: number): Promise<Booking> => {
    const response = await apiClient.get<{ success: boolean; booking: Booking }>(`/partner/bookings/${id}`);
    return response.data.booking;
  },

  confirmBooking: async (id: number): Promise<{
    id: number;
    status: BookingStatus;
    confirmedAt: string;
    confirmedBy: string;
  }> => {
    const response = await apiClient.post(`/partner/bookings/${id}/confirm`);
    return response.data.booking;
  },

  declineBooking: async (
    id: number,
    reasonCode: string,
    notes?: string
  ): Promise<{
    id: number;
    status: BookingStatus;
    declinedAt: string;
    declinedBy: string;
    declineReason: string;
    odooTicketId?: string;
  }> => {
    const response = await apiClient.post(`/partner/bookings/${id}/decline`, { reasonCode, notes });
    return { ...response.data.booking, odooTicketId: response.data.odooTicketId };
  },

  // ==================== Manager: Helpdesk ====================

  getHelpdeskTickets: async (params: {
    period?: TimePeriod;
    customFrom?: string;
    customTo?: string;
    stageIds?: number[];
    typeIds?: number[];
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    tickets: Ticket[];
    stages: HelpdeskStage[];
    ticketTypes: HelpdeskTicketType[];
    analytics: HelpdeskAnalytics;
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  }> => {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.set('period', params.period);
    if (params.customFrom) searchParams.set('customFrom', params.customFrom);
    if (params.customTo) searchParams.set('customTo', params.customTo);
    if (params.stageIds?.length) searchParams.set('stageIds', params.stageIds.join(','));
    if (params.typeIds?.length) searchParams.set('typeIds', params.typeIds.join(','));
    if (params.search) searchParams.set('search', params.search);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());

    const response = await apiClient.get(`/manager/helpdesk/tickets?${searchParams.toString()}`);
    return response.data;
  },

  getHelpdeskTicket: async (id: number): Promise<{
    ticket: Ticket;
    messages: TicketMessage[];
  }> => {
    const response = await apiClient.get(`/manager/helpdesk/ticket/${id}`);
    return { ticket: response.data.ticket, messages: response.data.messages };
  },

  analyzeHelpdeskTicket: async (
    ticketId: number,
    mode: 'full' | 'quick' | 'response' = 'full',
    existingAnalysis?: TicketAIAnalysisPhase1
  ): Promise<{
    ticketId: number;
    analysis?: TicketAIAnalysis | TicketAIAnalysisPhase1;
    responseSuggestion?: string;
    mode: string;
  }> => {
    const response = await apiClient.post('/manager/helpdesk/ai/analyze', {
      ticketId,
      mode,
      existingAnalysis,
    });
    return response.data;
  },
};
