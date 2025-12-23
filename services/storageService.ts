
import { Student, AttendanceRecord } from '../types';
import { INITIAL_STUDENTS, STORAGE_KEYS, GOOGLE_SCRIPT_URL } from '../constants';

const fetchWithTimeout = async (url: string, options: any = {}, timeout = 8000) => {
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

// Ambil data siswa (Utamakan Lokal, Sinkron Cloud di background)
export const getStudents = async (): Promise<Student[]> => {
  const stored = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  let localData: Student[] = stored ? JSON.parse(stored) : INITIAL_STUDENTS;

  try {
    const response = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=getStudents`);
    const cloudData = await response.json();
    
    if (Array.isArray(cloudData) && cloudData.length > 0) {
      // Merge: Cloud adalah acuan, tapi jangan hapus yang ada di lokal jika belum ada di cloud
      const cloudMap = new Map(cloudData.map(s => [s.id, s]));
      const merged = [...cloudData];
      
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.warn("Gagal ambil data siswa dari cloud, menggunakan lokal.");
  }
  return localData;
};

export const saveStudents = async (students: Student[]): Promise<boolean> => {
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  try {
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveStudents', payload: students })
    });
    return true;
  } catch (error) {
    return false;
  }
};

// Ambil data absensi dengan cerdas
export const getAttendance = async (): Promise<AttendanceRecord[]> => {
  const stored = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
  const localRecords: AttendanceRecord[] = stored ? JSON.parse(stored) : [];

  try {
    const response = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=getAttendance`);
    const cloudRecords = await response.json();
    
    if (Array.isArray(cloudRecords)) {
      // Gabungkan data cloud dengan data lokal yang belum masuk cloud
      const recordMap = new Map();
      
      // 1. Masukkan semua data cloud
      cloudRecords.forEach((r: AttendanceRecord) => recordMap.set(r.id, r));
      
      // 2. Tambahkan data lokal yang belum ada di cloud (berdasarkan ID)
      localRecords.forEach((r: AttendanceRecord) => {
        if (!recordMap.has(r.id)) {
          recordMap.set(r.id, r);
        }
      });

      const mergedRecords = Array.from(recordMap.values());
      // Urutkan berdasarkan timestamp terbaru
      mergedRecords.sort((a, b) => b.timestamp - a.timestamp);
      
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(mergedRecords));
      return mergedRecords;
    }
  } catch (e) {
    console.warn("Gagal sinkron absensi cloud.");
  }
  return localRecords;
};

export const addAttendanceRecordToSheet = async (
  student: Student, 
  operatorName: string, 
  status: 'PRESENT' | 'HAID' = 'PRESENT'
): Promise<{ success: boolean; message: string; record?: AttendanceRecord }> => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const stored = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
  const cachedRecords: AttendanceRecord[] = stored ? JSON.parse(stored) : [];
  
  // Cek duplikasi di lokal
  if (cachedRecords.some((r) => r.studentId === student.id && r.date === today)) {
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

  // 1. SIMPAN LOKAL SEGERA (Optimistic)
  const updatedRecords = [newRecord, ...cachedRecords];
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(updatedRecords));

  // 2. KIRIM CLOUD DI BACKGROUND (Tanpa await response)
  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'addAttendance',
      payload: newRecord
    })
  }).catch(e => console.error("Cloud save failed, will retry later."));

  return { 
    success: true, 
    message: `${student.name} berhasil ABSEN.`,
    record: newRecord 
  };
};
