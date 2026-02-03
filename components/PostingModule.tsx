import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { SalesInvoice, InvoiceStatus, InvoiceItem, JournalEntry, JournalEntryType, PackingType, Currency, Module, UserProfile } from '../types.ts';
import CurrencyInput from './ui/CurrencyInput.tsx';

interface PostingModuleProps {
    setModule: (module: Module) => void;
    userProfile: UserProfile | null;
}

interface ItemDetails {
    rate: number | '';
    packageRate: number | '';
    currency: Currency;
    conversionRate: number;
}

const PostingModule: React.FC<PostingModuleProps> = ({ setModule, userProfile }) => {
    const { state, dispatch } = useData();
    const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
    const [itemDetails, setItemDetails] = useState<Record<string, ItemDetails>>({});
    
    // These states are now populated from the invoice for calculation purposes, 
    // but are no longer editable via UI in this module.
    const [freightForwarderId, setFreightForwarderId] = useState<string>('');
    const [freightAmount, setFreightAmount] = useState<number | ''>('');
    const [customCharges, setCustomCharges] = useState<number | ''>('');

    const unpostedInvoices = state.salesInvoices.filter(inv => inv.status === InvoiceStatus.Unposted);
    
    const handleSelectInvoice = (invoice: SalesInvoice) => {
        setSelectedInvoice(invoice);
        const initialDetails = invoice.items.reduce((acc, item) => {
            const itemInfo = state.items.find(i => i.id === item.itemId);
            
            // FIX: Initializing with number 0 instead of string '' to avoid arithmetic errors later.
            let ratePerKg: number = 0;
            let packageRate: number = 0;

            if (itemInfo) {
                const isPackage = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(itemInfo.packingType);
                const size = (isPackage ? itemInfo.baleSize : 1) || 1;
                
                if (item.rate) {
                    if (isPackage) {
                        // Invoice item.rate is now the Package Rate
                        packageRate = item.rate;
                        // Calculate rate per Kg for internal consistency/display
                        ratePerKg = item.rate / size;
                    } else {
                        ratePerKg = item.rate;
                    }
                } else {
                    // Fallback to setup prices if rate missing
                    ratePerKg = itemInfo.avgSalesPrice;
                    if (isPackage) {
                        packageRate = ratePerKg * size;
                    }
                }
            }

            acc[item.itemId] = {
                rate: ratePerKg,
                packageRate: packageRate,
                currency: item.currency || Currency.Dollar,
                conversionRate: item.conversionRate || 1,
            };
            return acc;
        }, {} as Record<string, ItemDetails>);
        
        setItemDetails(initialDetails);
        
        // Load existing costs from invoice to state for posting logic
        setFreightForwarderId(invoice.freightForwarderId || '');
        const freightInUSD = (invoice.freightAmount || 0) * (invoice.freightConversionRate || 1);
        setFreightAmount(freightInUSD > 0 ? freightInUSD : '');

        const customChargesInUSD = (invoice.customCharges || 0) * (invoice.customChargesConversionRate || 1);
        setCustomCharges(customChargesInUSD > 0 ? customChargesInUSD : '');
    };

    const handleItemDetailChange = (itemId: string, field: keyof ItemDetails, value: any) => {
        setItemDetails(prev => {
            const currentDetails = { ...prev[itemId] };
            const itemInfo = state.items.find(i => i.id === itemId);
            
            if (field === 'currency') {
                const newCurrency = value.currency;
                const newConversionRate = value.conversionRate;
                 currentDetails.currency = newCurrency;
                 currentDetails.currency = newCurrency;
                 currentDetails.conversionRate = newConversionRate;
            } else {
                (currentDetails as any)[field] = value;

                const isPackage = itemInfo && [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(itemInfo.packingType);
                const size = (isPackage ? itemInfo.baleSize : 1) || 1;

                if (field === 'rate') {
                    const valNum = parseFloat(value);
                    if (value !== '' && !isNaN(valNum)) {
                        currentDetails.packageRate = valNum * size;
                    } else {
                        currentDetails.packageRate = '';
                    }
                } else if (field === 'packageRate') {
                    const valNum = parseFloat(value);
                    if (value !== '' && !isNaN(valNum) && size > 0) {
                         currentDetails.rate = valNum / size;
                    } else {
                         currentDetails.rate = '';
                    }
                }
            }
            
            return { ...prev, [itemId]: currentDetails };
        });
    };

    const handlePostInvoice = () => {
        if (!selectedInvoice) return;

        const updatedItems: InvoiceItem[] = [];
        let totalItemValueInDollar = 0;
        let totalCOGS = 0;

        for (const item of selectedInvoice.items) {
            const details = itemDetails[item.itemId];
            const itemDetailsFromState = state.items.find(i => i.id === item.itemId);
            if (!itemDetailsFromState) {
                console.error(`Could not find details for item ${item.itemId}`);
                continue;
            }

            const isPackage = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(itemDetailsFromState.packingType);
            
            let finalRate = 0;
            if (isPackage) {
                if (details.packageRate === '' || details.packageRate === null || Number(details.packageRate) <= 0) {
                    alert("Please enter a valid Package Rate.");
                    return;
                }
                finalRate = Number(details.packageRate);
            } else {
                if (details.rate === '' || details.rate === null || Number(details.rate) <= 0) {
                    alert("Please enter a valid Rate per Kg.");
                    return;
                }
                finalRate = Number(details.rate);
            }

            let totalKgForItem = 0;
            if (isPackage) {
                totalKgForItem = item.quantity * itemDetailsFromState.baleSize;
            } else {
                totalKgForItem = item.quantity;
            }

            // Logic: Total = Quantity * Rate (Package Rate or Kg Rate based on type)
            const totalForeignAmount = item.quantity * finalRate;
            const itemValueInDollar = totalForeignAmount * details.conversionRate;

            updatedItems.push({ ...item, rate: finalRate, currency: details.currency, conversionRate: details.conversionRate });
            totalItemValueInDollar += itemValueInDollar;
            
            const cogsForItem = totalKgForItem * itemDetailsFromState.avgProductionPrice;
            totalCOGS += cogsForItem;
        }
        
        const freightAmountNum = Number(freightAmount) || 0;
        const customChargesNum = Number(customCharges) || 0;
        const totalInvoiceValueInDollar = totalItemValueInDollar + freightAmountNum + customChargesNum;
        
        const customer = state.customers.find(c => c.id === selectedInvoice.customerId);
        const voucherId = selectedInvoice.id;
        const salesDescription = `Sale - Invoice ${selectedInvoice.id} to ${customer?.name || 'N/A'}`;
        const createdBy = userProfile?.uid;

        const payableAccountId = state.payableAccounts.find(acc => acc.name === 'Accounts Payable')?.id;
        const customsPayableAccountId = state.payableAccounts.find(acc => acc.name === 'Customs Charges Payable')?.id;

        if (!payableAccountId || !customsPayableAccountId) {
            alert("Payable accounts are not configured correctly. Please check accounting setup.");
            return;
        }

        const actions: any[] = [];

        // 1. Debit Customer for the full amount
        const debitEntry: JournalEntry = {
            id: `je-d-${selectedInvoice.id}`, voucherId, date: selectedInvoice.date, entryType: JournalEntryType.Journal, account: 'AR-001',
            debit: totalInvoiceValueInDollar, credit: 0, description: salesDescription, entityId: selectedInvoice.customerId, entityType: 'customer' as const, createdBy,
        };
        actions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });

        // 2. Credit Sales Revenue for items
        if (totalItemValueInDollar > 0) {
            const creditSalesEntry: JournalEntry = {
                id: `je-c-sales-${selectedInvoice.id}`, voucherId, date: selectedInvoice.date, entryType: JournalEntryType.Journal, account: 'REV-001',
                debit: 0, credit: totalItemValueInDollar, description: salesDescription, createdBy,
            };
            actions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditSalesEntry } });
        }
        
        // 3. Credit Freight Forwarder for Freight Amount
        if (freightAmountNum > 0 && freightForwarderId && freightForwarderId !== 'FFW-000') {
            const freightForwarder = state.freightForwarders.find(f => f.id === freightForwarderId);
            const freightDescription = `Freight charges on INV ${selectedInvoice.id} payable to ${freightForwarder?.name || 'N/A'}`;
            const creditFreightEntry: JournalEntry = {
                id: `je-c-freight-${selectedInvoice.id}`, voucherId, date: selectedInvoice.date, entryType: JournalEntryType.Journal, 
                account: payableAccountId,
                debit: 0, 
                credit: freightAmountNum, 
                description: freightDescription,
                entityId: freightForwarderId,
                entityType: 'freightForwarder',
                createdBy,
            };
            actions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditFreightEntry } });
        }


        // 4. Credit Customs Payable Account for Customs Charges
        if (customChargesNum > 0) {
            const customsDescription = `Customs charges on INV ${selectedInvoice.id}`;
            const creditCustomsEntry: JournalEntry = {
                id: `je-c-customs-${selectedInvoice.id}`, voucherId, date: selectedInvoice.date, entryType: JournalEntryType.Journal, 
                account: customsPayableAccountId,
                debit: 0, 
                credit: customChargesNum, 
                description: customsDescription,
                createdBy,
            };
            actions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditCustomsEntry } });
        }

        const commissionAmountNum = selectedInvoice.commissionAmount || 0;
        if (commissionAmountNum > 0 && selectedInvoice.commissionAgentId) {
            const agent = state.commissionAgents.find(ca => ca.id === selectedInvoice.commissionAgentId);
            const commissionDesc = `Commission on INV-${selectedInvoice.id} to ${agent?.name || 'N/A'}`;
            const commissionDebit: JournalEntry = {
                id: `je-d-com-s-${Date.now()}`, voucherId, date: selectedInvoice.date, entryType: JournalEntryType.Journal, account: 'EXP-008',
                debit: commissionAmountNum, credit: 0, description: commissionDesc, createdBy
            };
            const commissionCredit: JournalEntry = {
                id: `je-c-com-s-${Date.now()}`, voucherId, date: selectedInvoice.date, entryType: JournalEntryType.Journal, account: 'AP-001',
                debit: 0, credit: commissionAmountNum, description: commissionDesc, entityId: selectedInvoice.commissionAgentId, entityType: 'commissionAgent', createdBy
            };
            actions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: commissionDebit } });
            actions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: commissionCredit } });
        }

        // 5. Create COGS Journal Entries
        if (totalCOGS > 0) {
            const cogsVoucherId = `COGS-${selectedInvoice.id}`;
            const cogsDescription = `Cost of Goods Sold for INV ${selectedInvoice.id}`;

            const cogsDebitEntry: JournalEntry = {
                id: `je-d-cogs-${cogsVoucherId}`, voucherId: cogsVoucherId, date: selectedInvoice.date, entryType: JournalEntryType.Journal,
                account: 'EXP-011', debit: totalCOGS, credit: 0, description: cogsDescription, createdBy,
            };
            actions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: cogsDebitEntry } });

            const inventoryCreditEntry: JournalEntry = {
                id: `je-c-inv-${cogsVoucherId}`, voucherId: cogsVoucherId, date: selectedInvoice.date, entryType: JournalEntryType.Journal,
                account: 'INV-FG-001', debit: 0, credit: totalCOGS, description: cogsDescription, createdBy,
            };
            actions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: inventoryCreditEntry } });
        }


        const updatedInvoice: SalesInvoice = {
            ...selectedInvoice,
            items: updatedItems,
            status: InvoiceStatus.Posted,
            // We don't update cost fields here because they are already in the invoice from Data Entry
        };

        actions.push({ type: 'UPDATE_ENTITY', payload: { entity: 'salesInvoices', data: updatedInvoice } });
        
        dispatch({ type: 'BATCH_UPDATE', payload: actions });

        alert(`Invoice ${selectedInvoice.id} posted successfully and journal entries created.`);
        setSelectedInvoice(null);
        setItemDetails({});
        setFreightForwarderId('');
        setFreightAmount('');
        setCustomCharges('');
    };
    
    const customerName = (id: string) => state.customers.find(c => c.id === id)?.name || 'N/A';
    const itemName = (id: string) => state.items.find(i => i.id === id)?.name || 'N/A';

    if (selectedInvoice) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-slate-700">Post Invoice Form: {selectedInvoice.id}</h2>
                    <button onClick={() => setSelectedInvoice(null)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                        &larr; Back to List
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <p><strong>Customer:</strong> {customerName(selectedInvoice.customerId)}</p>
                    <p><strong>Date:</strong> {selectedInvoice.date}</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left table-auto">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="p-3 font-semibold text-slate-600">Item</th>
                                <th className="p-3 font-semibold text-slate-600">Category</th>
                                <th className="p-3 font-semibold text-slate-600 text-right">Quantity</th>
                                <th className="p-3 font-semibold text-slate-600 text-right">Package Size</th>
                                <th className="p-3 font-semibold text-slate-600 text-right">Total Kg</th>
                                <th className="p-3 font-semibold text-slate-600 w-48">Currency & Exchange Rate</th>
                                <th className="p-3 font-semibold text-slate-600 w-32">Package Price</th>
                                <th className="p-3 font-semibold text-slate-600 w-32">Price (per Kg)</th>
                                <th className="p-3 font-semibold text-slate-600 text-right">Total Worth</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedInvoice.items.map(item => {
                                const details = itemDetails[item.itemId] || { rate: '', packageRate: '', currency: Currency.Dollar, conversionRate: 1 };
                                const itemDetailsFromState = state.items.find(i => i.id === item.itemId);
                                const category = state.categories.find(c => c.id === itemDetailsFromState?.categoryId)?.name || 'N/A';
                                const isPackage = itemDetailsFromState && [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(itemDetailsFromState.packingType);
                                const packageSizeDisplay = isPackage ? itemDetailsFromState.baleSize : 'N/A';
                                
                                let totalKgForItem = 0;
                                if (itemDetailsFromState) {
                                    if (isPackage) {
                                        totalKgForItem = item.quantity * itemDetailsFromState.baleSize;
                                    } else {
                                        totalKgForItem = item.quantity;
                                    }
                                }

                                let totalWorth = 0;
                                const quantity = item.quantity;
                                
                                if (isPackage) {
                                    const pkgRate = Number(details.packageRate) || 0;
                                    totalWorth = quantity * pkgRate;
                                } else {
                                    const kgRate = Number(details.rate) || 0;
                                    totalWorth = quantity * kgRate;
                                }

                                return (
                                <tr key={item.itemId} className="border-b">
                                    <td className="p-3 text-slate-700">{itemName(item.itemId)}</td>
                                    <td className="p-3 text-slate-700">{category}</td>
                                    <td className="p-3 text-slate-700 text-right">{item.quantity}</td>
                                    <td className="p-3 text-slate-700 text-right">{packageSizeDisplay}</td>
                                    <td className="p-3 text-slate-700 text-right font-medium">{totalKgForItem.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                    <td className="p-3">
                                        <CurrencyInput 
                                            value={{ currency: details.currency, conversionRate: details.conversionRate }}
                                            onChange={(newValue) => handleItemDetailChange(item.itemId, 'currency', newValue)}
                                            idPrefix={`item-${item.itemId}`}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            value={details.packageRate}
                                            onChange={e => handleItemDetailChange(item.itemId, 'packageRate', e.target.value)}
                                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={`Pkg Price`}
                                            min="0.01"
                                            step="0.01"
                                            disabled={!isPackage}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            value={details.rate}
                                            onChange={e => handleItemDetailChange(item.itemId, 'rate', e.target.value)}
                                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={`/ Kg`}
                                            min="0.01"
                                            step="0.01"
                                        />
                                    </td>
                                    <td className="p-3 text-slate-700 text-right font-medium">
                                        {totalWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {details.currency}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-6 p-4 bg-slate-50 rounded-lg border">
                    <h4 className="font-semibold text-slate-700 mb-2">Additional Costs (From Invoice Data)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between border-b pb-1">
                            <span>Freight ({freightForwarderId ? state.freightForwarders.find(f => f.id === freightForwarderId)?.name : 'None'}):</span>
                            <span className="font-medium">${(Number(freightAmount) || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                            <span>Custom Charges:</span>
                            <span className="font-medium">${(Number(customCharges) || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">These costs were entered during data entry and will be posted to the ledger.</p>
                </div>

                 <div className="flex justify-end mt-6">
                    <button onClick={handlePostInvoice} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                        Save & Post Invoice
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold text-slate-800">Unposted Invoices</h1>
                 <button onClick={() => setModule('dashboard')} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    &larr; Back to Dashboard
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-3 font-semibold text-slate-600">Invoice ID</th>
                            <th className="p-3 font-semibold text-slate-600">Customer</th>
                            <th className="p-3 font-semibold text-slate-600">Date</th>
                            <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {unpostedInvoices.length > 0 ? (
                            unpostedInvoices.map(invoice => (
                                <tr key={invoice.id} className="border-b hover:bg-slate-50">
                                    <td className="p-3 text-slate-700">{invoice.id}</td>
                                    <td className="p-3 text-slate-700">{customerName(invoice.customerId)}</td>
                                    <td className="p-3 text-slate-700">{invoice.date}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => handleSelectInvoice(invoice)} className="py-1 px-3 bg-indigo-500 text-white rounded-md text-sm hover:bg-indigo-600">
                                            Rates & Post
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="text-center text-slate-500 py-6">No unposted invoices.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PostingModule;