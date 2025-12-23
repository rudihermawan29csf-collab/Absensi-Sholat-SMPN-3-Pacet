
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Scan, UserCheck, Search, QrCode, X, Sparkles, Zap, Camera, Keyboard, Send, Phone, Filter, CheckSquare, Square, Check, Droplets, Loader2 } from 'lucide-react';
import { QrReader } from 'react-qr-reader';
import { Student, AttendanceRecord } from '../types';
import { addAttendanceRecordToSheet } from '../services/storageService';

interface ScannerTabProps {
  students: Student[];
  records: AttendanceRecord[];
  onRecordUpdate: () => void;
  currentUser: string;
}

const ScannerTab: React.FC<ScannerTabProps> = ({ students, records, onRecordUpdate, currentUser }) => {
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [scanMethod, setScanMethod] = useState<'camera' | 'usb'>('camera');
  const [autoSendWA, setAutoSendWA] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [manualClassFilter, setManualClassFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isHaidMode, setIsHaidMode] = useState(false);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastMessage, setLastMessage] = useState<{ text: string; type: 'success' | 'error'; student?: Student } | null>(null);
  
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedIdRef = useRef<string>('');
  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'scan' && scanMethod === 'usb') {
      scanInputRef.current?.focus();
    }
  }, [mode, scanMethod, lastMessage]);

  const uniqueClasses = useMemo(() => {
    const classes = new Set(students.map(s => s.className));
    return Array.from(classes).sort();
  }, [students]);

  const attendedStudentIds = useMemo(() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      const todayRecords = records.filter(r => r.date === todayStr);
      return new Set(todayRecords.map(r => r.studentId));
  }, [records]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (attendedStudentIds.has(s.id)) return false;
      if (isHaidMode && s.gender !== 'P') return false;
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass = manualClassFilter === 'ALL' || s.className === manualClassFilter;
      return matchesSearch && matchesClass;
    });
  }, [students, searchQuery, manualClassFilter, attendedStudentIds, isHaidMode]);

  const handleAttendance = async (student: Student) => {
    setIsProcessing(true);
    const status = isHaidMode ? 'HAID' : 'PRESENT';
    const result = await addAttendanceRecordToSheet(student, currentUser, status);
    
    setLastMessage({
      text: result.message,
      type: result.success ? 'success' : 'error',
      student: result.success ? student : undefined
    });
    
    setTimeout(() => setLastMessage(null), 4000);
    
    if (result.success) {
      onRecordUpdate();
      if (autoSendWA && student.parentPhone) {
        sendWhatsappMessage(student, status);
      }
    }
    setIsProcessing(false);
  };

  const handleBulkAttendance = async () => {
    if (selectedIds.size === 0 || isProcessing) return;
    setIsProcessing(true);
    
    let successCount = 0;
    const status = isHaidMode ? 'HAID' : 'PRESENT';
    
    const targets = Array.from(selectedIds).map(id => students.find(s => s.id === id)).filter(Boolean) as Student[];

    for (const student of targets) {
      const result = await addAttendanceRecordToSheet(student, currentUser, status);
      if (result.success) successCount++;
    }

    onRecordUpdate();
    setLastMessage({
      text: successCount > 0 ? `Berhasil mencatat ${successCount} siswa!` : 'Gagal mencatat atau sudah absen.',
      type: successCount > 0 ? 'success' : 'error'
    });
    
    setSelectedIds(new Set());
    setTimeout(() => setLastMessage(null), 4000);
    setIsProcessing(false);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const sendWhatsappMessage = (student: Student, status: 'PRESENT' | 'HAID' = 'PRESENT') => {
    if (!student.parentPhone) return;
    let phone = student.parentPhone.replace(/\D/g, '');
    if (phone.startsWith('08')) phone = '62' + phone.substring(1);
    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let text = status === 'HAID' 
      ? `Assalamualaikum. Diberitahukan bahwa ananda *${student.name}* (Kelas ${student.className}) telah melapor *BERHALANGAN (HAID)* pada hari ini ${today}. Terima kasih.` 
      : `Assalamualaikum. Diberitahukan bahwa ananda *${student.name}* (Kelas ${student.className}) telah melaksanakan sholat Dhuhur berjamaah di sekolah pada hari ini ${today}. Petugas: ${currentUser}. Terima kasih.`;
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleCameraScan = (result: any, error: any) => {
    if (error || isProcessing) return;
    if (result) {
      const text = (typeof result.getText === 'function' ? result.getText() : result.text) || '';
      if (!text) return;
      const now = Date.now();
      if (text === lastScannedIdRef.current && now - lastScanTimeRef.current < 4000) return;
      lastScanTimeRef.current = now;
      lastScannedIdRef.current = text;
      processScan(text);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput || isProcessing) return;
    processScan(barcodeInput);
    setBarcodeInput('');
  };

  const processScan = (inputCode: string) => {
    const student = students.find(s => s.id === inputCode || s.name.toLowerCase() === inputCode.toLowerCase());
    if (student) handleAttendance(student);
    else {
      setLastMessage({ text: `Target tidak ditemukan: ${inputCode}`, type: 'error' });
      setTimeout(() => setLastMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex bg-slate-800/50 p-1.5 rounded-full w-full max-w-md mx-auto border border-white/10 relative backdrop-blur-md">
        <button onClick={() => setMode('scan')} className={`relative z-10 flex-1 py-2.5 text-sm font-bold rounded-full transition-all flex items-center justify-center gap-2 ${mode === 'scan' ? 'text-slate-900' : 'text-slate-400'}`}>
          {mode === 'scan' && <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.5)] -z-10"></div>}
          <QrCode size={18} /> SCANNER
        </button>
        <button onClick={() => setMode('manual')} className={`relative z-10 flex-1 py-2.5 text-sm font-bold rounded-full transition-all flex items-center justify-center gap-2 ${mode === 'manual' ? 'text-slate-900' : 'text-slate-400'}`}>
           {mode === 'manual' && <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)] -z-10"></div>}
          <UserCheck size={18} /> MANUAL
        </button>
      </div>

      {lastMessage && (
        <div className={`p-4 mx-auto max-w-lg rounded-xl text-center animate-bounce border relative overflow-hidden z-[100] fixed top-20 left-0 right-0 shadow-2xl ${lastMessage.type === 'success' ? 'bg-emerald-900/95 text-emerald-100 border-emerald-500' : 'bg-red-900/95 text-red-100 border-red-500'}`}>
          <div className="relative flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 uppercase font-gaming">
                {lastMessage.type === 'success' ? <Sparkles className="text-yellow-300" /> : <Zap className="text-red-300" />}
                {lastMessage.text}
            </div>
          </div>
        </div>
      )}

      {mode === 'scan' && (
        <div className="flex flex-col items-center justify-center space-y-6 py-4">
          <div className="flex flex-wrap justify-center gap-3 w-full max-w-lg">
             <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
                <button onClick={() => setScanMethod('camera')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${scanMethod === 'camera' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'text-slate-500'}`}><Camera size={14} /> KAMERA</button>
                <button onClick={() => setScanMethod('usb')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${scanMethod === 'usb' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'text-slate-500'}`}><Keyboard size={14} /> USB</button>
            </div>
            <button onClick={() => setAutoSendWA(!autoSendWA)} className={`px-4 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 transition-all ${autoSendWA ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                <div className={`w-2 h-2 rounded-full ${autoSendWA ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
                AUTO WA {autoSendWA ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="relative group w-full max-w-sm">
            <div className="absolute -inset-10 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition animate-pulse"></div>
            <div className="relative bg-slate-900/90 rounded-2xl p-6 shadow-2xl border border-cyan-500/30 flex flex-col items-center min-h-[400px]">
              <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-blue-400 mb-6 font-gaming tracking-widest uppercase">
                {isProcessing ? 'SINKRONISASI...' : (scanMethod === 'camera' ? 'CAMERA SCAN' : 'USB SCANNER')}
              </h3>

              {scanMethod === 'camera' ? (
                <div className={`w-full aspect-square bg-black rounded-lg overflow-hidden border-2 relative shadow-inner ${isProcessing ? 'opacity-50 grayscale border-slate-700' : 'border-cyan-500/50'}`}>
                  {!isProcessing && <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,1)] z-20 animate-[scan_2s_ease-in-out_infinite]"></div>}
                  {isProcessing && <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/60"><Loader2 className="animate-spin text-cyan-400" size={40} /></div>}
                  <QrReader onResult={handleCameraScan} constraints={{ facingMode: 'environment' }} scanDelay={1000} containerStyle={{ width: '100%', height: '100%' }} videoStyle={{ objectFit: 'cover' }} />
                </div>
              ) : (
                <div className="w-full flex flex-col items-center py-8">
                   <div className="relative mb-6">
                    <div className="bg-slate-950 p-6 rounded-lg border border-cyan-500/50">
                      {isProcessing ? <Loader2 size={80} className="text-cyan-400 animate-spin" /> : <Scan size={80} className="text-cyan-400" />}
                    </div>
                  </div>
                  <form onSubmit={handleBarcodeSubmit} className="w-full relative mt-4">
                    <input ref={scanInputRef} type="text" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} placeholder={isProcessing ? "Mohon Tunggu..." : "Menunggu Input USB..." } disabled={isProcessing} className="w-full px-4 py-4 bg-slate-950 border border-cyan-800 rounded-xl focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all text-center text-lg font-mono text-cyan-300 placeholder-slate-700" autoFocus />
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div className="relative">
            <div className={`bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-xl border overflow-hidden pb-4 transition-colors duration-500 ${isHaidMode ? 'border-pink-500/30' : 'border-white/10'}`}>
            <div className="p-4 border-b border-white/5 bg-slate-950/50 sticky top-0 z-20 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative group flex-grow">
                        <Search className={`absolute left-4 top-3.5 ${isHaidMode ? 'text-pink-400' : 'text-slate-500'}`} size={20} />
                        <input type="text" placeholder={isHaidMode ? "Cari Siswi Putri..." : "Cari Hero (Siswa)..."} className="w-full pl-12 pr-10 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none text-slate-200" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <select value={manualClassFilter} onChange={(e) => setManualClassFilter(e.target.value)} className="pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm appearance-none cursor-pointer">
                        <option value="ALL">Semua Kelas</option>
                        {uniqueClasses.map((cls) => (<option key={cls} value={cls}>{cls}</option>))}
                    </select>
                    <button onClick={() => { setIsHaidMode(!isHaidMode); setSelectedIds(new Set()); }} className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${isHaidMode ? 'bg-pink-900/40 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                      <Droplets size={16} /> {isHaidMode ? 'MODE HAID ON' : 'INPUT HAID'}
                    </button>
                </div>
                {selectedIds.size > 0 && (
                        <button onClick={handleBulkAttendance} disabled={isProcessing} className={`w-full text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-all border ${isHaidMode ? 'bg-pink-600 hover:bg-pink-500' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:opacity-50`}>
                            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CheckSquare size={20} />}
                            {isHaidMode ? `Simpan Status HAID (${selectedIds.size})` : `Simpan Absensi (${selectedIds.size})`}
                        </button>
                )}
            </div>
            <div className="max-h-[500px] overflow-y-auto p-2">
                <ul className="space-y-2">
                    {filteredStudents.map((student) => {
                        const isSelected = selectedIds.has(student.id);
                        return (
                            <li key={student.id} onClick={() => toggleSelection(student.id)} className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${isSelected ? (isHaidMode ? 'bg-pink-900/20 border-pink-500' : 'bg-amber-900/20 border-amber-500') : 'bg-slate-800/50 border-transparent'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-6 h-6 rounded flex items-center justify-center border ${isSelected ? (isHaidMode ? 'bg-pink-500' : 'bg-amber-500') : 'bg-slate-900 border-slate-600'}`}>
                                        {isSelected ? <Check size={16} strokeWidth={4} /> : null}
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${student.gender === 'L' ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-pink-900/30 border-pink-500 text-pink-400'}`}>
                                        {student.gender || '?'}
                                    </div>
                                    <div>
                                        <p className={`font-bold font-gaming tracking-wide ${isSelected ? (isHaidMode ? 'text-pink-400' : 'text-amber-400') : 'text-slate-200'}`}>{student.name}</p>
                                        <div className="flex gap-2 text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter">
                                            ID: {student.id} | {student.className}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
            </div>
        </div>
      )}
      <style>{`
        @keyframes scan { 0% { top: 10%; opacity: 0; } 50% { opacity: 1; } 100% { top: 90%; opacity: 0; } }
      `}</style>
    </div>
  );
};

export default ScannerTab;
