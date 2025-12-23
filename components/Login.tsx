import React, { useState, useMemo } from 'react';
import { TEACHERS } from '../constants';
import { Lock, User, KeyRound, ShieldCheck, ChevronRight, Briefcase, GraduationCap } from 'lucide-react';
import { Student, UserRole } from '../types';

interface LoginProps {
  onLogin: (username: string, role: UserRole, studentData?: Student) => void;
  students: Student[];
}

const Login: React.FC<LoginProps> = ({ onLogin, students }) => {
  const [loginMode, setLoginMode] = useState<'STAFF' | 'PARENT'>('STAFF');
  
  // STAFF STATE
  const [selectedStaff, setSelectedStaff] = useState('');
  const [password, setPassword] = useState('');
  
  // PARENT STATE
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Derived data for Parent Login
  const uniqueClasses = useMemo(() => {
    const classes = new Set(students.map(s => s.className));
    return Array.from(classes).sort();
  }, [students]);

  const studentsInClass = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => s.className === selectedClass).sort((a,b) => a.name.localeCompare(b.name));
  }, [students, selectedClass]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate network delay
    setTimeout(() => {
      
      if (loginMode === 'STAFF') {
          if (!selectedStaff) {
            setError('Silakan pilih identitas anda.');
            setLoading(false);
            return;
          }

          // ADMIN CHECK - User "Administrator" with password "007007Rh"
          if (selectedStaff === 'ADMINISTRATOR') {
              if (password === '007007Rh') {
                  onLogin('ADMINISTRATOR', 'ADMIN');
              } else {
                  setError('Password Admin salah!');
                  setLoading(false);
              }
          } 
          // TEACHER CHECK - Default password for teachers (simplified)
          else {
              if (password === 'guru123') {
                 onLogin(selectedStaff, 'TEACHER');
              } else {
                 setError('Password salah! (Default: guru123)');
                 setLoading(false);
              }
          }

      } else {
          // PARENT MODE
          if (!selectedClass || !selectedStudentId) {
             setError('Silakan pilih kelas dan nama siswa.');
             setLoading(false);
             return;
          }

          const student = students.find(s => s.id === selectedStudentId);
          if (student) {
             onLogin(`Wali ${student.name.split(' ')[0]}`, 'PARENT', student);
          } else {
             setError('Data siswa tidak valid.');
             setLoading(false);
          }
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-[#0f172a] z-0">
        <div className="absolute top-0 left-0 w-full h-full opacity-10" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', 
            backgroundSize: '30px 30px' 
          }}>
        </div>
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Header Area */}
        <div className="text-center mb-8">
           <div className="mx-auto w-24 h-24 bg-gradient-to-b from-slate-800 to-slate-950 rounded-2xl border-2 border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)] flex items-center justify-center mb-6 relative group">
              <div className="absolute inset-0 bg-amber-500/10 animate-pulse rounded-2xl"></div>
              <img 
                  src="https://iili.io/fEhQpTX.png"
                  alt="Logo" 
                  className="w-16 h-16 object-contain z-10 drop-shadow-lg"
              />
           </div>
           <h1 className="text-3xl font-bold font-gaming text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 tracking-wider mb-2">
             GATEKEEPER
           </h1>
           <p className="text-slate-400 text-xs uppercase tracking-[0.3em] font-medium">SMPN 3 PACET SYSTEM ACCESS</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-1 rounded-3xl shadow-2xl relative overflow-hidden">
           {/* MODE TABS */}
           <div className="flex p-1 bg-slate-950/50 rounded-t-3xl">
               <button 
                  onClick={() => { setLoginMode('STAFF'); setError(''); }}
                  className={`flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      loginMode === 'STAFF' 
                      ? 'bg-slate-800 text-amber-400 shadow-lg' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
               >
                   <Briefcase size={14} /> Guru / Staff
               </button>
               <button 
                  onClick={() => { setLoginMode('PARENT'); setError(''); }}
                  className={`flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      loginMode === 'PARENT' 
                      ? 'bg-slate-800 text-cyan-400 shadow-lg' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
               >
                   <GraduationCap size={14} /> Wali Murid
               </button>
           </div>

           <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                 
                 {/* STAFF FORM */}
                 {loginMode === 'STAFF' && (
                     <div className="space-y-4 animate-fade-in">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Identitas</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={18} />
                                <select 
                                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 pl-12 pr-4 py-3 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none appearance-none transition-all"
                                    value={selectedStaff}
                                    onChange={(e) => setSelectedStaff(e.target.value)}
                                    required
                                >
                                    <option value="">Pilih Nama...</option>
                                    <option value="ADMINISTRATOR" className="font-bold text-amber-400">★ ADMINISTRATOR</option>
                                    <optgroup label="Dewan Guru">
                                        {TEACHERS.map((t, i) => (
                                            <option key={i} value={t}>{t}</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <ChevronRight className="absolute right-4 top-3.5 text-slate-600 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative group">
                                <KeyRound className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={18} />
                                <input 
                                    type="password" 
                                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 pl-12 pr-4 py-3 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder-slate-700"
                                    placeholder="Masukkan Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                     </div>
                 )}

                 {/* PARENT FORM */}
                 {loginMode === 'PARENT' && (
                     <div className="space-y-4 animate-fade-in">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
                            <div className="relative group">
                                <ShieldCheck className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-cyan-500 transition-colors" size={18} />
                                <select 
                                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 pl-12 pr-4 py-3 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none transition-all"
                                    value={selectedClass}
                                    onChange={(e) => {
                                        setSelectedClass(e.target.value);
                                        setSelectedStudentId('');
                                    }}
                                    required
                                >
                                    <option value="">Pilih Kelas...</option>
                                    {uniqueClasses.map(cls => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-4 top-3.5 text-slate-600 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Siswa</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-cyan-500 transition-colors" size={18} />
                                <select 
                                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 pl-12 pr-4 py-3 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none appearance-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={selectedStudentId}
                                    onChange={(e) => setSelectedStudentId(e.target.value)}
                                    disabled={!selectedClass}
                                    required
                                >
                                    <option value="">{selectedClass ? 'Pilih Nama Siswa...' : 'Pilih Kelas Terlebih Dahulu'}</option>
                                    {studentsInClass.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-4 top-3.5 text-slate-600 pointer-events-none" size={16} />
                            </div>
                        </div>
                     </div>
                 )}

                 {error && (
                    <div className="bg-red-900/20 border border-red-500/50 text-red-200 text-xs p-3 rounded-lg text-center animate-bounce">
                        {error}
                    </div>
                 )}

                 <button 
                    type="submit"
                    disabled={loading}
                    className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                        loginMode === 'STAFF' 
                        ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-900 shadow-[0_0_20px_rgba(245,158,11,0.3)]' 
                        : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                    }`}
                 >
                    {loading ? (
                        <span className="animate-pulse">Accessing Mainframe...</span>
                    ) : (
                        <>
                            {loginMode === 'STAFF' ? <Lock size={16} /> : <ShieldCheck size={16} />}
                            LOGIN SYSTEM
                        </>
                    )}
                 </button>
              </form>
           </div>
        </div>
        
        <div className="mt-8 text-center text-slate-600 text-[10px] font-mono">
            SECURE CONNECTION ESTABLISHED • ENCRYPTED
        </div>
      </div>
    </div>
  );
};

export default Login;