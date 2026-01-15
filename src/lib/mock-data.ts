import { Course, CourseDate, User, CourseRequest, Partner, CourseRequestDate, CreateCourseFromRequest } from './types';

export const MOCK_PARTNER_USER: User = {
  email: 'demo@miomente.com',
  name: 'Demo Partner',
  token: 'mock-jwt-token-partner-12345',
  role: 'partner',
  partnerId: 1,
  partnerName: 'Food Atlas GmbH',
};

export const MOCK_MANAGER_USER: User = {
  email: 'manager@miomente.com',
  name: 'Manager Admin',
  token: 'mock-jwt-token-manager-67890',
  role: 'manager',
};

export const MOCK_PARTNERS: Partner[] = [
  {
    id: 1,
    name: 'Hans Mueller',
    email: 'demo@miomente.com',
    companyName: 'Food Atlas GmbH',
    coursesCount: 3,
    activeCoursesCount: 2,
    availableDatesCount: 5,
    pendingRequestsCount: 1,
  },
  {
    id: 2,
    name: 'Anna Schmidt',
    email: 'anna@weinschule.de',
    companyName: 'Weinschule Berlin',
    coursesCount: 5,
    activeCoursesCount: 4,
    availableDatesCount: 12,
    pendingRequestsCount: 2,
  },
  {
    id: 3,
    name: 'Marco Rossi',
    email: 'marco@kochstudio.de',
    companyName: 'Kochstudio München',
    coursesCount: 8,
    activeCoursesCount: 6,
    availableDatesCount: 3,
    pendingRequestsCount: 0,
  },
];

export const MOCK_COURSES: Course[] = [
  {
    id: 1,
    title: 'Italian Cooking Masterclass',
    sku: 'IT-COOK-001',
    status: 'active',
    description: 'Learn the secrets of authentic Italian cuisine from pasta to tiramisu.',
    image: 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?auto=format&fit=crop&q=80&w=1000',
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

export const MOCK_COURSE_REQUESTS: CourseRequest[] = [
  {
    id: 1,
    partnerId: 1,
    partnerName: 'Food Atlas GmbH',
    partnerEmail: 'demo@miomente.com',
    name: 'Veganes Sushi Workshop',
    location: 'München',
    basePrice: 79.00,
    partnerDescription: 'Ein Workshop für veganes Sushi mit kreativen pflanzlichen Zutaten. Perfekt für Einsteiger und Fortgeschrittene.',
    requestedDates: [
      { dateTime: '2024-04-15T18:00:00Z', duration: 180, capacity: 10 },
      { dateTime: '2024-04-22T18:00:00Z', duration: 180, capacity: 10, customPrice: 89.00 },
    ],
    status: 'pending',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z',
  },
  {
    id: 2,
    partnerId: 2,
    partnerName: 'Weinschule Berlin',
    partnerEmail: 'anna@weinschule.de',
    name: 'Champagner Masterclass',
    location: 'Berlin',
    basePrice: 129.00,
    partnerDescription: 'Exklusive Verkostung von Premium-Champagnern aus verschiedenen Häusern. Inkl. Käseplatte.',
    status: 'in_moderation',
    createdAt: '2024-01-08T14:30:00Z',
    updatedAt: '2024-01-12T09:00:00Z',
    managerNotes: 'Sehr interessantes Angebot, prüfe Kategorie-Zuordnung',
  },
  {
    id: 3,
    partnerId: 2,
    partnerName: 'Weinschule Berlin',
    partnerEmail: 'anna@weinschule.de',
    name: 'Naturwein Entdeckung',
    location: 'Berlin',
    basePrice: 69.00,
    partnerDescription: 'Einführung in die Welt der Naturweine. 6 verschiedene Weine aus Europa.',
    status: 'pending',
    createdAt: '2024-01-11T16:00:00Z',
    updatedAt: '2024-01-11T16:00:00Z',
  },
  {
    id: 4,
    partnerId: 1,
    partnerName: 'Food Atlas GmbH',
    partnerEmail: 'demo@miomente.com',
    name: 'Thai Street Food',
    location: 'München',
    basePrice: 75.00,
    partnerDescription: 'Authentische Thai-Küche wie auf den Straßen von Bangkok. Pad Thai, Som Tam und mehr.',
    status: 'approved',
    createdCourseId: 10,
    createdAt: '2024-01-05T11:00:00Z',
    updatedAt: '2024-01-09T15:00:00Z',
  },
  {
    id: 5,
    partnerId: 1,
    partnerName: 'Food Atlas GmbH',
    partnerEmail: 'demo@miomente.com',
    name: 'Molekulare Küche Basics',
    location: 'München',
    basePrice: 149.00,
    partnerDescription: 'Einführung in die molekulare Küche mit Sphärifikation und Gelierung.',
    status: 'rejected',
    rejectionReason: 'Zu spezielles Equipment erforderlich',
    rejectionRecommendations: 'Bitte prüfen Sie, ob Sie die benötigten Geräte (Sous-Vide, Siphon etc.) bereitstellen können. Wir können den Kurs erneut prüfen, wenn die Ausstattung vorhanden ist.',
    createdAt: '2024-01-02T09:00:00Z',
    updatedAt: '2024-01-06T14:00:00Z',
  },
];

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockApi = {
  login: async (email: string, password: string): Promise<User> => {
    await delay(500);
    // Manager login
    if (email === 'manager@miomente.com' && password === 'manager') {
      return MOCK_MANAGER_USER;
    }
    // Partner login
    if (email === 'demo@miomente.com' && password === 'demo') {
      return MOCK_PARTNER_USER;
    }
    // Allow any login for demo purposes - defaults to partner role
    if (email && password) {
      return {
        ...MOCK_PARTNER_USER,
        email,
        name: email.split('@')[0],
        role: 'partner',
      };
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
    console.log('Mock password reset request for:', email);
  },

  verifyResetToken: async (token: string): Promise<{ valid: boolean; email?: string }> => {
    await delay(300);
    if (token.startsWith('valid-')) {
      return { valid: true, email: 'demo@miomente.com' };
    }
    return { valid: false };
  },

  setNewPassword: async (token: string, newPassword: string): Promise<void> => {
    await delay(500);
    console.log('Mock set new password:', { token, newPassword });
    if (!token.startsWith('valid-')) {
      throw new Error('Invalid or expired reset token');
    }
  },

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    await delay(500);
    console.log('Mock contact message:', { subject, message });
  },

  // Course Request APIs
  getCourseRequests: async (partnerId?: number): Promise<CourseRequest[]> => {
    await delay(500);
    if (partnerId) {
      return MOCK_COURSE_REQUESTS.filter(r => r.partnerId === partnerId);
    }
    return [...MOCK_COURSE_REQUESTS];
  },

  getCourseRequest: async (id: number): Promise<CourseRequest | undefined> => {
    await delay(300);
    return MOCK_COURSE_REQUESTS.find(r => r.id === id);
  },

  createCourseRequest: async (request: {
    name: string;
    location: string;
    basePrice: number;
    partnerDescription: string;
    requestedDates?: CourseRequestDate[];
  }): Promise<CourseRequest> => {
    await delay(500);
    const newRequest: CourseRequest = {
      id: Date.now(),
      partnerId: MOCK_PARTNER_USER.partnerId!,
      partnerName: MOCK_PARTNER_USER.partnerName!,
      partnerEmail: MOCK_PARTNER_USER.email,
      ...request,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MOCK_COURSE_REQUESTS.push(newRequest);
    return newRequest;
  },

  updateCourseRequestStatus: async (
    id: number,
    status: 'in_moderation' | 'approved' | 'rejected',
    data?: { rejectionReason?: string; rejectionRecommendations?: string; managerNotes?: string }
  ): Promise<CourseRequest> => {
    await delay(500);
    const request = MOCK_COURSE_REQUESTS.find(r => r.id === id);
    if (!request) throw new Error('Request not found');

    request.status = status;
    request.updatedAt = new Date().toISOString();
    if (data?.rejectionReason) request.rejectionReason = data.rejectionReason;
    if (data?.rejectionRecommendations) request.rejectionRecommendations = data.rejectionRecommendations;
    if (data?.managerNotes) request.managerNotes = data.managerNotes;

    return request;
  },

  createCourseFromRequest: async (data: CreateCourseFromRequest): Promise<Course> => {
    await delay(800);
    const request = MOCK_COURSE_REQUESTS.find(r => r.id === data.requestId);
    if (!request) throw new Error('Request not found');

    const newCourse: Course = {
      id: Date.now(),
      title: request.name,
      sku: `NEW-${Date.now()}`,
      status: 'active',
      description: data.description,
      image: data.image || 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?auto=format&fit=crop&q=80&w=1000',
      basePrice: request.basePrice,
      location: request.location,
    };

    MOCK_COURSES.push(newCourse);
    MOCK_DATES[newCourse.id] = [];

    // Create dates from request if any
    if (request.requestedDates) {
      for (const reqDate of request.requestedDates) {
        const newDate: CourseDate = {
          id: Date.now() + Math.random() * 1000,
          courseId: newCourse.id,
          dateTime: reqDate.dateTime,
          capacity: reqDate.capacity,
          booked: 0,
          duration: reqDate.duration,
          price: reqDate.customPrice || request.basePrice,
        };
        MOCK_DATES[newCourse.id].push(newDate);
      }
    }

    // Update request status
    request.status = 'approved';
    request.createdCourseId = newCourse.id;
    request.updatedAt = new Date().toISOString();

    return newCourse;
  },

  // Partner APIs (for manager)
  getPartners: async (): Promise<Partner[]> => {
    await delay(500);
    return [...MOCK_PARTNERS];
  },

  getPartner: async (id: number): Promise<Partner | undefined> => {
    await delay(300);
    return MOCK_PARTNERS.find(p => p.id === id);
  },

  getPartnerCourses: async (partnerId: number): Promise<Course[]> => {
    await delay(400);
    // In mock, return all courses for any partner
    return [...MOCK_COURSES];
  },
};
