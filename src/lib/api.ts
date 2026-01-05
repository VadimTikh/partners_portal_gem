import axios from 'axios';
import { Course, CourseDate, User } from './types';
import { useAuthStore } from './auth';

// Single entry point for all n8n operations
const API_URL = process.env.NEXT_PUBLIC_N8N_API_URL;

if (!API_URL) {
  console.warn('NEXT_PUBLIC_N8N_API_URL is not set. API calls will fail.');
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
    // Login typically doesn't need auth headers, but needs the action param
    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { email, password }, {
      params: { action: 'login' }
    });
    return response.data;
  },

  getCourses: async (): Promise<Course[]> => {
    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, {}, { 
      ...getAuthConfig(),
      params: { action: 'get-courses' }
    });
    return response.data;
  },
  
  getCourse: async (id: string): Promise<Course | undefined> => {
    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { id }, { 
      ...getAuthConfig(),
      params: { action: 'get-course' } 
    });
    return response.data;
  },
  
  updateCourse: async (course: Course): Promise<Course> => {
    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, course, { 
      ...getAuthConfig(),
      params: { action: 'update-course' }
    });
    return response.data;
  },

  getDates: async (courseId: string): Promise<CourseDate[]> => {
    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { courseId }, { 
      ...getAuthConfig(),
      params: { action: 'get-dates' } 
    });
    return response.data;
  },
  
  saveDates: async (courseId: string, newDates: CourseDate[]): Promise<CourseDate[]> => {
    if (!API_URL) throw new Error('API URL not configured');
    const response = await axios.post(API_URL, { courseId, dates: newDates }, { 
      ...getAuthConfig(),
      params: { action: 'save-dates' }
    });
    return response.data;
  },

  changePassword: async (password: string, newPassword: string): Promise<void> => {
    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { password, newPassword }, { 
      ...getAuthConfig(),
      params: { action: 'change-password' }
    });
  },

  resetPassword: async (email: string): Promise<void> => {
    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { email }, {
      params: { action: 'reset-password' }
    });
  },

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    if (!API_URL) throw new Error('API URL not configured');
    await axios.post(API_URL, { subject, message }, { 
      ...getAuthConfig(),
      params: { action: 'contact' }
    });
  }
};
