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
            setError('A reason is required for any status other than "Present".');
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
        { value: AttendanceStatus.PaidLeave, label: 'Paid Leave', color: 'blue' },
        { value: AttendanceStatus.SickLeave, label: 'Sick Leave', color: 'yellow' },
        { value: AttendanceStatus.HalfDay, label: 'Half Day', color: 'indigo' },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Mark Attendance for ${employee.fullName} on ${date}`} size="lg">
            <div className="space-y-6">
                {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert"><p>{error}</p></div>}
                <div>
                    <h3 className="text-md font-medium text-slate-700 mb-2">Select Status</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {statusOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setStatus(opt.value)}
                                className={`p-3 rounded-md text-sm font-semibold transition-all duration-200 border-2 ${
                                    status === opt.value
                                        ? `bg-${opt.color}-500 text-white border-${opt.color}-500 ring-2 ring-offset-2 ring-${opt.color}-400`
                                        : `bg-white text-slate-700 border-slate-300 hover:bg-${opt.color}-50 hover:border-${opt.color}-400`
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">
                        Reason (Required)
                    </label>
                    <textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder={`e.g., "Personal emergency", "Annual leave application approved on..."`}
                    />
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                    <button onClick={handleMarkPresent} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Mark as Present</button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
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
        // Get yesterday's date string
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

        // Find employees who were absent yesterday
        const yesterdayAbsentees = new Set<string>();
        state.attendanceRecords.forEach(record => {
            if (record.date === yesterdayStr && record.status === AttendanceStatus.Absent) {
                yesterdayAbsentees.add(record.employeeId);
            }
        });

        // Get active employees and sort them
        const activeEmployees = state.employees.filter(emp => emp.status === 'Active');

        activeEmployees.sort((a, b) => {
            const aWasAbsent = yesterdayAbsentees.has(a.id);
            const bWasAbsent = yesterdayAbsentees.has(b.id);

            if (aWasAbsent && !bWasAbsent) {
                return -1; // a comes first
            }
            if (!aWasAbsent && bWasAbsent) {
                return 1; // b comes first
            }
            // If both were absent or both were present, sort alphabetically
            return a.fullName.localeCompare(b.fullName);
        });

        // Apply the employee filter if one is selected
        if (!selectedEmployeeId) {
            return activeEmployees;
        }
        return activeEmployees.filter(emp => emp.id === selectedEmployeeId);

    }, [state.employees, selectedEmployeeId, state.attendanceRecords]);
    
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
            case AttendanceStatus.Absent: return 'bg-red-500 text-white';
            case AttendanceStatus.PaidLeave: return 'bg-blue-500 text-white';
            case AttendanceStatus.SickLeave: return 'bg-yellow-400 text-black';
            case AttendanceStatus.HalfDay: return 'bg-indigo-500 text-white';
            case AttendanceStatus.Holiday: return 'bg-green-500 text-white';
            case 'P':
            default: return 'bg-transparent text-slate-400';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center space-x-2">
                    <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-md hover:bg-slate-200">&larr;</button>
                    <h2 className="text-2xl font-bold text-slate-800 w-48 text-center">
                        {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={() => handleMonthChange(1)} className="p-2 rounded-md hover:bg-slate-200">&rarr;</button>
                </div>
                <div className="w-full md:w-1/3">
                    <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-md bg-white"
                    >
                        <option value="">All Employees</option>
                        {state.employees.filter(emp => emp.status === 'Active').map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="w-full text-left table-fixed">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr>
                            <th className="p-2 font-semibold text-slate-600 w-48 sticky left-0 bg-slate-50 z-20">Employee</th>
                            {daysInMonth.map(day => (
                                <th key={day} className="p-2 font-semibold text-slate-600 text-center w-12">{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.map(employee => (
                            <tr key={employee.id} className="border-t hover:bg-slate-50">
                                <td className="p-2 text-slate-700 font-medium whitespace-nowrap overflow-hidden text-ellipsis sticky left-0 bg-white hover:bg-slate-50 z-10 border-r">{employee.fullName}</td>
                                {daysInMonth.map(day => {
                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const key = `${employee.id}-${dateStr}`;
                                    const record = attendanceMap.get(key);
                                    const status = record ? record.status : 'P';

                                    return (
                                        <td key={day} className="p-1 text-center border-l">
                                            <button
                                                onClick={() => handleCellClick(employee, day)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold transition-transform hover:scale-110 ${getStatusStyle(status)}`}
                                                title={record?.reason || 'Present'}
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
                 {filteredEmployees.length === 0 && <p className="text-center text-slate-500 py-6">No employees match your search.</p>}
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