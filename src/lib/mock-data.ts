import { Course, CourseDate } from './types';

export const MOCK_COURSES: Course[] = [
  {
    id: 'c1',
    title: 'Italian Cooking Masterclass',
    sku: 'IT-COOK-001',
    status: 'active',
    description: 'Learn the secrets of authentic Italian cuisine.',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf',
    basePrice: 99,
  },
  {
    id: 'c2',
    title: 'Wine Tasting & Pairing',
    sku: 'WINE-002',
    status: 'active',
    description: 'Discover the art of wine tasting with our expert sommeliers.',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3',
    basePrice: 75,
  },
  {
    id: 'c3',
    title: 'Sushi Making Workshop',
    sku: 'JP-SUSHI-003',
    status: 'inactive',
    description: 'Master the art of sushi making in this hands-on workshop.',
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c',
    basePrice: 120,
  },
];

export const MOCK_DATES: CourseDate[] = [
  { id: 'd1', courseId: 'c1', dateTime: '2023-11-15T18:00:00', capacity: 10, booked: 8, duration: 180 },
  { id: 'd2', courseId: 'c1', dateTime: '2023-11-20T18:00:00', capacity: 10, booked: 2, duration: 180 },
  { id: 'd3', courseId: 'c2', dateTime: '2023-11-18T19:00:00', capacity: 15, booked: 15, duration: 120 },
];
