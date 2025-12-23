export interface Student {
  id: string; // Will store NIS
  name: string;
  className: string;
  gender?: 'L' | 'P'; // Laki-laki / Perempuan (Optional now)
  parentPhone?: string; // Optional: Nomor WA Orang Tua (format 628xxx)
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  operatorName?: string; // Nama Guru yang melakukan scan
  status?: 'PRESENT' | 'HAID'; // Status kehadiran
}

export type TabView = 'dashboard' | 'scan' | 'students' | 'reports';
export type UserRole = 'ADMIN' | 'TEACHER' | 'PARENT';

export enum ReportPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  SEMESTER = 'SEMESTER'
}