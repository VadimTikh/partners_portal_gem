import axios from 'axios';
import { Course, CourseDate, User } from './types';
import { MOCK_COURSES, MOCK_DATES } from './mock-data';

// Environment variables for n8n Webhooks
const API_URLS = {
  login: process.env.NEXT_PUBLIC_N8N_LOGIN_WEBHOOK,
  courses: process.env.NEXT_PUBLIC_N8N_COURSES_WEBHOOK,
  course: process.env.NEXT_PUBLIC_N8N_COURSE_WEBHOOK,
  updateCourse: process.env.NEXT_PUBLIC_N8N_UPDATE_COURSE_WEBHOOK,
  dates: process.env.NEXT_PUBLIC_N8N_DATES_WEBHOOK,
  saveDates: process.env.NEXT_PUBLIC_N8N_SAVE_DATES_WEBHOOK,
  contact: process.env.NEXT_PUBLIC_N8N_CONTACT_WEBHOOK,
  changePassword: process.env.NEXT_PUBLIC_N8N_CHANGE_PASSWORD_WEBHOOK,
  resetPassword: process.env.NEXT_PUBLIC_N8N_RESET_PASSWORD_WEBHOOK,
};

// Simulate network delay for mocks
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory store for the session (fallback)
let courses = [...MOCK_COURSES];
let dates = [...MOCK_DATES];

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    if (API_URLS.login) {
      const response = await axios.post(API_URLS.login, { email, password });
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
    if (API_URLS.courses) {
      const response = await axios.get(API_URLS.courses);
      return response.data;
    }
    await delay(800);
    return courses;
  },
  
  getCourse: async (id: string): Promise<Course | undefined> => {
    if (API_URLS.course) {
      const response = await axios.get(API_URLS.course, { params: { id } });
      return response.data;
    }
    // If we have a courses endpoint but not specific course endpoint, we could fetch all and find one,
    // but here we assume if one is missing we fallback to mock for that specific action or use the memory store.
    
    // Fallback to memory store
    await delay(800);
    return courses.find((c) => c.id === id);
  },
  
  updateCourse: async (course: Course): Promise<Course> => {
    if (API_URLS.updateCourse) {
      const response = await axios.post(API_URLS.updateCourse, course);
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
    if (API_URLS.dates) {
      const response = await axios.get(API_URLS.dates, { params: { courseId } });
      return response.data;
    }
    await delay(800);
    return dates.filter((d) => d.courseId === courseId);
  },
  
  saveDates: async (courseId: string, newDates: CourseDate[]): Promise<CourseDate[]> => {
    if (API_URLS.saveDates) {
      const response = await axios.post(API_URLS.saveDates, { courseId, dates: newDates });
      return response.data;
    }
    await delay(1000);
    // Remove old dates for this course and add new ones
    dates = dates.filter(d => d.courseId !== courseId).concat(newDates);
    return newDates;
  },

  changePassword: async (password: string, newPassword: string): Promise<void> => {
    if (API_URLS.changePassword) {
      await axios.post(API_URLS.changePassword, { password, newPassword });
      return;
    }
    // Mock password change
    await delay(1000);
    // In a real app we'd verify current password first, but here we just simulate success.
    console.log('Password changed from', password, 'to', newPassword);
    return;
  },

  resetPassword: async (email: string): Promise<void> => {
    if (API_URLS.resetPassword) {
      await axios.post(API_URLS.resetPassword, { email });
      return;
    }
    // Mock password reset
    await delay(1000);
    console.log('Reset password link sent to:', email);
    return;
  },

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    if (API_URLS.contact) {
      await axios.post(API_URLS.contact, { subject, message });
      return;
    }
    await delay(1000);
    console.log('Message sent:', { subject, message });
  }
};
