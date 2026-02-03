
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { JournalEntry, JournalEntryType, Currency, UserProfile, AppState, SalesInvoice, PackingType, InvoiceItem } from '../types.ts';
import CurrencyInput from './ui/CurrencyInput.tsx';
import ReportFilters from './reports/ReportFilters.tsx';
import Modal from './ui/Modal.tsx';
import PackingMaterialModule from './PackingMaterialModule.tsx';
import FixedAssetsModule from './FixedAssetsModule.tsx';
import EntitySelector from './ui/EntitySelector.tsx';

const Notification: React.FC<{ message: string; onTimeout: () => void }> = ({ message, onTimeout }) => {
    useEffect(() => {
        const timer = setTimeout(onTimeout, 2000);
        return () => clearTimeout(timer);
    }, [onTimeout]);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out">
            {message}
        </div>
    );
};

const VoucherViewModal: React.FC<{ voucherId: string; onClose: () => void; state: AppState }> = ({ voucherId, onClose, state }) => {
    const entries = state.journalEntries.filter(je => je.voucherId === voucherId);

    const allAccounts = useMemo(() => [
        ...state.banks.map(b => ({ id: b.id, name: `${b.accountTitle} (Bank)` })),
        ...state.cashAccounts.map(c => ({ id: c.id, name: `${c.name} (Cash)` })),
        ...state.customers.map(c => ({ id: c.id, name: `${c.name} (Customer)`})),
        ...state.suppliers.map(s => ({ id: s.id, name: `${s.name} (Supplier)`})),
        ...state.vendors.map(v => ({ id: v.id, name: `${v.name} (Vendor)` })),
        ...state.commissionAgents.map(ca => ({ id: ca.id, name: `${ca.name} (Commission Agent)`})),
        ...state.employees.map(e => ({ id: e.id, name: e.fullName })),
        ...state.freightForwarders.map(e => ({ id: e.id, name: e.name })),
        ...state.clearingAgents.map(e => ({ id: e.id, name: e.name })),
        ...state.loanAccounts, ...state.capitalAccounts, ...state.investmentAccounts, ...state.expenseAccounts,
        ...state.receivableAccounts, ...state.payableAccounts, ...state.revenueAccounts,
        ...state.inventoryAccounts, ...state.packingMaterialInventoryAccounts, ...state.fixedAssetAccounts,
        ...state.accumulatedDepreciationAccounts,
    ], [state]);
    
    const getAccountName = (entry: JournalEntry) => {
        if (entry.entityId && entry.entityType) {
            switch(entry.entityType) {
                case 'customer': return state.customers.find(c => c.id === entry.entityId)?.name || entry.entityId;
                case 'supplier': return state.suppliers.find(s => s.id === entry.entityId)?.name || entry.entityId;
                case 'vendor': return state.vendors.find(v => v.id === entry.entityId)?.name || entry.entityId;
                case 'commissionAgent': return state.commissionAgents.find(ca => ca.id === entry.entityId)?.name || entry.entityId;
                case 'employee': return state.employees.find(e => e.id === entry.entityId)?.fullName || entry.entityId;
                case 'freightForwarder': return state.freightForwarders.find(e => e.id === entry.entityId)?.name || entry.entityId;
                case 'clearingAgent': return state.clearingAgents.find(e => e.id === entry.entityId)?.name || entry.entityId;
                case 'fixedAsset': return state.fixedAssets.find(e => e.id === entry.entityId)?.name || entry.entityId;
            }
        }
        return allAccounts.find(acc => acc.id === entry.account)?.name || entry.account;
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
                            <th className="p-2 font-semibold text-slate-600">Description</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Debit</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(entry => (
                            <tr key={entry.id} className="border-b">
                                <td className="p-2 text-slate-700">{getAccountName(entry)}</td>
                                <td className="p-2 text-slate-700">{entry.description}</td>
                                <td className="p-2 text-slate-700 text-right">{entry.debit > 0 ? entry.debit.toFixed(2) : '-'}</td>
                                <td className="p-2 text-slate-700 text-right">{entry.credit > 0 ? entry.credit.toFixed(2) : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold bg-slate-100">
                            <td colSpan={2} className="p-2 text-right text-slate-800">Total</td>
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

type JournalItem = {
    account: string;
    debit: string;
    credit: string;
    description: string;
    currency: Currency;
    conversionRate: number;
};


interface NewVoucherFormProps {
    userProfile: UserProfile | null;
    showNotification: (msg: string) => void;
}

const NewVoucherForm: React.FC<NewVoucherFormProps> = ({ userProfile, showNotification }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        entryType: JournalEntryType.Receipt,
        fromToAccount: '',
        cashBankAccount: '',
        amount: '',
        description: '',
        currency: Currency.Dollar,
        conversionRate: 1,
    });
    const [journalItems, setJournalItems] = useState<JournalItem[]>([
        { account: '', debit: '', credit: '', description: '', currency: Currency.Dollar, conversionRate: 1 },
        { account: '', debit: '', credit: '', description: '', currency: Currency.Dollar, conversionRate: 1 },
    ]);
    
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    const accountOptions = useMemo(() => {
        if (formData.entryType === JournalEntryType.Receipt) {
            return {
                fromToLabel: 'Received From',
                fromToOptions: [
                    { label: 'Customers', entities: state.customers },
                    { label: 'Other', entities: [{ id: 'misc-receipt', name: 'Miscellaneous Receipt' }] },
                ],
                cashBankLabel: 'To Account',
                cashBankOptions: [ ...state.cashAccounts, ...state.banks.map(b => ({ id: b.id, name: b.accountTitle })) ],
            };
        } else if (formData.entryType === JournalEntryType.Payment) {
            return {
                fromToLabel: 'Paid To',
                fromToOptions: [
                    { label: 'Suppliers', entities: state.suppliers },
                    { label: 'Vendors', entities: state.vendors },
                    { label: 'Customers', entities: state.customers },
                    { label: 'Commission Agents', entities: state.commissionAgents },
                    { label: 'Freight Forwarders', entities: state.freightForwarders },
                    { label: 'Clearing Agents', entities: state.clearingAgents },
                    { label: 'Employees', entities: state.employees.map(e => ({ id: e.id, name: e.fullName })) },
                    { label: 'Loan Accounts', entities: state.loanAccounts },
                    { label: 'Capital Accounts', entities: state.capitalAccounts },
                    { label: 'Investment Accounts', entities: state.investmentAccounts },
                ],
                cashBankLabel: 'From Account',
                cashBankOptions: [ ...state.cashAccounts, ...state.banks.map(b => ({ id: b.id, name: b.accountTitle })) ],
            };
        } else { // Expense
             return {
                fromToLabel: 'Expense Account',
                fromToOptions: [{ label: 'Expense Accounts', entities: state.expenseAccounts }],
                cashBankLabel: 'Paid From',
                cashBankOptions: [ ...state.cashAccounts, ...state.banks.map(b => ({ id: b.id, name: b.accountTitle })) ],
            };
        }
    }, [formData.entryType, state]);

    const allJournalAccountGroups = useMemo(() => [
        { label: 'Customers', entities: state.customers.map(c => ({ id: `customer__${c.id}`, name: c.name })) },
        { label: 'Suppliers', entities: state.suppliers.map(s => ({ id: `supplier__${s.id}`, name: s.name })) },
        { label: 'Vendors', entities: state.vendors.map(v => ({ id: `vendor__${v.id}`, name: v.name })) },
        { label: 'Commission Agents', entities: state.commissionAgents.map(c => ({ id: `commissionAgent__${c.id}`, name: c.name })) },
        { label: 'Freight Forwarders', entities: state.freightForwarders.map(f => ({ id: `freightForwarder__${f.id}`, name: f.name })) },
        { label: 'Clearing Agents', entities: state.clearingAgents.map(c => ({ id: `clearingAgent__${c.id}`, name: c.name })) },
        { label: 'Employees', entities: state.employees.map(e => ({ id: `employee__${e.id}`, name: e.fullName })) },
        { label: 'Fixed Assets', entities: state.fixedAssets.map(fa => ({ id: `fixedAsset__${fa.id}`, name: fa.name })) },
        { label: 'Banks', entities: state.banks.map(b => ({ id: `account__${b.id}`, name: `${b.accountTitle} (Bank)` })) },
        { label: 'Cash Accounts', entities: state.cashAccounts.map(c => ({ id: `account__${c.id}`, name: c.name })) },
        { label: 'Loan Accounts', entities: state.loanAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })) },
        { label: 'Capital Accounts', entities: state.capitalAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })) },
        { label: 'Investment Accounts', entities: state.investmentAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })) },
        { label: 'Expense Accounts', entities: state.expenseAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })) },
        { label: 'System Accounts', entities: [
            ...state.receivableAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })),
            ...state.payableAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })),
            ...state.revenueAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })),
            ...state.inventoryAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })),
            ...state.packingMaterialInventoryAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })),
            ...state.fixedAssetAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })),
            ...state.accumulatedDepreciationAccounts.map(a => ({ id: `account__${a.id}`, name: a.name })),
        ] },
    ], [state]);

    const { totalDebit, totalCredit, difference } = useMemo(() => {
        const totals = journalItems.reduce((acc, item) => {
            acc.debit += (Number(item.debit) || 0) * item.conversionRate;
            acc.credit += (Number(item.credit) || 0) * item.conversionRate;
            return acc;
        }, { debit: 0, credit: 0 });
        return { totalDebit: totals.debit, totalCredit: totals.credit, difference: totals.debit - totals.credit };
    }, [journalItems]);

    const handleJournalItemChange = (index: number, field: keyof Omit<JournalItem, 'currency' | 'conversionRate'>, value: string) => {
        const newItems = [...journalItems];
        (newItems[index] as any)[field] = value;

        if (field === 'debit' && value !== '') {
            newItems[index].credit = '';
        } else if (field === 'credit' && value !== '') {
            newItems[index].debit = '';
        }
        setJournalItems(newItems);
    };

    const handleJournalCurrencyChange = (index: number, value: { currency: Currency, conversionRate: number }) => {
        const newItems = [...journalItems];
        newItems[index].currency = value.currency;
        newItems[index].conversionRate = value.conversionRate;
        setJournalItems(newItems);
    };
    
    const addJournalItem = () => setJournalItems([...journalItems, { account: '', debit: '', credit: '', description: '', currency: Currency.Dollar, conversionRate: 1 }]);
    const removeJournalItem = (index: number) => setJournalItems(journalItems.filter((_, i) => i !== index));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { date, entryType, fromToAccount, cashBankAccount, amount, description, currency, conversionRate } = formData;
        
        if (entryType === JournalEntryType.Journal) {
            if (Math.abs(difference) > 0.001 || totalDebit === 0) {
                alert("Journal entry must be balanced (Total Debits must equal Total Credits in USD) and not be zero.");
                return;
            }
            if (!formData.description.trim()) {
                alert("A general description for the voucher is required.");
                return;
            }

            const voucherId = `JV-${String(state.nextJournalVoucherNumber).padStart(3, '0')}`;
            const batchActions: any[] = [];

            journalItems.forEach((item, index) => {
                if (!item.account || (Number(item.debit) === 0 && Number(item.credit) === 0)) return;

                const [type, id] = item.account.split('__');
                const isEntity = type !== 'account';
                
                const debitUSD = (Number(item.debit) || 0) * item.conversionRate;
                const creditUSD = (Number(item.credit) || 0) * item.conversionRate;

                const newEntry: JournalEntry = {
                    id: `je-${voucherId}-${index}`, voucherId, date, entryType,
                    account: isEntity ? (type === 'customer' ? 'AR-001' : 'AP-001') : id,
                    debit: debitUSD,
                    credit: creditUSD,
                    description: item.description || formData.description,
                    entityId: isEntity ? id : undefined,
                    entityType: isEntity ? type as any : undefined,
                    originalAmount: item.currency !== Currency.Dollar ? { amount: Number(item.debit) || Number(item.credit), currency: item.currency } : undefined,
                    createdBy: userProfile?.uid,
                };
                batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: newEntry } });
            });

            if(batchActions.length > 0) {
                dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
                showNotification(`Journal voucher ${voucherId} created successfully.`);
                setJournalItems([{ account: '', debit: '', credit: '', description: '', currency: Currency.Dollar, conversionRate: 1 }, { account: '', debit: '', credit: '', description: '', currency: Currency.Dollar, conversionRate: 1 }]);
                setFormData(prev => ({ ...prev, description: '' }));
            }
            return;
        }


        // --- Existing Logic for Receipt, Payment, Expense ---
        const amountNum = Number(amount);
        if (!fromToAccount || !cashBankAccount || !amount || amountNum <= 0) {
            alert('Please fill all required fields correctly.');
            return;
        }
        const amountInDollar = amountNum * conversionRate;
        let voucherId = '';
        let debitEntry: JournalEntry, creditEntry: JournalEntry;
        const fromToOptionGroups = (accountOptions.fromToOptions as any[]).flatMap(g => g.entities || g);
        const fromToAccountData = fromToOptionGroups.find(o => o.id === fromToAccount);
        

        const baseEntry = { date, entryType, description, originalAmount: currency !== Currency.Dollar ? { amount: amountNum, currency } : undefined, createdBy: userProfile?.uid };

        if (entryType === JournalEntryType.Receipt) {
            voucherId = `RV-${String(state.nextReceiptVoucherNumber).padStart(3, '0')}`;
            debitEntry = { ...baseEntry, id: `je-d-${voucherId}`, voucherId, account: cashBankAccount, debit: amountInDollar, credit: 0 };
            creditEntry = { ...baseEntry, id: `je-c-${voucherId}`, voucherId, account: 'AR-001', debit: 0, credit: amountInDollar, entityId: fromToAccount, entityType: 'customer' };
        } else if (entryType === JournalEntryType.Payment) {
            voucherId = `PV-${String(state.nextPaymentVoucherNumber).padStart(3, '0')}`;
            
            let debitAccount = 'AP-001'; // Default for suppliers/vendors/etc
            let entityType: JournalEntry['entityType'] | undefined;
            let entityId: string | undefined = fromToAccount;

            if (state.customers.some(c => c.id === fromToAccount)) {
                entityType = 'customer';
                debitAccount = 'AR-001'; // Debit AR to reduce credit balance (refund)
            } else if (state.suppliers.some(s => s.id === fromToAccount)) {
                 entityType = 'supplier';
            } else if (state.vendors.some(v => v.id === fromToAccount)) {
                 entityType = 'vendor';
            } else if (state.commissionAgents.some(c => c.id === fromToAccount)) {
                 entityType = 'commissionAgent';
            } else if (state.freightForwarders.some(f => f.id === fromToAccount)) {
                 entityType = 'freightForwarder';
            } else if (state.clearingAgents.some(c => c.id === fromToAccount)) {
                 entityType = 'clearingAgent';
            } else if (state.employees.some(e => e.id === fromToAccount)) {
                 entityType = 'employee';
            } else {
                // It's likely a direct account (Loan, Capital, Investment)
                debitAccount = fromToAccount;
                entityId = undefined;
                entityType = undefined;
            }
            
            debitEntry = { ...baseEntry, id: `je-d-${voucherId}`, voucherId, account: debitAccount, debit: amountInDollar, credit: 0, entityId, entityType };
            creditEntry = { ...baseEntry, id: `je-c-${voucherId}`, voucherId, account: cashBankAccount, debit: 0, credit: amountInDollar };
        } else { // Expense
            voucherId = `EV-${String(state.nextExpenseVoucherNumber).padStart(3, '0')}`;
            debitEntry = { ...baseEntry, id: `je-d-${voucherId}`, voucherId, account: fromToAccount, debit: amountInDollar, credit: 0 };
            creditEntry = { ...baseEntry, id: `je-c-${voucherId}`, voucherId, account: cashBankAccount, debit: 0, credit: amountInDollar };
        }

        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });

        showNotification(`${entryType} voucher ${voucherId} created successfully.`);
        setFormData({ ...formData, fromToAccount: '', amount: '', description: '', currency: Currency.Dollar, conversionRate: 1, });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Voucher Type</label>
                    <select value={formData.entryType} onChange={e => setFormData({ ...formData, entryType: e.target.value as JournalEntryType, fromToAccount: '' })} className="mt-1 w-full p-2 rounded-md">
                        <option value={JournalEntryType.Receipt}>Receipt</option>
                        <option value={JournalEntryType.Payment}>Payment</option>
                        <option value={JournalEntryType.Expense}>Expense</option>
                        <option value={JournalEntryType.Journal}>JV (Journal Voucher)</option>
                    </select>
                </div>
                <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} min={minDate} required className="mt-1 w-full p-2 rounded-md"/></div>
            </div>
            
             {formData.entryType !== JournalEntryType.Journal ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">{accountOptions.fromToLabel}</label>
                            <EntitySelector
                                {...(Array.isArray(accountOptions.fromToOptions) && 'label' in accountOptions.fromToOptions[0]
                                    ? { entityGroups: accountOptions.fromToOptions as any[] }
                                    : { entities: accountOptions.fromToOptions as any[], entityGroups: [{label: "Accounts", entities: accountOptions.fromToOptions as any[] }] })}
                                selectedEntityId={formData.fromToAccount}
                                onSelect={(id) => setFormData({ ...formData, fromToAccount: id })}
                                placeholder={`Search for a ${accountOptions.fromToLabel}...`}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">{accountOptions.cashBankLabel}</label>
                            <EntitySelector
                                entities={accountOptions.cashBankOptions}
                                selectedEntityId={formData.cashBankAccount}
                                onSelect={(id) => setFormData({ ...formData, cashBankAccount: id })}
                                placeholder="Search cash/bank accounts..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-slate-700">Amount</label><input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required className="mt-1 w-full p-2 rounded-md"/></div>
                        <div><label className="block text-sm font-medium text-slate-700">Currency & Rate</label><CurrencyInput value={{ currency: formData.currency, conversionRate: formData.conversionRate }} onChange={v => setFormData(f => ({...f, ...v}))} /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700">Description</label><input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required className="mt-1 w-full p-2 rounded-md"/></div>
                </>
            ) : (
                <>
                    <div><label className="block text-sm font-medium text-slate-700">General Description</label><input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required className="mt-1 w-full p-2 rounded-md"/></div>
                    <div className="overflow-x-auto border rounded-md">
                        <table className="w-full text-left table-auto">
                             <thead><tr className="bg-slate-100">
                                <th className="p-2 font-semibold text-slate-600 w-[25%]">Account</th>
                                <th className="p-2 font-semibold text-slate-600">Line Description</th>
                                <th className="p-2 font-semibold text-slate-600 w-28 text-right">Debit</th>
                                <th className="p-2 font-semibold text-slate-600 w-28 text-right">Credit</th>
                                <th className="p-2 font-semibold text-slate-600 w-48">Currency & Rate</th>
                                <th className="p-2 w-12"></th>
                            </tr></thead>
                            <tbody>
                                {journalItems.map((item, index) => (
                                    <tr key={index} className="border-b">
                                        <td className="p-1 align-top">
                                            <EntitySelector
                                                entityGroups={allJournalAccountGroups}
                                                selectedEntityId={item.account}
                                                onSelect={(id) => handleJournalItemChange(index, 'account', id)}
                                                placeholder="Select Account..."
                                            />
                                        </td>
                                        <td className="p-1 align-top"><input type="text" value={item.description} onChange={e => handleJournalItemChange(index, 'description', e.target.value)} className="w-full p-2 rounded-md"/></td>
                                        <td className="p-1 align-top"><input type="number" step="0.01" value={item.debit} onChange={e => handleJournalItemChange(index, 'debit', e.target.value)} className="w-full p-2 rounded-md text-right"/></td>
                                        <td className="p-1 align-top"><input type="number" step="0.01" value={item.credit} onChange={e => handleJournalItemChange(index, 'credit', e.target.value)} className="w-full p-2 rounded-md text-right"/></td>
                                        <td className="p-1 align-top"><CurrencyInput value={{currency: item.currency, conversionRate: item.conversionRate}} onChange={(value) => handleJournalCurrencyChange(index, value)} /></td>
                                        <td className="p-1 text-center align-top"><button type="button" onClick={() => removeJournalItem(index)} className="text-red-500 hover:text-red-700 font-bold p-2">✕</button></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-100 font-semibold">
                                    <td colSpan={2} className="p-2 text-right">Totals (in USD)</td>
                                    <td className="p-2 text-right">{totalDebit.toFixed(2)}</td>
                                    <td className="p-2 text-right">{totalCredit.toFixed(2)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                                {Math.abs(difference) > 0.001 && (
                                    <tr className="bg-red-100 font-semibold text-red-700">
                                        <td colSpan={4} className="p-2 text-right">Difference</td>
                                        <td colSpan={2} className="p-2 text-center">{difference.toFixed(2)}</td>
                                    </tr>
                                )}
                            </tfoot>
                        </table>
                    </div>
                     <button type="button" onClick={addJournalItem} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md text-sm">+ Add Line</button>
                </>
            )}

            <div className="flex justify-end"><button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Voucher</button></div>
        </form>
    );
};

const UpdateVoucherList: React.FC<{ userProfile: UserProfile | null; }> = ({ userProfile }) => {
    const { state } = useData();
    const [filters, setFilters] = useState({ startDate: '2024-01-01', endDate: new Date().toISOString().split('T')[0], type: 'All' });
    const [viewingVoucherId, setViewingVoucherId] = useState<string|null>(null);

    const groupedVouchers = useMemo(() => {
        const filteredEntries = state.journalEntries.filter(je => 
            je.date >= filters.startDate && 
            je.date <= filters.endDate &&
            (filters.type === 'All' || je.entryType === filters.type) &&
            !je.voucherId.startsWith('SI') // Exclude sales invoices
        );

        const groups: { [id: string]: { voucherId: string, date: string, type: JournalEntryType, description: string, amount: number, entries: JournalEntry[] } } = {};

        filteredEntries.forEach(entry => {
            if (!groups[entry.voucherId]) {
                groups[entry.voucherId] = { voucherId: entry.voucherId, date: entry.date, type: entry.entryType, description: entry.description, amount: 0, entries: [] };
            }
            groups[entry.voucherId].entries.push(entry);
            groups[entry.voucherId].amount += entry.debit;
        });

        return Object.values(groups).sort((a, b) => {
            const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateComparison !== 0) {
                return dateComparison;
            }

            const voucherNumA = parseInt(a.voucherId.split('-').pop() || '0', 10);
            const voucherNumB = parseInt(b.voucherId.split('-').pop() || '0', 10);

            return voucherNumB - voucherNumA;
        });
    }, [filters, state.journalEntries]);
    
    return (
        <div className="space-y-4">
            <ReportFilters filters={filters} onFilterChange={(name, value) => setFilters(f => ({...f, [name]: value}))}>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Voucher Type</label>
                    <select value={filters.type} onChange={e => setFilters(f => ({...f, type: e.target.value}))} className="w-full p-2 rounded-md text-sm">
                        <option>All</option>
                        {Object.values(JournalEntryType).map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>
            </ReportFilters>
             <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-3 font-semibold text-slate-600">ID</th>
                            <th className="p-3 font-semibold text-slate-600">Date</th>
                            <th className="p-3 font-semibold text-slate-600">Type</th>
                            <th className="p-3 font-semibold text-slate-600">Description</th>
                            <th className="p-3 font-semibold text-slate-600 text-right">Amount</th>
                            <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedVouchers.map(v => {
                            const isReversed = v.entries.some(e => String(e.description || '').startsWith('[REVERSED]'));
                            return (
                                <tr key={v.voucherId} className={`border-b hover:bg-slate-50 ${isReversed ? 'bg-red-50 text-slate-500 line-through' : ''}`}>
                                    <td className="p-3 font-mono text-slate-700">{v.voucherId}</td>
                                    <td className="p-3 text-slate-700">{v.date}</td>
                                    <td className="p-3 text-slate-700">{v.type}</td>
                                    <td className="p-3 text-slate-700">{v.description}</td>
                                    <td className="p-3 text-right font-medium text-slate-700">{v.amount.toFixed(2)}</td>
                                    <td className="p-3 text-right space-x-2">
                                        <button onClick={() => setViewingVoucherId(v.voucherId)} className="text-gray-600 hover:text-gray-800 text-sm font-semibold">View</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {viewingVoucherId && <VoucherViewModal voucherId={viewingVoucherId} onClose={() => setViewingVoucherId(null)} state={state} />}
        </div>
    );
};


const AccountingModule: React.FC<{ userProfile: UserProfile | null; initialView?: string | null }> = ({ userProfile, initialView }) => {
    const [subModule, setSubModule] = useState<'new' | 'update' | 'packing' | 'fixedAssets'>(initialView as any || 'new');
    const [notification, setNotification] = useState<string|null>(null);

    useEffect(() => {
        if(initialView) setSubModule(initialView as any);
    }, [initialView]);

    const showNotification = (message: string) => {
        setNotification(message);
    };

    const getButtonClass = (module: 'new' | 'update' | 'packing' | 'fixedAssets') => `px-4 py-2 rounded-md transition-colors text-sm font-medium ${subModule === module ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`;

    return (
        <div className="space-y-6">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
             <div className="bg-white p-4 rounded-lg shadow-md flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-700 mr-4">Accounting</h2>
                <button onClick={() => setSubModule('new')} className={getButtonClass('new')} title="Shortcut: Alt + N">New Voucher</button>
                <button onClick={() => setSubModule('update')} className={getButtonClass('update')} title="Shortcut: Alt + E">Update / View Vouchers</button>
                <button onClick={() => setSubModule('packing')} className={getButtonClass('packing')}>Packing Material</button>
                <button onClick={() => setSubModule('fixedAssets')} className={getButtonClass('fixedAssets')}>Fixed Assets</button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                {subModule === 'new' && <NewVoucherForm userProfile={userProfile} showNotification={showNotification} />}
                {subModule === 'update' && <UpdateVoucherList userProfile={userProfile} />}
                {subModule === 'packing' && <PackingMaterialModule userProfile={userProfile} showNotification={showNotification} />}
                {subModule === 'fixedAssets' && <FixedAssetsModule userProfile={userProfile} showNotification={showNotification} />}
            </div>
        </div>
    );
};

export default AccountingModule;
