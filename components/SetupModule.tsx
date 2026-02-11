
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData, db, auth, allPermissions } from '../context/DataContext.tsx';
import { 
    UserProfile, Module, Employee, AttendanceStatus, 
    HRTask, HREnquiry, Vehicle, VehicleStatus, JournalEntry, JournalEntryType, Currency
} from '../types.ts';
import { generateEmployeeId, generateVehicleId } from '../utils/idGenerator.ts';
import Modal from './ui/Modal.tsx';
import AttendanceRegister from './AttendanceRegister.tsx';
import OvertimeRegister from './OvertimeRegister.tsx';
import OvertimePressRegister from './OvertimePressRegister.tsx';
import SalaryCalculator from './SalaryCalculator.tsx';
import EntitySelector from './ui/EntitySelector.tsx';

// --- Shared Notification Component ---
const Notification: React.FC<{ message: string; onTimeout: () => void }> = ({ message, onTimeout }) => {
    useEffect(() => {
        const timer = setTimeout(onTimeout, 3000);
        return () => clearTimeout(timer);
    }, [onTimeout]);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out">
            {message}
        </div>
    );
};

// --- Settlement Register Component ---
const SettlementRegister: React.FC = () => {
    const { state, dispatch } = useData();
    const [selectedId, setSelectedId] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paidGratuityInput, setPaidGratuityInput] = useState('');
    const [paidLeaveInput, setPaidLeaveInput] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank'>('Cash');
    const [notification, setNotification] = useState<string | null>(null);

    const activeEmployees = useMemo(() => 
        state.employees
            .filter(e => e.status === 'Active')
            .map(e => ({ id: e.id, name: `${e.fullName} (${e.id})` }))
            .sort((a, b) => a.name.localeCompare(b.name))
    , [state.employees]);

    const selectedEmployee = useMemo(() => 
        state.employees.find(e => e.id === selectedId)
    , [selectedId, state.employees]);

    const stats = useMemo(() => {
        if (!selectedEmployee) return null;
        
        const joinDate = new Date(selectedEmployee.joiningDate);
        const today = new Date();
        const yearsOfService = Math.max(0, (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

        // Gratuity: 600 per year for Labor
        const totalAccruedGratuity = selectedEmployee.employeeType === 'Labour' ? yearsOfService * 600 : 0;
        const dueGratuity = Math.max(0, totalAccruedGratuity - (selectedEmployee.gratuityPaid || 0));

        // REVISED LAW: Vacations (Paid) 600 AED Per Year
        const totalAccruedLeave = yearsOfService * 600;
        const dueLeave = Math.max(0, totalAccruedLeave - (selectedEmployee.leaveSalaryPaid || 0));

        return {
            yearsOfService,
            totalAccruedGratuity,
            dueGratuity,
            totalAccruedLeave,
            dueLeave
        };
    }, [selectedEmployee]);

    // Update inputs when employee changes to suggest full settlement
    useEffect(() => {
        if (stats) {
            setPaidGratuityInput(stats.dueGratuity.toFixed(2));
            setPaidLeaveInput(stats.dueLeave.toFixed(2));
        } else {
            setPaidGratuityInput('');
            setPaidLeaveInput('');
        }
    }, [stats]);

    const handleRecordSettlement = () => {
        if (!selectedEmployee || !stats) return;

        const gratuityToPay = Number(paidGratuityInput) || 0;
        const leaveToPay = Number(paidLeaveInput) || 0;

        if (gratuityToPay <= 0 && leaveToPay <= 0) {
            alert("Please enter a payment amount for Gratuity or Leave Salary.");
            return;
        }

        const confirmMsg = `Record settlement for ${selectedEmployee.fullName}?\n\n` +
                          `Gratuity Paid: AED ${gratuityToPay.toLocaleString()}\n` +
                          `Leave Paid: AED ${leaveToPay.toLocaleString()}\n` +
                          `Method: ${paymentMethod}\n` +
                          `Date: ${paymentDate}`;

        if (!window.confirm(confirmMsg)) return;

        // 1. Update Employee Record (Accumulate paid amounts)
        const updatedEmployee: Employee = {
            ...selectedEmployee,
            gratuityPaid: (selectedEmployee.gratuityPaid || 0) + gratuityToPay,
            leaveSalaryPaid: (selectedEmployee.leaveSalaryPaid || 0) + leaveToPay,
            vacationHistory: (selectedEmployee.vacationHistory || '') + 
                ` [SETTLED: ${paymentDate}, G: ${gratuityToPay}, L: ${leaveToPay}]`
        };

        // 2. Dispatch update
        dispatch({
            type: 'UPDATE_ENTITY',
            payload: { entity: 'employees', data: updatedEmployee }
        });

        setNotification(`Settlement recorded for ${selectedEmployee.fullName}. balances updated.`);
        setSelectedId(''); // Reset for next use
    };

    const labelClass = "block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5";
    const inputClass = "w-full p-3 bg-slate-900 text-white border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all";

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
            
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                <div className="mb-8">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Biennial Settlement Tool</h3>
                    <p className="text-sm text-slate-500 font-medium">Process Gratuity and Leave Salary payments (Typically every 2 years).</p>
                </div>

                <div className="space-y-8">
                    {/* Search Section */}
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <label className={labelClass}>Search Employee</label>
                        <EntitySelector 
                            entities={activeEmployees}
                            selectedEntityId={selectedId}
                            onSelect={setSelectedId}
                            placeholder="Type name or code to find employee..."
                        />
                    </div>

                    {selectedEmployee && stats ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Summary Stats */}
                            <div className="space-y-6">
                                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                                    <div className="flex justify-between items-start border-b pb-4">
                                        <div>
                                            <h4 className="text-lg font-black text-slate-900 uppercase">{selectedEmployee.fullName}</h4>
                                            <p className="text-xs font-bold text-slate-400">Joined: {selectedEmployee.joiningDate}</p>
                                        </div>
                                        <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                                            {stats.yearsOfService.toFixed(2)} YRS SERVICE
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Gratuity Due</p>
                                            <p className="text-xl font-black text-indigo-700">AED {stats.dueGratuity.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Leave Due</p>
                                            <p className="text-xl font-black text-blue-700">AED {stats.dueLeave.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-50 space-y-2">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-slate-500 font-bold uppercase">Accrued Gratuity (Total)</span>
                                            <span className="text-slate-800 font-black">AED {stats.totalAccruedGratuity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-slate-500 font-bold uppercase">Accrued Leave (Total)</span>
                                            <span className="text-slate-800 font-black">AED {stats.totalAccruedLeave.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Form */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className={labelClass}>Payment Date</label>
                                        <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Gratuity to Pay</label>
                                        <input 
                                            type="number" 
                                            value={paidGratuityInput} 
                                            onChange={e => setPaidGratuityInput(e.target.value)} 
                                            className={inputClass}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Leave Salary to Pay</label>
                                        <input 
                                            type="number" 
                                            value={paidLeaveInput} 
                                            onChange={e => setPaidLeaveInput(e.target.value)} 
                                            className={inputClass}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className={labelClass}>Payment Method</label>
                                        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                            {(['Cash', 'Bank'] as const).map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => setPaymentMethod(m)}
                                                    className={`flex-grow py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                                        paymentMethod === m ? 'bg-white text-blue-600 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleRecordSettlement}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-black hover:scale-[1.01] active:scale-95 transition-all shadow-xl mt-4"
                                >
                                    Record Settlement
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                            <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Select an employee to start settlement</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Editable Spreadsheet Cell Component ---
interface EditableCellProps {
    value: any;
    field: keyof Employee;
    employeeId: string;
    type?: 'text' | 'number' | 'date' | 'select';
    options?: { label: string; value: any }[];
    onUpdate: (id: string, field: keyof Employee, value: any) => void;
    className?: string;
    placeholder?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, field, employeeId, type = 'text', options, onUpdate, className = "", placeholder }) => {
    const [localValue, setLocalValue] = useState(value ?? '');

    useEffect(() => {
        setLocalValue(value ?? '');
    }, [value]);

    const handleBlur = () => {
        if (localValue !== value) {
            let finalValue = localValue;
            if (type === 'number') {
                const cleaned = String(localValue).replace(/[^0-9.-]/g, '');
                finalValue = parseFloat(cleaned) || 0;
            }
            onUpdate(employeeId, field, finalValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.target as HTMLElement).blur();
        }
    };

    const cellStyle: React.CSSProperties = {
        backgroundColor: 'transparent',
        color: '#0f172a',
        border: 'none',
        padding: '2px 4px',
        fontSize: '11px',
        width: '100%',
        height: '100%',
        fontWeight: 500,
    };

    if (type === 'select' && options) {
        return (
            <select
                value={localValue}
                onChange={(e) => {
                    const val = e.target.value;
                    setLocalValue(val);
                    onUpdate(employeeId, field, val);
                }}
                className="appearance-none cursor-pointer focus:outline-none"
                style={{ ...cellStyle, backgroundImage: 'none', paddingRight: '4px' }}
            >
                {options.map(opt => <option key={opt.value} value={opt.value} className="bg-white text-slate-900">{opt.label}</option>)}
            </select>
        );
    }

    return (
        <input
            type={type === 'number' ? 'text' : type}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-slate-300 ${className}`}
            style={cellStyle}
        />
    );
};

// --- Bulk Upload Utility Component ---
const BulkEmployeeSync: React.FC<{ isOpen: boolean; onClose: () => void; showNotification: (msg: string) => void }> = ({ isOpen, onClose, showNotification }) => {
    const { state, dispatch } = useData();
    const [parsedData, setParsedData] = useState<Partial<Employee>[]>([]);
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const downloadTemplate = () => {
        const headers = [
            "CODE", "NAME (AS PER EID)", "EMPLOYEE TYPE (Office/Labour)", "SECTION", "DEPARTMENT", 
            "FIRST VISA APPLICATION DATE (YYYY-MM-DD)", "CURRENT VISA APPLICATION DATE (YYYY-MM-DD)", "CURRENT VISA EXPIRY DATE (YYYY-MM-DD)",
            "LEAVE SALARY PAYABLE", "LEAVE SALARY PAID", "GRATUITY PAYABLE", "GRATUITY PAID", "VACATION HISTORY",
            "BASIC SALARY", "ALLOWANCES", "OTHER EXPS", "LAST INCREMENT", "ACCOMODATION", "VISA CUTTING TERMS",
            "NATIONALITY", "JOINING DATE (YYYY-MM-DD)", "DESIGNATION"
        ];
        
        const sampleRow = [
            "LBR-001", "ABDULLAH ABDUL KARIM", "Labour", "CREAM", "Operations",
            "2024-11-13", "", "2026-11-12",
            "1200", "0", "1200", "0", "",
            "1200", "500", "400", "01/10/2024=01/05/2025", "BUILDING NO J01= ROOM NO SF06", "N/A",
            "Pakistan", "2024-11-13", "Worker"
        ];
        
        const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "employee_bulk_sync_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const sanitizeNumber = (val: string | undefined): number => {
        if (!val || val.trim() === '') return 0;
        const cleaned = val.replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    const parseCSV = (text: string) => {
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"' && text[i+1] === '"') { currentField += '"'; i++; }
            else if (char === '"') { inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { currentRow.push(currentField); currentField = ''; }
            else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (currentField || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = ''; }
                if (char === '\r' && text[i+1] === '\n') i++;
            } else { currentField += char; }
        }
        if (currentField || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow); }
        return rows;
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = parseCSV(text);
            if (rows.length < 2) { alert("The CSV file seems empty or missing data rows."); return; }
            const headers = rows[0].map(h => h.trim().toUpperCase());
            const dataRows = rows.slice(1);
            const employees: Partial<Employee>[] = dataRows.map(row => {
                const emp: any = {};
                headers.forEach((header, index) => {
                    const val = row[index]?.trim();
                    if (!val && val !== '0') return;
                    if (header.includes('NAME')) emp.fullName = val;
                    else if (header.includes('TYPE')) emp.employeeType = val.toLowerCase().includes('labour') ? 'Labour' : 'Office';
                    else if (header.includes('SECTION')) emp.section = val;
                    else if (header.includes('DEPARTMENT')) emp.department = val;
                    else if (header.includes('FIRST VISA')) emp.firstVisaAppDate = val;
                    else if (header.includes('CURRENT VISA APPLICATION')) emp.currentVisaAppDate = val;
                    else if (header.includes('EXPIRY')) emp.visaExpiryDate = val;
                    else if (header.includes('LEAVE SALARY PAYABLE')) emp.leaveSalaryPayable = sanitizeNumber(val);
                    else if (header.includes('LEAVE SALARY PAID')) emp.leaveSalaryPaid = sanitizeNumber(val);
                    else if (header.includes('GRATUITY PAYABLE')) emp.gratuityPayable = sanitizeNumber(val);
                    else if (header.includes('GRATUITY PAID')) emp.gratuityPaid = sanitizeNumber(val);
                    else if (header.includes('VACATION HISTORY')) emp.vacationHistory = val;
                    else if (header.includes('BASIC SALARY') || header === 'BASIC') emp.basicSalary = sanitizeNumber(val);
                    else if (header.includes('ALLOWANCE')) emp.allowance = sanitizeNumber(val);
                    else if (header.includes('OTHER EXPS')) emp.otherExps = sanitizeNumber(val);
                    else if (header.includes('LAST INCREMENT')) emp.lastIncrement = val;
                    else if (header.includes('ACCOMODATION') || header.includes('ACCOMMODATION')) emp.accommodation = val;
                    else if (header.includes('VISA CUTTING TERMS')) emp.visaCuttingTerms = val;
                    else if (header.includes('NATIONALITY')) emp.nationality = val;
                    else if (header.includes('JOINING')) emp.joiningDate = val;
                    else if (header.includes('DESIGNATION')) emp.designation = val;
                    else if (header === 'CODE' || header === 'ID') emp.id = val;
                });
                return emp;
            }).filter(e => e.fullName);
            setParsedData(employees);
        };
        reader.readAsText(file);
    };

    const handleConfirmImport = () => {
        if (parsedData.length === 0) return;
        const batchActions: any[] = [];
        let currentEmployeesInState = [...state.employees];
        parsedData.forEach(empData => {
            const type = (empData.employeeType || 'Labour') as 'Office' | 'Labour';
            const finalId = empData.id || generateEmployeeId(currentEmployeesInState, type);
            const newEmp: Employee = {
                id: finalId, employeeType: type, fullName: empData.fullName || '', section: empData.section || '', department: empData.department || '', designation: empData.designation || '', joiningDate: empData.joiningDate || new Date().toISOString().split('T')[0], basicSalary: Number(empData.basicSalary) || 0, allowance: Number(empData.allowance) || 0, otherExps: Number(empData.otherExps) || 0, leaveSalaryPayable: Number(empData.leaveSalaryPayable) || 0, leaveSalaryPaid: Number(empData.leaveSalaryPaid) || 0, gratuityPayable: Number(empData.gratuityPayable) || 0, gratuityPaid: Number(empData.gratuityPaid) || 0, vacationHistory: empData.vacationHistory || '', lastIncrement: empData.lastIncrement || '', accommodation: empData.accommodation || '', visaCuttingTerms: empData.visaCuttingTerms || '', nationality: empData.nationality || 'N/A', dateOfBirth: empData.dateOfBirth || '', status: 'Active', onDuty: true, companyVisa: true, firstVisaAppDate: empData.firstVisaAppDate || '', currentVisaAppDate: empData.currentVisaAppDate || '', visaExpiryDate: empData.visaExpiryDate || '', address: '', phone: '', email: '', bankName: '', accountNumber: '', advances: 0, startingBalance: 0,
            };
            batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'employees', data: newEmp } });
            currentEmployeesInState.push(newEmp);
        });
        dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
        showNotification(`Successfully synced ${parsedData.length} employees.`);
        onClose();
        setParsedData([]);
        setFileName('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bulk Employee Sync" size="4xl">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border rounded-lg flex flex-col justify-between">
                        <div className="space-y-1">
                            <h4 className="font-bold text-slate-800">1. Prepare Data</h4>
                            <p className="text-sm text-slate-500">Download the detailed template with all accounting fields.</p>
                        </div>
                        <button onClick={downloadTemplate} className="mt-4 px-4 py-2 bg-slate-200 text-slate-700 rounded-md font-semibold hover:bg-slate-300 transition-colors flex items-center gap-2 justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download CSV Template
                        </button>
                    </div>
                    <div className="p-4 bg-slate-50 border rounded-lg flex flex-col justify-between">
                        <div className="space-y-1">
                            <h4 className="font-bold text-slate-800">2. Sync File</h4>
                            <p className="text-sm text-slate-500">Upload your CSV to preview and commit changes.</p>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
                            <button onClick={() => fileInputRef.current?.click()} className="flex-grow px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors">
                                {fileName ? `Replace: ${fileName}` : 'Select File'}
                            </button>
                        </div>
                    </div>
                </div>
                {parsedData.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h4 className="font-bold text-slate-800">Preview: {parsedData.length} Employees</h4>
                        </div>
                        <div className="max-h-72 overflow-y-auto border rounded-md bg-white">
                            <table className="w-full text-left table-auto text-[11px] text-slate-900 border-collapse">
                                <thead className="bg-slate-100 sticky top-0 text-slate-700">
                                    <tr><th className="p-2 font-semibold border-b">Code</th><th className="p-2 font-semibold border-b">Name</th><th className="p-2 font-semibold border-b">Section</th><th className="p-2 font-semibold border-b text-right">Basic</th><th className="p-2 font-semibold border-b text-right">Total Salary</th><th className="p-2 font-semibold border-b">Accommodation</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {parsedData.map((emp, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="p-2 font-mono text-slate-700">{emp.id || 'AUTO'}</td>
                                            <td className="p-2 font-medium text-slate-900">{emp.fullName}</td>
                                            <td className="p-2 text-slate-700">{emp.section}</td>
                                            <td className="p-2 text-right text-slate-900 font-bold">${(emp.basicSalary || 0).toLocaleString()}</td>
                                            <td className="p-2 text-right font-bold text-blue-700">${((emp.basicSalary || 0) + (emp.allowance || 0) + (emp.otherExps || 0)).toLocaleString()}</td>
                                            <td className="p-2 truncate max-w-[150px] text-slate-700">{emp.accommodation}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                    <button onClick={handleConfirmImport} disabled={parsedData.length === 0} className="px-8 py-2 bg-green-600 text-white rounded-md font-bold disabled:bg-slate-300 hover:bg-green-700 transition-colors shadow-md">Commit Sync</button>
                </div>
            </div>
        </Modal>
    );
};

// --- USER MANAGEMENT ---
const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<UserProfile> & { password?: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!db) return;
        const unsubscribe = db.collection('users').onSnapshot((snapshot: any) => {
            const userList: UserProfile[] = [];
            snapshot.forEach((doc: any) => {
                userList.push({ ...doc.data(), uid: doc.id });
            });
            setUsers(userList.sort((a, b) => a.name.localeCompare(b.name)));
        });
        return () => unsubscribe();
    }, []);

    const handleOpenModal = (user: UserProfile | null = null) => {
        setError(null);
        if (user) { setEditingUser({ ...user }); } else { setEditingUser({ name: '', email: '', password: '', isAdmin: false, permissions: [] }); }
        setIsModalOpen(true);
    };

    const handlePermissionToggle = (permission: string) => {
        if (!editingUser) return;
        const currentPermissions = editingUser.permissions || [];
        const newPermissions = currentPermissions.includes(permission) ? currentPermissions.filter(p => p !== permission) : [...currentPermissions, permission];
        setEditingUser({ ...editingUser, permissions: newPermissions });
    };

    const handleSaveUser = async () => {
        if (!editingUser?.name || !editingUser?.email) { setError("Name and Email are required."); return; }
        setIsLoading(true); setError(null);
        try {
            if (editingUser.uid) {
                await db.collection('users').doc(editingUser.uid).update({ name: editingUser.name, isAdmin: editingUser.isAdmin, permissions: editingUser.isAdmin ? allPermissions : editingUser.permissions, });
            } else {
                if (!editingUser.password || editingUser.password.length < 6) { throw new Error("Password must be at least 6 characters."); }
                const userCredential = await auth.createUserWithEmailAndPassword(editingUser.email, editingUser.password);
                const newUser = userCredential.user;
                if (newUser) { await db.collection('users').doc(newUser.uid).set({ name: editingUser.name, email: editingUser.email, isAdmin: editingUser.isAdmin, permissions: editingUser.isAdmin ? allPermissions : editingUser.permissions, }); }
            }
            setIsModalOpen(false); setEditingUser(null);
        } catch (err: any) { setError(err.message || "Failed to save user."); } finally { setIsLoading(false); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div><h3 className="text-xl font-bold text-slate-800">App Users</h3><p className="text-sm text-slate-500">Manage system access and permissions.</p></div>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">Create New User</button>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden text-slate-900 shadow-sm">
                <table className="w-full text-left table-auto">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr><th className="p-4 font-semibold">User Name</th><th className="p-4 font-semibold">Email Address</th><th className="p-4 font-semibold">Role</th><th className="p-4 font-semibold text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => (
                            <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-medium text-slate-900">{user.name}</td>
                                <td className="p-4 font-mono text-sm text-slate-600">{user.email}</td>
                                <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${user.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{user.isAdmin ? 'ADMIN' : 'USER'}</span></td>
                                <td className="p-4 text-right"><button onClick={() => handleOpenModal(user)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">Edit</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && editingUser && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser.uid ? `Edit User: ${editingUser.name}` : "Create New User"} size="3xl">
                    <div className="space-y-6">
                        {error && <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 md:col-span-1"><label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label><input type="text" value={editingUser.name || ''} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full p-2 border rounded-md" /></div>
                            <div className="col-span-2 md:col-span-1"><label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label><input type="email" value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full p-2 border rounded-md disabled:bg-slate-100" disabled={!!editingUser.uid} /></div>
                            {!editingUser.uid && (<div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Password</label><input type="password" value={editingUser.password || ''} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} className="w-full p-2 border rounded-md" /></div>)}
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-md border border-slate-200">
                            <input type="checkbox" id="isAdmin" checked={editingUser.isAdmin || false} onChange={e => setEditingUser({ ...editingUser, isAdmin: e.target.checked })} className="h-4 w-4 text-blue-600 rounded" />
                            <label htmlFor="isAdmin" className="text-sm font-bold text-slate-700">Grant Administrative Privileges</label>
                        </div>
                        {!editingUser.isAdmin && (
                            <div className="space-y-3">
                                <h4 className="font-semibold text-slate-700 border-b pb-1">Module Permissions</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 max-h-60 overflow-y-auto">
                                    {allPermissions.map(p => (
                                        <label key={p} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={editingUser.permissions?.includes(p)} onChange={() => handlePermissionToggle(p)} className="h-3 w-3" /><span>{p}</span></label>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                            <button onClick={handleSaveUser} className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold disabled:bg-blue-300" disabled={isLoading}>{isLoading ? "Saving..." : (editingUser.uid ? "Update" : "Create")}</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- EMPLOYEE MANAGEMENT ---
const EmployeeManagement: React.FC = () => {
    const { state, dispatch } = useData();
    const [notification, setNotification] = useState<string | null>(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Deletion Modal State
    const [deletionTarget, setDeletionTarget] = useState<Employee | null>(null);
    const [supervisorPassword, setSupervisorPassword] = useState('');
    const [passwordError, setPasswordError] = useState(false);

    // Filter states
    const [filterNameId, setFilterNameId] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [filterVisaStart, setFilterVisaStart] = useState('');
    const [filterVisaEnd, setFilterVisaEnd] = useState('');
    const [filterJoiningStart, setFilterJoiningStart] = useState('');
    const [filterJoiningEnd, setFilterJoiningEnd] = useState('');

    const uniqueSections = useMemo(() => {
        const fromEmployees = Array.from(new Set(state.employees.map(e => e.section).filter(Boolean)));
        const fromSections = state.sections.map(s => s.name);
        return Array.from(new Set([...fromSections, ...fromEmployees])).sort();
    }, [state.employees, state.sections]);

    const filteredEmployees = useMemo(() => {
        return state.employees.filter(emp => {
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
    }, [state.employees, filterNameId, filterType, filterSection, filterVisaStart, filterVisaEnd, filterJoiningStart, filterJoiningEnd]);

    const resetFilters = () => {
        setFilterNameId('');
        setFilterType('');
        setFilterSection('');
        setFilterVisaStart('');
        setFilterVisaEnd('');
        setFilterJoiningStart('');
        setFilterJoiningEnd('');
    };

    const handleCellUpdate = (id: string, field: keyof Employee, value: any) => {
        const employee = state.employees.find(e => e.id === id);
        if (!employee) return;
        dispatch({ 
            type: 'UPDATE_ENTITY', 
            payload: { 
                entity: 'employees', 
                data: { ...employee, [field]: value } 
            } 
        });
        setNotification(`Update: ${field} for ${employee.fullName}`);
    };

    const handleOpenDeleteModal = (emp: Employee) => {
        setDeletionTarget(emp);
        setSupervisorPassword('');
        setPasswordError(false);
    };

    const handleConfirmDelete = () => {
        if (!deletionTarget) return;
        if (supervisorPassword === "Sobee") {
            dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'employees', id: deletionTarget.id } });
            setNotification(`Employee "${deletionTarget.fullName}" has been deleted.`);
            setDeletionTarget(null);
            setSupervisorPassword('');
        } else {
            setPasswordError(true);
        }
    };

    const handleAddBlank = () => {
        const type = 'Labour';
        const newEmp: Employee = {
            id: generateEmployeeId(state.employees, type),
            employeeType: type,
            fullName: 'NEW EMPLOYEE',
            department: '',
            section: '',
            dateOfBirth: '',
            joiningDate: new Date().toISOString().split('T')[0],
            designation: '',
            status: 'Active',
            onDuty: true,
            companyVisa: true,
            nationality: '',
            leaveSalaryPayable: 0,
            leaveSalaryPaid: 0,
            gratuityPayable: 0,
            gratuityPaid: 0,
            vacationHistory: '',
            address: '',
            phone: '',
            email: '',
            bankName: '',
            accountNumber: '',
            basicSalary: 0,
            allowance: 0,
            otherExps: 0,
            lastIncrement: '',
            accommodation: '',
            visaCuttingTerms: '',
            startingBalance: 0
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'employees', data: newEmp } });
        setNotification("New placeholder row added.");
    };

    const typeOptions = [{ label: 'LBR', value: 'Labour' }, { label: 'OFF', value: 'Office' }];
    const statusOptions = [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }];

    const thClass = "px-2 py-1 border border-slate-300 font-bold text-slate-700 bg-slate-100 text-[10px] uppercase tracking-tighter sticky top-0 z-10 whitespace-nowrap text-center shadow-sm";
    const tdClass = "border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500 transition-all";

    return (
        <div className="flex flex-col h-[calc(100vh-220px)] overflow-hidden">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
            
            <div className="flex justify-between items-center mb-4 shrink-0 no-print">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Employee Register</h3>
                        <p className="text-xs text-slate-500">Spreadsheet View: Atomic Live Updates on click-out/Enter.</p>
                    </div>
                    <button 
                        onClick={() => setIsFilterOpen(!isFilterOpen)} 
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors border ${isFilterOpen ? 'bg-slate-800 text-white border-slate-900 shadow-inner' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filters
                        {(filterNameId || filterType || filterSection || filterVisaStart || filterVisaEnd || filterJoiningStart || filterJoiningEnd) && (
                            <span className="flex h-2 w-2 rounded-full bg-red-500"></span>
                        )}
                    </button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsBulkModalOpen(true)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-md font-bold text-sm hover:bg-slate-300 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Bulk Sync
                    </button>
                    <button onClick={handleAddBlank} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md font-bold text-sm hover:bg-indigo-700 shadow-md">
                        + New Row
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {isFilterOpen && (
                <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-inner shrink-0 no-print relative z-40">
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

            <div className="flex-1 overflow-auto border border-slate-300 rounded-lg shadow-inner bg-slate-50 custom-scrollbar">
                <table className="min-w-max border-separate border-spacing-0 table-fixed w-full">
                    <thead>
                        <tr>
                            <th className={`${thClass} w-24 left-0 z-30 shadow-md`} style={{ left: 0 }}>Code</th>
                            <th className={`${thClass} w-56 left-24 z-30 shadow-md`} style={{ left: '6rem' }}>Name (AS PER EID)</th>
                            <th className={`${thClass} w-24`}>Type</th>
                            <th className={`${thClass} w-32`}>Section</th>
                            <th className={`${thClass} w-32`}>Department</th>
                            <th className={`${thClass} w-32`}>Designation</th>
                            <th className={`${thClass} w-32`}>Nationality</th>
                            <th className={`${thClass} w-24 text-right`}>Basic Sal.</th>
                            <th className={`${thClass} w-24 text-right`}>Allow.</th>
                            <th className={`${thClass} w-24 text-right`}>Other Exps</th>
                            <th className={`${thClass} w-24 text-right text-blue-700 bg-blue-50/50`}>Total Sal.</th>
                            <th className={`${thClass} w-36`}>Accommodation</th>
                            <th className={`${thClass} w-32`}>Visa Expiry</th>
                            <th className={`${thClass} w-24`}>Status</th>
                            <th className={`${thClass} w-48`}>Vacation History</th>
                            <th className={`${thClass} w-24 text-right`}>Leave Pay</th>
                            <th className={`${thClass} w-24 text-right`}>Gratuity Pay</th>
                            <th className={`${thClass} w-32`}>Joining Date</th>
                            <th className={`${thClass} w-20 sticky right-0 z-30 bg-slate-100 border-l shadow-sm`}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.map((emp, idx) => {
                            const totalSalary = (Number(emp.basicSalary) || 0) + (Number(emp.allowance) || 0) + (Number(emp.otherExps) || 0);
                            return (
                            <tr key={emp.id} className="odd:bg-white even:bg-slate-50/50 hover:bg-blue-50/20 group">
                                <td className={`${tdClass} sticky left-0 z-20 font-mono font-bold text-slate-500 text-center text-[10px]`} style={{ left: 0 }}>{emp.id}</td>
                                <td className={`${tdClass} sticky left-24 z-20 font-bold`} style={{ left: '6rem' }}>
                                    <EditableCell employeeId={emp.id} field="fullName" value={emp.fullName} onUpdate={handleCellUpdate} className="uppercase text-slate-900" />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="employeeType" value={emp.employeeType} type="select" options={typeOptions} onUpdate={handleCellUpdate} />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="section" value={emp.section} onUpdate={handleCellUpdate} />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="department" value={emp.department} onUpdate={handleCellUpdate} />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="designation" value={emp.designation} onUpdate={handleCellUpdate} />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="nationality" value={emp.nationality} onUpdate={handleCellUpdate} />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="basicSalary" value={emp.basicSalary} type="number" onUpdate={handleCellUpdate} className="text-right text-slate-900 font-bold" />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="allowance" value={emp.allowance} type="number" onUpdate={handleCellUpdate} className="text-right" />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="otherExps" value={emp.otherExps} type="number" onUpdate={handleCellUpdate} className="text-right" />
                                </td>
                                <td className={`${tdClass} text-right text-[11px] font-black text-blue-700 bg-blue-50/20 px-2`}>
                                    AED {totalSalary.toLocaleString()}
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="accommodation" value={emp.accommodation} onUpdate={handleCellUpdate} />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="visaExpiryDate" value={emp.visaExpiryDate} type="date" onUpdate={handleCellUpdate} />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="status" value={emp.status} type="select" options={statusOptions} onUpdate={handleCellUpdate} />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="vacationHistory" value={emp.vacationHistory} onUpdate={handleCellUpdate} />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="leaveSalaryPayable" value={emp.leaveSalaryPayable} type="number" onUpdate={handleCellUpdate} className="text-right" />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="gratuityPayable" value={emp.gratuityPayable} type="number" onUpdate={handleCellUpdate} className="text-right" />
                                </td>
                                <td className={tdClass}>
                                    <EditableCell employeeId={emp.id} field="joiningDate" value={emp.joiningDate} type="date" onUpdate={handleCellUpdate} />
                                </td>
                                <td className={`${tdClass} sticky right-0 z-20 bg-slate-100 border-l text-center`}>
                                    <button onClick={() => handleOpenDeleteModal(emp)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors opacity-80 group-hover:opacity-100" title="Delete">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </td>
                            </tr>
                        )})}
                        {filteredEmployees.length === 0 && (
                            <tr><td colSpan={20} className="p-20 text-center text-slate-400 font-medium bg-white">No employees match your search or filter criteria.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <BulkEmployeeSync isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} showNotification={setNotification} />

            {/* Deletion Confirmation Modal */}
            {deletionTarget && (
                <Modal isOpen={!!deletionTarget} onClose={() => { setDeletionTarget(null); setSupervisorPassword(''); }} title="Confirm Permanent Deletion" size="lg">
                    <div className="space-y-6">
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                            <p className="font-bold text-lg">Warning: Irreversible Action</p>
                            <p className="mt-1 text-sm">You are about to delete <strong>{deletionTarget.fullName}</strong>. This will remove all their records from the register.</p>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Enter Supervisor Password</label>
                            <input 
                                type="password" 
                                value={supervisorPassword} 
                                onChange={(e) => {
                                    setSupervisorPassword(e.target.value);
                                    setPasswordError(false);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmDelete()}
                                className={`w-full p-3 border rounded-lg shadow-inner focus:ring-2 focus:ring-red-500 outline-none ${passwordError ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                                placeholder="Supervisor Password Required"
                                autoFocus
                            />
                            {passwordError && <p className="text-red-600 text-xs font-bold mt-2">Incorrect supervisor password. Please try again.</p>}
                            <p className="mt-3 text-xs text-slate-500">Supervisor Password for deletion is "Sobee".</p>
                        </div>

                        <div className="flex gap-3 pt-4 border-t">
                            <button 
                                onClick={() => { setDeletionTarget(null); setSupervisorPassword(''); }} 
                                className="flex-grow px-4 py-2 bg-slate-100 text-slate-700 rounded-md font-bold hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmDelete}
                                className="flex-grow px-4 py-2 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 transition-colors shadow-md"
                            >
                                Confirm Deletion
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- TASKS MANAGEMENT ---
const TasksManagement: React.FC = () => {
    const { state, dispatch } = useData();
    const [description, setDescription] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [users, setUsers] = useState<UserProfile[]>([]);

    useEffect(() => {
        if (!db) return;
        const unsubscribe = db.collection('users').onSnapshot((snapshot: any) => {
            const userList: UserProfile[] = [];
            snapshot.forEach((doc: any) => { userList.push({ ...doc.data(), uid: doc.id }); });
            setUsers(userList.sort((a, b) => a.name.localeCompare(b.name)));
        });
        return () => unsubscribe();
    }, []);

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;
        const assignee = users.find(u => u.uid === assigneeId);
        const newTask: HRTask = {
            id: `TASK-${Date.now()}`, description, isDone: false, comments: '', creationDate: new Date().toISOString().split('T')[0], assignedToId: assigneeId || undefined, assignedToName: assignee?.name || undefined,
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'hrTasks', data: newTask } });
        setDescription(''); setAssigneeId('');
    };

    const toggleDone = (task: HRTask) => {
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'hrTasks', data: { ...task, isDone: !task.isDone, completionDate: !task.isDone ? new Date().toISOString().split('T')[0] : undefined } } });
    };

    return (
        <div className="space-y-6 text-slate-900">
            <h3 className="text-xl font-bold text-slate-800">HR Task Tracker</h3>
            <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg no-print">
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter new task description..." className="flex-grow p-2 border rounded-md" />
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full md:w-64 p-2 border rounded-md"><option value="">Select Assignee (Optional)</option>{users.map(u => (<option key={u.uid} value={u.uid}>{u.name}</option>))}</select>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 transition-colors">Add Task</button>
            </form>
            <div className="space-y-3">
                {state.hrTasks.map(task => (
                    <div key={task.id} className="p-4 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <input type="checkbox" checked={task.isDone} onChange={() => toggleDone(task)} className="h-5 w-5 rounded text-indigo-600" />
                            <div>
                                <p className={`font-medium ${task.isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.description}</p>
                                <div className="flex gap-4 mt-1"><p className="text-xs text-slate-500">Created: {task.creationDate}</p>{task.assignedToName && (<p className="text-xs text-indigo-600 font-semibold flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Assigned to: {task.assignedToName}</p>)}</div>
                            </div>
                        </div>
                        {task.isDone && task.completionDate && (<span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Done on {task.completionDate}</span>)}
                    </div>
                ))}
                {state.hrTasks.length === 0 && (<div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-lg"><p className="text-slate-400">No tasks tracked yet.</p></div>)}
            </div>
        </div>
    );
};

// --- ENQUIRY MANAGEMENT ---
const EnquiryManagement: React.FC = () => {
    const { state, dispatch } = useData();
    const [description, setDescription] = useState('');

    const handleAddEnquiry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;
        const newEnq: HREnquiry = { id: `ENQ-${Date.now()}`, description, isApproved: false, comments: '', creationDate: new Date().toISOString().split('T')[0], };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'hrEnquiries', data: newEnq } });
        setDescription('');
    };

    const toggleApprove = (enq: HREnquiry) => {
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'hrEnquiries', data: { ...enq, iApproved: !enq.isApproved, approvalDate: !enq.isApproved ? new Date().toISOString().split('T')[0] : undefined } } });
    };

    return (
        <div className="space-y-6 text-slate-900">
            <h3 className="text-xl font-bold text-slate-800">Enquiries & Requests</h3>
            <form onSubmit={handleAddEnquiry} className="flex gap-2 no-print">
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter new enquiry..." className="flex-grow p-2 border rounded-md" />
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md font-bold">Submit Enquiry</button>
            </form>
            <div className="space-y-3">
                {state.hrEnquiries.map(enq => (
                    <div key={enq.id} className="p-4 bg-slate-50 border rounded-lg flex items-center justify-between shadow-sm">
                        <div><p className="font-medium text-slate-800">{enq.description}</p><p className="text-xs text-slate-500">Created: {enq.creationDate}</p></div>
                        <button onClick={() => toggleApprove(enq)} className={`px-4 py-1.5 rounded-md text-sm font-bold ${enq.isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{enq.isApproved ? 'Approved' : 'Pending Approval'}</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- VEHICLE MANAGEMENT ---
const VehicleManagement: React.FC = () => {
    const { state, dispatch, userProfile } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);
    const [chargeData, setChargeData] = useState({ description: '', type: '', amount: '', employeeId: '' });

    const handleOpenModal = (veh: Vehicle | null = null) => {
        setEditingVehicle(veh ? { ...veh } : { plateNumber: '', model: '', registrationExpiry: '', insuranceExpiry: '', status: VehicleStatus.Active, assignedTo: '', remarks: '' });
        setChargeData({ description: '', type: '', amount: '', employeeId: '' });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!editingVehicle?.plateNumber || !editingVehicle?.model) { alert("Plate Number and Model are required."); return; }
        let vehicleId = editingVehicle.id;
        if (vehicleId) { dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'vehicles', data: editingVehicle as Vehicle } }); }
        else { vehicleId = generateVehicleId(state.vehicles); const newVeh = { ...editingVehicle, id: vehicleId } as Vehicle; dispatch({ type: 'ADD_ENTITY', payload: { entity: 'vehicles', data: newVeh } }); }
        if (chargeData.amount && chargeData.employeeId) {
            const amountNum = Number(chargeData.amount);
            const voucherId = `VEH-CHG-${Date.now()}`;
            const description = `${chargeData.type}: ${chargeData.description} (Vehicle: ${editingVehicle.plateNumber})`;
            const debitEntry: JournalEntry = { id: `je-d-${voucherId}`, voucherId, date: new Date().toISOString().split('T')[0], entryType: JournalEntryType.Journal, account: 'AP-001', debit: amountNum, credit: 0, description, entityId: chargeData.employeeId, entityType: 'customer', createdBy: userProfile?.uid };
            const creditEntry: JournalEntry = { id: `je-c-${voucherId}`, voucherId, date: new Date().toISOString().split('T')[0], entryType: JournalEntryType.Journal, account: 'EXP-010', debit: 0, credit: amountNum, description, createdBy: userProfile?.uid };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
        }
        setIsModalOpen(false);
    };

    const labelClasses = "block text-sm font-semibold text-slate-700 mb-1";
    const inputClasses = "w-full p-2 border rounded-md";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center no-print">
                <h3 className="text-xl font-bold text-slate-800">Vehicle Fleet</h3>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold shadow-sm">Add Vehicle</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.vehicles.map(v => (
                    <div key={v.id} className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 hover:shadow-md transition-shadow text-slate-900">
                        <div className="flex justify-between items-start mb-3"><span className="bg-slate-900 text-white font-mono text-lg font-bold px-3 py-1 rounded shadow-inner">{v.plateNumber}</span><span className={`px-2 py-1 rounded text-xs font-bold ${v.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.status}</span></div>
                        <div className="space-y-1"><p className="text-slate-800 font-bold">{v.model}</p><p className="text-xs text-slate-500 flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>Reg. Expiry: {v.registrationExpiry || 'N/A'}</p></div>
                        <button onClick={() => handleOpenModal(v)} className="w-full mt-5 py-2 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 transition-colors text-sm font-bold no-print">Edit / Add Charge</button>
                    </div>
                ))}
            </div>
            {isModalOpen && editingVehicle && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingVehicle.id ? "Edit Vehicle" : "Add Vehicle"} size="2xl" isForm>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <div><label className={labelClasses}>Plate Number <span className="text-red-500">*</span></label><input type="text" value={editingVehicle.plateNumber || ''} onChange={e => setEditingVehicle({ ...editingVehicle, plateNumber: e.target.value })} className={inputClasses} /></div>
                            <div><label className={labelClasses}>Model <span className="text-red-500">*</span></label><input type="text" value={editingVehicle.model || ''} onChange={e => setEditingVehicle({ ...editingVehicle, model: e.target.value })} className={inputClasses} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={labelClasses}>Registration Expiry <span className="text-red-500">*</span></label><input type="date" value={editingVehicle.registrationExpiry || ''} onChange={e => setEditingVehicle({ ...editingVehicle, registrationExpiry: e.target.value })} className={inputClasses} /></div>
                                <div><label className={labelClasses}>Insurance Expiry <span className="text-red-500">*</span></label><input type="date" value={editingVehicle.insuranceExpiry || ''} onChange={e => setEditingVehicle({ ...editingVehicle, insuranceExpiry: e.target.value })} className={inputClasses} /></div>
                            </div>
                            <div><label className={labelClasses}>Assigned To</label><select value={editingVehicle.assignedTo || ''} onChange={e => setEditingVehicle({ ...editingVehicle, assignedTo: e.target.value })} className={inputClasses}><option value="">Select Assigned To</option>{state.employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}</select></div>
                            <div><label className={labelClasses}>Status <span className="text-red-500">*</span></label><select value={editingVehicle.status} onChange={e => setEditingVehicle({ ...editingVehicle, status: e.target.value as any })} className={inputClasses}>{Object.values(VehicleStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                            <div><label className={labelClasses}>Remarks</label><textarea rows={3} value={editingVehicle.remarks || ''} onChange={e => setEditingVehicle({ ...editingVehicle, remarks: e.target.value })} className={inputClasses} /></div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-8 border-t mt-6"><button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-md font-bold hover:bg-slate-300">Cancel</button><button onClick={handleSave} className="px-8 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow-md">Save</button></div>
                </Modal>
            )}
        </div>
    );
};

// --- MAIN SETUP MODULE ---
interface SetupModuleProps { 
    initialSection?: string | null; 
    setModule?: (module: Module) => void; 
    userProfile?: UserProfile | null; 
}

const SetupModule: React.FC<SetupModuleProps> = ({ initialSection }) => {
    const [activeSection, setActiveSection] = useState<'users' | 'placeholder'>(initialSection === 'users' ? 'users' : 'users');
    return (
        <div className="flex flex-col md:flex-row gap-6">
            <aside className="w-full md:w-64 flex-shrink-0 no-print">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50"><h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Setup Modules</h2></div>
                    <nav className="p-2 space-y-1"><button onClick={() => setActiveSection('users')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 ${activeSection === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>User Management</button></nav>
                </div>
            </aside>
            <main className="flex-grow bg-white rounded-lg shadow-sm border border-slate-200 p-6 min-h-[600px]">{activeSection === 'users' ? <UserManagement /> : <div className="text-center py-20 text-slate-400">Ready to build your custom setup.</div>}</main>
        </div>
    );
};

// --- HR MODULE (Exported) ---
export const HRModule: React.FC<{ userProfile: UserProfile | null; initialView?: string | null }> = ({ userProfile, initialView }) => {
    const [activeTab, setActiveTab] = useState(initialView || 'employees');
    const tabs = [
        { id: 'employees', label: 'Employees', icon: '👤' }, 
        { id: 'attendance', label: 'Attendance', icon: '📅' }, 
        { id: 'overtime', label: 'Overtime', icon: '⏰' }, 
        { id: 'overtime-press', label: 'Overtime Press', icon: '🚜' }, 
        { id: 'payroll', label: 'Payroll', icon: '💰' }, 
        { id: 'settlements', label: 'Settlements', icon: '⚖️' },
        { id: 'vehicles', label: 'Vehicles', icon: '🚚' }, 
        { id: 'tasks', label: 'Tasks', icon: '✅' }, 
        { id: 'enquiries', label: 'Enquiries', icon: '❓' },
    ];
    const renderTabContent = () => {
        switch (activeTab) {
            case 'employees': return <EmployeeManagement />;
            case 'attendance': return <AttendanceRegister userProfile={userProfile} />;
            case 'overtime': return <OvertimeRegister userProfile={userProfile} />;
            case 'overtime-press': return <OvertimePressRegister userProfile={userProfile} />;
            case 'payroll': return <SalaryCalculator />;
            case 'settlements': return <SettlementRegister />;
            case 'vehicles': return <VehicleManagement />;
            case 'tasks': return <TasksManagement />;
            case 'enquiries': return <EnquiryManagement />;
            default: return <EmployeeManagement />;
        }
    };
    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden no-print shrink-0">
                <div className="flex overflow-x-auto scrollbar-hide">
                    {tabs.map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}><span>{tab.icon}</span>{tab.label}</button>))}
                </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex-grow overflow-visible">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default SetupModule;
