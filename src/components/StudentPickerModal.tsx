import React, { useState, useEffect, useMemo } from 'react';
import { Student } from '../types';
import { X, Search, User, Hash, BookOpen, ChevronRight } from 'lucide-react';
import { isClassMatch, studentMatchesQuery } from '../lib/digitUtils';

interface StudentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  academicClasses: string[];
  onSelect: (student: Student) => void;
}

export default function StudentPickerModal({ isOpen, onClose, students, academicClasses, onSelect }: StudentPickerModalProps) {
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSelectedClass(null);
      setSearchTerm('');
      const timer = setTimeout(() => setLoading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const classStudentCount = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
      counts[s.class] = (counts[s.class] || 0) + 1;
    });
    return counts;
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students
      .filter(s => isClassMatch(s.class, selectedClass))
      .filter(s => studentMatchesQuery(s, searchTerm))
      .sort((a, b) =>
        String(a.roll ?? '').localeCompare(String(b.roll ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
  }, [students, selectedClass, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#2c332d]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-stone-300 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#4a5d4e] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <User className="h-4.5 w-4.5 text-[#d9c5b2]" />
            <h3 className="text-sm font-bold">
              {selectedClass ? `Students in ${selectedClass}` : 'Select Class First'}
            </h3>
          </div>
          <button onClick={onClose} className="text-stone-300 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-all cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 bg-stone-200 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-stone-200 rounded w-2/3" />
                    <div className="h-2.5 bg-stone-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !selectedClass ? (
            <div className="p-4">
              <p className="text-xs text-stone-500 mb-3">Choose a class to see its students:</p>
              <div className="grid grid-cols-2 gap-2">
                {academicClasses.map(cls => (
                  <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    className="flex items-center justify-between bg-stone-50 hover:bg-[#f5f2ed] border border-stone-200 hover:border-[#4a5d4e] rounded-lg px-3 py-3 transition-all cursor-pointer group"
                  >
                    <div className="text-left">
                      <span className="text-xs font-bold text-[#2c332d] block">{cls}</span>
                      <span className="text-[10px] text-stone-400">
                        {classStudentCount[cls] || 0} student{(classStudentCount[cls] || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-[#4a5d4e] transition-colors" />
                  </button>
                ))}
              </div>
              {academicClasses.length === 0 && (
                <p className="text-xs text-red-500 italic text-center py-6">No academic levels configured. Go to Settings to add classes.</p>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Back + Search */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedClass(null); setSearchTerm(''); }}
                  className="text-xs font-bold text-[#4a5d4e] hover:underline cursor-pointer whitespace-nowrap"
                >
                  ← All Classes
                </button>
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search by name, roll, ID or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs pl-8 pr-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
              </div>

              {/* Student List */}
              {filteredStudents.length === 0 ? (
                <div className="text-center py-10">
                  <User className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs text-stone-400 italic">
                    {searchTerm ? 'No students match your search.' : 'No students in this class.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredStudents.map((s, idx) => (
                    <button
                      key={`${s.id}__${idx}`}
                      onClick={() => { onSelect(s); onClose(); }}
                      className="w-full flex items-center gap-3 bg-stone-50 hover:bg-[#f5f2ed] border border-stone-200 hover:border-[#4a5d4e] rounded-lg px-3 py-2.5 transition-all cursor-pointer text-left group"
                    >
                      <div className="h-9 w-9 bg-[#4a5d4e]/10 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-black text-[#4a5d4e] font-mono">{s.roll}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#2c332d] truncate">{s.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-stone-400">
                          <span className="flex items-center gap-0.5">
                            <Hash className="h-2.5 w-2.5" />
                            {s.id}
                          </span>
                          <span>•</span>
                          <span>Roll {s.roll}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-[#4a5d4e] transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
