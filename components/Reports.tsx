
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AttendanceRecord, ReportPeriod, Student } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Calendar, Crown, Medal, TrendingUp, CheckCircle2, List, FileText, FileSpreadsheet, Loader2, UserCircle, XCircle, Filter, Check, X, PieChart as PieIcon, Eye, ChevronRight, Download, ArrowLeft, Droplets, Phone, Send, AlertCircle, Trash2, Edit } from 'lucide-react';
// Fixed: Removed missing/unused members subDays, startOfMonth, parseISO, endOfMonth, isSameDay, isAfter, getDay from date-fns
import { format, eachDayOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { deleteAttendanceRecord, updateAttendanceStatus } from '../services/storageService';

interface ReportsProps {
  records: AttendanceRecord[];
  students: Student[];
  onRecordUpdate: () => void;
  viewOnlyStudent?: Student | null;
}

const Reports: React.FC<ReportsProps> = ({ records, students, onRecordUpdate, viewOnlyStudent }) => {
  const [period, setPeriod] = useState<ReportPeriod>(ReportPeriod.DAILY);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [dailyFilter, setDailyFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'HAID'>('ALL');
  const [dailyClassFilter, setDailyClassFilter] = useState('ALL');
  
  // Fixed: Replaced subDays with native Date calculation to resolve date-fns export error
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [historyMonth, setHistoryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [historyFilterClass, setHistoryFilterClass] = useState('ALL');

  // Modal State untuk Edit/Hapus di History & Leaderboard
  const [showDetailModal, setShowDetailModal] = useState<{ student: Student, records: AttendanceRecord[] } | null>(null);

  // Sync modal records jika ada perubahan data utama
  useEffect(() => {
    if (showDetailModal) {
      const updatedRecords = records.filter(r => r.studentId === showDetailModal.student.id);
      setShowDetailModal({ ...showDetailModal, records: updatedRecords });
    }
  }, [records]);

  // UNIFIED ACTION HANDLERS
  const handleDelete = async (recordId: string) => {
    if (confirm('Hapus record ini selamanya?')) {
      await deleteAttendanceRecord(recordId);
      onRecordUpdate();
    }
  };

  const handleToggleStatus = async (recordId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'PRESENT' ? 'HAID' : 'PRESENT';
    await updateAttendanceStatus(recordId, newStatus);
    onRecordUpdate();
  };

  const openStudentDetails = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    let filteredRecs = records.filter(r => r.studentId === studentId);
    
    // Jika di tab history, filter record hanya untuk bulan tersebut
    if (period === ReportPeriod.MONTHLY) {
      filteredRecs = filteredRecs.filter(r => r.date.startsWith(historyMonth));
    }

    setShowDetailModal({ student, records: filteredRecs });
  };

  const classList = useMemo(() => {
    const classes = new Set(students.map(s => s.className));
    return Array.from(classes).sort();
  }, [students]);

  // LOGIKA TAB DAILY (QUEST)
  const dailyMasterList = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayRecords = records.filter(r => r.date === today);
    const targetStudents = viewOnlyStudent ? [viewOnlyStudent] : students;

    return targetStudents.map(student => {
      const record = todayRecords.find(r => r.studentId === student.id);
      const statusRaw = record?.status || 'ABSENT'; 
      return {
        ...student,
        recordId: record?.id,
        isPresent: !!record,
        statusRaw: statusRaw,
        time: record ? format(record.timestamp, 'HH:mm') : '-',
        statusLabel: record ? (statusRaw === 'HAID' ? 'Haid' : 'Hadir') : 'Alfa'
      };
    }).sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
  }, [records, students, viewOnlyStudent]);

  const filteredDailyList = useMemo(() => {
    let list = dailyMasterList;
    if (dailyClassFilter !== 'ALL' && !viewOnlyStudent) list = list.filter(s => s.className === dailyClassFilter);
    if (dailyFilter === 'ALL') return list;
    if (dailyFilter === 'PRESENT') return list.filter(s => s.statusRaw === 'PRESENT');
    if (dailyFilter === 'HAID') return list.filter(s => s.statusRaw === 'HAID');
    return list.filter(s => s.statusRaw === 'ABSENT');
  }, [dailyMasterList, dailyFilter, dailyClassFilter, viewOnlyStudent]);

  // LOGIKA TAB RANGE (MATRIX) - SINKRON
  const weeklyMatrixData = useMemo(() => {
    // Fixed: Replaced parseISO with native local date parsing to resolve date-fns export error
    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    const start = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);
    const daysInRange = eachDayOfInterval({ start, end });
    let targetStudents = viewOnlyStudent ? [viewOnlyStudent] : students;
    if (!viewOnlyStudent && selectedClass !== 'ALL') targetStudents = targetStudents.filter(s => s.className === selectedClass);

    return {
      daysInRange,
      matrix: targetStudents.map(student => {
        let presentCount = 0;
        let haidCount = 0;
        const attendanceMap = daysInRange.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const record = records.find(r => r.studentId === student.id && r.date === dateStr);
          if (record) {
            if (record.status === 'HAID') haidCount++;
            else presentCount++;
          }
          return { date: dateStr, isPresent: !!record, isHaid: record?.status === 'HAID', recordId: record?.id };
        });
        return { ...student, attendanceMap, presentCount, haidCount };
      }).sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name))
    };
  }, [records, students, startDate, endDate, selectedClass, viewOnlyStudent]);

  // LOGIKA TAB HISTORY (MONTHLY) - DIPERBAIKI SINKRONISASINYA
  const monthlyStats = useMemo(() => {
    let targetStudents = viewOnlyStudent ? [viewOnlyStudent] : students;
    if (!viewOnlyStudent && historyFilterClass !== 'ALL') targetStudents = targetStudents.filter(s => s.className === historyFilterClass);

    return targetStudents.map(student => {
      // Filter record yang hanya terjadi di bulan terpilih
      const monthRecords = records.filter(r => r.studentId === student.id && r.date.startsWith(historyMonth));
      const presentCount = monthRecords.filter(r => r.status === 'PRESENT').length;
      const haidCount = monthRecords.filter(r => r.status === 'HAID').length;
      return { ...student, presentCount, haidCount, total: presentCount + haidCount };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [records, students, historyMonth, historyFilterClass, viewOnlyStudent]);

  // LOGIKA TAB LEADERBOARD (SEMESTER) - DIPERBAIKI SINKRONISASINYA
  const semesterData = useMemo(() => {
    const counts: Record<string, { student: Student, present: number, haid: number, total: number }> = {};
    
    // Gunakan map agar data siswa tetap lengkap
    students.forEach(s => {
      counts[s.id] = { student: s, present: 0, haid: 0, total: 0 };
    });

    records.forEach(r => {
      if (counts[r.studentId]) {
        if (r.status === 'HAID') counts[r.studentId].haid++;
        else counts[r.studentId].present++;
        counts[r.studentId].total = counts[r.studentId].present + counts[r.studentId].haid;
      }
    });

    return Object.values(counts)
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total || a.student.name.localeCompare(b.student.name));
  }, [records, students]);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 500));
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#0f172a' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
      pdf.save(`Laporan_${period}_${format(new Date(), 'ddMMyy')}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* TABS NAVIGATION */}
      <div className="flex bg-slate-900 p-1.5 rounded-xl border border-white/10 w-full mx-auto mb-8 shadow-xl overflow-x-auto no-scrollbar">
        {[
          { id: ReportPeriod.DAILY, label: 'Daily Quest', icon: <List size={16} /> },
          { id: ReportPeriod.WEEKLY, label: 'Range Report', icon: <TrendingUp size={16} /> },
          { id: ReportPeriod.MONTHLY, label: 'History', icon: <Calendar size={16} /> },
          { id: ReportPeriod.SEMESTER, label: 'Leaderboard', icon: <Crown size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPeriod(tab.id)}
            className={`flex-1 min-w-[100px] py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide whitespace-nowrap ${period === tab.id ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-white/5 relative min-h-[400px]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-lg font-bold text-amber-400 font-gaming flex items-center gap-2 uppercase tracking-widest">
                {period === ReportPeriod.DAILY && <><CheckCircle2 className="text-cyan-400" /> MISSION REPORT: TODAY</>}
                {period === ReportPeriod.WEEKLY && <><TrendingUp className="text-amber-500" /> ATTENDANCE MATRIX</>}
                {period === ReportPeriod.MONTHLY && <><Calendar className="text-cyan-400" /> MONTHLY HISTORY LOG</>}
                {period === ReportPeriod.SEMESTER && <><Crown className="text-amber-500" /> MVP LEADERBOARD</>}
            </h3>
            <button onClick={handleDownloadPDF} disabled={isExporting} className="bg-red-900/40 text-red-400 border border-red-500/30 hover:bg-red-900/60 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} DOWNLOAD PDF
            </button>
        </div>
        
        <div ref={reportRef} className="p-2 -m-2 rounded-xl">
            {/* DAILY QUEST VIEW */}
            {period === ReportPeriod.DAILY && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex gap-4 text-xs text-slate-400">
                           <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Hadir: {dailyMasterList.filter(s=>s.statusRaw === 'PRESENT').length}</span>
                           <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-500"></div> Haid: {dailyMasterList.filter(s=>s.statusRaw === 'HAID').length}</span>
                           <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Alfa: {dailyMasterList.filter(s=>s.statusRaw === 'ABSENT').length}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {!viewOnlyStudent && (
                                <select value={dailyClassFilter} onChange={(e) => setDailyClassFilter(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg text-[10px] p-2 uppercase outline-none">
                                    <option value="ALL">SEMUA KELAS</option>
                                    {classList.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                                </select>
                            )}
                            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                                {['ALL', 'PRESENT', 'HAID', 'ABSENT'].map(f => (
                                    <button key={f} onClick={() => setDailyFilter(f as any)} className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${dailyFilter === f ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{f}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-700">
                        <table className="w-full text-left">
                            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold">
                                <tr>
                                    <th className="p-3 text-center">No</th>
                                    <th className="p-3">Kelas</th>
                                    <th className="p-3">Nama Siswa</th>
                                    <th className="p-3 text-center">Waktu</th>
                                    <th className="p-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs font-mono">
                                {filteredDailyList.map((student, idx) => (
                                    <tr key={idx} className={`border-b border-slate-800/50 ${student.statusRaw === 'ABSENT' ? 'bg-red-950/20' : 'hover:bg-slate-800/30'}`}>
                                        <td className="p-3 text-center opacity-60">{idx + 1}</td>
                                        <td className="p-3 font-bold text-cyan-500">{student.className}</td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                {student.statusRaw === 'PRESENT' && <CheckCircle2 size={12} className="text-green-500" />}
                                                {student.statusRaw === 'HAID' && <Droplets size={12} className="text-pink-500" />}
                                                {student.statusRaw === 'ABSENT' && <XCircle size={12} className="text-red-500" />}
                                                {student.name}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center text-slate-400">{student.time}</td>
                                        <td className="p-3">
                                            <div className="flex justify-center gap-2">
                                                {student.isPresent ? (
                                                    <>
                                                        <button onClick={() => handleToggleStatus(student.recordId!, student.statusRaw)} className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded" title="Ubah Hadir/Haid"><Edit size={14} /></button>
                                                        <button onClick={() => handleDelete(student.recordId!)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded" title="Hapus"><Trash2 size={14} /></button>
                                                    </>
                                                ) : <span className="text-[9px] text-slate-600 italic">No Data</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* RANGE REPORT VIEW */}
            {period === ReportPeriod.WEEKLY && (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-4 items-end bg-slate-950/50 p-4 rounded-xl border border-white/5">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold">Dari</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-200 rounded p-1.5 text-xs outline-none" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold">Sampai</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-200 rounded p-1.5 text-xs outline-none" />
                        </div>
                        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-200 rounded p-1.5 text-xs outline-none">
                            <option value="ALL">SEMUA KELAS</option>
                            {classList.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-700">
                        <table className="w-full text-left">
                            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold">
                                <tr>
                                    <th className="p-3 sticky left-0 bg-slate-950 z-10">No</th>
                                    <th className="p-3">Kelas</th>
                                    <th className="p-3 min-w-[150px]">Nama</th>
                                    {weeklyMatrixData.daysInRange.map((d, i) => (
                                        <th key={i} className="p-1 text-center min-w-[30px] border-l border-slate-800">{format(d, 'dd')}</th>
                                    ))}
                                    <th className="p-3 text-center text-green-400 border-l border-slate-800">V</th>
                                    <th className="p-3 text-center text-pink-400">H</th>
                                </tr>
                            </thead>
                            <tbody className="text-[10px] font-mono">
                                {weeklyMatrixData.matrix.map((s, idx) => (
                                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                        <td className="p-3 sticky left-0 bg-slate-900 opacity-60 z-10">{idx + 1}</td>
                                        <td className="p-3 font-bold text-cyan-500">{s.className}</td>
                                        <td className="p-3">{s.name}</td>
                                        {s.attendanceMap.map((d, di) => (
                                            <td key={di} className="p-1 text-center border-l border-slate-800/30">
                                                <div className="flex justify-center group relative">
                                                    {d.isPresent ? (
                                                       <div className="flex flex-col items-center">
                                                            <span className={d.isHaid ? 'text-pink-500' : 'text-green-500'}>{d.isHaid ? 'H' : 'V'}</span>
                                                            <div className="absolute -top-6 opacity-0 group-hover:opacity-100 flex gap-1 z-50 scale-75">
                                                                <button onClick={() => handleDelete(d.recordId!)} className="bg-red-600 p-1 rounded text-white"><Trash2 size={10}/></button>
                                                                <button onClick={() => handleToggleStatus(d.recordId!, d.isHaid ? 'HAID' : 'PRESENT')} className="bg-amber-600 p-1 rounded text-white"><Edit size={10}/></button>
                                                            </div>
                                                       </div>
                                                    ) : '-'}
                                                </div>
                                            </td>
                                        ))}
                                        <td className="p-3 text-center text-green-400 font-bold border-l border-slate-800">{s.presentCount}</td>
                                        <td className="p-3 text-center text-pink-400 font-bold">{s.haidCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* HISTORY MONTHLY VIEW */}
            {period === ReportPeriod.MONTHLY && (
                <div className="space-y-4">
                    <div className="flex gap-4 items-end bg-slate-950/50 p-4 rounded-xl border border-white/5">
                        <input type="month" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-200 rounded p-1.5 text-xs outline-none" />
                        <select value={historyFilterClass} onChange={e => setHistoryFilterClass(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-200 rounded p-1.5 text-xs outline-none">
                            <option value="ALL">SEMUA KELAS</option>
                            {classList.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-700">
                        <table className="w-full text-left">
                            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold">
                                <tr>
                                    <th className="p-3">Rank</th>
                                    <th className="p-3">Nama Siswa</th>
                                    <th className="p-3 text-center text-green-400">Sholat (V)</th>
                                    <th className="p-3 text-center text-pink-400">Haid (H)</th>
                                    <th className="p-3 text-center font-bold text-amber-400">Total</th>
                                    <th className="p-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs font-mono">
                                {monthlyStats.map((s, idx) => (
                                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                        <td className="p-3 opacity-60">#{idx + 1}</td>
                                        <td className="p-3">
                                            <div className="font-bold">{s.name}</div>
                                            <div className="text-[9px] text-slate-500 uppercase">{s.className}</div>
                                        </td>
                                        <td className="p-3 text-center text-green-400">{s.presentCount}</td>
                                        <td className="p-3 text-center text-pink-400">{s.haidCount}</td>
                                        <td className="p-3 text-center font-bold text-amber-400">{s.total}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => openStudentDetails(s.id)} className="flex items-center gap-1 mx-auto bg-slate-800 px-3 py-1 rounded-md text-cyan-400 hover:bg-slate-700 border border-cyan-500/30">
                                                <Eye size={14} /> DETAIL / EDIT
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* LEADERBOARD VIEW */}
            {period === ReportPeriod.SEMESTER && (
                <div className="overflow-hidden border border-slate-800 rounded-lg">
                    <table className="w-full text-left">
                        <thead className="bg-slate-950">
                            <tr>
                                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase text-center">Rank</th>
                                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase">Hero Name</th>
                                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase text-center">S + H</th>
                                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {semesterData.map((item, idx) => (
                                <tr key={idx} className={`hover:bg-slate-800/50 transition-colors ${idx < 3 ? 'bg-amber-500/5' : ''}`}>
                                    <td className="p-4 text-center">
                                        {idx === 0 ? <Medal size={24} className="text-yellow-400 mx-auto drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" /> : 
                                         idx === 1 ? <Medal size={24} className="text-slate-300 mx-auto" /> : 
                                         idx === 2 ? <Medal size={24} className="text-amber-700 mx-auto" /> : 
                                         <span className="text-slate-500 font-bold font-mono">#{idx+1}</span>}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm font-bold text-slate-200">{item.student.name}</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{item.student.className}</div>
                                    </td>
                                    <td className="p-4 text-center font-bold text-cyan-400 font-mono">{item.total}</td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => openStudentDetails(item.student.id)} className="text-slate-500 hover:text-amber-400 p-2"><Eye size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>

      {/* MODAL DETAIL: IZIN EDIT/HAPUS SPESIFIK */}
      {showDetailModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 w-full max-w-2xl max-h-[80vh] rounded-3xl border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                      <div>
                        <h4 className="text-amber-400 font-bold font-gaming text-lg uppercase tracking-widest">{showDetailModal.student.name}</h4>
                        <p className="text-[10px] text-slate-500 uppercase font-mono">{showDetailModal.student.className} • Log Kehadiran</p>
                      </div>
                      <button onClick={() => setShowDetailModal(null)} className="p-2 text-slate-400 hover:text-white"><X size={24}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {showDetailModal.records.length === 0 ? (
                          <div className="py-20 text-center text-slate-600 italic">Belum ada record absensi.</div>
                      ) : (
                          showDetailModal.records.map((r, i) => (
                              <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                  <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${r.status === 'HAID' ? 'bg-pink-900/30 text-pink-400 border border-pink-500/30' : 'bg-green-900/30 text-green-400 border border-green-500/30'}`}>
                                          {r.status === 'HAID' ? 'H' : 'V'}
                                      </div>
                                      <div>
                                          {(() => {
                                            // Fixed: Replaced parseISO with native local date parsing to resolve date-fns export error
                                            const [y, m, d] = r.date.split('-').map(Number);
                                            return <p className="text-xs font-bold text-slate-200">{format(new Date(y, m - 1, d), 'EEEE, dd MMM yyyy', { locale: id })}</p>;
                                          })()}
                                          <p className="text-[10px] text-slate-500 uppercase font-mono">Pukul {format(r.timestamp, 'HH:mm')} • {r.status === 'HAID' ? 'Sedang Berhalangan' : 'Hadir Sholat'}</p>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => handleToggleStatus(r.id, r.status || 'PRESENT')} className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"><Edit size={16}/></button>
                                      <button onClick={() => handleDelete(r.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
                  
                  <div className="p-4 bg-slate-950/50 border-t border-white/5 text-center">
                      <p className="text-[10px] text-slate-500 italic">Setiap perubahan akan otomatis memperbarui Leaderboard & History.</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Reports;
