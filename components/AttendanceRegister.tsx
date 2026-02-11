import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { Employee, AttendanceRecord, AttendanceStatus, UserProfile } from '../types.ts';
import Modal from './ui/Modal.tsx';

interface AttendanceEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: Employee;
    date: string;
    record: AttendanceRecord | null;
    onSave: (employeeId: string, date: string, status: AttendanceStatus, reason: string, recordId: string | null) => void;
    onDelete: (recordId: string) => void;
}

const AttendanceEditModal: React.FC<AttendanceEditModalProps> = ({ isOpen, onClose, employee, date, record, onSave, onDelete }) => {
    const [status, setStatus] = useState<AttendanceStatus>(AttendanceStatus.Absent);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (record) {
            setStatus(record.status);
            setReason(record.reason || '');
        } else {
            setStatus(AttendanceStatus.Absent);
            setReason('');
        }
        setError('');
    }, [record, isOpen]);

    const handleSave = () => {
        if (status !== AttendanceStatus.Present && !reason.trim()) {
            setError('A reason is required for marking an exception (Absent, Leave, etc.).');
            return;
        }
        onSave(employee.id, date, status, reason, record ? record.id : null);
    };

    const handleMarkPresent = () => {
        if (record) {
            onDelete(record.id);
        }
        onClose();
    };
    
    const statusOptions = [
        { value: AttendanceStatus.Absent, label: 'Absent (Unpaid)', color: 'red' },
        { value: AttendanceStatus.HalfDay, label: 'Half Day (0.5)', color: 'orange' },
        { value: AttendanceStatus.PaidLeave, label: 'Paid Leave', color: 'blue' },
        { value: AttendanceStatus.SickLeave, label: 'Sick Leave', color: 'yellow' },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Attendance Exception: ${employee.fullName}`} size="lg">
            <div className="space-y-6">
                <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800 border border-blue-100">
                    <p><strong>Date:</strong> {date}</p>
                    <p className="mt-1">Employees are marked <strong>Present (P)</strong> by default. Only mark deviations from full attendance here.</p>
                </div>

                {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert"><p>{error}</p></div>}
                
                <div>
                    <h3 className="text-md font-semibold text-slate-700 mb-3">Select Deviation Type</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {statusOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setStatus(opt.value)}
                                className={`p-4 rounded-lg text-sm font-bold transition-all duration-200 border-2 text-center ${
                                    status === opt.value
                                        ? `bg-${opt.color}-600 text-white border-${opt.color}-700 shadow-inner`
                                        : `bg-white text-slate-700 border-slate-200 hover:border-${opt.color}-400 hover:bg-${opt.color}-50`
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="reason" className="block text-sm font-bold text-slate-700 mb-1">
                        Reason / Notes
                    </label>
                    <textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                        placeholder={`e.g., "Medical appointment", "Unauthorized absence", "Family emergency"`}
                        style={{ backgroundColor: 'white', color: '#1e293b' }}
                    />
                </div>

                <div className="flex justify-between items-center pt-6 border-t gap-4">
                    <button 
                        onClick={handleMarkPresent} 
                        className="flex-grow py-3 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors"
                    >
                        Reset to Present (P)
                    </button>
                    <div className="flex gap-2 flex-grow">
                        <button onClick={onClose} className="flex-grow py-3 bg-white text-slate-600 font-bold border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        <button onClick={handleSave} className="flex-grow py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">Save Exception</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};


const AttendanceRegister: React.FC<{ userProfile: UserProfile | null }> = ({ userProfile }) => {
    const { state, dispatch } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedCell, setSelectedCell] = useState<{ employee: Employee; date: string; record: AttendanceRecord | null } | null>(null);

    const { month, year, daysInMonth } = useMemo(() => {
        const date = new Date(currentDate);
        const month = date.getMonth();
        const year = date.getFullYear();
        const numDays = new Date(year, month + 1, 0).getDate();
        const days = Array.from({ length: numDays }, (_, i) => i + 1);
        return { month, year, daysInMonth: days };
    }, [currentDate]);

    const filteredEmployees = useMemo(() => {
        const activeEmployees = state.employees.filter(emp => emp.status === 'Active');
        activeEmployees.sort((a, b) => a.fullName.localeCompare(b.fullName));

        if (!selectedEmployeeId) return activeEmployees;
        return activeEmployees.filter(emp => emp.id === selectedEmployeeId);
    }, [state.employees, selectedEmployeeId]);
    
    const attendanceMap = useMemo(() => {
        const map = new Map<string, AttendanceRecord>();
        state.attendanceRecords.forEach(record => {
            const key = `${record.employeeId}-${record.date}`;
            map.set(key, record);
        });
        return map;
    }, [state.attendanceRecords]);

    const handleMonthChange = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };
    
    const handleCellClick = (employee: Employee, day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const key = `${employee.id}-${dateStr}`;
        const record = attendanceMap.get(key) || null;
        setSelectedCell({ employee, date: dateStr, record });
    };

    const handleSaveAttendance = (employeeId: string, date: string, status: AttendanceStatus, reason: string, recordId: string | null) => {
        const id = recordId || `ATT-${employeeId}-${date}`;
        const record: AttendanceRecord = { id, employeeId, date, status, reason };
        
        if (recordId) {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'attendanceRecords', data: record } });
        } else {
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'attendanceRecords', data: record } });
        }
        setSelectedCell(null);
    };

    const handleDeleteAttendance = (recordId: string) => {
        dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'attendanceRecords', id: recordId } });
        setSelectedCell(null);
    };
    
    const getStatusStyle = (status: AttendanceStatus | 'P') => {
        switch (status) {
            case AttendanceStatus.Absent: return 'bg-red-600 text-white shadow-sm ring-1 ring-red-800';
            case AttendanceStatus.PaidLeave: return 'bg-blue-600 text-white shadow-sm';
            case AttendanceStatus.SickLeave: return 'bg-amber-400 text-amber-950 shadow-sm ring-1 ring-amber-600';
            case AttendanceStatus.HalfDay: return 'bg-indigo-600 text-white shadow-sm';
            case AttendanceStatus.Holiday: return 'bg-emerald-600 text-white shadow-sm';
            case 'P':
            default: return 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-white hover:text-slate-600 transition-colors';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-md hover:bg-white hover:shadow-sm transition-all">&larr;</button>
                        <h2 className="text-lg font-bold text-slate-800 w-40 text-center uppercase tracking-tight">
                            {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button onClick={() => handleMonthChange(1)} className="p-2 rounded-md hover:bg-white hover:shadow-sm transition-all">&rarr;</button>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-xs font-bold">
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200"></span><span className="text-slate-500">Present (Auto)</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-600"></span><span className="text-slate-700">Absent</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-600"></span><span className="text-slate-700">Half Day</span></div>
                    </div>
                    <div className="w-64">
                        <select
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Active Employees</option>
                            {state.employees.filter(emp => emp.status === 'Active').map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-lg">
                <table className="w-full text-left table-fixed border-collapse">
                    <thead>
                        <tr className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200">
                            <th className="p-3 font-bold text-slate-600 w-48 sticky left-0 bg-slate-50/80 z-20 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Employee</th>
                            {daysInMonth.map(day => (
                                <th key={day} className="p-3 font-bold text-slate-500 text-center w-12 border-r border-slate-100">{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.map(employee => (
                            <tr key={employee.id} className="group hover:bg-slate-50 transition-colors">
                                <td className="p-3 text-slate-800 font-bold whitespace-nowrap overflow-hidden text-ellipsis sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 text-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{employee.fullName}</td>
                                {daysInMonth.map(day => {
                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const key = `${employee.id}-${dateStr}`;
                                    const record = attendanceMap.get(key);
                                    const status = record ? record.status : 'P';

                                    return (
                                        <td key={day} className="p-1.5 text-center border-r border-slate-50">
                                            <button
                                                onClick={() => handleCellClick(employee, day)}
                                                className={`w-full aspect-square flex items-center justify-center rounded-lg text-[10px] font-black transition-all hover:scale-110 active:scale-95 ${getStatusStyle(status)}`}
                                                title={record?.reason || 'Automatic Present'}
                                            >
                                                {status}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredEmployees.length === 0 && (
                    <div className="text-center py-20 bg-slate-50">
                        <p className="text-slate-400 font-medium">No active employees found to mark attendance.</p>
                    </div>
                 )}
            </div>

            {selectedCell && (
                <AttendanceEditModal
                    isOpen={!!selectedCell}
                    onClose={() => setSelectedCell(null)}
                    employee={selectedCell.employee}
                    date={selectedCell.date}
                    record={selectedCell.record}
                    onSave={handleSaveAttendance}
                    onDelete={handleDeleteAttendance}
                />
            )}
        </div>
    );
};

export default AttendanceRegister;
