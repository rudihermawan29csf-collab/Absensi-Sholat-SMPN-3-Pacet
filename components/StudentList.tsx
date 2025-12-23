
import React, { useState, useRef } from 'react';
import { Student } from '../types';
import { UserPlus, Trash2, Users, QrCode, Sword, Scroll, Save, Download, Upload, FileSpreadsheet, Phone, Edit, X, Loader2 } from 'lucide-react';
import { saveStudents } from '../services/storageService';
import CardGenerator from './CardGenerator';
import * as XLSX from 'xlsx';

interface StudentListProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
}

const StudentList: React.FC<StudentListProps> = ({ students, setStudents }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showCardGenerator, setShowCardGenerator] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [newStudent, setNewStudent] = useState<Partial<Student>>({ className: 'IX A', gender: 'L', parentPhone: '' });
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const performSync = async (updatedList: Student[]) => {
    setIsSaving(true);
    setStudents(updatedList);
    await saveStudents(updatedList);
    setIsSaving(false);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.id || isSaving) return;

    const updatedStudents = [...students, newStudent as Student];
    updatedStudents.sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
    
    await performSync(updatedStudents);
    setIsAdding(false);
    setNewStudent({ className: 'IX A', gender: 'L', name: '', id: '', parentPhone: '' });
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editingStudent.name || !editingStudent.id || isSaving) return;

    const finalList = students.map(s => s.id === editingStudent.id ? editingStudent : s);
    await performSync(finalList);
    setEditingStudent(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Konfirmasi Hapus: Apakah Anda yakin?')) {
      const updatedStudents = students.filter(s => s.id !== id);
      await performSync(updatedStudents);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result;
      if (!data) return;

      try {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const newStudents: Student[] = [];
        jsonData.forEach((row) => {
          const id = row['NIS'] || row['ID'];
          const nameRaw = row['Nama Lengkap'] || row['Nama'];
          if (id && nameRaw) {
            newStudents.push({
              id: String(id).trim(),
              name: String(nameRaw).toUpperCase().trim(),
              className: String(row['Kelas'] || 'IX A').trim(),
              gender: (String(row['Gender'] || 'L').toUpperCase().startsWith('P')) ? 'P' : 'L',
              parentPhone: String(row['No WA Ortu'] || '').replace(/\D/g, '')
            });
          }
        });

        if (newStudents.length > 0) {
            const mergedStudents = [...students];
            newStudents.forEach(newS => {
              const index = mergedStudents.findIndex(s => s.id === newS.id);
              if (index >= 0) mergedStudents[index] = newS;
              else mergedStudents.push(newS);
            });
            mergedStudents.sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
            await performSync(mergedStudents);
            alert(`Impor Sukses! Data disinkronkan ke Cloud.`);
        }
      } catch (error) {
        alert("Gagal membaca file Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <div className="space-y-6 pb-20">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm relative">
          {isSaving && (
            <div className="absolute inset-0 bg-slate-900/60 z-20 flex items-center justify-center rounded-2xl">
               <Loader2 className="animate-spin text-amber-500 mr-2" />
               <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Sinkronisasi Cloud...</span>
            </div>
          )}
          <h2 className="text-xl font-bold text-amber-500 flex items-center gap-3 font-gaming">
            <Scroll className="text-cyan-400" />
            HERO ROSTER <span className="text-slate-500 text-sm font-sans font-normal ml-2">({students.length})</span>
          </h2>
          
          <div className="flex flex-wrap gap-2 w-full xl:w-auto">
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
             <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none bg-slate-800 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-900/30 transition-all flex items-center justify-center gap-2">
                <Upload size={16} /> Import
             </button>
             <button onClick={() => setShowCardGenerator(true)} className="flex-1 sm:flex-none bg-slate-800 text-cyan-400 border border-cyan-500/50 px-3 py-2 rounded-lg text-xs font-bold hover:bg-cyan-900/50 transition-all flex items-center justify-center gap-2">
                <QrCode size={16} /> Cards
             </button>
             <button onClick={() => setIsAdding(!isAdding)} className="flex-1 sm:flex-none bg-amber-600 text-slate-900 px-4 py-2 rounded-lg text-xs font-bold hover:bg-amber-500 transition-all flex items-center justify-center gap-2 uppercase tracking-wide">
                <UserPlus size={16} /> {isAdding ? 'Cancel' : 'Add Hero'}
             </button>
          </div>
        </div>

        {isAdding && (
          <div className="bg-slate-900/90 p-6 rounded-xl border border-amber-500/30 animate-fade-in shadow-2xl">
            <h3 className="font-bold mb-6 text-amber-400 font-gaming text-lg border-b border-white/10 pb-2">Registrasi Baru</h3>
            <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-medium text-cyan-400 uppercase tracking-widest">NIS / ID</label>
                <input type="text" required className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 outline-none" value={newStudent.id || ''} onChange={e => setNewStudent({...newStudent, id: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-cyan-400 uppercase tracking-widest">Nama Lengkap</label>
                <input type="text" required className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 outline-none" value={newStudent.name || ''} onChange={e => setNewStudent({...newStudent, name: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-cyan-400 uppercase tracking-widest">Kelas</label>
                <input type="text" required className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 outline-none" value={newStudent.className || ''} onChange={e => setNewStudent({...newStudent, className: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-cyan-400 uppercase tracking-widest">Gender</label>
                <select className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 outline-none" value={newStudent.gender || ''} onChange={e => setNewStudent({...newStudent, gender: e.target.value as 'L'|'P'})}>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div className="md:col-span-2 mt-4">
                <button type="submit" disabled={isSaving} className="w-full bg-cyan-600 text-white py-3 rounded-lg hover:bg-cyan-500 font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} Simpan ke Cloud
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {students.map((student) => (
            <div key={student.id} className="group relative bg-slate-800/40 border border-slate-700 hover:border-amber-500/50 rounded-xl p-4 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center border-2 ${student.gender === 'L' ? 'bg-blue-950 border-blue-600 text-blue-400' : 'bg-pink-950 border-pink-600 text-pink-400'}`}>
                    <Users size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 group-hover:text-amber-400">{student.name}</h4>
                    <div className="flex gap-3 text-xs text-slate-500 mt-1 font-mono">
                      <span className="text-cyan-500">{student.id}</span>
                      <span>{student.className}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setEditingStudent(student)} className="p-2 text-slate-600 hover:text-amber-400"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(student.id)} className="p-2 text-slate-600 hover:text-red-400"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-amber-500 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-white/10 bg-slate-950">
                    <h3 className="text-lg font-bold text-amber-400 font-gaming">EDIT HERO DATA</h3>
                    <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>
                <div className="p-6">
                    <form onSubmit={handleUpdateStudent} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">NIS / ID</label>
                            <input disabled className="w-full p-3 bg-slate-950/50 border border-slate-800 rounded-lg text-slate-500 font-mono" value={editingStudent.id} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-widest">Nama Lengkap</label>
                            <input type="text" required className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200" value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value.toUpperCase()})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-cyan-400 uppercase tracking-widest">Kelas</label>
                                <input type="text" required className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200" value={editingStudent.className} onChange={e => setEditingStudent({...editingStudent, className: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-cyan-400 uppercase tracking-widest">Gender</label>
                                <select className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200" value={editingStudent.gender || ''} onChange={e => setEditingStudent({...editingStudent, gender: e.target.value as 'L'|'P'})}>
                                    <option value="L">Laki-laki</option>
                                    <option value="P">Perempuan</option>
                                </select>
                            </div>
                        </div>
                        <div className="pt-4 flex gap-3">
                            <button type="button" onClick={() => setEditingStudent(null)} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-lg font-bold">Batal</button>
                            <button type="submit" disabled={isSaving} className="flex-1 bg-amber-600 text-slate-900 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} Update Cloud
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}
      {showCardGenerator && <CardGenerator students={students} onClose={() => setShowCardGenerator(false)} />}
    </>
  );
};

export default StudentList;
