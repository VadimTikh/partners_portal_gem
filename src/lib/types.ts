export interface Course {
  id: string;
  title: string;
  sku: string;
  status: 'active' | 'inactive';
  description: string;
  image: string;
  basePrice: number;
}

export interface CourseDate {
  id: string;
  courseId: string;
  dateTime: string; // ISO string
  capacity: number;
  booked: number;
  duration?: number; // Duration in minutes
}

export interface User {
  email: string;
  name: string;
  token?: string;
}
