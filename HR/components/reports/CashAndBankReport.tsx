import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';

interface CashAndBankReportProps {
    mode: 'combined' | 'cash' | 'bank';
    initialFilters?: any;
}

const CashAndBankReport: React.FC<CashAndBankReportProps> = ({ mode, initialFilters }) => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const title = useMemo(() => {
        if (mode === 'cash') return 'Cash Book';
        if (mode === 'bank') return 'Bank Book';
        return 'Combined Cash & Bank Book (Ledger)';
    }, [mode]);

    const accountsForSelection = useMemo(() => {
        if (mode === 'cash') return state.cashAccounts.map(c => ({ id: c.id, name: c.name }));
        if (mode === 'bank') return state.banks.map(b => ({ id: b.id, name: b.accountTitle }));
        // combined
        return [
            ...state.cashAccounts.map(c => ({ id: c.id, name: `${c.name} (Cash)` })),
            ...state.banks.map(b => ({ id: b.id, name: `${b.accountTitle} (Bank)` })),
        ];
    }, [mode, state.cashAccounts, state.banks]);

    const allAccounts = useMemo(() => [
        ...state.cashAccounts.map(c => ({ id: c.id, name: c.name })),
        ...state.banks.map(b => ({ id: b.id, name: b.accountTitle })),
    ], [state.cashAccounts, state.banks]);


    const [filters, setFilters] = useState({
        startDate: firstDayOfMonth,
        endDate: today,
        selectedAccounts: [] as string[], // for combined/cash
        selectedBankId: '', // for bank
    });

    useEffect(() => {
        if (initialFilters) {
            // Special handling for navigating to "Cash" or "Bank" from Balance Sheet
            if (initialFilters.endDate) {
                if(mode === 'cash') {
                    setFilters({
                        startDate: '2024-01-01',
                        endDate: initialFilters.endDate,
                        selectedAccounts: state.cashAccounts.map(a => a.id),
                        selectedBankId: '',
                    });
                } else if (mode === 'bank') {
                     setFilters({
                        startDate: '2024-01-01',
                        endDate: initialFilters.endDate,
                        selectedAccounts: [],
                        selectedBankId: '', // Will show all banks
                    });
                } else {
                    setFilters(prev => ({ ...prev, ...initialFilters }));
                }
            } else {
                 setFilters(prev => ({ ...prev, ...initialFilters }));
            }
            return; // Exit early
        }

        // Default filter logic when no initialFilters are provided
        if (mode !== 'bank') {
            setFilters(prev => ({
                ...prev,
                selectedAccounts: accountsForSelection.map(acc => acc.id),
                selectedBankId: '',
            }));
        } else {
             setFilters(prev => ({
                ...prev,
                selectedAccounts: [],
                selectedBankId: '',
            }));
        }
    }, [mode, accountsForSelection, initialFilters, state.cashAccounts]);


    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };
    
    const handleAccountSelection = (accountId: string) => {
        setFilters(prev => {
            const newSelection = prev.selectedAccounts.includes(accountId)
                ? prev.selectedAccounts.filter(id => id !== accountId)
                : [...prev.selectedAccounts, accountId];
            return { ...prev, selectedAccounts: newSelection };
        });
    };

    const { openingBalance, transactions, closingBalance, totalReceipts, totalPayments } = useMemo(() => {
        let accountIds: string[];

        if (mode === 'bank') {
            accountIds = filters.selectedBankId ? [filters.selectedBankId] : state.banks.map(b => b.id);
        } else { // 'cash' or 'combined'
            accountIds = filters.selectedAccounts;
        }

        if (accountIds.length === 0 && mode !== 'bank' && state.banks.length > 0) {
            return { openingBalance: 0, transactions: [], closingBalance: 0, totalReceipts: 0, totalPayments: 0 };
        }

        const relevantEntries = state.journalEntries.filter(je => accountIds.includes(je.account));
        
        const openingBalance = relevantEntries
            .filter(je => je.date < filters.startDate)
            .reduce((balance, je) => balance + je.debit - je.credit, 0);

        const periodTransactions = relevantEntries
            .filter(je => je.date >= filters.startDate && je.date <= filters.endDate)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningBalance = openingBalance;
        const transactionsWithBalance = periodTransactions.map(t => {
            runningBalance += t.debit - t.credit;
            return { ...t, balance: runningBalance };
        });
        
        const totalReceipts = periodTransactions.reduce((sum, t) => sum + t.debit, 0);
        const totalPayments = periodTransactions.reduce((sum, t) => sum + t.credit, 0);

        return {
            openingBalance,
            transactions: transactionsWithBalance,
            closingBalance: runningBalance,
            totalReceipts,
            totalPayments
        };

    }, [filters, state.journalEntries, mode, state.banks]);

    const getAccountName = (id: string) => allAccounts.find(a => a.id === id)?.name || id;
    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const formatCurrencyValue = (val: number) => val.toFixed(2);

    const exportHeaders = [
        { label: 'Date', key: 'date' },
        { label: 'Account', key: 'account' },
        { label: 'Description', key: 'description' },
        { label: 'Receipts (Debit)', key: 'debit' },
        { label: 'Payments (Credit)', key: 'credit' },
        { label: 'Balance', key: 'balance' },
    ];
    
    const cashBankExportData = useMemo(() => {
        return transactions.map(t => ({
            date: t.date,
            account: getAccountName(t.account),
            description: t.description,
            debit: t.debit > 0 ? formatCurrencyValue(t.debit) : '',
            credit: t.credit > 0 ? formatCurrencyValue(t.credit) : '',
            balance: formatCurrencyValue(t.balance)
        }));
    }, [transactions]);
    
    return (
        <div className="report-print-area">
            <ReportToolbar
                title={title}
                exportData={cashBankExportData}
                exportHeaders={exportHeaders}
                exportFilename={`${title.replace(/ /g, '_')}_${filters.startDate}_to_${filters.endDate}`}
            />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                 {mode === 'bank' ? (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select Bank</label>
                        <select
                            value={filters.selectedBankId}
                            onChange={(e) => handleFilterChange('selectedBankId', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-md text-sm"
                        >
                            <option value="">All Banks</option>
                            {accountsForSelection.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="p-4 border rounded-md bg-white w-full">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Select Accounts</label>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {accountsForSelection.map(acc => (
                                <label key={acc.id} className="flex items-center space-x-2 text-sm text-slate-800 font-normal">
                                    <input
                                        type="checkbox"
                                        checked={filters.selectedAccounts.includes(acc.id)}
                                        onChange={() => handleAccountSelection(acc.id)}
                                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-slate-300 rounded"
                                    />
                                    <span>{acc.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </ReportFilters>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-center">
                <div className="p-4 bg-slate-100 rounded-lg"><h4 className="text-sm font-semibold text-slate-600">Opening Balance</h4><p className="text-xl font-bold text-slate-800">{formatCurrency(openingBalance)}</p></div>
                <div className="p-4 bg-green-100 rounded-lg"><h4 className="text-sm font-semibold text-green-700">Total Receipts</h4><p className="text-xl font-bold text-green-800">{formatCurrency(totalReceipts)}</p></div>
                <div className="p-4 bg-red-100 rounded-lg"><h4 className="text-sm font-semibold text-red-700">Total Payments</h4><p className="text-xl font-bold text-red-800">{formatCurrency(totalPayments)}</p></div>
                <div className="p-4 bg-blue-100 rounded-lg"><h4 className="text-sm font-semibold text-blue-700">Closing Balance</h4><p className="text-xl font-bold text-blue-800">{formatCurrency(closingBalance)}</p></div>
            </div>

            <div className="overflow-x-auto">
                 <table className="w-full text-left table-auto text-sm">
                    <thead><tr className="bg-slate-100">
                        <th className="p-2 font-semibold text-slate-600">Date</th>
                        <th className="p-2 font-semibold text-slate-600">Account</th>
                        <th className="p-2 font-semibold text-slate-600">Description</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Receipts (Debit)</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Payments (Credit)</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Balance</th>
                    </tr></thead>
                    <tbody>
                        {transactions.map(t => (
                            <tr key={t.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{t.date}</td>
                                <td className="p-2 text-slate-700">{getAccountName(t.account)}</td>
                                <td className="p-2 text-slate-700">{t.description}</td>
                                <td className="p-2 text-slate-700 text-right">{t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
                                <td className="p-2 text-slate-700 text-right">{t.credit > 0 ? formatCurrency(t.credit) : '-'}</td>
                                <td className="p-2 text-slate-700 text-right">{formatCurrency(t.balance)}</td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr><td colSpan={6} className="text-center text-slate-500 py-6">No transactions in the selected period for the chosen accounts.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CashAndBankReport;
