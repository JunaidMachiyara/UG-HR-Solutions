import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import ReportFilters from './ReportFilters.tsx';

interface ProfitAndLossReportProps {
    initialFilters?: any;
}

const ProfitAndLossReport: React.FC<ProfitAndLossReportProps> = ({ initialFilters }) => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        startDate: firstDayOfYear,
        endDate: today,
    });

    useEffect(() => {
        if (initialFilters) {
            setFilters(prev => ({ ...prev, ...initialFilters }));
        }
    }, [initialFilters]);

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const { revenue, expenses, netIncome } = useMemo(() => {
        const entries = state.journalEntries.filter(je => je.date >= filters.startDate && je.date <= filters.endDate);
        
        const revenueAccounts = state.revenueAccounts.map(a => a.id);
        const expenseAccounts = state.expenseAccounts;

        const totalRevenue = entries
            .filter(je => revenueAccounts.includes(je.account))
            .reduce((sum, je) => sum + je.credit - je.debit, 0);
            
        const expenseDetails = expenseAccounts.map(acc => {
            const balance = entries
                .filter(je => je.account === acc.id)
                .reduce((sum, je) => sum + je.debit - je.credit, 0);
            return { name: acc.name, balance };
        }).filter(e => e.balance !== 0);

        const totalExpenses = expenseDetails.reduce((sum, e) => sum + e.balance, 0);
        
        const netIncome = totalRevenue - totalExpenses;

        return { revenue: totalRevenue, expenses: expenseDetails, netIncome };
    }, [filters, state]);
    
    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const AccountRow: React.FC<{ label: string, value: number, isSubtotal?: boolean, isTotal?: boolean, isHeader?: boolean }> = ({ label, value, isSubtotal, isTotal, isHeader }) => (
        <div className={`flex justify-between py-1.5 text-slate-800 ${isSubtotal ? 'border-t mt-1 pt-1.5 font-semibold text-lg' : ''} ${isTotal ? 'border-t-2 border-slate-400 mt-2 pt-2 font-bold text-xl' : ''} ${isHeader ? 'font-bold text-xl' : ''}`}>
            <span className={!isSubtotal && !isTotal && !isHeader ? 'pl-4' : ''}>{label}</span>
            <span>{formatCurrency(value)}</span>
        </div>
    );
    
    return (
        <div className="report-print-area">
            <ReportToolbar title="Profit & Loss Report" exportData={[]} exportHeaders={[]} exportFilename={`ProfitAndLoss_${filters.startDate}_to_${filters.endDate}`} />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange} />
            
            <div className="max-w-4xl mx-auto space-y-6">
                <AccountRow label="Revenue" value={revenue} isHeader />
                
                <div className="pl-4">
                    <h3 className="text-lg font-semibold text-slate-700 mt-4 mb-2 border-b pb-1">Expenses</h3>
                    {expenses.map(exp => (
                        <div key={exp.name} className="flex justify-between py-1 text-slate-800">
                            <span>{exp.name}</span>
                            <span>{formatCurrency(exp.balance)}</span>
                        </div>
                    ))}
                    <AccountRow label="Total Expenses" value={expenses.reduce((s, e) => s + e.balance, 0)} isSubtotal />
                </div>
                
                <AccountRow label="Net Income" value={netIncome} isTotal />
            </div>
        </div>
    );
};

export default ProfitAndLossReport;
