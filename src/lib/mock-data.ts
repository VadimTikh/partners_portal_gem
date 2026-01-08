import { Course, CourseDate, User } from './types';

export const MOCK_USER: User = {
  email: 'demo@miomente.com',
  name: 'Demo Partner',
  token: 'mock-jwt-token-12345',
};

export const MOCK_COURSES: Course[] = [
  {
    id: 1,
    title: 'Italian Cooking Masterclass',
    sku: 'IT-COOK-001',
    status: 'active',
    description: 'Learn the secrets of authentic Italian cuisine from pasta to tiramisu.',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf?auto=format&fit=crop&q=80&w=1000',
    basePrice: 89.00,
  },
  {
    id: 2,
    title: 'Wine Tasting Essentials',
    sku: 'WINE-101',
    status: 'active',
    description: 'A journey through the most famous wine regions of the world.',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=1000',
    basePrice: 59.00,
  },
  {
    id: 3,
    title: 'Barista Basics',
    sku: 'COFFEE-001',
    status: 'inactive',
    description: 'Master the art of espresso and milk frothing.',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1000',
    basePrice: 45.00,
  }
];

export const MOCK_DATES: Record<number, CourseDate[]> = {
  1: [
    { id: 1, courseId: 1, dateTime: '2024-02-15T18:00:00Z', capacity: 12, booked: 8, duration: 180 },
    { id: 2, courseId: 1, dateTime: '2024-02-22T18:00:00Z', capacity: 12, booked: 12, duration: 180 },
    { id: 3, courseId: 1, dateTime: '2024-03-01T18:00:00Z', capacity: 12, booked: 4, duration: 180 },
  ],
  2: [
    { id: 4, courseId: 2, dateTime: '2024-02-20T19:00:00Z', capacity: 20, booked: 15, duration: 120 },
    { id: 5, courseId: 2, dateTime: '2024-03-05T19:00:00Z', capacity: 20, booked: 5, duration: 120 },
  ],
  3: []
};

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockApi = {
  login: async (email: string, password: string): Promise<User> => {
    await delay(500);
    if (email === 'demo@miomente.com' && password === 'demo') {
      return MOCK_USER;
    }
    // Allow any login for demo purposes if not strictly checked
    if (email && password) {
       return { ...MOCK_USER, email, name: email.split('@')[0] };
    }
    throw new Error('Invalid credentials');
  },

  getCourses: async (): Promise<Course[]> => {
    await delay(500);
    return [...MOCK_COURSES];
  },

  getCourse: async (id: string | number): Promise<Course | undefined> => {
    await delay(300);
    const numId = Number(id);
    return MOCK_COURSES.find(c => c.id === numId);
  },

  updateCourse: async (course: Course): Promise<Course> => {
    await delay(500);
    const index = MOCK_COURSES.findIndex(c => c.id === course.id);
    if (index !== -1) {
      MOCK_COURSES[index] = { ...course };
      return MOCK_COURSES[index];
    }
    return course;
  },

  getDates: async (courseId: string | number): Promise<CourseDate[]> => {
    await delay(400);
    const numId = Number(courseId);
    return MOCK_DATES[numId] || [];
  },

  saveDates: async (courseId: string | number, newDates: CourseDate[]): Promise<CourseDate[]> => {
    await delay(600);
    const numId = Number(courseId);
    MOCK_DATES[numId] = newDates;
    return newDates;
  },

  changePassword: async (password: string, newPassword: string): Promise<void> => {
    await delay(500);
    console.log('Mock password change:', { password, newPassword });
  },

  resetPassword: async (email: string): Promise<void> => {
    await delay(500);
    console.log('Mock password reset for:', email);
  },

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    await delay(500);
    console.log('Mock contact message:', { subject, message });
  }
};
