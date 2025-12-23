import React, { useMemo, useState } from 'react';
import { Student, AttendanceRecord } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Users, CheckCircle2, XCircle, Droplets, Filter, BookOpen } from 'lucide-react';

interface DashboardProps {
  students: Student[];
  records: AttendanceRecord[];
}

const Dashboard: React.FC<DashboardProps> = ({ students, records }) => {
  const [selectedClass, setSelectedClass] = useState('ALL');

  // --- Date Info ---
  const todayDate = new Date();
  const dateStr = format(todayDate, 'yyyy-MM-dd');
  const displayDate = format(todayDate, 'EEEE, dd MMMM yyyy', { locale: id });

  // --- Data Processing ---
  const uniqueClasses = useMemo(() => {
    const classes = new Set(students.map(s => s.className));
    return Array.from(classes).sort();
  }, [students]);

  const stats = useMemo(() => {
    // 1. Filter Students based on selected class
    let targetStudents = students;
    if (selectedClass !== 'ALL') {
      targetStudents = students.filter(s => s.className === selectedClass);
    }

    // 2. Get Today's Records
    const todayRecords = records.filter(r => r.date === dateStr);

    // 3. Calculate Stats
    let presentCount = 0;
    let haidCount = 0;

    targetStudents.forEach(student => {
      const record = todayRecords.find(r => r.studentId === student.id);
      if (record) {
        if (record.status === 'HAID') {
          haidCount++;
        } else {
          presentCount++; // Default PRESENT
        }
      }
    });

    const totalStudents = targetStudents.length;
    const absentCount = totalStudents - (presentCount + haidCount);
    
    // Percentage
    const percentage = totalStudents > 0 ? Math.round(((presentCount + haidCount) / totalStudents) * 100) : 0;

    return {
      total: totalStudents,
      present: presentCount,
      haid: haidCount,
      absent: absentCount,
      percentage
    };
  }, [students, records, selectedClass, dateStr]);

  // --- Chart Data ---
  const chartData = [
    { name: 'Sudah Sholat', value: stats.present, color: '#4ade80' }, // Green-400
    { name: 'Sedang Haid', value: stats.haid, color: '#ec4899' }, // Pink-500
    { name: 'Belum Sholat', value: stats.absent, color: '#f87171' }, // Red-400
  ];

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent === 0) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-bold drop-shadow-md">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      
      {/* 1. Header Section */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        
        <h2 className="text-xl md:text-2xl font-bold text-amber-400 font-gaming mb-1 relative z-10">
          Selamat Datang, Pahlawan Pendidikan!
        </h2>
        <p className="text-slate-300 text-sm mb-4 relative z-10">
          Portal Absensi Sholat SMPN 3 Pacet
        </p>
        
        <div className="flex flex-col md:flex-row md:items-center gap-4 border-t border-white/5 pt-4">
           <div className="bg-slate-950/50 px-3 py-1.5 rounded-lg border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              Tahun Pelajaran 2025/2026
           </div>
           <div className="bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-mono flex items-center gap-2">
              <CalendarIcon />
              {displayDate}
           </div>
        </div>
      </div>

      {/* 2. Hadith Section */}
      <div className="bg-emerald-950/30 border border-emerald-500/20 p-6 rounded-xl text-center relative overflow-hidden group hover:bg-emerald-950/40 transition-colors">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-10"></div>
        <BookOpen className="mx-auto text-emerald-500 mb-3 opacity-80" size={24} />
        
        <p className="text-xl md:text-2xl font-serif text-emerald-100 mb-3 leading-loose drop-shadow-md" dir="rtl" lang="ar">
          صلاةُ الجماعةِ تَفضُلُ صلاةَ الفذِّ بِخمسٍ وعِشرينَ دَرَجةً
        </p>
        <p className="text-emerald-200/80 text-sm italic font-medium mb-1">
          "Sholat berjamaah itu lebih utama dibandingkan sholat sendiri (dengan perbandingan) sebanyak 25 derajat."
        </p>
        <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest">
          (HR. Bukhari)
        </p>
      </div>

      {/* 3. Stats & Filter Section */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl">
        
        {/* Filter */}
        <div className="flex justify-between items-center mb-6">
           <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
              Statistik Kehadiran
           </h3>
           
           <div className="relative">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-700 text-slate-200 pl-4 pr-10 py-2 rounded-lg text-xs font-bold focus:border-amber-500 outline-none cursor-pointer hover:bg-slate-900 transition-colors"
              >
                <option value="ALL">SEMUA KELAS</option>
                {uniqueClasses.map(cls => (
                  <option key={cls} value={cls}>KELAS {cls}</option>
                ))}
              </select>
              <Filter className="absolute right-3 top-2.5 text-slate-500 pointer-events-none" size={14} />
           </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard 
              label="Total Siswa" 
              value={stats.total} 
              icon={<Users size={18} />} 
              color="bg-slate-800 text-slate-200 border-slate-600" 
            />
            <StatCard 
              label="Sudah Sholat" 
              value={stats.present} 
              icon={<CheckCircle2 size={18} />} 
              color="bg-green-900/20 text-green-400 border-green-500/30" 
            />
            <StatCard 
              label="Sedang Haid" 
              value={stats.haid} 
              icon={<Droplets size={18} />} 
              color="bg-pink-900/20 text-pink-400 border-pink-500/30" 
            />
            <StatCard 
              label="Belum Absen" 
              value={stats.absent} 
              icon={<XCircle size={18} />} 
              color="bg-red-900/20 text-red-400 border-red-500/30" 
            />
        </div>

        {/* Chart */}
        <div className="flex flex-col items-center justify-center min-h-[300px] relative">
            {stats.total === 0 ? (
               <div className="text-slate-500 text-sm italic">Belum ada data siswa untuk kelas ini.</div>
            ) : (
               <>
                  <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomizedLabel}
                          stroke="none"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                            itemStyle={{ fontSize: '12px' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                      <span className="text-3xl font-bold text-slate-200">{stats.percentage}%</span>
                      <span className="text-[10px] uppercase text-slate-500 tracking-widest font-bold">Kehadiran</span>
                  </div>
               </>
            )}
        </div>

      </div>
    </div>
  );
};

// Helper Components
const StatCard = ({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) => (
  <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-1 shadow-lg ${color}`}>
    <div className="mb-1 opacity-80">{icon}</div>
    <span className="text-2xl font-bold font-mono">{value}</span>
    <span className="text-[10px] uppercase tracking-wider opacity-70 font-bold">{label}</span>
  </div>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
);

export default Dashboard;