import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AttendanceRecord, ReportPeriod, Student } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Calendar, Crown, Medal, TrendingUp, CheckCircle2, List, FileText, FileSpreadsheet, Loader2, UserCircle, XCircle, Filter, Check, X, PieChart as PieIcon, Eye, ChevronRight, Download, ArrowLeft, Droplets, Phone, Send, AlertCircle } from 'lucide-react';
import { format, subDays, startOfMonth, eachDayOfInterval, endOfMonth, parseISO, isSameDay, isAfter, getDay } from 'date-fns';
import { id } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface ReportsProps {
  records: AttendanceRecord[];
  students: Student[];
  viewOnlyStudent?: Student | null; // Optional: If present, restrict view to this student
}

const Reports: React.FC<ReportsProps> = ({ records, students, viewOnlyStudent }) => {
  const [period, setPeriod] = useState<ReportPeriod>(ReportPeriod.DAILY);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const studentDetailRef = useRef<HTMLDivElement>(null);

  // --- Filter States for Daily Report ---
  const [dailyFilter, setDailyFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'HAID'>('ALL');
  const [dailyClassFilter, setDailyClassFilter] = useState('ALL'); // Added Class Filter State
  const [broadcastProgress, setBroadcastProgress] = useState<{ current: number, total: number, status: string } | null>(null);

  // --- Filter States for Weekly/Range Report ---
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClass, setSelectedClass] = useState('ALL');

  // --- Filter States for Monthly History ---
  const [historyMonth, setHistoryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [historyFilterClass, setHistoryFilterClass] = useState('ALL');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<Student | null>(null);

  // Effect: If viewOnlyStudent is provided (Parent Login), force specific states
  useEffect(() => {
    if (viewOnlyStudent) {
        setSelectedStudentDetail(viewOnlyStudent);
        // For daily/weekly views, the filtering logic uses viewOnlyStudent prop implicitly below
    } else {
        // Reset if admin logs in after parent (unlikely in same session but good practice)
        if (!selectedStudentDetail) setSelectedStudentDetail(null);
    }
  }, [viewOnlyStudent, period]);

  // --- Calculations ---

  // Get Unique Classes for Filter (Moved up to be accessible for daily)
  const classList = useMemo(() => {
      const classes = new Set(students.map(s => s.className));
      return Array.from(classes).sort();
  }, [students]);

  // 1. DAILY REPORT DATA
  const dailyMasterList = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayRecords = records.filter(r => r.date === today);

    // If viewOnlyStudent, restrict students list
    const targetStudents = viewOnlyStudent ? [viewOnlyStudent] : students;

    const list = targetStudents.map(student => {
        const record = todayRecords.find(r => r.studentId === student.id);
        const statusRaw = record?.status || 'PRESENT'; 
        
        return {
            ...student,
            isPresent: !!record,
            isHaid: !!record && statusRaw === 'HAID',
            statusRaw: record ? statusRaw : 'ABSENT',
            time: record ? format(record.timestamp, 'HH:mm') : '-',
            operator: record?.operatorName || '-',
            statusLabel: record ? (statusRaw === 'HAID' ? 'Sedang Haid' : 'Hadir') : 'Tidak Hadir'
        };
    });

    return list.sort((a, b) => {
        if (a.className === b.className) {
            return a.name.localeCompare(b.name);
        }
        return a.className.localeCompare(b.className);
    });
  }, [records, students, viewOnlyStudent]);

  // Updated Filter Logic: Class -> Status
  const filteredDailyList = useMemo(() => {
    // 1. Filter by Class first
    let list = dailyMasterList;
    if (dailyClassFilter !== 'ALL' && !viewOnlyStudent) {
        list = list.filter(s => s.className === dailyClassFilter);
    }

    // 2. Filter by Status
    if (dailyFilter === 'ALL') return list;
    if (dailyFilter === 'PRESENT') return list.filter(s => s.isPresent && !s.isHaid);
    if (dailyFilter === 'HAID') return list.filter(s => s.isHaid);
    return list.filter(s => !s.isPresent);
  }, [dailyMasterList, dailyFilter, dailyClassFilter, viewOnlyStudent]);

  // Updated Daily Stats: Calculate based on Class Selection
  const dailyStats = useMemo(() => {
     // Determine base list based on class filter
     const targetList = (dailyClassFilter === 'ALL' || viewOnlyStudent) 
        ? dailyMasterList 
        : dailyMasterList.filter(s => s.className === dailyClassFilter);

     const total = targetList.length;
     const present = targetList.filter(s => s.isPresent && !s.isHaid).length;
     const haid = targetList.filter(s => s.isHaid).length;
     
     // Percentage of total attended (Present + Haid) vs Total Student
     const totalAttended = present + haid;
     const percentage = total > 0 ? Math.round((totalAttended / total) * 100) : 0;
     
     return { total, present, haid, percentage };
  }, [dailyMasterList, dailyClassFilter, viewOnlyStudent]);


  // 2. WEEKLY / RANGE MATRIX DATA
  const weeklyMatrixData = useMemo(() => {
    // Generate dates in range
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    let daysInRange: Date[] = [];
    try {
        daysInRange = eachDayOfInterval({ start, end });
    } catch (e) {
        daysInRange = [new Date()]; // Fallback
    }

    // Filter Students
    let filteredStudents = viewOnlyStudent ? [viewOnlyStudent] : students;
    
    if (!viewOnlyStudent && selectedClass !== 'ALL') {
        filteredStudents = filteredStudents.filter(s => s.className === selectedClass);
    }

    // Map Data
    const matrix = filteredStudents.map(student => {
        let presentCount = 0;
        let haidCount = 0;
        
        // Check attendance for each day
        const attendanceMap = daysInRange.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const record = records.find(r => r.studentId === student.id && r.date === dateStr);
            
            const isPresent = !!record;
            const isHaid = record?.status === 'HAID';
            
            if (isPresent) {
                if (isHaid) haidCount++;
                else presentCount++;
            }
            
            return { date: dateStr, isPresent, isHaid };
        });

        const absentCount = daysInRange.length - (presentCount + haidCount);

        return {
            ...student,
            attendanceMap,
            presentCount,
            haidCount,
            absentCount
        };
    });

    // Sort: Class -> Name
    matrix.sort((a, b) => {
        if (a.className === b.className) {
            return a.name.localeCompare(b.name);
        }
        return a.className.localeCompare(b.className);
    });

    return { daysInRange, matrix };
  }, [records, students, startDate, endDate, selectedClass, viewOnlyStudent]);

  // 3. MONTHLY DATA (History Table)
  const monthlyStats = useMemo(() => {
    // Determine effective days in month (excluding Sundays and Future dates)
    const start = startOfMonth(parseISO(historyMonth + '-01'));
    const end = endOfMonth(start);
    const today = new Date();
    
    // If current month, cap at today. If past month, use end of month.
    const effectiveEnd = isAfter(end, today) ? today : end;
    
    const allDays = eachDayOfInterval({ start, end: effectiveEnd });
    // Exclude Sundays (0)
    const activeDays = allDays.filter(day => getDay(day) !== 0).length;

    // Filter Students
    let filteredStudents = viewOnlyStudent ? [viewOnlyStudent] : students;
    
    if (!viewOnlyStudent && historyFilterClass !== 'ALL') {
        filteredStudents = filteredStudents.filter(s => s.className === historyFilterClass);
    }

    const stats = filteredStudents.map(student => {
        // Count Present: Filter records for this student in this month
        const monthRecords = records.filter(r => 
            r.studentId === student.id && 
            r.date.startsWith(historyMonth)
        );

        const presentCount = monthRecords.filter(r => r.status !== 'HAID').length;
        const haidCount = monthRecords.filter(r => r.status === 'HAID').length;

        // Count Absent: Active Days - (Present + Haid)
        const absentCount = Math.max(0, activeDays - (presentCount + haidCount));

        return {
            ...student,
            presentCount,
            haidCount,
            absentCount
        };
    });
    
    // Sort
    stats.sort((a, b) => {
        if (a.className === b.className) {
            return a.name.localeCompare(b.name);
        }
        return a.className.localeCompare(b.className);
    });

    return stats;
  }, [records, students, historyMonth, historyFilterClass, viewOnlyStudent]);

  // Helper for Student Detail Modal
  const getStudentHistoryDetails = (student: Student) => {
    const start = startOfMonth(parseISO(historyMonth + '-01'));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const record = records.find(r => r.studentId === student.id && r.date === dateStr);
        const isSunday = getDay(day) === 0;
        const isFuture = isAfter(day, new Date());

        let status = 'Tidak Hadir';
        if (record) {
             status = record.status === 'HAID' ? 'Haid' : 'Hadir';
        }
        else if (isSunday) status = 'Libur (Ahad)';
        else if (isFuture) status = '-';

        return {
            date: dateStr,
            displayDate: format(day, 'eeee, dd MMMM', { locale: id }),
            status,
            statusRaw: record?.status,
            time: record ? format(record.timestamp, 'HH:mm') : '-',
            operator: record?.operatorName || '-',
            isSunday
        };
    });
  };

  const semesterData = useMemo(() => {
    const counts: Record<string, { name: string, count: number, className: string }> = {};
    
    records.forEach(r => {
      if (!counts[r.studentId]) {
        counts[r.studentId] = { name: r.studentName, count: 0, className: r.className };
      }
      counts[r.studentId].count++;
    });

    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [records]);

  // --- WA Broadcast Logic ---
  const handleClassBroadcast = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent accidental form submissions or bubbling
    console.log("Broadcast button clicked. Selected Class:", dailyClassFilter);

    // 1. Validate Selection
    if (dailyClassFilter === 'ALL') {
        alert("Peringatan: Anda belum memilih kelas. Silakan pilih kelas spesifik di dropdown filter untuk memulai broadcast.");
        return;
    }
    
    // 2. Calculate Targets Directly (Avoids staleness)
    // Filter conditions: In selected class AND has phone number AND phone number is valid length
    const targets = dailyMasterList.filter(s => 
        s.className === dailyClassFilter && 
        s.parentPhone && 
        s.parentPhone.replace(/\D/g, '').length > 5
    );

    console.log("Found targets:", targets.length);

    if (targets.length === 0) {
        alert(`Gagal: Tidak ada siswa di kelas ${dailyClassFilter} yang memiliki nomor WA Orang Tua yang valid.\n\nSilakan lengkapi data nomor HP di menu 'Heroes'.`);
        return;
    }

    if (!confirm(`Konfirmasi Broadcast:\n\nTarget: Kelas ${dailyClassFilter}\nPenerima: ${targets.length} Orang Tua\n\nSistem akan membuka tab baru WhatsApp satu per satu. Lanjutkan?`)) {
        return;
    }

    setBroadcastProgress({ current: 0, total: targets.length, status: 'Memulai...' });

    // 3. Loop with delay
    for (let i = 0; i < targets.length; i++) {
        const student = targets[i];
        
        setBroadcastProgress({ 
            current: i + 1, 
            total: targets.length, 
            status: `Mengirim ke: ${student.name}` 
        });

        // Generate Message
        sendWhatsappMessage(student);

        // Wait 4 seconds before next (except last one)
        // Increased delay slightly to let browser handle the new tab
        if (i < targets.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 4000));
        }
    }

    setBroadcastProgress(null);
    alert("Proses Broadcast Selesai.");
  };

  const sendWhatsappMessage = (student: any) => {
    if (!student.parentPhone) return;

    // Clean phone number
    let phone = student.parentPhone.replace(/\D/g, '');
    if (phone.startsWith('08')) {
        phone = '62' + phone.substring(1);
    }

    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let text = "";

    if (student.isPresent && student.isHaid) {
         text = `Assalamualaikum. Laporan harian: ananda *${student.name}* (Kelas ${student.className}) telah melapor *BERHALANGAN (HAID)* pada hari ini ${today}. Terima kasih. %0A%0A- *Sistem Absensi SMPN 3 Pacet*`;
    } else if (student.isPresent) {
         text = `Assalamualaikum. Laporan harian: ananda *${student.name}* (Kelas ${student.className}) telah melaksanakan sholat Dhuhur berjamaah di sekolah pada hari ini ${today}. Pukul: ${student.time}. Terima kasih. %0A%0A- *Sistem Absensi SMPN 3 Pacet*`;
    } else {
         text = `Assalamualaikum. Laporan harian: ananda *${student.name}* (Kelas ${student.className}) *BELUM/TIDAK* terekam melakukan absensi sholat Dhuhur di sekolah pada hari ini ${today}. Mohon konfirmasinya. Terima kasih. %0A%0A- *Sistem Absensi SMPN 3 Pacet*`;
    }
    
    // Open in new tab
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  // --- Export Logic ---

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#0f172a',
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4'); 
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Laporan_${period}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error("PDF Export failed", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const filename = `Laporan_${period}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    if (period === ReportPeriod.DAILY) {
       csvContent += "No,Kelas,NIS,Nama Siswa,Status,Jam Scan,Petugas Scan\n";
       filteredDailyList.forEach((student, index) => {
           csvContent += `${index + 1},${student.className},${student.id},"${student.name}",${student.statusLabel},${student.time},"${student.operator}"\n`;
       });

    } else if (period === ReportPeriod.WEEKLY) {
        let header = "No,Kelas,NIS,Nama Siswa";
        weeklyMatrixData.daysInRange.forEach(day => {
            header += `,${format(day, 'dd/MM')}`;
        });
        header += ",Total Sholat,Total Haid,Total Tidak Sholat\n";
        csvContent += header;

        weeklyMatrixData.matrix.forEach((student, index) => {
            let row = `${index + 1},${student.className},${student.id},"${student.name}"`;
            
            student.attendanceMap.forEach(d => {
                const mark = d.isPresent ? (d.isHaid ? 'H' : 'V') : 'X';
                row += `,${mark}`;
            });

            row += `,${student.presentCount},${student.haidCount},${student.absentCount}\n`;
            csvContent += row;
        });

    } else if (period === ReportPeriod.MONTHLY) {
        csvContent += "No,Kelas,NIS,Nama Siswa,Bulan,Jumlah Sholat,Jumlah Haid,Jumlah Tidak Sholat\n";
        monthlyStats.forEach((student, index) => {
             csvContent += `${index+1},${student.className},${student.id},"${student.name}",${historyMonth},${student.presentCount},${student.haidCount},${student.absentCount}\n`;
        });

    } else if (period === ReportPeriod.SEMESTER) {
        csvContent += "Peringkat,Nama Siswa,Kelas,Total Kehadiran\n";
        semesterData.forEach((student, index) => {
            csvContent += `${index + 1},"${student.name}",${student.className},${student.count}\n`;
        });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Student Detail Exports ---
  const handleDownloadStudentDetailExcel = () => {
    if (!selectedStudentDetail) return;

    // 1. Prepare Header Info (Metadata)
    const headerRows = [
        ["LAPORAN ABSENSI SISWA"],
        ["Periode", historyMonth],
        ["Nama Siswa", selectedStudentDetail.name],
        ["Nomor Induk (NIS)", selectedStudentDetail.id],
        ["Kelas", selectedStudentDetail.className],
        [""] // Blank row spacer
    ];

    // 2. Prepare Table Data
    const tableData = getStudentHistoryDetails(selectedStudentDetail).map(item => ({
        'Tanggal': item.displayDate,
        'Status': item.status,
        'Waktu Scan': item.time,
        'Petugas': item.operator
    }));

    // 3. Create Sheet with Data starting at row 7 (after headers)
    const ws = XLSX.utils.json_to_sheet(tableData, { origin: 'A7' });
    
    // 4. Add Header Rows at the top
    XLSX.utils.sheet_add_aoa(ws, headerRows, { origin: 'A1' });

    // 5. Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "History Siswa");
    
    // Auto fit column width logic
    ws['!cols'] = [{wch: 25}, {wch: 15}, {wch: 15}, {wch: 25}];

    XLSX.writeFile(wb, `History_${selectedStudentDetail.name}_${historyMonth}.xlsx`);
  };

  const handleDownloadStudentDetailPDF = async () => {
    if (!selectedStudentDetail || !studentDetailRef.current) return;
    
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // Allow UI to settle

    try {
        const canvas = await html2canvas(studentDetailRef.current, {
            scale: 2,
            backgroundColor: '#0f172a', // Capture dark mode correctly
            useCORS: true,
            logging: false,
            windowWidth: studentDetailRef.current.scrollWidth,
            windowHeight: studentDetailRef.current.scrollHeight
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgWidth = pdfWidth - 20; // 10mm margin
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 10; // Top margin

        // Add background color for the PDF page
        pdf.setFillColor(15, 23, 42); // Slate 900 background
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        
        // Add Image
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        
        // Handle multi-page if content is too long
        heightLeft -= (pdfHeight - 20);
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight; 
            pdf.addPage();
            pdf.setFillColor(15, 23, 42);
            pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
            pdf.addImage(imgData, 'PNG', 10, - (pdfHeight - 20) + 10, imgWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save(`History_${selectedStudentDetail.name}_${historyMonth}.pdf`);
    } catch (e) {
        console.error("PDF Fail", e);
        alert("Gagal download PDF");
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Report Type Selector */}
      <div className="flex bg-slate-900 p-1.5 rounded-xl border border-white/10 w-full mx-auto mb-8 shadow-xl overflow-x-auto no-scrollbar">
        {[
          { id: ReportPeriod.DAILY, label: 'Daily Quest', icon: <List size={16} /> },
          { id: ReportPeriod.WEEKLY, label: 'Range Report', icon: <TrendingUp size={16} /> },
          { id: ReportPeriod.MONTHLY, label: 'History', icon: <Calendar size={16} /> },
          { id: ReportPeriod.SEMESTER, label: 'Leaderboard', icon: <Crown size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
                setPeriod(tab.id);
                // If not restricted by viewOnlyStudent, allow resetting detail view
                if (!viewOnlyStudent) setSelectedStudentDetail(null);
            }}
            className={`flex-1 min-w-[100px] py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide whitespace-nowrap ${
              period === tab.id ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            <span className="">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content based on selection */}
      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-white/5 relative min-h-[400px]">
        {/* Header with Download Buttons */}
        {!selectedStudentDetail && (
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-amber-400 font-gaming flex items-center gap-2">
                        {period === ReportPeriod.DAILY && <><CheckCircle2 className="text-cyan-400" /> MISSION REPORT: TODAY</>}
                        {period === ReportPeriod.WEEKLY && <><TrendingUp className="text-amber-500" /> ATTENDANCE MATRIX</>}
                        {period === ReportPeriod.MONTHLY && <><Calendar className="text-cyan-400" /> MONTHLY HISTORY LOG</>}
                        {period === ReportPeriod.SEMESTER && <><Crown className="text-amber-500" /> MVP LEADERBOARD</>}
                    </h3>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={handleDownloadCSV}
                        className="flex-1 md:flex-none bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                        <FileSpreadsheet size={16} /> EXCEL
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isExporting}
                        className="flex-1 md:flex-none bg-red-900/40 text-red-400 border border-red-500/30 hover:bg-red-900/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        PDF
                    </button>
                </div>
            </div>
        )}
        
        {/* Printable/Capture Area */}
        <div ref={reportRef} className="p-2 -m-2 rounded-xl bg-slate-900/50">
            
            {/* DAILY VIEW */}
            {period === ReportPeriod.DAILY && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-4 px-2">
                        {/* Summary */}
                        <div className="text-xs text-slate-400 flex flex-col gap-1 w-full md:w-auto">
                             <div className="font-mono mb-1">Date: {format(new Date(), 'dd MMMM yyyy', { locale: id })}</div>
                             <div className="flex gap-3 text-[11px] md:text-xs">
                                <span>Total: <b className="text-white">{dailyStats.total}</b></span>
                                <span>Hadir: <b className="text-green-400">{dailyStats.present}</b></span>
                                <span>Haid: <b className="text-pink-400">{dailyStats.haid}</b></span>
                                <span>Alpha: <b className="text-red-400">{dailyStats.total - (dailyStats.present + dailyStats.haid)}</b></span>
                            </div>
                        </div>

                        {/* DAILY FILTER CONTROLS */}
                        <div className="flex flex-wrap gap-2 items-center justify-end w-full md:w-auto">
                            
                            {/* Broadcast Button (Visible to ADMIN/TEACHER only) */}
                            {!viewOnlyStudent && (
                                <button
                                    onClick={handleClassBroadcast}
                                    disabled={!!broadcastProgress}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 border shadow-lg ${
                                        broadcastProgress 
                                        ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-wait' 
                                        : 'bg-green-600 hover:bg-green-500 text-white border-green-400/50'
                                    }`}
                                >
                                    {broadcastProgress ? (
                                        <><Loader2 size={12} className="animate-spin" /> Sending ({broadcastProgress.current}/{broadcastProgress.total})</>
                                    ) : (
                                        <>
                                            <Send size={12} /> 
                                            Broadcast WA 
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Class Filter Dropdown */}
                            {!viewOnlyStudent && (
                                <div className="relative min-w-[130px] flex-1 md:flex-none">
                                    <div className="absolute left-3 top-2.5 text-slate-500 pointer-events-none">
                                        <Filter size={12} />
                                    </div>
                                    <select
                                        value={dailyClassFilter}
                                        onChange={(e) => setDailyClassFilter(e.target.value)}
                                        className="w-full pl-8 pr-4 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg text-[10px] font-bold focus:border-amber-500 outline-none appearance-none cursor-pointer uppercase shadow-sm"
                                    >
                                        <option value="ALL">PILIH KELAS...</option>
                                        {classList.map((cls) => (
                                            <option key={cls} value={cls}>{cls}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Status Filter Buttons */}
                            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                                <button
                                    onClick={() => setDailyFilter('ALL')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${dailyFilter === 'ALL' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Semua
                                </button>
                                <button
                                    onClick={() => setDailyFilter('PRESENT')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${dailyFilter === 'PRESENT' ? 'bg-green-900/50 text-green-400 shadow' : 'text-slate-500 hover:text-green-400'}`}
                                >
                                    Sholat
                                </button>
                                <button
                                    onClick={() => setDailyFilter('HAID')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${dailyFilter === 'HAID' ? 'bg-pink-900/50 text-pink-400 shadow' : 'text-slate-500 hover:text-pink-400'}`}
                                >
                                    Haid
                                </button>
                                <button
                                    onClick={() => setDailyFilter('ABSENT')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${dailyFilter === 'ABSENT' ? 'bg-red-900/50 text-red-400 shadow' : 'text-slate-500 hover:text-red-400'}`}
                                >
                                    Absen
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-700">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="p-3 border-b border-slate-800 text-center w-12">No</th>
                                    <th className="p-3 border-b border-slate-800 w-24">Kelas</th>
                                    <th className="p-3 border-b border-slate-800 w-32">NIS</th>
                                    <th className="p-3 border-b border-slate-800">Nama Siswa</th>
                                    <th className="p-3 border-b border-slate-800 text-center w-24">Time</th>
                                    <th className="p-3 border-b border-slate-800 w-48">Info</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-mono divide-y divide-slate-800/50">
                                {filteredDailyList.map((student, idx) => (
                                    <tr 
                                        key={idx} 
                                        className={`transition-colors ${
                                            student.isHaid 
                                                ? 'bg-pink-900/30 hover:bg-pink-900/50 text-pink-100'
                                                : student.isPresent 
                                                    ? 'bg-slate-900/50 hover:bg-slate-800/80 text-slate-200' 
                                                    : 'bg-red-900/40 hover:bg-red-900/60 text-red-200'
                                        }`}
                                    >
                                        <td className="p-3 text-center opacity-60">{idx + 1}</td>
                                        <td className="p-3 font-bold text-cyan-500/80">{student.className}</td>
                                        <td className="p-3 opacity-70">{student.id}</td>
                                        <td className="p-3 font-medium">
                                            <div className="flex items-center gap-2">
                                                {!student.isPresent && <XCircle size={14} className="text-red-400 inline" />}
                                                {student.isPresent && !student.isHaid && <CheckCircle2 size={14} className="text-green-400 inline" />}
                                                {student.isHaid && <Droplets size={14} className="text-pink-400 inline" />}
                                                {student.name}
                                                {student.parentPhone && <Phone size={10} className="text-green-500 ml-1" />}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            {student.isPresent ? (
                                                <span className={`px-2 py-1 rounded border text-xs ${student.isHaid ? 'bg-pink-950 text-pink-400 border-pink-500/30' : 'bg-slate-800 text-amber-400 border-amber-500/20'}`}>
                                                    {student.isHaid ? 'HAID' : student.time}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-3 text-xs">
                                            <div className="flex items-center gap-1.5 opacity-80">
                                                {student.isPresent ? <UserCircle size={12} /> : null}
                                                {student.operator}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredDailyList.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-500 italic">Data tidak ditemukan untuk filter ini.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* WEEKLY / RANGE VIEW (MATRIX + CHART) */}
            {period === ReportPeriod.WEEKLY && (
            <div className="space-y-6">
                {/* FILTER CONTROLS */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row gap-4 items-end md:items-center no-print">
                    <div className="w-full md:w-auto space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Start Date</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none"
                        />
                    </div>
                    <div className="w-full md:w-auto space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">End Date</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none"
                        />
                    </div>
                    {!viewOnlyStudent && (
                        <div className="w-full md:w-auto space-y-1">
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                                <Filter size={10} /> Filter Class
                            </label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none"
                            >
                                <option value="ALL">SEMUA KELAS</option>
                                {classList.map(cls => (
                                    <option key={cls} value={cls}>{cls}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* 1. TABLE CONTAINER (Moved to Top) */}
                <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/30">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="p-3 border-b border-slate-800 text-center w-10 sticky left-0 bg-slate-950 z-10">No</th>
                                <th className="p-3 border-b border-slate-800 w-20 sticky left-10 bg-slate-950 z-10">Kelas</th>
                                <th className="p-3 border-b border-slate-800 w-24">NIS</th>
                                <th className="p-3 border-b border-slate-800 min-w-[200px]">Nama Siswa</th>
                                {/* Dynamic Date Columns */}
                                {weeklyMatrixData.daysInRange.map((day, i) => (
                                    <th key={i} className="p-2 border-b border-slate-800 text-center min-w-[50px] bg-slate-950/50">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] opacity-70">{format(day, 'MMM')}</span>
                                            <span className="text-sm text-cyan-400">{format(day, 'dd')}</span>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-3 border-b border-slate-800 text-center w-20 bg-green-900/20 border-l border-slate-800 text-green-400">Sholat</th>
                                <th className="p-3 border-b border-slate-800 text-center w-20 bg-pink-900/20 text-pink-400">Haid</th>
                                <th className="p-3 border-b border-slate-800 text-center w-20 bg-red-900/20 text-red-400">Absen</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-mono divide-y divide-slate-800/50">
                            {weeklyMatrixData.matrix.map((student, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-3 text-center opacity-60 sticky left-0 bg-slate-900 z-10">{idx + 1}</td>
                                    <td className="p-3 font-bold text-cyan-500/80 sticky left-10 bg-slate-900 z-10">{student.className}</td>
                                    <td className="p-3 opacity-70">{student.id}</td>
                                    <td className="p-3 font-medium text-slate-300 truncate max-w-[200px]" title={student.name}>{student.name}</td>
                                    
                                    {/* Attendance Checks */}
                                    {student.attendanceMap.map((day, dIdx) => (
                                        <td key={dIdx} className="p-2 text-center border-l border-slate-800/30">
                                            {day.isPresent ? (
                                                day.isHaid ? (
                                                     <div className="flex justify-center text-pink-500 font-bold" title="Haid">H</div>
                                                ) : (
                                                    <div className="flex justify-center">
                                                        <Check size={16} className="text-green-500" strokeWidth={3} />
                                                    </div>
                                                )
                                            ) : (
                                                <div className="flex justify-center">
                                                    <X size={16} className="text-red-500/50" />
                                                </div>
                                            )}
                                        </td>
                                    ))}

                                    {/* Summary Stats */}
                                    <td className="p-3 text-center font-bold text-green-400 bg-green-900/10 border-l border-slate-800">
                                        {student.presentCount}
                                    </td>
                                    <td className="p-3 text-center font-bold text-pink-400 bg-pink-900/10">
                                        {student.haidCount}
                                    </td>
                                    <td className="p-3 text-center font-bold text-red-400 bg-red-900/10">
                                        {student.absentCount}
                                    </td>
                                </tr>
                            ))}
                            {weeklyMatrixData.matrix.length === 0 && (
                                <tr>
                                    <td colSpan={6 + weeklyMatrixData.daysInRange.length} className="p-8 text-center text-slate-500">
                                        Tidak ada data siswa untuk filter ini.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* MONTHLY VIEW (UPDATED HISTORY) */}
            {period === ReportPeriod.MONTHLY && (
            <div className="space-y-6">
                
                {selectedStudentDetail ? (
                    // FULL PAGE STUDENT DETAIL VIEW
                     <div className="animate-fade-in space-y-4">
                        {/* Header Detail */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-950 p-4 rounded-xl border border-cyan-500/30 shadow-lg">
                             <div className="flex items-center gap-4 w-full">
                                {/* Hide Back button if view restricted */}
                                {!viewOnlyStudent && (
                                    <button 
                                        onClick={() => setSelectedStudentDetail(null)}
                                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-cyan-400 font-gaming uppercase tracking-wider">{selectedStudentDetail.name}</h3>
                                    <p className="text-xs text-slate-400 font-mono">
                                        KELAS: {selectedStudentDetail.className} | NIS: {selectedStudentDetail.id}
                                    </p>
                                </div>
                             </div>

                             {/* Month Selector for Detail View */}
                             <div className="flex flex-col md:flex-row items-center gap-2">
                                 <label className="text-[10px] text-slate-500 uppercase font-bold">Pilih Bulan</label>
                                 <input 
                                    type="month" 
                                    value={historyMonth} 
                                    onChange={(e) => setHistoryMonth(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-amber-500 outline-none"
                                />
                             </div>

                             <div className="flex gap-2 w-full md:w-auto">
                                <button
                                    onClick={handleDownloadStudentDetailExcel}
                                    className="flex-1 md:flex-none bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/60 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <FileSpreadsheet size={16} /> Excel
                                </button>
                                <button
                                    onClick={handleDownloadStudentDetailPDF}
                                    disabled={isExporting}
                                    className="flex-1 md:flex-none bg-red-900/40 text-red-400 border border-red-500/30 hover:bg-red-900/60 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                    PDF
                                </button>
                             </div>
                        </div>

                        {/* Detail Table Container (For Ref and View) */}
                        <div ref={studentDetailRef} className="bg-slate-900/50 p-8 rounded-xl border border-slate-800 relative overflow-hidden">
                             {/* Watermark/Background for flair */}
                             <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <img src="https://iili.io/fEhQpTX.png" className="w-32 h-32 grayscale" alt="watermark" />
                             </div>

                             {/* Visible Header for PDF/View */}
                             <div className="mb-8 border-b border-slate-700 pb-4">
                                 <h2 className="text-2xl font-bold text-slate-200 text-center font-gaming tracking-widest mb-2">LAPORAN ABSENSI</h2>
                                 <div className="grid grid-cols-2 gap-4 text-sm font-mono text-slate-300 mt-4">
                                    <div>
                                        <p className="text-slate-500 text-xs uppercase">Nama Siswa</p>
                                        <p className="font-bold text-lg text-amber-400">{selectedStudentDetail.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-500 text-xs uppercase">Periode</p>
                                        <p className="font-bold">{historyMonth}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-xs uppercase">Nomor Induk (NIS)</p>
                                        <p className="font-bold">{selectedStudentDetail.id}</p>
                                    </div>
                                     <div className="text-right">
                                        <p className="text-slate-500 text-xs uppercase">Kelas</p>
                                        <p className="font-bold text-cyan-400">{selectedStudentDetail.className}</p>
                                    </div>
                                 </div>
                             </div>

                             <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="p-3 border-b border-slate-800">Tanggal</th>
                                        <th className="p-3 border-b border-slate-800 text-center">Status</th>
                                        <th className="p-3 border-b border-slate-800 text-center">Waktu Scan</th>
                                        <th className="p-3 border-b border-slate-800">Petugas</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-mono divide-y divide-slate-800/50">
                                    {getStudentHistoryDetails(selectedStudentDetail).map((row, idx) => (
                                        <tr key={idx} className={`${row.statusRaw === 'PRESENT' ? 'bg-green-900/10' : row.statusRaw === 'HAID' ? 'bg-pink-900/10' : row.isSunday ? 'bg-slate-900/30 opacity-50' : 'hover:bg-slate-800/50'}`}>
                                            <td className="p-3 text-slate-300">
                                                {row.displayDate}
                                            </td>
                                            <td className="p-3 text-center">
                                                {row.statusRaw === 'PRESENT' && <span className="text-green-400 font-bold text-xs bg-green-900/30 px-2 py-0.5 rounded">HADIR</span>}
                                                {row.statusRaw === 'HAID' && <span className="text-pink-400 font-bold text-xs bg-pink-900/30 px-2 py-0.5 rounded">HAID</span>}
                                                {!row.statusRaw && row.status === 'Tidak Hadir' && <span className="text-red-400 text-xs">ALPHA</span>}
                                                {!row.statusRaw && row.status !== 'Tidak Hadir' && <span className="text-slate-600 text-[10px] italic">{row.status}</span>}
                                            </td>
                                            <td className="p-3 text-center text-slate-400">
                                                {row.time}
                                            </td>
                                            <td className="p-3 text-xs text-slate-500">
                                                {row.operator}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     </div>
                ) : (
                    <>
                    {/* FILTER CONTROLS (Only show when list is active) */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row gap-4 items-end md:items-center no-print">
                        <div className="w-full md:w-auto space-y-1">
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Bulan</label>
                            <input 
                                type="month" 
                                value={historyMonth} 
                                onChange={(e) => setHistoryMonth(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-amber-500 outline-none"
                            />
                        </div>
                        <div className="w-full md:w-auto space-y-1">
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                                <Filter size={10} /> Filter Kelas
                            </label>
                            <select
                                value={historyFilterClass}
                                onChange={(e) => setHistoryFilterClass(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none"
                            >
                                <option value="ALL">SEMUA KELAS</option>
                                {classList.map(cls => (
                                    <option key={cls} value={cls}>{cls}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* HISTORY TABLE (List of Students) */}
                    <div className="overflow-x-auto rounded-xl border border-slate-700">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="p-3 border-b border-slate-800 text-center w-12">No</th>
                                    <th className="p-3 border-b border-slate-800 w-24">Kelas</th>
                                    <th className="p-3 border-b border-slate-800 w-32">NIS</th>
                                    <th className="p-3 border-b border-slate-800">Nama Siswa</th>
                                    <th className="p-3 border-b border-slate-800 text-center w-20 bg-green-900/10 text-green-400">Sholat</th>
                                    <th className="p-3 border-b border-slate-800 text-center w-20 bg-pink-900/10 text-pink-400">Haid</th>
                                    <th className="p-3 border-b border-slate-800 text-center w-20 bg-red-900/10 text-red-400">Absen</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-mono divide-y divide-slate-800/50">
                                {monthlyStats.map((student, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-3 text-center opacity-60">{idx + 1}</td>
                                        <td className="p-3 font-bold text-cyan-500/80">{student.className}</td>
                                        <td className="p-3 opacity-70">{student.id}</td>
                                        <td className="p-3 font-medium text-slate-300">
                                            <button 
                                                onClick={() => setSelectedStudentDetail(student)}
                                                className="hover:text-amber-400 hover:underline flex items-center gap-2 transition-all w-full text-left"
                                            >
                                                {student.name}
                                                <Eye size={14} className="opacity-0 group-hover:opacity-100 text-amber-500 transition-opacity" />
                                            </button>
                                        </td>
                                        <td className="p-3 text-center font-bold text-green-400 bg-green-900/5">
                                            {student.presentCount}
                                        </td>
                                        <td className="p-3 text-center font-bold text-pink-400 bg-pink-900/5">
                                            {student.haidCount}
                                        </td>
                                        <td className="p-3 text-center font-bold text-red-400 bg-red-900/5">
                                            {student.absentCount}
                                        </td>
                                    </tr>
                                ))}
                                {monthlyStats.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-500">
                                            Tidak ada data siswa.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    </>
                )}
            </div>
            )}

            {/* SEMESTER VIEW */}
            {period === ReportPeriod.SEMESTER && (
            <div>
                <div className="overflow-hidden border border-slate-800 rounded-lg mt-4">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950/50">
                    <tr>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Rank</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Hero Name</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Score</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                    {semesterData.length > 0 ? semesterData.map((s, idx) => (
                        <tr key={idx} className={`group hover:bg-slate-800/50 transition-colors ${idx < 3 ? 'bg-gradient-to-r from-amber-500/5 to-transparent' : ''}`}>
                        <td className="p-3 text-sm text-center">
                            {idx === 0 && <Medal size={20} className="text-yellow-400 mx-auto drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]" />}
                            {idx === 1 && <Medal size={20} className="text-slate-300 mx-auto" />}
                            {idx === 2 && <Medal size={20} className="text-amber-700 mx-auto" />}
                            {idx > 2 && <span className="text-slate-500 font-mono font-bold">#{idx + 1}</span>}
                        </td>
                        <td className="p-3">
                            <div className="text-sm font-bold text-slate-200 group-hover:text-amber-400 transition-colors">{s.name}</div>
                            <div className="text-xs text-slate-500">{s.className}</div>
                        </td>
                        <td className="p-3 text-sm font-bold text-cyan-400 text-right font-mono">{s.count}</td>
                        </tr>
                    )) : (
                        <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-500 italic">No battle records found.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Reports;