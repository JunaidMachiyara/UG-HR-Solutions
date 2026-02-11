
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { Employee, OvertimePressRecord, UserProfile } from '../types.ts';

const OvertimePressRegister: React.FC<{ userProfile: UserProfile | null }> = ({ userProfile }) => {
    const { state, dispatch } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'Grid' | 'MachineTool'>('Grid');

    // Search and Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [sectionFilter, setSectionFilter] = useState('');

    // Tool State
    const [toolData, setToolData] = useState({
        date: new Date().toISOString().split('T')[0],
        machineId: '1',
        extraBales: '', 
        ratePerExtra: '5',
        selectedWorkerIds: [] as string[]
    });

    const { month, year, daysInMonth } = useMemo(() => {
        const date = new Date(currentDate);
        const month = date.getMonth();
        const year = date.getFullYear();
        const numDays = new Date(year, month + 1, 0).getDate();
        return { month, year, daysInMonth: Array.from({ length: numDays }, (_, i) => i + 1) };
    }, [currentDate]);

    // Unique sections for the filter dropdown
    const availableSections = useMemo(() => {
        const sections = new Set(state.employees.map(e => e.section).filter(Boolean));
        return Array.from(sections).sort();
    }, [state.employees]);

    // Filtered list based on Search and Section
    const filteredEmployees = useMemo(() => {
        return state.employees
            .filter(emp => emp.status === 'Active')
            .filter(emp => {
                const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                     emp.id.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesSection = !sectionFilter || emp.section === sectionFilter;
                return matchesSearch && matchesSection;
            })
            .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }, [state.employees, searchTerm, sectionFilter]);

    const selectedWorkers = useMemo(() => {
        return state.employees.filter(emp => toolData.selectedWorkerIds.includes(emp.id));
    }, [state.employees, toolData.selectedWorkerIds]);

    const overtimeMap = useMemo(() => {
        const map = new Map<string, OvertimePressRecord>();
        state.overtimePressRecords.forEach(record => {
            const key = `${record.employeeId}-${record.date}`;
            map.set(key, record);
        });
        return map;
    }, [state.overtimePressRecords]);

    const handleMonthChange = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const handleGridChange = (employeeId: string, day: number, value: string) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hours = parseFloat(value);
        const existing = overtimeMap.get(`${employeeId}-${dateStr}`);

        if (isNaN(hours) || hours === 0) {
            if (existing) dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'overtimePressRecords', id: existing.id } });
            return;
        }

        const record: OvertimePressRecord = { id: existing?.id || `OTP-${employeeId}-${dateStr}`, employeeId, date: dateStr, hours };
        existing ? dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'overtimePressRecords', data: record } }) : dispatch({ type: 'ADD_ENTITY', payload: { entity: 'overtimePressRecords', data: record } });
    };

    const handleSaveProductionTeam = () => {
        const { extraBales, ratePerExtra, selectedWorkerIds, date } = toolData;
        const extra = Number(extraBales);
        const rate = Number(ratePerExtra);

        if (extra <= 0) {
            alert("Please enter the number of extra bales produced.");
            return;
        }
        if (selectedWorkerIds.length === 0) {
            alert("Please select the workers who were present for this session.");
            return;
        }

        const totalPool = extra * rate;
        const individualShare = totalPool / selectedWorkerIds.length;

        if (!window.confirm(`Extra Bales: ${extra}\nTotal Pool: AED ${totalPool.toFixed(2)}\nTeam Size: ${selectedWorkerIds.length}\nShare per Worker: AED ${individualShare.toFixed(2)}\n\nProcess this distribution?`)) return;

        const batchActions = selectedWorkerIds.map(workerId => {
            const existing = overtimeMap.get(`${workerId}-${date}`);
            const record: OvertimePressRecord = {
                id: existing?.id || `OTP-${workerId}-${date}`,
                employeeId: workerId,
                date,
                hours: existing?.hours || 0,
                amount: (existing?.amount || 0) + individualShare
            };
            return existing 
                ? { type: 'UPDATE_ENTITY', payload: { entity: 'overtimePressRecords', data: record } }
                : { type: 'ADD_ENTITY', payload: { entity: 'overtimePressRecords', data: record } };
        });

        dispatch({ type: 'BATCH_UPDATE', payload: batchActions });

        alert(`Success! AED ${totalPool.toFixed(2)} distributed among ${selectedWorkerIds.length} workers.`);
        setToolData(prev => ({ ...prev, selectedWorkerIds: [], extraBales: '' }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 no-print">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-md hover:bg-white hover:shadow-sm transition-all">&larr;</button>
                        <h2 className="text-sm font-bold text-slate-800 w-36 text-center uppercase">
                            {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button onClick={() => handleMonthChange(1)} className="p-2 rounded-md hover:bg-white hover:shadow-sm transition-all">&rarr;</button>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('Grid')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'Grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Manual Grid</button>
                        <button onClick={() => setViewMode('MachineTool')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'MachineTool' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Team Production Tool</button>
                    </div>
                </div>
            </div>

            {viewMode === 'Grid' ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-lg">
                    <table className="w-full text-left table-fixed border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-3 font-black text-slate-600 w-48 sticky left-0 bg-slate-50 z-20 border-r border-slate-200">Employee</th>
                                {daysInMonth.map(day => (
                                    <th key={day} className="p-2 font-bold text-slate-500 text-center w-12 border-r border-slate-100 text-[10px]">{day}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {state.employees.filter(e => e.status === 'Active').sort((a,b) => a.fullName.localeCompare(b.fullName)).map(employee => (
                                <tr key={employee.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-50">
                                    <td className="p-3 text-slate-800 font-bold whitespace-nowrap overflow-hidden text-ellipsis sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 text-xs uppercase">{employee.fullName}</td>
                                    {daysInMonth.map(day => {
                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const record = overtimeMap.get(`${employee.id}-${dateStr}`);
                                        return (
                                            <td key={day} className="p-1 border-r border-slate-50">
                                                <input
                                                    type="number"
                                                    value={record?.hours || ''}
                                                    onChange={(e) => handleGridChange(employee.id, day, e.target.value)}
                                                    className={`w-full h-8 text-center bg-transparent border-0 focus:ring-2 focus:ring-blue-500 text-[10px] font-black ${record?.amount ? 'text-green-600 bg-green-50' : 'text-slate-700'}`}
                                                    placeholder="-"
                                                    title={record?.amount ? `Bonus Amount: AED ${record.amount.toFixed(2)}` : ''}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="max-w-6xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="border-b pb-4">
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Team Production Allocation</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Distribute bonus among specific workers</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Payout Details (Left) */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Production Date</label>
                                    <input type="date" value={toolData.date} onChange={e => setToolData({...toolData, date: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Machine</label>
                                        <select value={toolData.machineId} onChange={e => setToolData({...toolData, machineId: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800">
                                            <option value="1">Machine 1</option>
                                            <option value="2">Machine 2</option>
                                            <option value="3">Machine 3</option>
                                            <option value="4">Machine 4</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Rate (AED)</label>
                                        <input type="number" value={toolData.ratePerExtra} onChange={e => setToolData({...toolData, ratePerExtra: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-blue-500 uppercase mb-1">Extra Bales Produced</label>
                                    <input 
                                        type="number" 
                                        value={toolData.extraBales} 
                                        onChange={e => setToolData({...toolData, extraBales: e.target.value})} 
                                        className="w-full p-4 border-2 border-blue-500 rounded-xl font-black text-blue-600 focus:ring-0 outline-none text-2xl" 
                                        placeholder="0" 
                                    />
                                </div>
                            </div>

                            <div className="p-5 bg-slate-900 rounded-2xl text-white space-y-4 shadow-inner">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-300">Total Pool:</span>
                                    <span className="text-xl font-black text-green-400">AED {(Number(toolData.extraBales) * Number(toolData.ratePerExtra)).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                                    <span className="text-xs font-bold text-slate-300">Share Per Person:</span>
                                    <span className="text-2xl font-black text-blue-400">
                                        AED {(toolData.selectedWorkerIds.length > 0 ? (Number(toolData.extraBales) * Number(toolData.ratePerExtra)) / toolData.selectedWorkerIds.length : 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Selected Team Mini List */}
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-[10px] font-black text-blue-600 uppercase">Selected Team ({selectedWorkers.length})</h4>
                                    {selectedWorkers.length > 0 && (
                                        <button onClick={() => setToolData(p => ({...p, selectedWorkerIds: []}))} className="text-[10px] font-black text-red-500 uppercase hover:underline">Clear All</button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedWorkers.map(w => (
                                        <div key={w.id} className="bg-white px-2 py-1 rounded-md text-[10px] font-bold text-blue-700 shadow-sm border border-blue-200 flex items-center gap-1">
                                            {w.fullName}
                                            <button onClick={() => setToolData(p => ({...p, selectedWorkerIds: p.selectedWorkerIds.filter(id => id !== w.id)}))} className="text-blue-300 hover:text-red-500">×</button>
                                        </div>
                                    ))}
                                    {selectedWorkers.length === 0 && <span className="text-[10px] text-slate-400 italic">No workers selected yet.</span>}
                                </div>
                            </div>
                        </div>

                        {/* Worker Selection (Right) */}
                        <div className="lg:col-span-8 flex flex-col h-[600px]">
                            {/* Search and Filters */}
                            <div className="bg-slate-100 p-3 rounded-t-2xl flex flex-col md:flex-row gap-3">
                                <div className="flex-grow relative">
                                    <input 
                                        type="text" 
                                        value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)} 
                                        placeholder="Search by Name or Employee Code..." 
                                        className="w-full p-2.5 pl-10 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                    />
                                    <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <select 
                                    value={sectionFilter} 
                                    onChange={e => setSectionFilter(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700"
                                >
                                    <option value="">All Sections</option>
                                    {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Scrollable Grid */}
                            <div className="flex-grow overflow-y-auto p-4 border-x border-slate-100 bg-slate-50/30 custom-scrollbar grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                {filteredEmployees.map(emp => {
                                    const isSelected = toolData.selectedWorkerIds.includes(emp.id);
                                    return (
                                        <button
                                            key={emp.id}
                                            onClick={() => {
                                                setToolData(prev => ({
                                                    ...prev,
                                                    selectedWorkerIds: isSelected
                                                        ? prev.selectedWorkerIds.filter(id => id !== emp.id)
                                                        : [...prev.selectedWorkerIds, emp.id]
                                                }));
                                            }}
                                            className={`p-3 text-left rounded-xl transition-all flex flex-col border-2 ${
                                                isSelected 
                                                    ? 'bg-blue-600 text-white border-blue-700 shadow-md scale-[0.98]' 
                                                    : 'bg-white text-slate-700 border-white hover:border-slate-200 shadow-sm'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className="text-[10px] font-black opacity-60 uppercase">{emp.id}</span>
                                                {isSelected && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                                            </div>
                                            <span className="text-xs font-black uppercase truncate">{emp.fullName}</span>
                                            <span className={`text-[9px] font-bold uppercase mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                                {emp.section || 'General'}
                                            </span>
                                        </button>
                                    );
                                })}
                                {filteredEmployees.length === 0 && (
                                    <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                        No workers found matching "{searchTerm}"
                                    </div>
                                )}
                            </div>
                            
                            <div className="bg-slate-100 p-3 rounded-b-2xl">
                                <button
                                    onClick={handleSaveProductionTeam}
                                    disabled={!toolData.extraBales || toolData.selectedWorkerIds.length === 0}
                                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black disabled:opacity-30 transition-all shadow-xl active:scale-95"
                                >
                                    Process & Allocate to {toolData.selectedWorkerIds.length} Selected Workers
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OvertimePressRegister;
