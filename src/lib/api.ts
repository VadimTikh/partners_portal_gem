import axios from 'axios';
import { Course, CourseDate, User } from './types';
import { MOCK_COURSES, MOCK_DATES } from './mock-data';
import { useAuthStore } from './auth';

// Single entry point for all n8n operations
const API_URL = process.env.NEXT_PUBLIC_N8N_API_URL;

// Simulate network delay for mocks
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// In-memory store for the session (fallback)
let courses = [...MOCK_COURSES];
let dates = [...MOCK_DATES];

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    if (API_URL) {
      // Login typically doesn't need auth headers, but needs the action param
      const response = await axios.post(API_URL, { email, password }, {
        params: { action: 'login' }
      });
      return response.data;
    }
    // Mock login
    await delay(800);
    if (email === 'admin@partner.de' && password === 'password123') {
      return { email, name: 'Partner Admin', token: 'mock-jwt-token' };
    }
    throw new Error('Invalid credentials');
  },

  getCourses: async (): Promise<Course[]> => {
    if (API_URL) {
      const response = await axios.post(API_URL, {}, { 
        ...getAuthConfig(),
        params: { action: 'get-courses' }
      });
      return response.data;
    }
    await delay(800);
    return courses;
  },
  
  getCourse: async (id: string): Promise<Course | undefined> => {
    if (API_URL) {
      const response = await axios.post(API_URL, { id }, { 
        ...getAuthConfig(),
        params: { action: 'get-course' } 
      });
      return response.data;
    }
    // Fallback to memory store
    await delay(800);
    return courses.find((c) => c.id === id);
  },
  
  updateCourse: async (course: Course): Promise<Course> => {
    if (API_URL) {
      const response = await axios.post(API_URL, course, { 
        ...getAuthConfig(),
        params: { action: 'update-course' }
      });
      return response.data;
    }
    await delay(1000);
    courses = courses.map(c => c.id === course.id ? course : c);
    // If it's a new course (not in list), add it
    if (!courses.find(c => c.id === course.id)) {
        courses.push(course);
    }
    return course;
  },

  getDates: async (courseId: string): Promise<CourseDate[]> => {
    if (API_URL) {
      const response = await axios.post(API_URL, { courseId }, { 
        ...getAuthConfig(),
        params: { action: 'get-dates' } 
      });
      return response.data;
    }
    await delay(800);
    return dates.filter((d) => d.courseId === courseId);
  },
  
  saveDates: async (courseId: string, newDates: CourseDate[]): Promise<CourseDate[]> => {
    if (API_URL) {
      const response = await axios.post(API_URL, { courseId, dates: newDates }, { 
        ...getAuthConfig(),
        params: { action: 'save-dates' }
      });
      return response.data;
    }
    await delay(1000);
    // Remove old dates for this course and add new ones
    dates = dates.filter(d => d.courseId !== courseId).concat(newDates);
    return newDates;
  },

  changePassword: async (password: string, newPassword: string): Promise<void> => {
    if (API_URL) {
      await axios.post(API_URL, { password, newPassword }, { 
        ...getAuthConfig(),
        params: { action: 'change-password' }
      });
      return;
    }
    // Mock password change
    await delay(1000);
    console.log('Password changed from', password, 'to', newPassword);
    return;
  },

  resetPassword: async (email: string): Promise<void> => {
    if (API_URL) {
      await axios.post(API_URL, { email }, {
        params: { action: 'reset-password' }
      });
      return;
    }
    // Mock password reset
    await delay(1000);
    console.log('Reset password link sent to:', email);
    return;
  },

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    if (API_URL) {
      await axios.post(API_URL, { subject, message }, { 
        ...getAuthConfig(),
        params: { action: 'contact' }
      });
      return;
    }
    await delay(1000);
    console.log('Message sent:', { subject, message });
  }
};