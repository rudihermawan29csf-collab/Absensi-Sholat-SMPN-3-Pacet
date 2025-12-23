
import { Student, AttendanceRecord } from '../types';
import { INITIAL_STUDENTS, STORAGE_KEYS, GOOGLE_SCRIPT_URL } from '../constants';

const fetchWithTimeout = async (url: string, options: any = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// AMBIL SISWA DARI CLOUD
export const getStudents = async (): Promise<Student[]> => {
  try {
    const response = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=getStudents`);
    const data = await response.json();
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(data));
    return data;
  } catch (error) {
    console.warn("Gagal ambil siswa dari cloud, gunakan lokal.");
    const stored = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    return stored ? JSON.parse(stored) : INITIAL_STUDENTS;
  }
};

// SIMPAN SISWA KE CLOUD
export const saveStudents = async (students: Student[]): Promise<boolean> => {
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveStudents',
        payload: students
      })
    });
    return true;
  } catch (error) {
    console.error("Gagal sinkron siswa ke cloud:", error);
    return false;
  }
};

// AMBIL ABSENSI DARI CLOUD
export const getAttendance = async (): Promise<AttendanceRecord[]> => {
  try {
    const response = await fetchWithTimeout(GOOGLE_SCRIPT_URL);
    const data = await response.json();
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(data));
    return data;
  } catch (error) {
    const stored = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    return stored ? JSON.parse(stored) : [];
  }
};

// SIMPAN ABSENSI KE CLOUD
export const addAttendanceRecordToSheet = async (
  student: Student, 
  operatorName: string, 
  status: 'PRESENT' | 'HAID' = 'PRESENT'
): Promise<{ success: boolean; message: string }> => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const cachedRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]');
  if (cachedRecords.some((r: any) => r.studentId === student.id && r.date === today)) {
    return { success: false, message: `${student.name} sudah absen hari ini.` };
  }

  const newRecord: AttendanceRecord = {
    id: crypto.randomUUID(),
    studentId: student.id,
    studentName: student.name,
    className: student.className,
    date: today,
    timestamp: Date.now(),
    operatorName: operatorName,
    status: status
  };

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addAttendance',
        payload: newRecord
      })
    });

    const updatedRecords = [...cachedRecords, newRecord];
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(updatedRecords));
    return { success: true, message: `${student.name} berhasil ABSEN (Cloud Sync)` };
  } catch (error) {
    const updatedRecords = [...cachedRecords, newRecord];
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(updatedRecords));
    return { success: true, message: `${student.name} berhasil (Lokal)` };
  }
};
