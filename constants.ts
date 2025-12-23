
import { Student } from './types';

// URL Google Apps Script Anda
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwtcLk4tHst7HkGIv36oOasY6ollRDqp9AMTfKkua-5vOId6VO7c3TCsNyD2a4MNJFtOw/exec";

// SILAKAN TEMPELKAN KEMBALI DAFTAR LENGKAP SISWA ANDA DI SINI
// Jika Anda memiliki file Excel, Anda juga bisa menggunakan tombol "IMPORT" di menu "HEROES"
export const INITIAL_STUDENTS: Student[] = [
  { id: '1129', className: 'IX A', name: 'ABEL AULIA PASA RAMADANI', gender: 'P' },
  { id: '1132', className: 'IX A', name: 'ADITYA FIRMANSYAH', gender: 'L' },
  { id: '1133', className: 'IX A', name: 'AHMAD DANI', gender: 'L' },
  { id: '1134', className: 'IX B', name: 'ALYA NUR AZIZAH', gender: 'P' },
  { id: '1135', className: 'IX B', name: 'BINTANG RAMADHAN', gender: 'L' },
  { id: '1136', className: 'IX C', name: 'CHAIRUL ANAM', gender: 'L' },
  { id: '1137', className: 'IX C', name: 'DEWI SARTIKA', gender: 'P' },
  { id: '1138', className: 'IX D', name: 'EKO PRASETYO', gender: 'L' },
  { id: '1139', className: 'IX D', name: 'FITRIANI', gender: 'P' },
  { id: '1140', className: 'IX E', name: 'GALIH RAKASWI', gender: 'L' }
  // ... Tambahkan data siswa lainnya di sini jika ada
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
