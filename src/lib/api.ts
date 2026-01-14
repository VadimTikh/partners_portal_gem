import axios from 'axios';
import { Course, CourseDate, User, CourseRequest, Partner, CourseRequestDate, CreateCourseFromRequest } from './types';
import { useAuthStore } from './auth';
import { mockApi } from './mock-data';

// Single entry point for all n8n operations
const API_URL = '/api/proxy';
const USE_MOCK = !process.env.NEXT_PUBLIC_N8N_API_URL;

if (USE_MOCK) {
  console.log('Running in MOCK mode. API calls will be simulated.');
}

// Helper to get auth headers
const getAuthConfig = () => {
  const token = useAuthStore.getState().token;
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  };
};

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    if (USE_MOCK) return mockApi.login(email, password);

    // Login typically doesn't need auth headers, but needs the action param
    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { email, password }, {
      params: { action: 'login' }
    });
    return response.data;
  },

  getCourses: async (): Promise<Course[]> => {
    if (USE_MOCK) return mockApi.getCourses();

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, {}, { 
      ...getAuthConfig(),
      params: { action: 'get-courses' }
    });
    return response.data;
  },
  
  getCourse: async (id: string | number): Promise<Course | undefined> => {
    if (USE_MOCK) return mockApi.getCourse(id);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { course_id: Number(id) }, {
      ...getAuthConfig(),
      params: { action: 'get-course' }
    });
    return response.data;
  },
  
  updateCourse: async (course: Pick<Course, 'id' | 'title' | 'status' | 'basePrice'>): Promise<Course> => {
    if (USE_MOCK) return mockApi.updateCourse(course);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, {
      id: course.id,
      title: course.title,
      status: course.status,
      basePrice: course.basePrice,
    }, {
      ...getAuthConfig(),
      params: { action: 'update-course' }
    });
    return response.data;
  },

  createCourse: async (course: Omit<Course, 'id' | 'available_dates'>): Promise<Course> => {
    if (USE_MOCK) return mockApi.createCourse(course);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, course, {
      ...getAuthConfig(),
      params: { action: 'create-course' }
    });
    return response.data;
  },

  getDates: async (courseId: string | number): Promise<CourseDate[]> => {
    if (USE_MOCK) return mockApi.getDates(courseId);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { course_id: Number(courseId) }, {
      ...getAuthConfig(),
      params: { action: 'get-dates' }
    });
    return response.data;
  },

  createDate: async (date: Omit<CourseDate, 'id' | 'booked'>): Promise<CourseDate> => {
    if (USE_MOCK) return mockApi.createDate(date);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, date, {
      ...getAuthConfig(),
      params: { action: 'create-date' }
    });
    return response.data;
  },

  deleteDate: async (dateId: number): Promise<void> => {
    if (USE_MOCK) return mockApi.deleteDate(dateId);

    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { date_id: dateId }, {
      ...getAuthConfig(),
      params: { action: 'delete-date' }
    });
  },

  updateDate: async (dateId: number, price: number): Promise<void> => {
    if (USE_MOCK) return mockApi.updateDate(dateId, price);

    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { date_id: dateId, price }, {
      ...getAuthConfig(),
      params: { action: 'update-date' }
    });
  },

  updateSeats: async (dateId: number, seats: number): Promise<void> => {
    if (USE_MOCK) return; // Mock doesn't need implementation

    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { date_id: dateId, seats }, {
      ...getAuthConfig(),
      params: { action: 'update-seats' }
    });
  },

  updateDateTime: async (dateId: number, dateTime: string): Promise<void> => {
    if (USE_MOCK) return; // Mock doesn't need implementation

    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { date_id: dateId, dateTime }, {
      ...getAuthConfig(),
      params: { action: 'update-date-time' }
    });
  },

  updateDuration: async (dateId: number, duration: number): Promise<void> => {
    if (USE_MOCK) return; // Mock doesn't need implementation

    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { date_id: dateId, duration }, {
      ...getAuthConfig(),
      params: { action: 'update-duration' }
    });
  },

  changePassword: async (password: string, newPassword: string): Promise<void> => {
    if (USE_MOCK) return mockApi.changePassword(password, newPassword);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { password, newPassword }, { 
      ...getAuthConfig(),
      params: { action: 'change-password' }
    });

    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || 'Failed to change password');
    }
  },

  resetPassword: async (email: string): Promise<void> => {
    if (USE_MOCK) return mockApi.resetPassword(email);

    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { email }, {
      params: { action: 'reset-password' }
    });
  },

  verifyResetToken: async (token: string): Promise<{ valid: boolean; email?: string }> => {
    if (USE_MOCK) return mockApi.verifyResetToken(token);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { token }, {
      params: { action: 'verify-reset-token' }
    });
    return response.data;
  },

  setNewPassword: async (token: string, newPassword: string): Promise<void> => {
    if (USE_MOCK) return mockApi.setNewPassword(token, newPassword);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { token, newPassword }, {
      params: { action: 'set-new-password' }
    });

    if (response.data && response.data.success === false) {
      throw new Error(response.data.message || 'Failed to set new password');
    }
  },

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    if (USE_MOCK) return mockApi.sendContactMessage(subject, message);

    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { subject, message }, {
      ...getAuthConfig(),
      params: { action: 'contact' }
    });
  },

  // Course Request APIs
  getCourseRequests: async (partnerId?: number): Promise<CourseRequest[]> => {
    if (USE_MOCK) return mockApi.getCourseRequests(partnerId);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { partner_id: partnerId }, {
      ...getAuthConfig(),
      params: { action: 'get-course-requests' }
    });
    return response.data;
  },

  getCourseRequest: async (id: number): Promise<CourseRequest | undefined> => {
    if (USE_MOCK) return mockApi.getCourseRequest(id);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { request_id: id }, {
      ...getAuthConfig(),
      params: { action: 'get-course-request' }
    });
    return response.data;
  },

  createCourseRequest: async (request: {
    name: string;
    location: string;
    basePrice: number;
    partnerDescription: string;
    requestedDates?: CourseRequestDate[];
  }): Promise<CourseRequest> => {
    if (USE_MOCK) return mockApi.createCourseRequest(request);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, request, {
      ...getAuthConfig(),
      params: { action: 'create-course-request' }
    });
    return response.data;
  },

  updateCourseRequestStatus: async (
    id: number,
    status: 'in_moderation' | 'approved' | 'rejected',
    data?: { rejectionReason?: string; rejectionRecommendations?: string; managerNotes?: string }
  ): Promise<CourseRequest> => {
    if (USE_MOCK) return mockApi.updateCourseRequestStatus(id, status, data);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { request_id: id, status, ...data }, {
      ...getAuthConfig(),
      params: { action: 'update-course-request-status' }
    });
    return response.data;
  },

  createCourseFromRequest: async (data: CreateCourseFromRequest): Promise<Course> => {
    if (USE_MOCK) return mockApi.createCourseFromRequest(data);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, data, {
      ...getAuthConfig(),
      params: { action: 'create-course-from-request' }
    });
    return response.data;
  },

  // Partner APIs (for manager)
  getPartners: async (): Promise<Partner[]> => {
    if (USE_MOCK) return mockApi.getPartners();

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, {}, {
      ...getAuthConfig(),
      params: { action: 'get-partners' }
    });
    return response.data;
  },

  getPartner: async (id: number): Promise<Partner | undefined> => {
    if (USE_MOCK) return mockApi.getPartner(id);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { partner_id: id }, {
      ...getAuthConfig(),
      params: { action: 'get-partner' }
    });
    return response.data;
  },

  getPartnerCourses: async (partnerId: number): Promise<Course[]> => {
    if (USE_MOCK) return mockApi.getPartnerCourses(partnerId);

    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { partner_id: partnerId }, {
      ...getAuthConfig(),
      params: { action: 'get-partner-courses' }
    });
    return response.data;
  },
};