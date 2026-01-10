export interface Course {
  id: number;
  title: string;
  sku: string;
  status: 'active' | 'inactive';
  description: string;
  image: string;
  basePrice: number;
  available_dates?: number;
  location: string;
}

export interface CourseDate {
  id: number;
  courseId: number;
  dateTime: string; // ISO string
  capacity: number;
  booked: number;
  duration?: number; // Duration in minutes
  price: number; // Price for this specific date
}

export interface User {
  email: string;
  name: string;
  token?: string;
}
