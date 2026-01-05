import { Course, CourseDate, MOCK_COURSES, MOCK_DATES } from './mock-data';

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory store for the session
let courses = [...MOCK_COURSES];
let dates = [...MOCK_DATES];

export const api = {
  getCourses: async (): Promise<Course[]> => {
    await delay(800);
    return courses;
  },
  
  getCourse: async (id: string): Promise<Course | undefined> => {
    await delay(800);
    return courses.find((c) => c.id === id);
  },
  
  updateCourse: async (course: Course): Promise<Course> => {
    await delay(1000);
    courses = courses.map(c => c.id === course.id ? course : c);
    return course;
  },

  getDates: async (courseId: string): Promise<CourseDate[]> => {
    await delay(800);
    return dates.filter((d) => d.courseId === courseId);
  },
  
  saveDates: async (courseId: string, newDates: CourseDate[]): Promise<CourseDate[]> => {
    await delay(1000);
    // Remove old dates for this course and add new ones
    dates = dates.filter(d => d.courseId !== courseId).concat(newDates);
    return newDates;
  },

  sendContactMessage: async (subject: string, message: string): Promise<void> => {
    await delay(1000);
    console.log('Message sent:', { subject, message });
  }
};
