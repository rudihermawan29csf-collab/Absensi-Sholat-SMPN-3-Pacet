
import React, { useState, useEffect } from 'react';
import { Shield, Users, QrCode, Trophy, LogOut, User, Home, Loader2, RefreshCw } from 'lucide-react';
import ScannerTab from './components/ScannerTab';
import StudentList from './components/StudentList';
import Reports from './components/Reports';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Student, AttendanceRecord, TabView, UserRole } from './types';
import { getStudents, getAttendance } from './services/storageService';
import { STORAGE_KEYS } from './constants';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('TEACHER');
  const [parentStudentData, setParentStudentData] = useState<Student | null>(null);

  const [activeTab, setActiveTab] = useState<TabView>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sinkronisasi Full (Siswa + Absensi)
  const syncFullData = async () => {
    setIsSyncing(true);
    try {
      const [studentData, attendanceData] = await Promise.all([
        getStudents(),
        getAttendance()
      ]);
      setStudents(studentData);
      setRecords(attendanceData);
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const sessionAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (sessionAuth) {
      try {
        const parsedAuth = JSON.parse(sessionAuth);
        setCurrentUser(parsedAuth.username);
        setUserRole(parsedAuth.role);
        if (parsedAuth.role === 'PARENT' && parsedAuth.studentData) {
            setParentStudentData(parsedAuth.studentData);
            setActiveTab('reports');
        }
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.AUTH);
      }
    }
    syncFullData();
  }, []);

  const handleRecordUpdate = () => syncFullData();

  const handleLogin = (username: string, role: UserRole, studentData?: Student) => {
    const authData = { username, role, studentData };
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(authData));
    setCurrentUser(username);
    setUserRole(role);
    setParentStudentData(studentData || null);
    setIsAuthenticated(true);
    if (role === 'PARENT') setActiveTab('reports');
    else setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    setIsAuthenticated(false);
    setCurrentUser('');
    setUserRole('TEACHER');
    setParentStudentData(null);
    setActiveTab('dashboard');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} students={students} />;
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden text-slate-200">
      <div className="fixed inset-0 z-0 bg-[#0f172a]">
        <div className="absolute top-0 left-0 w-full h-96 bg-blue-900/20 blur-[100px] rounded-full mix-blend-screen"></div>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(to right, #6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <header className="relative z-50 pt-6 px-4 pb-4">
        <div className="max-w-5xl mx-auto flex items-center gap-6 border-b border-white/10 pb-6 bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80 backdrop-blur-md rounded-2xl shadow-xl px-6 py-4 border-t border-white/5 relative">
          <div className="relative group shrink-0">
             <div className="absolute -inset-4 bg-gradient-to-r from-amber-600 to-amber-600 rounded-full blur-xl opacity-40 group-hover:opacity-80 transition duration-1000"></div>
             <div className="relative w-20 h-20 rounded-full p-1 bg-gradient-to-b from-amber-400 to-amber-700 shadow-2xl">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                   <img src="https://iili.io/fEhQpTX.png" alt="Logo" className="w-full h-full object-contain p-2" />
                </div>
             </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 font-gaming truncate">
              SMPN 3 PACET
            </h1>
            <div className="flex flex-wrap gap-2 mt-1">
               <button 
                  onClick={syncFullData}
                  disabled={isSyncing}
                  className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase border border-cyan-500/30 px-2 py-1 rounded bg-cyan-950/30 text-cyan-400 hover:bg-cyan-500/20 transition-all"
               >
                 {isSyncing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                 {isSyncing ? 'SYNCING...' : 'REFRESH DATABASE'}
               </button>
            </div>
          </div>

          <button onClick={handleLogout} className="p-2 text-red-400 bg-red-900/20 rounded-lg border border-red-500/20 active:scale-90 transition-transform">
              <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 relative z-10">
        <div className="animate-fade-in">
          {activeTab === 'dashboard' && userRole !== 'PARENT' && <Dashboard students={students} records={records} />}
          {activeTab === 'scan' && userRole !== 'PARENT' && (
            <ScannerTab students={students} records={records} onRecordUpdate={handleRecordUpdate} currentUser={currentUser} />
          )}
          {activeTab === 'students' && userRole === 'ADMIN' && <StudentList students={students} setStudents={setStudents} />}
          {activeTab === 'reports' && <Reports records={records} students={students} viewOnlyStudent={parentStudentData} />}
        </div>
      </main>

      {userRole !== 'PARENT' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40">
          <div className="max-w-xl mx-auto flex justify-center items-end pb-4 gap-4 md:gap-8">
             <button onClick={() => setActiveTab('dashboard')} className={`group flex flex-col items-center transition-all w-16 ${activeTab === 'dashboard' ? '-translate-y-2 scale-110' : 'opacity-70'}`}>
                <div className={`w-12 h-12 flex items-center justify-center rounded-xl transform rotate-45 border-2 ${activeTab === 'dashboard' ? 'bg-slate-800 border-amber-400' : 'bg-slate-900 border-slate-700'}`}>
                  <Home size={22} className={`transform -rotate-45 ${activeTab === 'dashboard' ? 'text-amber-400' : 'text-slate-400'}`} />
                </div>
             </button>
             <button onClick={() => setActiveTab('scan')} className={`group flex flex-col items-center transition-all w-16 ${activeTab === 'scan' ? '-translate-y-2 scale-110' : 'opacity-70'}`}>
                <div className={`w-12 h-12 flex items-center justify-center rounded-xl transform rotate-45 border-2 ${activeTab === 'scan' ? 'bg-slate-800 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-900 border-slate-700'}`}>
                  <QrCode size={22} className={`transform -rotate-45 ${activeTab === 'scan' ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
             </button>
             {userRole === 'ADMIN' && (
               <button onClick={() => setActiveTab('students')} className={`group flex flex-col items-center transition-all w-16 ${activeTab === 'students' ? '-translate-y-2 scale-110' : 'opacity-70'}`}>
                  <div className={`w-12 h-12 flex items-center justify-center rounded-xl transform rotate-45 border-2 ${activeTab === 'students' ? 'bg-slate-800 border-amber-400' : 'bg-slate-900 border-slate-700'}`}>
                    <Users size={22} className={`transform -rotate-45 ${activeTab === 'students' ? 'text-amber-400' : 'text-slate-400'}`} />
                  </div>
               </button>
             )}
             <button onClick={() => setActiveTab('reports')} className={`group flex flex-col items-center transition-all w-16 ${activeTab === 'reports' ? '-translate-y-2 scale-110' : 'opacity-70'}`}>
                <div className={`w-12 h-12 flex items-center justify-center rounded-xl transform rotate-45 border-2 ${activeTab === 'reports' ? 'bg-slate-800 border-amber-400' : 'bg-slate-900 border-slate-700'}`}>
                  <Trophy size={22} className={`transform -rotate-45 ${activeTab === 'reports' ? 'text-amber-400' : 'text-slate-400'}`} />
                </div>
             </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
