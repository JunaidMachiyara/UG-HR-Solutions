import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { JournalEntry, InvoiceItem, AppState, Currency, PackingType, SalesInvoice } from '../../types.ts';
import Modal from '../ui/Modal.tsx';
import EntitySelector from '../ui/EntitySelector.tsx';

const SalesInvoiceViewModal: React.FC<{ invoiceId: string; onClose: () => void; state: AppState }> = ({ invoiceId, onClose, state }) => {
    const invoice = state.salesInvoices.find(inv => inv.id === invoiceId);

    if (!invoice) {
        return (
             <Modal isOpen={true} onClose={onClose} title="Error" size="4xl">
                <p>Could not find invoice with ID: {invoiceId}</p>
             </Modal>
        );
    }

    const customer = state.customers.find(c => c.id === invoice.customerId);
    const handlePrint = () => window.print();

    const calculateItemValue = (item: InvoiceItem) => {
        const itemDetails = state.items.find(i => i.id === item.itemId);
        if (!itemDetails || !item.rate) return 0;

        if (itemDetails.packingType === PackingType.Bales) {
            const totalKg = item.quantity * itemDetails.baleSize;
            return totalKg * item.rate;
        }
        return item.quantity * item.rate;
    };
    
    const itemsTotal = invoice.items.reduce((sum, item) => sum + calculateItemValue(item), 0);
    const grandTotal = itemsTotal + (invoice.freightAmount || 0) + (invoice.customCharges || 0);
    const currency = invoice.items.length > 0 ? (invoice.items[0].currency || Currency.Dollar) : Currency.Dollar;

    return (
        <Modal isOpen={true} onClose={onClose} title={`Invoice Details: ${invoice.id}`} size="4xl">
            <div id="voucher-print-area" className="space-y-4 text-sm text-slate-800">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Sales Invoice</h2>
                    <p className="text-slate-600">USMAN GLOBAL</p>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-b pb-4 text-slate-700">
                    <p><strong className="text-slate-800">Invoice ID:</strong> {invoice.id}</p>
                    <p><strong className="text-slate-800">Date:</strong> {invoice.date}</p>
                    <p><strong className="text-slate-800">Customer:</strong> {customer?.name || 'N/A'}</p>
                    <p><strong className="text-slate-800">Address:</strong> {customer?.address || 'N/A'}</p>
                </div>

                <table className="w-full text-left table-auto my-4 border-t border-b">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="p-2 font-semibold text-slate-600">Item</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Quantity</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Rate (per Kg)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item, index) => {
                            const itemDetails = state.items.find(i => i.id === item.itemId);
                            const totalValue = calculateItemValue(item);
                            return (
                                <tr key={index} className="border-b">
                                    <td className="p-2 text-slate-700">{itemDetails?.name || 'Unknown Item'}</td>
                                    <td className="p-2 text-slate-700 text-right">{item.quantity.toLocaleString()}</td>
                                    <td className="p-2 text-slate-700 text-right">{(item.rate || 0).toFixed(2)}</td>
                                    <td className="p-2 text-slate-700 text-right">{totalValue.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="font-medium">
                            <td colSpan={3} className="p-2 text-right text-slate-800 border-t">Subtotal</td>
                            <td className="p-2 text-right text-slate-800 border-t">{itemsTotal.toFixed(2)}</td>
                        </tr>
                        {invoice.freightAmount && (
                            <tr className="font-medium">
                                <td colSpan={3} className="p-2 text-right text-slate-800">Freight Charges</td>
                                <td className="p-2 text-right text-slate-800">{invoice.freightAmount.toFixed(2)}</td>
                            </tr>
                        )}
                        {invoice.customCharges && (
                            <tr className="font-medium">
                                <td colSpan={3} className="p-2 text-right text-slate-800">Customs Charges</td>
                                <td className="p-2 text-right text-slate-800">{invoice.customCharges.toFixed(2)}</td>
                            </tr>
                        )}
                        <tr className="font-bold bg-slate-100">
                            <td colSpan={3} className="p-2 text-right text-slate-800">Grand Total ({currency})</td>
                            <td className="p-2 text-right text-slate-800">{grandTotal.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-t pt-4 text-slate-700">
                    <p><strong>Total Bales:</strong> {invoice.totalBales.toLocaleString()}</p>
                    <p><strong>Total Kg:</strong> {invoice.totalKg.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>

                 <div className="flex justify-between items-center pt-16 text-sm text-slate-600">
                     <p>____________________<br/>Prepared By</p>
                     <p>____________________<br/>Approved By</p>
                 </div>
            </div>
            <div className="flex justify-end pt-6 space-x-2 no-print">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Close</button>
                <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Print Invoice</button>
            </div>
        </Modal>
    );
};

const VoucherViewModal: React.FC<{ voucherId: string; onClose: () => void; state: AppState }> = ({ voucherId, onClose, state }) => {
    const entries = state.journalEntries.filter(je => je.voucherId === voucherId);

    const allAccounts = useMemo(() => [
        ...state.banks.map(b => ({ id: b.id, name: `${b.accountTitle} (Bank)` })),
        ...state.cashAccounts.map(c => ({ id: c.id, name: `${c.name} (Cash)` })),
        ...state.customers.map(c => ({ id: c.id, name: `${c.name} (Customer)`})),
        ...state.suppliers.map(s => ({ id: s.id, name: `${s.name} (Supplier)`})),
        ...state.commissionAgents.map(ca => ({ id: ca.id, name: `${ca.name} (Commission Agent)`})),
        ...state.loanAccounts, ...state.capitalAccounts, ...state.investmentAccounts, ...state.expenseAccounts,
        ...state.receivableAccounts, ...state.payableAccounts, ...state.revenueAccounts,
    ], [state]);
    
    const getAccountName = (id: string, entityId?: string, entityType?: string) => {
        if (entityType === 'customer') return state.customers.find(c => c.id === entityId)?.name || entityId;
        if (entityType === 'supplier') return state.suppliers.find(s => s.id === entityId)?.name || entityId;
        if (entityType === 'commissionAgent') return state.commissionAgents.find(s => s.id === entityId)?.name || entityId;
        return allAccounts.find(acc => acc.id === id)?.name || id;
    };

    if (entries.length === 0) {
        return ( <Modal isOpen={true} onClose={onClose} title="Error"><p>Could not find voucher with ID: {voucherId}</p></Modal> );
    }
    
    const mainEntry = entries[0];
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    const handlePrint = () => window.print();

    return (
        <Modal isOpen={true} onClose={onClose} title={`Voucher Details: ${voucherId}`} size="4xl">
            <div id="voucher-print-area" className="space-y-4 text-sm text-slate-800">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">{mainEntry.entryType} Voucher</h2>
                    <p className="text-slate-600">USMAN GLOBAL</p>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-b pb-4 text-slate-700">
                    <p><strong>Voucher ID:</strong> {voucherId}</p>
                    <p><strong>Date:</strong> {mainEntry.date}</p>
                    <p><strong>Amount:</strong> ${totalDebit.toFixed(2)}</p>
                    <p><strong>Description:</strong> {mainEntry.description}</p>
                </div>
                <table className="w-full text-left table-auto my-4 border-t border-b">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="p-2 font-semibold text-slate-600">Account</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Debit</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(entry => (
                            <tr key={entry.id} className="border-b">
                                <td className="p-2 text-slate-700">{getAccountName(entry.account, entry.entityId, entry.entityType as any)}</td>
                                <td className="p-2 text-slate-700 text-right">{entry.debit > 0 ? entry.debit.toFixed(2) : '-'}</td>
                                <td className="p-2 text-slate-700 text-right">{entry.credit > 0 ? entry.credit.toFixed(2) : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold bg-slate-100">
                            <td className="p-2 text-right text-slate-800">Total</td>
                            <td className="p-2 text-right text-slate-800">${totalDebit.toFixed(2)}</td>
                            <td className="p-2 text-right text-slate-800">${totalCredit.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div className="flex justify-between items-center pt-16 text-sm text-slate-600">
                     <p>____________________<br/>Prepared By</p>
                     <p>____________________<br/>Approved By</p>
                 </div>
            </div>
            <div className="flex justify-end pt-6 space-x-2 no-print">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Close</button>
                <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Print Voucher</button>
            </div>
        </Modal>
    );
};


type AccountType = 'All' | 'Customer' | 'Supplier' | 'Vendor' | 'Commission Agent' | 'Freight Forwarder' | 'Clearing Agent' | 'Employee' | 'Bank' | 'Cash' | 'Loan' | 'Capital' | 'Investment' | 'Expense' | 'Receivable' | 'Payable' | 'Revenue' | 'Inventory' | 'Fixed Asset' | 'Accumulated Depreciation';
type DisplayCurrency = 'USD' | 'FCY'; // FCY = Foreign Currency

interface LedgerReportProps {
    initialFilters?: any;
}

const LedgerReport: React.FC<LedgerReportProps> = ({ initialFilters }) => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    
    const [filters, setFilters] = useState({
        startDate: '2024-01-01',
        endDate: today,
        accountType: 'All' as AccountType,
        accountId: '',
    });
    const [viewingDocumentId, setViewingDocumentId] = useState<string | null>(null);
    const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('USD');

    useEffect(() => {
        if (initialFilters) {
            setFilters(prev => ({ ...prev, ...initialFilters }));
        }
    }, [initialFilters]);

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value, ...(filterName === 'accountType' && { accountId: '' }) }));
    };

    const allAccountGroups = useMemo(() => {
        return [
            { label: 'Customers', type: 'Customer' as AccountType, list: state.customers },
            { label: 'Suppliers', type: 'Supplier' as AccountType, list: state.suppliers },
            { label: 'Vendors', type: 'Vendor' as AccountType, list: state.vendors },
            { label: 'Commission Agents', type: 'Commission Agent' as AccountType, list: state.commissionAgents },
            { label: 'Freight Forwarders', type: 'Freight Forwarder' as AccountType, list: state.freightForwarders },
            { label: 'Clearing Agents', type: 'Clearing Agent' as AccountType, list: state.clearingAgents },
            { label: 'Employees', type: 'Employee' as AccountType, list: state.employees.map(e => ({ id: e.id, name: e.fullName })) },
            { label: 'Banks', type: 'Bank' as AccountType, list: state.banks.map(b => ({ id: b.id, name: b.accountTitle })) },
            { label: 'Cash Accounts', type: 'Cash' as AccountType, list: state.cashAccounts },
            { label: 'Loan Accounts', type: 'Loan' as AccountType, list: state.loanAccounts },
            { label: 'Capital Accounts', type: 'Capital' as AccountType, list: state.capitalAccounts },
            { label: 'Investment Accounts', type: 'Investment' as AccountType, list: state.investmentAccounts },
            { label: 'Expense Accounts', type: 'Expense' as AccountType, list: state.expenseAccounts },
            { label: 'Receivable Accounts', type: 'Receivable' as AccountType, list: state.receivableAccounts },
            { label: 'Payable Accounts', type: 'Payable' as AccountType, list: state.payableAccounts },
            { label: 'Revenue Accounts', type: 'Revenue' as AccountType, list: state.revenueAccounts },
            { label: 'Inventory Accounts', type: 'Inventory' as AccountType, list: state.inventoryAccounts },
            { label: 'Fixed Asset Accounts', type: 'Fixed Asset' as AccountType, list: state.fixedAssetAccounts },
            { label: 'Accumulated Depreciation Accounts', type: 'Accumulated Depreciation' as AccountType, list: state.accumulatedDepreciationAccounts },
        ].filter(group => group.list && group.list.length > 0);
    }, [state]);

    const entityGroupsForSelector = useMemo(() => {
        return allAccountGroups.map(group => ({
            label: group.label,
            entities: group.list.map(acc => ({
                id: `${group.type}__${acc.id}`,
                name: ('name' in acc ? acc.name : (acc as any).accountTitle) || acc.id
            }))
        }));
    }, [allAccountGroups]);
    
    const accountOptions = useMemo(() => {
        switch (filters.accountType) {
            case 'Customer': return state.customers;
            case 'Supplier': return state.suppliers;
            case 'Vendor': return state.vendors;
            case 'Commission Agent': return state.commissionAgents;
            case 'Freight Forwarder': return state.freightForwarders;
            case 'Clearing Agent': return state.clearingAgents;
            case 'Employee': return state.employees.map(e => ({ id: e.id, name: e.fullName }));
            case 'Bank': return state.banks.map(b => ({ id: b.id, name: b.accountTitle }));
            case 'Cash': return state.cashAccounts;
            case 'Loan': return state.loanAccounts;
            case 'Capital': return state.capitalAccounts;
            case 'Investment': return state.investmentAccounts;
            case 'Expense': return state.expenseAccounts;
            case 'Receivable': return state.receivableAccounts;
            case 'Payable': return state.payableAccounts;
            case 'Revenue': return state.revenueAccounts;
            case 'Inventory': return state.inventoryAccounts;
            case 'Fixed Asset': return state.fixedAssetAccounts;
            case 'Accumulated Depreciation': return state.accumulatedDepreciationAccounts;
            default: return [];
        }
    }, [filters.accountType, state]);

    const accountEntitiesForSelector = useMemo(() => {
        return accountOptions.map(acc => ({
            id: acc.id,
            name: ('name' in acc ? acc.name : (acc as any).accountTitle) || acc.id
        }));
    }, [accountOptions]);

    const accountCurrencyInfo = useMemo(() => {
        if (!filters.accountId) return null;
        let currency: Currency | undefined;
        switch(filters.accountType) {
            case 'Supplier': currency = state.suppliers.find(a => a.id === filters.accountId)?.defaultCurrency; break;
            case 'Bank': currency = state.banks.find(a => a.id === filters.accountId)?.currency; break;
            case 'Cash': currency = state.cashAccounts.find(a => a.id === filters.accountId)?.currency; break;
        }
        if (currency && currency !== Currency.Dollar) {
            return { currency };
        }
        return null;
    }, [filters.accountId, filters.accountType, state]);

    useEffect(() => {
        if (accountCurrencyInfo) {
            setDisplayCurrency('FCY');
        } else {
            setDisplayCurrency('USD');
        }
    }, [accountCurrencyInfo]);

    const summaryReportData = useMemo(() => {
        if (filters.accountId || filters.accountType === 'All') {
            return null;
        }
    
        const calculateSummary = (
            entityList: { id: string; name: string; [key: string]: any }[],
            isEntityBased: boolean,
            generalAccountId?: string
        ) => {
            if (isEntityBased && !generalAccountId) return [];
    
            return entityList.map(entity => {
                const relevantEntries = state.journalEntries.filter(je =>
                    isEntityBased
                        ? (je.account === generalAccountId && je.entityId === entity.id)
                        : (je.account === entity.id)
                );
    
                const openingBalance = relevantEntries
                    .filter(je => je.date < filters.startDate)
                    .reduce((bal, je) => bal + je.debit - je.credit, 0);
    
                const periodEntries = relevantEntries.filter(je => je.date >= filters.startDate && je.date <= filters.endDate);
                const totalDebit = periodEntries.reduce((sum, je) => sum + je.debit, 0);
                const totalCredit = periodEntries.reduce((sum, je) => sum + je.credit, 0);
                const closingBalance = openingBalance + totalDebit - totalCredit;
    
                return {
                    id: entity.id,
                    name: entity.name,
                    openingBalance,
                    totalDebit,
                    totalCredit,
                    closingBalance
                };
            });
        };
    
        const payableAccountId = state.payableAccounts.find(acc => acc.name === 'Accounts Payable')?.id;
    
        switch (filters.accountType) {
            case 'Customer':
                return calculateSummary(state.customers, true, state.receivableAccounts[0]?.id);
            case 'Supplier':
                return calculateSummary(state.suppliers, true, payableAccountId);
            case 'Vendor':
                return calculateSummary(state.vendors, true, payableAccountId);
            case 'Commission Agent':
                return calculateSummary(state.commissionAgents, true, payableAccountId);
            case 'Freight Forwarder':
                return calculateSummary(state.freightForwarders, true, payableAccountId);
            case 'Clearing Agent':
                return calculateSummary(state.clearingAgents, true, payableAccountId);
            case 'Employee':
                return calculateSummary(state.employees.map(e => ({ ...e, name: e.fullName })), true, payableAccountId);
            case 'Bank':
                return calculateSummary(state.banks.map(b => ({ ...b, name: b.accountTitle })), false);
            case 'Cash':
                return calculateSummary(state.cashAccounts, false);
            case 'Loan':
                return calculateSummary(state.loanAccounts, false);
            case 'Capital':
                return calculateSummary(state.capitalAccounts, false);
            case 'Investment':
                return calculateSummary(state.investmentAccounts, false);
            case 'Expense':
                return calculateSummary(state.expenseAccounts, false);
            case 'Revenue':
                 return calculateSummary(state.revenueAccounts, false);
            default:
                return null;
        }
    }, [filters, state]);
    
    const allAccountsSummaryData = useMemo(() => {
        if (filters.accountType !== 'All' || filters.accountId) {
            return [];
        }

        const allEntriesUpToDate = state.journalEntries.filter(je => je.date <= filters.endDate);
        const results: { id: string, name: string, type: string, closingBalance: number }[] = [];

        const calculateBalance = (entries: JournalEntry[]) => entries.reduce((bal, je) => bal + je.debit - je.credit, 0);

        const entityAccountGroups: { type: AccountType, accountId: string, list: { id: string, name: string }[] }[] = [
            { type: 'Customer', accountId: state.receivableAccounts[0]?.id, list: state.customers },
            { type: 'Supplier', accountId: state.payableAccounts[0]?.id, list: state.suppliers },
            { type: 'Vendor', accountId: state.payableAccounts[0]?.id, list: state.vendors },
            { type: 'Commission Agent', accountId: state.payableAccounts[0]?.id, list: state.commissionAgents },
            { type: 'Freight Forwarder', accountId: state.payableAccounts[0]?.id, list: state.freightForwarders },
            { type: 'Clearing Agent', accountId: state.payableAccounts[0]?.id, list: state.clearingAgents },
            { type: 'Employee', accountId: state.payableAccounts[0]?.id, list: state.employees.map(e => ({ ...e, name: e.fullName })) },
        ];

        entityAccountGroups.forEach(({ type, accountId, list }) => {
            if (!accountId) return;
            list.forEach(entity => {
                const balance = calculateBalance(allEntriesUpToDate.filter(je => je.account === accountId && je.entityId === entity.id));
                if (Math.abs(balance) > 0.01) {
                    results.push({ id: entity.id, name: entity.name, type, closingBalance: balance });
                }
            });
        });

        const directAccountLists: { type: AccountType, list: {id: string, name: string}[] }[] = [
            { type: 'Bank', list: state.banks.map(b => ({id: b.id, name: b.accountTitle})) },
            { type: 'Cash', list: state.cashAccounts },
            { type: 'Loan', list: state.loanAccounts },
            { type: 'Capital', list: state.capitalAccounts },
            { type: 'Investment', list: state.investmentAccounts },
            { type: 'Expense', list: state.expenseAccounts },
            { type: 'Revenue', list: state.revenueAccounts },
            ...state.inventoryAccounts.map(acc => ({type: 'Inventory' as AccountType, list: [acc]})),
            ...state.payableAccounts.filter(acc => acc.name !== 'Accounts Payable').map(acc => ({type: 'Payable' as AccountType, list: [acc]}))
        ];

        directAccountLists.forEach(({ type, list }) => {
            list.forEach(account => {
                const balance = calculateBalance(allEntriesUpToDate.filter(je => je.account === account.id));
                if (Math.abs(balance) > 0.01) {
                    results.push({ id: account.id, name: account.name, type, closingBalance: balance });
                }
            });
        });
        
        return results.sort((a,b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    }, [filters.accountType, filters.accountId, filters.endDate, state]);


    const { openingBalance, transactions, closingBalance } = useMemo(() => {
        if (!filters.accountId) {
            return { openingBalance: 0, transactions: [], closingBalance: 0 };
        }

        let relevantEntries: JournalEntry[] = [];
        const isEntityLedger = ['Customer', 'Supplier', 'Vendor', 'Commission Agent', 'Freight Forwarder', 'Clearing Agent', 'Employee', 'Payable'].includes(filters.accountType);
        
        if (isEntityLedger) {
            let generalAccount;
            if (filters.accountType === 'Customer') generalAccount = state.receivableAccounts[0]?.id;
            else if (filters.accountType === 'Payable') generalAccount = filters.accountId;
            else generalAccount = state.payableAccounts[0]?.id;

            if (generalAccount) {
                 relevantEntries = state.journalEntries.filter(je => 
                    (filters.accountType === 'Payable' && je.account === generalAccount) ||
                    (je.account === generalAccount && je.entityId === filters.accountId)
                 );
            }
        } else {
            relevantEntries = state.journalEntries.filter(je => je.account === filters.accountId);
        }

        let lastKnownRate = 0; // USD per FCY
        const entriesWithFcy = [...relevantEntries].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(t => {
            let debitFcy = 0, creditFcy = 0;
            if (t.originalAmount) {
                if (t.debit > 0) debitFcy = t.originalAmount.amount;
                if (t.credit > 0) creditFcy = t.originalAmount.amount;
                const totalUsd = t.debit + t.credit;
                if (t.originalAmount.amount > 0) {
                    lastKnownRate = totalUsd / t.originalAmount.amount;
                }
            } else if (accountCurrencyInfo && lastKnownRate > 0) {
                 debitFcy = t.debit / lastKnownRate;
                 creditFcy = t.credit / lastKnownRate;
            }
            return { ...t, debitFcy, creditFcy };
        });
        
        const useFcy = displayCurrency === 'FCY' && accountCurrencyInfo;
        
        const openingBalance = entriesWithFcy
            .filter(je => je.date < filters.startDate)
            .reduce((balance, je) => {
                const debit = useFcy ? je.debitFcy : je.debit;
                const credit = useFcy ? je.creditFcy : je.credit;
                return balance + debit - credit;
            }, 0);

        const periodTransactions = entriesWithFcy
            .filter(je => je.date >= filters.startDate && je.date <= filters.endDate);

        let runningBalance = openingBalance;
        const transactionsWithBalance = periodTransactions.map(t => {
            const debit = useFcy ? t.debitFcy : t.debit;
            const credit = useFcy ? t.creditFcy : t.credit;
            runningBalance += debit - credit;
            return { ...t, debit, credit, balance: runningBalance };
        });

        return {
            openingBalance,
            transactions: transactionsWithBalance.slice().reverse(),
            closingBalance: runningBalance,
        };

    }, [filters, state, displayCurrency, accountCurrencyInfo]);
    
    const currencySymbol = displayCurrency === 'FCY' && accountCurrencyInfo ? accountCurrencyInfo.currency : '$';
    
    const formatCurrency = (val: number) => Math.abs(val).toFixed(2);
    const getBalanceSuffix = (val: number) => val >= 0 ? 'Dr' : 'Cr';

    const ledgerExportData = useMemo(() => {
        if (!filters.accountId) return [];
        const openingRow = { date: '', voucher: 'Opening Balance', description: `Balance as of ${filters.startDate}`, debit: '', credit: '', balance: `${formatCurrency(openingBalance)} ${getBalanceSuffix(openingBalance)}` };
        const transactionRows = transactions.map(t => ({ date: t.date, voucher: t.voucherId, description: t.description, debit: t.debit > 0 ? t.debit.toFixed(2) : '', credit: t.credit > 0 ? t.credit.toFixed(2) : '', balance: `${formatCurrency(t.balance)} ${getBalanceSuffix(t.balance)}` }));
        const closingRow = { date: '', voucher: 'Closing Balance', description: `Balance as of ${filters.endDate}`, debit: '', credit: '', balance: `${formatCurrency(closingBalance)} ${getBalanceSuffix(closingBalance)}` };
        return [openingRow, ...transactionRows, closingRow];
    }, [openingBalance, transactions, closingBalance, filters.startDate, filters.endDate, filters.accountId]);
    
    const exportHeaders = [ { label: 'Date', key: 'date' }, { label: 'Voucher', key: 'voucher' }, { label: 'Description', key: 'description' }, { label: `Debit (${currencySymbol})`, key: 'debit' }, { label: `Credit (${currencySymbol})`, key: 'credit' }, { label: `Balance (${currencySymbol})`, key: 'balance' }, ];

    const renderDetailedLedger = () => (
        <div className="overflow-x-auto">
             <table className="w-full text-left table-auto text-sm">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="p-2 font-semibold text-slate-600">Date</th>
                        <th className="p-2 font-semibold text-slate-600">Voucher</th>
                        <th className="p-2 font-semibold text-slate-600">Description</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Debit ({currencySymbol})</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Credit ({currencySymbol})</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Balance ({currencySymbol})</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b bg-slate-50 font-medium">
                        <td colSpan={5} className="p-2 text-slate-700">Opening Balance</td>
                        <td className="p-2 text-right text-slate-700">{formatCurrency(openingBalance)} {getBalanceSuffix(openingBalance)}</td>
                    </tr>
                    {transactions.map(t => {
                        return (
                        <tr key={t.id} className="border-b hover:bg-slate-50">
                            <td className="p-2 text-slate-800">{t.date}</td>
                            <td className="p-2 text-slate-800">
                                <button onClick={(e) => { e.preventDefault(); setViewingDocumentId(t.voucherId); }} className="text-blue-600 hover:underline font-mono">
                                    {t.voucherId}
                                </button>
                            </td>
                            <td className="p-2 text-slate-800">{t.description}</td>
                            <td className="p-2 text-slate-800 text-right">{t.debit > 0 ? t.debit.toFixed(2) : '-'}</td>
                            <td className="p-2 text-slate-800 text-right">{t.credit > 0 ? t.credit.toFixed(2) : '-'}</td>
                            <td className="p-2 text-slate-800 text-right">{formatCurrency(t.balance)} {getBalanceSuffix(t.balance)}</td>
                        </tr>
                        )
                    })}
                     <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                        <td colSpan={5} className="p-2 text-right text-slate-800">Closing Balance</td>
                        <td className="p-2 text-right text-slate-800">{formatCurrency(closingBalance)} {getBalanceSuffix(closingBalance)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
    
    const renderSummaryReport = () => {
        if (!summaryReportData || summaryReportData.length === 0) return (
            <p className="text-center text-slate-500 py-8">No accounts with balances found for this account type.</p>
        );
    
        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">{filters.accountType}</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Opening Balance</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Total Debit</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Total Credit</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Closing Balance</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summaryReportData.map(c => (
                            <tr key={c.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-800">{c.name}</td>
                                <td className="p-2 text-slate-800 text-right">{formatCurrency(c.openingBalance)} {getBalanceSuffix(c.openingBalance)}</td>
                                <td className="p-2 text-slate-800 text-right">{c.totalDebit.toFixed(2)}</td>
                                <td className="p-2 text-slate-800 text-right">{c.totalCredit.toFixed(2)}</td>
                                <td className="p-2 text-slate-800 text-right font-medium">{formatCurrency(c.closingBalance)} {getBalanceSuffix(c.closingBalance)}</td>
                                <td className="p-2 text-center">
                                    <button onClick={() => handleFilterChange('accountId', c.id)} className="text-blue-600 hover:underline text-xs font-semibold">
                                        View Ledger
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderAllAccountsSummary = () => (
        <div className="overflow-x-auto">
            <table className="w-full text-left table-auto text-sm">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="p-2 font-semibold text-slate-600">Account Name</th>
                        <th className="p-2 font-semibold text-slate-600">Account Type</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Closing Balance</th>
                        <th className="p-2 font-semibold text-slate-600 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {allAccountsSummaryData.map(acc => (
                        <tr key={`${acc.type}-${acc.id}`} className="border-b hover:bg-slate-50">
                            <td className="p-2 text-slate-800">{acc.name}</td>
                            <td className="p-2 text-slate-800">{acc.type}</td>
                            <td className="p-2 text-slate-800 text-right font-medium">{formatCurrency(acc.closingBalance)} {getBalanceSuffix(acc.closingBalance)}</td>
                            <td className="p-2 text-center">
                                <button onClick={() => {
                                    handleFilterChange('accountType', acc.type as AccountType);
                                    handleFilterChange('accountId', acc.id);
                                }} className="text-blue-600 hover:underline text-xs font-semibold">
                                    View Ledger
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Ledger Report"
                exportData={ledgerExportData}
                exportHeaders={exportHeaders}
                exportFilename={`Ledger_${filters.accountId || 'report'}_${filters.startDate}_to_${filters.endDate}`}
            />
            <div className="p-4 bg-slate-50 rounded-lg border mb-6 flex flex-wrap gap-4 items-end no-print">
                <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Account Type</label>
                        <select value={filters.accountType} onChange={e => handleFilterChange('accountType', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                            <option>All</option>
                            <option>Customer</option>
                            <option>Supplier</option>
                            <option>Vendor</option>
                            <option>Commission Agent</option>
                            <option>Freight Forwarder</option>
                            <option>Clearing Agent</option>
                            <option>Employee</option>
                            <option>Bank</option>
                            <option>Cash</option>
                            <option>Expense</option>
                            <option>Loan</option>
                            <option>Capital</option>
                            <option>Investment</option>
                            <option>Receivable</option>
                            <option>Payable</option>
                            <option>Revenue</option>
                        </select>
                    </div>
                    <div className="flex-grow min-w-[250px]">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
                        {filters.accountType === 'All' ? (
                            <EntitySelector
                                entityGroups={entityGroupsForSelector}
                                selectedEntityId={filters.accountId ? `${filters.accountType}__${filters.accountId}` : ''}
                                onSelect={(value) => {
                                    if (!value) {
                                        handleFilterChange('accountId', '');
                                        handleFilterChange('accountType', 'All');
                                    } else {
                                        const [type, id] = value.split('__');
                                        setFilters(prev => ({ ...prev, accountType: type as AccountType, accountId: id }));
                                    }
                                }}
                                placeholder="Search or select an account..."
                            />
                        ) : (
                            <EntitySelector
                                entities={accountEntitiesForSelector}
                                selectedEntityId={filters.accountId}
                                onSelect={(id) => handleFilterChange('accountId', id)}
                                placeholder={filters.accountId ? `Search in ${filters.accountType}s...` : `All ${filters.accountType}s (Summary)`}
                                disabled={!filters.accountType}
                            />
                        )}
                    </div>
                </ReportFilters>
                {accountCurrencyInfo && (
                     <div className="ml-auto">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Display Currency</label>
                        <div className="flex items-center space-x-2 bg-white p-1 rounded-md border">
                            <button onClick={() => setDisplayCurrency('FCY')} className={`px-3 py-1 text-sm rounded ${displayCurrency === 'FCY' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600'}`}>
                                {accountCurrencyInfo.currency}
                            </button>
                             <button onClick={() => setDisplayCurrency('USD')} className={`px-3 py-1 text-sm rounded ${displayCurrency === 'USD' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600'}`}>
                                $ (USD)
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {filters.accountType === 'All' && !filters.accountId
                ? renderAllAccountsSummary()
                : filters.accountId
                ? renderDetailedLedger()
                : summaryReportData
                ? renderSummaryReport()
                : <p className="text-slate-500 text-center py-8">Please select an account to generate a ledger.</p>
            }


             {viewingDocumentId && viewingDocumentId.startsWith('SI') && (
                <SalesInvoiceViewModal 
                    invoiceId={viewingDocumentId}
                    onClose={() => setViewingDocumentId(null)}
                    state={state}
                />
            )}
            {viewingDocumentId && !viewingDocumentId.startsWith('SI') && (
                <VoucherViewModal
                    voucherId={viewingDocumentId}
                    onClose={() => setViewingDocumentId(null)}
                    state={state}
                />
            )}
        </div>
    );
};

export default LedgerReport;
