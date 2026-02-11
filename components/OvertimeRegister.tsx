import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { Employee, OvertimeRecord, UserProfile } from '../types.ts';
import EntitySelector from './ui/EntitySelector.tsx';

const OvertimeRegister: React.FC<{ userProfile: UserProfile | null }> = ({ userProfile }) => {
    const { state, dispatch } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Filter states
    const [filterNameId, setFilterNameId] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [filterVisaStart, setFilterVisaStart] = useState('');
    const [filterVisaEnd, setFilterVisaEnd] = useState('');
    const [filterJoiningStart, setFilterJoiningStart] = useState('');
    const [filterJoiningEnd, setFilterJoiningEnd] = useState('');

    const { month, year, daysInMonth } = useMemo(() => {
        const date = new Date(currentDate);
        const month = date.getMonth();
        const year = date.getFullYear();
        const numDays = new Date(year, month + 1, 0).getDate();
        const days = Array.from({ length: numDays }, (_, i) => i + 1);
        return { month, year, daysInMonth: days };
    }, [currentDate]);

    const uniqueSections = useMemo(() => {
        const fromEmployees = Array.from(new Set(state.employees.map(e => e.section).filter(Boolean)));
        const fromSections = state.sections.map(s => s.name);
        return Array.from(new Set([...fromSections, ...fromEmployees])).sort();
    }, [state.employees, state.sections]);

    const filteredEmployees = useMemo(() => {
        const activeEmployees = state.employees.filter(emp => {
            if (emp.status !== 'Active') return false;

            const matchesName = !filterNameId || emp.id === filterNameId || emp.fullName.toLowerCase().includes(filterNameId.toLowerCase());
            const matchesType = !filterType || emp.employeeType === filterType;
            const matchesSection = !filterSection || emp.section === filterSection;

            const visaDate = emp.visaExpiryDate || '';
            const matchesVisa = (!filterVisaStart || visaDate >= filterVisaStart) &&
                                (!filterVisaEnd || visaDate <= filterVisaEnd);
            
            const joiningDate = emp.joiningDate || '';
            const matchesJoining = (!filterJoiningStart || joiningDate >= filterJoiningStart) &&
                                   (!filterJoiningEnd || joiningDate <= filterJoiningEnd);
            
            return matchesName && matchesType && matchesSection && matchesVisa && matchesJoining;
        });
        
        activeEmployees.sort((a, b) => a.fullName.localeCompare(b.fullName));
        return activeEmployees;
    }, [state.employees, filterNameId, filterType, filterSection, filterVisaStart, filterVisaEnd, filterJoiningStart, filterJoiningEnd]);
    
    const overtimeMap = useMemo(() => {
        const map = new Map<string, OvertimeRecord>();
        state.overtimeRecords.forEach(record => {
            const key = `${record.employeeId}-${record.date}`;
            map.set(key, record);
        });
        return map;
    }, [state.overtimeRecords]);

    const handleMonthChange = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };
    
    const resetFilters = () => {
        setFilterNameId('');
        setFilterType('');
        setFilterSection('');
        setFilterVisaStart('');
        setFilterVisaEnd('');
        setFilterJoiningStart('');
        setFilterJoiningEnd('');
    };

    const handleOvertimeChange = (employeeId: string, day: number, value: string) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const key = `${employeeId}-${dateStr}`;
        const hours = parseFloat(value);
        
        const existingRecord = overtimeMap.get(key);

        if (isNaN(hours) || hours === 0) {
            if (existingRecord) {
                dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'overtimeRecords', id: existingRecord.id } });
            }
            return;
        }

        const record: OvertimeRecord = {
            id: existingRecord?.id || `OT-${employeeId}-${dateStr}`,
            employeeId,
            date: dateStr,
            hours
        };

        if (existingRecord) {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'overtimeRecords', data: record } });
        } else {
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'overtimeRecords', data: record } });
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
                    <button 
                        onClick={() => setIsFilterOpen(!isFilterOpen)} 
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors border ${isFilterOpen ? 'bg-slate-800 text-white border-slate-900 shadow-inner' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filters
                        {(filterNameId || filterType || filterSection || filterVisaStart || filterVisaEnd || filterJoiningStart || filterJoiningEnd) && (
                            <span className="flex h-2 w-2 rounded-full bg-red-500"></span>
                        )}
                    </button>
                    <p className="text-sm text-slate-500 font-medium hidden md:block">Enter OT hours in the grid below</p>
                </div>
            </div>

            {/* Filter Panel */}
            {isFilterOpen && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-inner shrink-0 no-print relative z-40">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Search Name</label>
                            <EntitySelector 
                                entities={state.employees.map(e => ({ id: e.id, name: e.fullName }))}
                                selectedEntityId={filterNameId}
                                onSelect={setFilterNameId}
                                placeholder="Name or Code..."
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                            <EntitySelector 
                                entities={[
                                    { id: 'Labour', name: 'Labour' },
                                    { id: 'Office', name: 'Office' }
                                ]}
                                selectedEntityId={filterType}
                                onSelect={setFilterType}
                                placeholder="Select Type..."
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Section</label>
                            <EntitySelector 
                                entities={uniqueSections.map(s => ({ id: s, name: s }))}
                                selectedEntityId={filterSection}
                                onSelect={setFilterSection}
                                placeholder="Select Section..."
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Visa Expiry</label>
                            <div className="flex gap-1">
                                <input type="date" value={filterVisaStart} onChange={e => setFilterVisaStart(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-xs text-slate-900" style={{ backgroundColor: 'white' }} />
                                <input type="date" value={filterVisaEnd} onChange={e => setFilterVisaEnd(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-xs text-slate-900" style={{ backgroundColor: 'white' }} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Joining Date</label>
                            <div className="flex gap-1">
                                <input type="date" value={filterJoiningStart} onChange={e => setFilterJoiningStart(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-xs text-slate-900" style={{ backgroundColor: 'white' }} />
                                <input type="date" value={filterJoiningEnd} onChange={e => setFilterJoiningEnd(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-xs text-slate-900" style={{ backgroundColor: 'white' }} />
                            </div>
                        </div>
                        <div className="lg:col-span-5 flex justify-end">
                             <button onClick={resetFilters} className="px-4 py-1.5 bg-slate-200 text-slate-600 rounded-md font-bold text-xs hover:bg-slate-300 transition-colors">Reset All Filters</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-lg">
                <table className="w-full text-left table-fixed border-collapse">
                    <thead>
                        <tr className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200">
                            <th className="p-3 font-bold text-slate-600 w-48 sticky left-0 bg-slate-50/80 z-20 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Employee</th>
                            {daysInMonth.map(day => (
                                <th key={day} className="p-3 font-bold text-slate-500 text-center w-14 border-r border-slate-100">{day}</th>
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
                                    const record = overtimeMap.get(key);
                                    
                                    return (
                                        <td key={day} className="p-1 border-r border-slate-50">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.5"
                                                value={record ? record.hours : ''}
                                                onChange={(e) => handleOvertimeChange(employee.id, day, e.target.value)}
                                                className="w-full h-8 text-center bg-transparent border-0 focus:ring-0 text-xs font-bold text-slate-700 placeholder-slate-200"
                                                placeholder="-"
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredEmployees.length === 0 && (
                    <div className="text-center py-20 bg-slate-50">
                        <p className="text-slate-400 font-medium">No active employees found matching the filters.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default OvertimeRegister;