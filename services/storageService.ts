
import { Student, AttendanceRecord } from '../types';
import { INITIAL_STUDENTS, STORAGE_KEYS, GOOGLE_SCRIPT_URL } from '../constants';

const fetchWithTimeout = async (url: string, options: any = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { 
      ...options, 
      signal: controller.signal,
      redirect: 'follow' 
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const getStudents = async (): Promise<Student[]> => {
  const stored = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  let localData: Student[] = stored ? JSON.parse(stored) : INITIAL_STUDENTS;

  try {
    const response = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=getStudents`);
    const cloudData = await response.json();
    
    if (Array.isArray(cloudData) && cloudData.length > 0) {
      // Merge logic for students: Cloud takes precedence, but keep local-only if any
      const merged = [...cloudData];
      localData.forEach(ls => {
        if (!merged.find(cs => cs.id === ls.id)) merged.push(ls);
      });
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(merged));
      return merged;
    }
    return localData;
  } catch (error) {
    return localData;
  }
};

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
    return false;
  }
};

export const getAttendance = async (): Promise<AttendanceRecord[]> => {
  const stored = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
  const localRecords: AttendanceRecord[] = stored ? JSON.parse(stored) : [];

  try {
    const response = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=getAttendance`);
    const cloudRecords = await response.json();
    
    if (Array.isArray(cloudRecords)) {
      // PENTING: Merge data Cloud dan Lokal berdasarkan ID agar record baru tidak hilang
      const recordMap = new Map();
      
      // Masukkan data cloud dulu
      cloudRecords.forEach((r: AttendanceRecord) => recordMap.set(r.id, r));
      
      // Masukkan data lokal (Data lokal yang ID-nya sama dengan cloud akan di-update, 
      // tapi data lokal yang belum ada di cloud akan tetap ada)
      localRecords.forEach((r: AttendanceRecord) => {
        if (!recordMap.has(r.id)) {
          recordMap.set(r.id, r);
        }
      });

      const mergedRecords = Array.from(recordMap.values());
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(mergedRecords));
      return mergedRecords;
    }
    return localRecords;
  } catch (error) {
    return localRecords;
  }
};

export const addAttendanceRecordToSheet = async (
  student: Student, 
  operatorName: string, 
  status: 'PRESENT' | 'HAID' = 'PRESENT'
): Promise<{ success: boolean; message: string }> => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const cachedRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]');
  
  // Cek apakah sudah ada hari ini
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

  // Simpan LOKAL dulu agar instan muncul di UI
  const updatedRecords = [...cachedRecords, newRecord];
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(updatedRecords));

  try {
    // Kirim ke Cloud di background
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addAttendance',
        payload: newRecord
      })
    });

    return { success: true, message: `${student.name} berhasil ABSEN.` };
  } catch (error) {
    return { success: true, message: `${student.name} berhasil (Offline Mode).` };
  }
};
