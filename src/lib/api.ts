import axios from 'axios';
import { Course, CourseDate, User } from './types';
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

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    if (USE_MOCK) return mockApi.sendContactMessage(subject, message);

    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { subject, message }, { 
      ...getAuthConfig(),
      params: { action: 'contact' }
    });
  }
};