
import { Student } from './types';

// GANTI URL INI DENGAN URL WEB APP DARI GOOGLE APPS SCRIPT ANDA
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwtcLk4tHst7HkGIv36oOasY6ollRDqp9AMTfKkua-5vOId6VO7c3TCsNyD2a4MNJFtOw/exec";

export const INITIAL_STUDENTS: Student[] = [
  // Data ini sekarang hanya sebagai fallback jika internet mati
  { id: '1129', className: 'IX A', name: 'ABEL AULIA PASA RAMADANI', gender: 'P' },
  { id: '1132', className: 'IX A', name: 'ADITYA FIRMANSYAH', gender: 'L', parentPhone: '628987654321' },
];

export const TEACHERS = [
  "Dra. Sri Hayati",
  "Bakhtiar Rifai, SE",
  "Moch. Husain Rifai Hamzah, S.Pd.",
  "Rudi Hermawan, S.Pd.I",
  "Okha Devi Anggraini, S.Pd.",
  "Eka Hariyati, S. Pd.",
  "Mikoe Wahyudi Putra, ST., S. Pd.",
  "Purnadi, S. Pd.",
  "Israfin Maria Ulfa, S.Pd",
  "Syadam Budi Satrianto, S.Pd",
  "Rebby Dwi Prataopu, S.Si",
  "Mukhamad Yunus, S.Pd",
  "Fahmi Wahyuni, S.Pd",
  "Fakhita Madury, S.Sn",
  "Retno Nawangwulan, S. Pd.",
  "Emilia Kartika Sari, S.Pd",
  "Akhmad Hariadi, S.Pd"
];

export const STORAGE_KEYS = {
  STUDENTS: 'smpn3pacet_students_cache',
  ATTENDANCE: 'smpn3pacet_attendance_cache',
  AUTH: 'smpn3pacet_auth_session'
};
