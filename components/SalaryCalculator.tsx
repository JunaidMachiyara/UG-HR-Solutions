import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { Employee, AttendanceStatus, SalaryPayment } from '../types.ts';

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

        let employeesToProcess = state.employees.filter(emp => emp.status === 'Active');
        if (filterEmployeeId) {
            employeesToProcess = employeesToProcess.filter(emp => emp.id === filterEmployeeId);
        }

        return employeesToProcess.map(employee => {
                const yearsOfService = (new Date().getTime() - new Date(employee.joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                const dailyWage = employee.basicSalary / 30;
                let gratuity = 0;
                if (yearsOfService >= 1) {
                    gratuity = (yearsOfService <= 5) ? (dailyWage * 21 * yearsOfService) : (dailyWage * 30 * yearsOfService);
                }

                const attendanceForMonth = state.attendanceRecords.filter(
                    r => r.employeeId === employee.id &&
                         new Date(r.date).getFullYear() === year &&
                         new Date(r.date).getMonth() === month
                );

                const absentDays = attendanceForMonth.filter(r => r.status === AttendanceStatus.Absent).length;
                const halfDays = attendanceForMonth.filter(r => r.status === AttendanceStatus.HalfDay).length;
                const paidLeaveDays = attendanceForMonth.filter(r => r.status === AttendanceStatus.PaidLeave || r.status === AttendanceStatus.SickLeave).length;

                const unpaidDays = absentDays + (halfDays * 0.5);
                const dailyRate = employee.basicSalary / daysInMonth;
                const deductions = unpaidDays * dailyRate;
                const netSalary = employee.basicSalary - deductions - (employee.advances || 0);

                return {
                    ...employee,
                    payableDays: daysInMonth - unpaidDays,
                    deductions,
                    advances: employee.advances || 0,
                    netPayableSalary: netSalary,
                    paidLeaveDaysThisMonth: paidLeaveDays,
                    gratuityAmount: gratuity,
                };
            });
    }, [month, year, state.employees, state.attendanceRecords, filterEmployeeId]);

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


    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    return (
        <div className="space-y-6">
            {notification && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50">{notification}</div>}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center space-x-2">
                    <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-md hover:bg-slate-200">&larr;</button>
                    <h2 className="text-2xl font-bold text-slate-800 w-48 text-center">
                        {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={() => handleMonthChange(1)} className="p-2 rounded-md hover:bg-slate-200">&rarr;</button>
                </div>
                 <div className="w-full md:w-1/3">
                    <select value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md bg-white">
                        <option value="">All Active Employees</option>
                        {state.employees.filter(emp => emp.status === 'Active').map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                        ))}
                    </select>
                </div>
            </div>
            
            <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="w-full text-left table-auto text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-2 font-semibold text-slate-600">Employee</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Net Payable Salary</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Gratuity Accrued</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(emp => {
                            const payment = salaryPaymentsMap.get(emp.id);
                            const isPayingThisRow = payingRow?.employeeId === emp.id;

                            return (
                                <React.Fragment key={emp.id}>
                                    <tr className={`border-t hover:bg-slate-50 ${isPayingThisRow ? 'bg-blue-50' : ''}`}>
                                        <td className="p-2 text-slate-700 font-medium">{emp.fullName}</td>
                                        <td className="p-2 text-blue-600 font-bold text-right">{formatCurrency(emp.netPayableSalary)}</td>
                                        <td className="p-2 text-slate-700 text-right">{formatCurrency(emp.gratuityAmount)}</td>
                                        <td className="p-2 text-center">
                                            {payment ? (
                                                <div className="text-xs font-semibold text-green-700">
                                                    <p>Paid via {payment.voucherId ? `Voucher ${payment.voucherId}` : payment.paymentMethod}</p>
                                                    <p>on {payment.paymentDate}</p>
                                                </div>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={isPayingThisRow}
                                                    onChange={() => {
                                                        if (isPayingThisRow) {
                                                            setPayingRow(null);
                                                        } else {
                                                            setPayingRow({ employeeId: emp.id, netSalary: emp.netPayableSalary });
                                                            setPaymentDetails({ method: 'Cash', bankId: state.banks[0]?.id || '' });
                                                        }
                                                    }}
                                                    className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
                                                />
                                            )}
                                        </td>
                                    </tr>
                                    {isPayingThisRow && (
                                        <tr className="bg-slate-100">
                                            <td colSpan={4} className="p-3">
                                                <div className="flex items-center gap-4">
                                                    <span className="font-semibold text-sm">Payment Method:</span>
                                                    <div className="flex items-center gap-2 bg-white p-1 rounded-md border">
                                                        <button onClick={() => setPaymentDetails(p => ({...p, method: 'Cash'}))} className={`px-3 py-1 text-sm rounded ${paymentDetails.method === 'Cash' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600'}`}>Cash</button>
                                                        <button onClick={() => setPaymentDetails(p => ({...p, method: 'Bank'}))} className={`px-3 py-1 text-sm rounded ${paymentDetails.method === 'Bank' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600'}`}>Bank</button>
                                                    </div>
                                                    {paymentDetails.method === 'Bank' && (
                                                         <select value={paymentDetails.bankId} onChange={e => setPaymentDetails(p => ({...p, bankId: e.target.value}))} className="p-2 border border-slate-300 rounded-md text-sm">
                                                            {state.banks.map(b => <option key={b.id} value={b.id}>{b.accountTitle}</option>)}
                                                        </select>
                                                    )}
                                                    <div className="ml-auto flex gap-2">
                                                        <button onClick={() => setPayingRow(null)} className="px-4 py-2 text-sm bg-slate-300 text-slate-800 rounded-md hover:bg-slate-400">Cancel</button>
                                                        <button onClick={handleConfirmPayment} disabled={paymentDetails.method === 'Bank' && !paymentDetails.bankId} className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300">Confirm Payment</button>
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
