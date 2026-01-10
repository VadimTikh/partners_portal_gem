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
    location: 'München',
  },
  {
    id: 2,
    title: 'Wine Tasting Essentials',
    sku: 'WINE-101',
    status: 'active',
    description: 'A journey through the most famous wine regions of the world.',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=1000',
    basePrice: 59.00,
    location: 'Berlin',
  },
  {
    id: 3,
    title: 'Barista Basics',
    sku: 'COFFEE-001',
    status: 'inactive',
    description: 'Master the art of espresso and milk frothing.',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1000',
    basePrice: 45.00,
    location: 'Hamburg',
  }
];

export const MOCK_DATES: Record<number, CourseDate[]> = {
  1: [
    { id: 1, courseId: 1, dateTime: '2024-02-15T18:00:00Z', capacity: 12, booked: 8, duration: 180, price: 89.00 },
    { id: 2, courseId: 1, dateTime: '2024-02-22T18:00:00Z', capacity: 12, booked: 12, duration: 180, price: 89.00 },
    { id: 3, courseId: 1, dateTime: '2024-03-01T18:00:00Z', capacity: 12, booked: 4, duration: 180, price: 129.00 },
  ],
  2: [
    { id: 4, courseId: 2, dateTime: '2024-02-20T19:00:00Z', capacity: 20, booked: 15, duration: 120, price: 59.00 },
    { id: 5, courseId: 2, dateTime: '2024-03-05T19:00:00Z', capacity: 20, booked: 5, duration: 120, price: 79.00 },
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

  updateCourse: async (course: Pick<Course, 'id' | 'title' | 'status' | 'basePrice'>): Promise<Course> => {
    await delay(500);
    const index = MOCK_COURSES.findIndex(c => c.id === course.id);
    if (index !== -1) {
      MOCK_COURSES[index] = {
        ...MOCK_COURSES[index],
        title: course.title,
        status: course.status,
        basePrice: course.basePrice,
      };
      return MOCK_COURSES[index];
    }
    throw new Error('Course not found');
  },

  createCourse: async (course: Omit<Course, 'id' | 'available_dates'>): Promise<Course> => {
    await delay(500);
    const newCourse: Course = {
      ...course,
      id: Date.now(),
    };
    MOCK_COURSES.push(newCourse);
    MOCK_DATES[newCourse.id] = [];
    return newCourse;
  },

  getDates: async (courseId: string | number): Promise<CourseDate[]> => {
    await delay(400);
    const numId = Number(courseId);
    return MOCK_DATES[numId] || [];
  },

  createDate: async (date: Omit<CourseDate, 'id' | 'booked'>): Promise<CourseDate> => {
    await delay(500);
    const newDate: CourseDate = {
      ...date,
      id: Date.now(),
      booked: 0,
    };
    if (!MOCK_DATES[date.courseId]) {
      MOCK_DATES[date.courseId] = [];
    }
    MOCK_DATES[date.courseId].push(newDate);
    return newDate;
  },

  deleteDate: async (dateId: number): Promise<void> => {
    await delay(400);
    for (const courseId in MOCK_DATES) {
      const index = MOCK_DATES[Number(courseId)].findIndex(d => d.id === dateId);
      if (index !== -1) {
        MOCK_DATES[Number(courseId)].splice(index, 1);
        return;
      }
    }
  },

  updateDate: async (dateId: number, price: number): Promise<void> => {
    await delay(400);
    for (const courseId in MOCK_DATES) {
      const date = MOCK_DATES[Number(courseId)].find(d => d.id === dateId);
      if (date) {
        date.price = price;
        return;
      }
    }
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
