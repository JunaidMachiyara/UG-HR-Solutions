
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { Employee, AttendanceStatus, SalaryPayment, OvertimeRecord, OvertimePressRecord } from '../types.ts';

const SalaryCalculator: React.FC = () => {
    const { state, dispatch } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [filterEmployeeId, setFilterEmployeeId] = useState('');
    const [payingRow, setPayingRow] = useState<{ employeeId: string; netSalary: number } | null>(null);
    const [paymentDetails, setPaymentDetails] = useState({ method: 'Cash', bankId: '' });
    const [notification, setNotification] = useState<string | null>(null);


    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const { month, year } = useMemo(() => {
        const date = new Date(currentDate);
        return { month: date.getMonth(), year: date.getFullYear() };
    }, [currentDate]);

    const salaryPaymentsMap = useMemo(() => {
        const map = new Map<string, SalaryPayment>();
        const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`;
        state.salaryPayments
            .filter(p => p.monthYear === monthYear)
            .forEach(p => map.set(p.employeeId, p));
        return map;
    }, [state.salaryPayments, month, year]);

    const reportData = useMemo(() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        let employeesToProcess = state.employees.filter(emp => emp.status === 'Active');
        if (filterEmployeeId) {
            employeesToProcess = employeesToProcess.filter(emp => emp.id === filterEmployeeId);
        }

        return employeesToProcess.map(employee => {
                // Time calculations
                const joinDate = new Date(employee.joiningDate);
                const endDate = new Date(year, month + 1, 0); // Last day of selected month
                const yearsOfService = Math.max(0, (endDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

                // RULE: Gratuity 600 AED for Labor per Year
                let gratuityAccrued = 0;
                if (employee.employeeType === 'Labour') {
                    gratuityAccrued = yearsOfService * 600;
                } else {
                    const dailyWage = employee.basicSalary / 30;
                    if (yearsOfService >= 1) {
                        gratuityAccrued = (yearsOfService <= 5) ? (dailyWage * 21 * yearsOfService) : (dailyWage * 30 * yearsOfService);
                    }
                }

                // REVISED LAW: Vacations (Paid) 600 AED Per Year
                const leaveSalaryAccrued = yearsOfService * 600;

                // Attendance deductions
                const attendanceForMonth = state.attendanceRecords.filter(
                    r => r.employeeId === employee.id &&
                         r.date.startsWith(monthStr)
                );

                const absentDays = attendanceForMonth.filter(r => r.status === AttendanceStatus.Absent).length;
                const halfDays = attendanceForMonth.filter(r => r.status === AttendanceStatus.HalfDay).length;
                
                const unpaidDays = absentDays + (halfDays * 0.5);
                const dailyRate = employee.basicSalary / 30; 
                const deductions = unpaidDays * dailyRate;

                // --- Overtime Logic ---
                // 1. Regular Hourly OT (7 AED/hr)
                const otRecords = state.overtimeRecords.filter(r => r.employeeId === employee.id && r.date.startsWith(monthStr));
                const totalOtHours = otRecords.reduce((sum, r) => sum + r.hours, 0);
                const hourlyOtAmount = totalOtHours * 7;

                // 2. Press Overtime (Mixed: Hourly or Fixed Pool Amount)
                const otPressRecords = state.overtimePressRecords.filter(r => r.employeeId === employee.id && r.date.startsWith(monthStr));
                const pressOtAmount = otPressRecords.reduce((sum, r) => {
                    // If 'amount' exists, it's a team-pool distribution. Otherwise, it's hourly.
                    if (r.amount !== undefined && r.amount > 0) {
                        return sum + r.amount;
                    }
                    return sum + (r.hours * 7);
                }, 0);

                const netSalary = (employee.basicSalary + employee.allowance + employee.otherExps + hourlyOtAmount + pressOtAmount) - deductions - (employee.advances || 0);

                return {
                    ...employee,
                    payableDays: daysInMonth - unpaidDays,
                    deductions,
                    otAmount: hourlyOtAmount + pressOtAmount,
                    otHours: totalOtHours + otPressRecords.reduce((s, r) => s + (r.hours || 0), 0),
                    advances: employee.advances || 0,
                    netPayableSalary: netSalary,
                    gratuityAmount: gratuityAccrued,
                    leaveSalaryAccrued: leaveSalaryAccrued,
                };
            });
    }, [month, year, state.employees, state.attendanceRecords, state.overtimeRecords, state.overtimePressRecords, filterEmployeeId]);

    const handleMonthChange = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };
    
    const handleConfirmPayment = () => {
        if (!payingRow) return;

        const { employeeId, netSalary } = payingRow;
        const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`;

        const newPayment: SalaryPayment = {
            id: `SP-${employeeId}-${monthYear}`,
            employeeId, monthYear,
            paymentDate: new Date().toISOString().split('T')[0],
            paymentMethod: paymentDetails.method as 'Cash' | 'Bank',
            bankId: paymentDetails.method === 'Bank' ? paymentDetails.bankId : undefined,
            amountPaid: netSalary,
        };
        
        const existingPayment = state.salaryPayments.find(p => p.id === newPayment.id);
        
        if (existingPayment) {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'salaryPayments', data: newPayment } });
        } else {
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'salaryPayments', data: newPayment } });
        }
        
        setNotification(`Salary for ${state.employees.find(e=>e.id === employeeId)?.fullName} marked as paid.`);
        setPayingRow(null);
    };


    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'AED' }).replace('AED', 'AED ');

    return (
        <div className="space-y-6">
            {notification && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50">{notification}</div>}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center space-x-2">
                    <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-md hover:bg-slate-200 transition-colors">&larr;</button>
                    <h2 className="text-2xl font-black text-slate-800 w-64 text-center uppercase tracking-tighter">
                        {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={() => handleMonthChange(1)} className="p-2 rounded-md hover:bg-slate-200 transition-colors">&rarr;</button>
                </div>
                 <div className="w-full md:w-1/3">
                    <select value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md bg-white text-slate-900 font-bold">
                        <option value="">All Active Employees</option>
                        {state.employees.filter(emp => emp.status === 'Active').map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                        ))}
                    </select>
                </div>
            </div>
            
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xl">
                <table className="w-full text-left table-auto text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-3 font-black text-slate-600 uppercase tracking-widest">Employee</th>
                            <th className="p-3 font-black text-slate-600 uppercase text-right">Basic + Allow</th>
                            <th className="p-3 font-black text-slate-600 uppercase text-right">OT Total</th>
                            <th className="p-3 font-black text-slate-600 uppercase text-right">Deductions</th>
                            <th className="p-3 font-black text-slate-600 uppercase text-right">Net Payable</th>
                            <th className="p-3 font-black text-slate-600 uppercase text-right">Gratuity Accrued</th>
                            <th className="p-3 font-black text-slate-600 uppercase text-right">Leave Sal. Accrued</th>
                            <th className="p-3 font-black text-slate-600 uppercase text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(emp => {
                            const payment = salaryPaymentsMap.get(emp.id);
                            const isPayingThisRow = payingRow?.employeeId === emp.id;
                            const totalFixed = emp.basicSalary + emp.allowance + emp.otherExps;

                            return (
                                <React.Fragment key={emp.id}>
                                    <tr className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${isPayingThisRow ? 'bg-blue-50' : ''}`}>
                                        <td className="p-3 text-slate-900 font-black uppercase">{emp.fullName} <span className="text-[9px] font-medium text-slate-400">({emp.id})</span></td>
                                        <td className="p-3 text-slate-700 text-right font-bold">{formatCurrency(totalFixed)}</td>
                                        <td className="p-3 text-indigo-600 text-right font-black">
                                            {formatCurrency(emp.otAmount)}
                                        </td>
                                        <td className="p-3 text-red-600 text-right font-bold">{formatCurrency(emp.deductions + emp.advances)}</td>
                                        <td className="p-3 text-blue-800 font-black text-right text-sm">{formatCurrency(emp.netPayableSalary)}</td>
                                        <td className="p-2 text-slate-700 text-right font-medium">{formatCurrency(emp.gratuityAmount)}</td>
                                        <td className="p-2 text-slate-700 text-right font-medium">{formatCurrency(emp.leaveSalaryAccrued)}</td>
                                        <td className="p-3 text-center">
                                            {payment ? (
                                                <div className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded inline-block uppercase">
                                                    Paid: {payment.paymentMethod}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        if (isPayingThisRow) {
                                                            setPayingRow(null);
                                                        } else {
                                                            setPayingRow({ employeeId: emp.id, netSalary: emp.netPayableSalary });
                                                            setPaymentDetails({ method: 'Cash', bankId: state.banks[0]?.id || '' });
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isPayingThisRow ? 'bg-slate-800 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'}`}
                                                >
                                                    {isPayingThisRow ? 'Close' : 'Pay Now'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {isPayingThisRow && (
                                        <tr className="bg-slate-900 text-white">
                                            <td colSpan={8} className="p-4 rounded-b-xl overflow-hidden shadow-inner">
                                                <div className="flex flex-col md:flex-row items-center gap-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase text-slate-400 mb-1">Select Payment Mode</span>
                                                        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg">
                                                            <button onClick={() => setPaymentDetails(p => ({...p, method: 'Cash'}))} className={`px-4 py-2 text-xs font-black rounded-md uppercase transition-all ${paymentDetails.method === 'Cash' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-white'}`}>Cash</button>
                                                            <button onClick={() => setPaymentDetails(p => ({...p, method: 'Bank'}))} className={`px-4 py-2 text-xs font-black rounded-md uppercase transition-all ${paymentDetails.method === 'Bank' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-white'}`}>Bank</button>
                                                        </div>
                                                    </div>
                                                    
                                                    {paymentDetails.method === 'Bank' && (
                                                         <div className="flex flex-col flex-grow max-w-xs">
                                                            <span className="text-[10px] font-black uppercase text-slate-400 mb-1">Source Account</span>
                                                            <select value={paymentDetails.bankId} onChange={e => setPaymentDetails(p => ({...p, bankId: e.target.value}))} className="p-2 bg-slate-800 border-0 rounded-lg text-xs font-black text-white focus:ring-2 focus:ring-blue-500">
                                                                <option value="">Select Bank Account</option>
                                                                {state.banks.map(b => <option key={b.id} value={b.id}>{b.accountTitle}</option>)}
                                                            </select>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="ml-auto flex gap-3">
                                                        <button onClick={() => setPayingRow(null)} className="px-6 py-2 text-[10px] font-black uppercase bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors">Cancel</button>
                                                        <button onClick={handleConfirmPayment} disabled={paymentDetails.method === 'Bank' && !paymentDetails.bankId} className="px-8 py-2 text-[10px] font-black uppercase bg-green-600 text-white rounded-lg hover:bg-green-500 shadow-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95">Confirm Salary Disbursement</button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SalaryCalculator;
