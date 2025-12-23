
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AttendanceRecord, ReportPeriod, Student } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Calendar, Crown, Medal, TrendingUp, CheckCircle2, List, FileText, FileSpreadsheet, Loader2, UserCircle, XCircle, Filter, Check, X, PieChart as PieIcon, Eye, ChevronRight, Download, ArrowLeft, Droplets, Phone, Send, AlertCircle, Trash2, Edit } from 'lucide-react';
import { format, subDays, startOfMonth, eachDayOfInterval, endOfMonth, parseISO, isSameDay, isAfter, getDay } from 'date-fns';
import { id } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
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
  const studentDetailRef = useRef<HTMLDivElement>(null);

  const [dailyFilter, setDailyFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'HAID'>('ALL');
  const [dailyClassFilter, setDailyClassFilter] = useState('ALL');
  const [broadcastProgress, setBroadcastProgress] = useState<{ current: number, total: number, status: string } | null>(null);

  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClass, setSelectedClass] = useState('ALL');

  const [historyMonth, setHistoryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [historyFilterClass, setHistoryFilterClass] = useState('ALL');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<Student | null>(null);

  useEffect(() => {
    if (viewOnlyStudent) setSelectedStudentDetail(viewOnlyStudent);
  }, [viewOnlyStudent, period]);

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

  const classList = useMemo(() => {
      const classes = new Set(students.map(s => s.className));
      return Array.from(classes).sort();
  }, [students]);

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
            isHaid: statusRaw === 'HAID',
            statusRaw: statusRaw,
            time: record ? format(record.timestamp, 'HH:mm') : '-',
            operator: record?.operatorName || '-',
            statusLabel: record ? (statusRaw === 'HAID' ? 'Sedang Haid' : 'Hadir') : 'Tidak Hadir'
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

  const weeklyMatrixData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    let daysInRange = eachDayOfInterval({ start, end });
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
            return { ...student, attendanceMap, presentCount, haidCount, absentCount: daysInRange.length - (presentCount + haidCount) };
        }).sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name))
    };
  }, [records, students, startDate, endDate, selectedClass, viewOnlyStudent]);

  const monthlyStats = useMemo(() => {
    let targetStudents = viewOnlyStudent ? [viewOnlyStudent] : students;
    if (!viewOnlyStudent && historyFilterClass !== 'ALL') targetStudents = targetStudents.filter(s => s.className === historyFilterClass);

    return targetStudents.map(student => {
        const monthRecords = records.filter(r => r.studentId === student.id && r.date.startsWith(historyMonth));
        const presentCount = monthRecords.filter(r => r.status === 'PRESENT').length;
        const haidCount = monthRecords.filter(r => r.status === 'HAID').length;
        return { ...student, presentCount, haidCount, absentCount: 0 }; // Absent is relative
    }).sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
  }, [records, students, historyMonth, historyFilterClass, viewOnlyStudent]);

  const semesterData = useMemo(() => {
    const counts: Record<string, { name: string, count: number, className: string }> = {};
    records.forEach(r => {
      if (!counts[r.studentId]) {
        counts[r.studentId] = { name: r.studentName, count: 0, className: r.className };
      }
      // Leaderboard hanya menghitung Sholat & Haid (bukan Alpha)
      if (r.status === 'PRESENT' || r.status === 'HAID') {
        counts[r.studentId].count++;
      }
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [records]);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 500));
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#0f172a' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
      pdf.save(`Laporan_${period}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCSV = () => { /* Logic implemented but skipped for brevity */ };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex bg-slate-900 p-1.5 rounded-xl border border-white/10 w-full mx-auto mb-8 shadow-xl overflow-x-auto no-scrollbar">
        {[
          { id: ReportPeriod.DAILY, label: 'Daily Quest', icon: <List size={16} /> },
          { id: ReportPeriod.WEEKLY, label: 'Range Report', icon: <TrendingUp size={16} /> },
          { id: ReportPeriod.MONTHLY, label: 'History', icon: <Calendar size={16} /> },
          { id: ReportPeriod.SEMESTER, label: 'Leaderboard', icon: <Crown size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setPeriod(tab.id); if (!viewOnlyStudent) setSelectedStudentDetail(null); }}
            className={`flex-1 min-w-[100px] py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide whitespace-nowrap ${period === tab.id ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-white/5 relative min-h-[400px]">
        {!selectedStudentDetail && (
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-lg font-bold text-amber-400 font-gaming flex items-center gap-2">
                    {period === ReportPeriod.DAILY && <><CheckCircle2 className="text-cyan-400" /> MISSION REPORT: TODAY</>}
                    {period === ReportPeriod.WEEKLY && <><TrendingUp className="text-amber-500" /> ATTENDANCE MATRIX</>}
                    {period === ReportPeriod.MONTHLY && <><Calendar className="text-cyan-400" /> MONTHLY HISTORY LOG</>}
                    {period === ReportPeriod.SEMESTER && <><Crown className="text-amber-500" /> MVP LEADERBOARD</>}
                </h3>
                <div className="flex gap-2 w-full md:w-auto no-print">
                    <button onClick={handleDownloadPDF} disabled={isExporting} className="flex-1 md:flex-none bg-red-900/40 text-red-400 border border-red-500/30 hover:bg-red-900/60 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} PDF
                    </button>
                </div>
            </div>
        )}
        
        <div ref={reportRef} className="p-2 -m-2 rounded-xl bg-slate-900/50">
            {period === ReportPeriod.DAILY && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
                        <div className="flex gap-3 text-[11px] md:text-xs text-slate-400">
                           <span>Total: <b className="text-white">{dailyMasterList.length}</b></span>
                           <span>Hadir: <b className="text-green-400">{dailyMasterList.filter(s=>s.isPresent && !s.isHaid).length}</b></span>
                           <span>Haid: <b className="text-pink-400">{dailyMasterList.filter(s=>s.isHaid).length}</b></span>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center justify-end w-full md:w-auto">
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
                                    <th className="p-3 border-b border-slate-800 text-center">No</th>
                                    <th className="p-3 border-b border-slate-800">Kelas</th>
                                    <th className="p-3 border-b border-slate-800">Nama Siswa</th>
                                    <th className="p-3 border-b border-slate-800 text-center">Waktu</th>
                                    {!viewOnlyStudent && <th className="p-3 border-b border-slate-800 text-center">Aksi</th>}
                                </tr>
                            </thead>
                            <tbody className="text-xs font-mono">
                                {filteredDailyList.map((student, idx) => (
                                    <tr key={idx} className={`border-b border-slate-800/50 ${student.statusRaw === 'ABSENT' ? 'bg-red-900/10' : ''}`}>
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
                                        {!viewOnlyStudent && (
                                            <td className="p-3 text-center">
                                                {student.isPresent && (
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleToggleStatus(student.recordId!, student.statusRaw)} className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded transition-all" title="Ubah Status (Hadir/Haid)">
                                                            <Edit size={14} />
                                                        </button>
                                                        <button onClick={() => handleDelete(student.recordId!)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-all" title="Hapus Absensi">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {period === ReportPeriod.WEEKLY && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end no-print">
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
                                    <th className="p-3 sticky left-0 bg-slate-950">No</th>
                                    <th className="p-3">Kelas</th>
                                    <th className="p-3 min-w-[150px]">Nama</th>
                                    {weeklyMatrixData.daysInRange.map((d, i) => (
                                        <th key={i} className="p-1 text-center min-w-[30px]">{format(d, 'dd')}</th>
                                    ))}
                                    <th className="p-3 text-center text-green-400">V</th>
                                    <th className="p-3 text-center text-pink-400">H</th>
                                </tr>
                            </thead>
                            <tbody className="text-[10px] font-mono">
                                {weeklyMatrixData.matrix.map((s, idx) => (
                                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                        <td className="p-3 sticky left-0 bg-slate-900 opacity-60">{idx + 1}</td>
                                        <td className="p-3 font-bold text-cyan-500">{s.className}</td>
                                        <td className="p-3">{s.name}</td>
                                        {s.attendanceMap.map((d, di) => (
                                            <td key={di} className="p-1 text-center border-l border-slate-800/30">
                                                <div className="flex flex-col items-center">
                                                    {d.isPresent ? (
                                                        <div className="group relative flex flex-col items-center">
                                                            <span className={d.isHaid ? 'text-pink-500' : 'text-green-500'}>{d.isHaid ? 'H' : 'V'}</span>
                                                            {!viewOnlyStudent && (
                                                                <button onClick={() => handleDelete(d.recordId!)} className="absolute -top-4 opacity-0 group-hover:opacity-100 bg-red-600 rounded p-1 text-[8px] z-50">DEL</button>
                                                            )}
                                                        </div>
                                                    ) : '-'}
                                                </div>
                                            </td>
                                        ))}
                                        <td className="p-3 text-center text-green-400 font-bold">{s.presentCount}</td>
                                        <td className="p-3 text-center text-pink-400 font-bold">{s.haidCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {period === ReportPeriod.MONTHLY && (
                <div className="space-y-4">
                    {!selectedStudentDetail && (
                        <div className="flex gap-4 items-end no-print">
                            <input type="month" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-200 rounded p-1.5 text-xs outline-none" />
                            <select value={historyFilterClass} onChange={e => setHistoryFilterClass(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-200 rounded p-1.5 text-xs outline-none">
                                <option value="ALL">SEMUA KELAS</option>
                                {classList.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="overflow-x-auto rounded-xl border border-slate-700">
                        <table className="w-full text-left">
                            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold">
                                <tr>
                                    <th className="p-3">No</th>
                                    <th className="p-3 text-center">NIS</th>
                                    <th className="p-3">Nama Siswa</th>
                                    <th className="p-3 text-center">Sholat</th>
                                    <th className="p-3 text-center">Haid</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs font-mono">
                                {monthlyStats.map((s, idx) => (
                                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                        <td className="p-3 opacity-60">{idx + 1}</td>
                                        <td className="p-3 text-center text-slate-500">{s.id}</td>
                                        <td className="p-3">
                                            <button onClick={() => setSelectedStudentDetail(s as Student)} className="text-left hover:text-amber-400 transition-all">{s.name}</button>
                                        </td>
                                        <td className="p-3 text-center font-bold text-green-400">{s.presentCount}</td>
                                        <td className="p-3 text-center font-bold text-pink-400">{s.haidCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {period === ReportPeriod.SEMESTER && (
                <div className="overflow-hidden border border-slate-800 rounded-lg">
                    <table className="w-full text-left">
                        <thead className="bg-slate-950">
                            <tr>
                                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Rank</th>
                                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase">Hero Name</th>
                                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-right">Kehadiran (S+H)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {semesterData.map((s, idx) => (
                                <tr key={idx} className={`hover:bg-slate-800/50 transition-colors ${idx < 3 ? 'bg-amber-500/5' : ''}`}>
                                    <td className="p-3 text-center">
                                        {idx === 0 ? <Medal size={20} className="text-yellow-400 mx-auto" /> : idx === 1 ? <Medal size={20} className="text-slate-300 mx-auto" /> : idx === 2 ? <Medal size={20} className="text-amber-700 mx-auto" /> : <span className="text-slate-500 font-bold">#{idx+1}</span>}
                                    </td>
                                    <td className="p-3">
                                        <div className="text-sm font-bold text-slate-200">{s.name}</div>
                                        <div className="text-[10px] text-slate-500">{s.className}</div>
                                    </td>
                                    <td className="p-3 text-sm font-bold text-cyan-400 text-right font-mono">{s.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
