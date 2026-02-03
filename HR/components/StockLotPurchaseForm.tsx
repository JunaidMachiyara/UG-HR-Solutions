import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { 
    FinishedGoodsPurchase, FinishedGoodsPurchaseItem, Supplier, Item, PackingType, 
    Currency, JournalEntry, JournalEntryType, AppState, UserProfile, Production
} from '../types.ts';
import { generateFinishedGoodsPurchaseId } from '../utils/idGenerator.ts';
import ItemSelector from './ui/ItemSelector.tsx';
import CurrencyInput from './ui/CurrencyInput.tsx';
import Modal from './ui/Modal.tsx';
import EntitySelector from './ui/EntitySelector.tsx';

interface StockLotPurchaseFormProps {
    showNotification: (msg: string) => void;
    userProfile: UserProfile | null;
}

const FinishedGoodsPurchaseSummaryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    purchase: FinishedGoodsPurchase;
    state: AppState;
    hasPrinted: boolean;
    setHasPrinted: (p: boolean) => void;
}> = ({ isOpen, onClose, onSave, purchase, state, hasPrinted, setHasPrinted }) => {
    const handlePrint = () => { window.print(); setHasPrinted(true); };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bundle Purchase Summary" size="4xl">
            <PrintableFinishedGoodsVoucher purchase={purchase} state={state} />
            <div className="flex justify-end pt-6 space-x-2 no-print">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                    {hasPrinted ? 'Cancel Entry' : 'Cancel'}
                </button>
                <button onClick={handlePrint} disabled={hasPrinted} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
                    Print
                </button>
                <button onClick={onSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    {hasPrinted ? 'Save & Exit' : 'Save & Download PDF'}
                </button>
            </div>
        </Modal>
    );
};

const PrintableFinishedGoodsVoucher: React.FC<{ purchase: FinishedGoodsPurchase, state: AppState }> = ({ purchase, state }) => {
    const supplier = state.suppliers.find(s => s.id === purchase.supplierId);

    const freightValueUSD = (purchase.freightAmount || 0) * (purchase.freightConversionRate || 1);
    const clearingValueUSD = (purchase.clearingAmount || 0) * (purchase.clearingConversionRate || 1);
    const commissionValueUSD = (purchase.commissionAmount || 0) * (purchase.commissionConversionRate || 1);
    const totalAdditionalCosts = freightValueUSD + clearingValueUSD + commissionValueUSD;
    const grandTotalUSD = purchase.totalAmountInDollar + totalAdditionalCosts + (purchase.discountSurcharge || 0);

    const costs = [
        { label: 'Freight', name: state.freightForwarders.find(e => e.id === purchase.freightForwarderId)?.name, amount: purchase.freightAmount, currency: purchase.freightCurrency, amountUSD: freightValueUSD },
        { label: 'Clearing', name: state.clearingAgents.find(e => e.id === purchase.clearingAgentId)?.name, amount: purchase.clearingAmount, currency: purchase.clearingCurrency, amountUSD: clearingValueUSD },
        { label: 'Commission', name: state.commissionAgents.find(e => e.id === purchase.commissionAgentId)?.name, amount: purchase.commissionAmount, currency: purchase.commissionCurrency, amountUSD: commissionValueUSD },
    ].filter(c => c.amount && c.amount > 0);

    return (
        <div id="fg-purchase-voucher-content" className="p-4 bg-white font-sans text-sm">
            <h2 className="text-xl font-bold text-center text-slate-900">Bundle Purchase Voucher</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-4 border-b pb-2 text-slate-700">
                <p><strong>Date:</strong> {purchase.date}</p>
                <p><strong>Supplier:</strong> {supplier?.name}</p>
                <p><strong>Batch No:</strong> {purchase.batchNumber}</p>
                <p><strong>Container No:</strong> {purchase.containerNumber || 'N/A'}</p>
            </div>
            <table className="w-full text-left my-4">
                <thead className="border-b"><tr className="bg-slate-50"><th className="p-1 font-semibold text-slate-800">Item</th><th className="p-1 font-semibold text-slate-800 text-right">Qty</th><th className="p-1 font-semibold text-slate-800 text-right">Rate ({purchase.currency})</th><th className="p-1 font-semibold text-slate-800 text-right">Total ({purchase.currency})</th></tr></thead>
                <tbody>
                    {purchase.items.map(item => (
                        <tr key={item.itemId}>
                            <td className="p-1 text-slate-800">{state.items.find(i => i.id === item.itemId)?.name}</td>
                            <td className="p-1 text-right text-slate-800">{item.quantity.toLocaleString()}</td>
                            <td className="p-1 text-right text-slate-800">{item.rate.toFixed(2)}</td>
                            <td className="p-1 text-right text-slate-800">{(item.quantity * item.rate).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
                 <tfoot>
                    <tr className="font-bold border-t"><td colSpan={3} className="p-1 text-right text-slate-800">Subtotal ({purchase.currency})</td><td className="p-1 text-right text-slate-800">{purchase.totalAmount.toFixed(2)}</td></tr>
                    {purchase.discountSurcharge && (
                         <tr className="font-medium"><td colSpan={3} className="p-1 text-right text-slate-800">Discount/Surcharge (USD)</td><td className="p-1 text-right text-slate-800">${purchase.discountSurcharge.toFixed(2)}</td></tr>
                    )}
                    <tr className="font-bold"><td colSpan={3} className="p-1 text-right text-slate-800">Subtotal (USD)</td><td className="p-1 text-right text-slate-800">${(purchase.totalAmountInDollar + (purchase.discountSurcharge || 0)).toFixed(2)}</td></tr>
                </tfoot>
            </table>
            {(totalAdditionalCosts > 0) && (
                <div className="mt-2">
                    <h4 className="font-semibold text-slate-800">Additional Costs</h4>
                     <table className="w-full text-left my-2 text-xs"><tbody>
                        {costs.map(c => (
                            <tr key={c.label}>
                                <td className="p-1 text-slate-700">{c.label} ({c.name})</td>
                                <td className="p-1 text-slate-700 text-right">{c.amount?.toFixed(2)} {c.currency}</td>
                                <td className="p-1 text-slate-700 text-right">${c.amountUSD.toFixed(2)}</td>
                            </tr>
                        ))}
                     </tbody></table>
                </div>
            )}
            <div className="text-right font-bold text-lg bg-slate-100 p-2 rounded-md mt-4 text-slate-900">
                Grand Total (USD): ${grandTotalUSD.toFixed(2)}
            </div>
        </div>
    );
};


const StockLotPurchaseForm: React.FC<StockLotPurchaseFormProps> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
    const itemInputRef = useRef<HTMLInputElement>(null);

    const getInitialState = () => {
        const allBatchNumbers = [
            ...state.originalPurchases.map(p => p.batchNumber),
            ...state.finishedGoodsPurchases.map(p => p.batchNumber)
        ];

        const lastNumericBatch = allBatchNumbers
            .filter(bn => bn && /^\d+$/.test(bn))
            .map(bn => parseInt(bn!, 10))
            .sort((a, b) => b - a)[0];

        const newBatchNumber = lastNumericBatch ? String(lastNumericBatch + 1) : '101';

        return {
            date: new Date().toISOString().split('T')[0],
            supplierId: '',
            batchNumber: newBatchNumber,
            currency: Currency.Dollar,
            conversionRate: 1,
            containerNumber: '',
            divisionId: '',
            subDivisionId: '',
            discountSurcharge: undefined as number | undefined,
            freightForwarderId: '', 
            freightAmount: undefined as number | undefined,
            clearingAgentId: '', 
            clearingAmount: undefined as number | undefined, 
            commissionAgentId: '', 
            commissionAmount: undefined as number | undefined,
        };
    };
    
    const [formData, setFormData] = useState<Partial<FinishedGoodsPurchase>>(getInitialState());
    const [purchaseId, setPurchaseId] = useState('');
    const [freightCurrencyData, setFreightCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [clearingCurrencyData, setClearingCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [commissionCurrencyData, setCommissionCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [items, setItems] = useState<FinishedGoodsPurchaseItem[]>([]);
    const [currentItem, setCurrentItem] = useState<{ itemId: string; quantity: string; rate: string }>({ itemId: '', quantity: '', rate: '' });
    
    const [purchaseToSave, setPurchaseToSave] = useState<FinishedGoodsPurchase | null>(null);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [hasPrinted, setHasPrinted] = useState(false);
    const [containerError, setContainerError] = useState<string | null>(null);
    
    const availableSubDivisions = useMemo(() => {
        if (!formData.divisionId) return [];
        return state.subDivisions.filter(sd => sd.divisionId === formData.divisionId);
    }, [formData.divisionId, state.subDivisions]);
    
    const totals = useMemo(() => {
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const totalAmountInDollar = totalAmount * (formData.conversionRate || 1);
        return { totalAmount, totalAmountInDollar };
    }, [items, formData.conversionRate]);

    useEffect(() => {
        if (formData.supplierId && !purchaseId) {
            setPurchaseId(generateFinishedGoodsPurchaseId(state.nextFinishedGoodsPurchaseNumber));
            setFormData(prev => ({...prev, date: new Date().toISOString().split('T')[0]}));
        }
        const supplier = state.suppliers.find(s => s.id === formData.supplierId);
        if (supplier) {
            setFormData(prev => ({ ...prev, currency: supplier.defaultCurrency || Currency.Dollar, conversionRate: 1 }));
        }
    }, [formData.supplierId, purchaseId, state.nextFinishedGoodsPurchaseNumber, state.suppliers]);

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const { itemId, quantity, rate } = currentItem;
        if (!itemId || !quantity || !rate || Number(quantity) <= 0 || Number(rate) < 0) {
            showNotification("Please select an item and enter a valid quantity and rate.");
            return;
        }
        setItems([...items, { itemId, quantity: Number(quantity), rate: Number(rate) }]);
        setCurrentItem({ itemId: '', quantity: '', rate: '' });
        itemInputRef.current?.focus();
    };

    const handleRemoveItem = (indexToRemove: number) => {
        setItems(items.filter((_, index) => index !== indexToRemove));
    };

    const handleRateChange = (index: number, newRate: string) => {
        const updatedItems = [...items];
        updatedItems[index].rate = Number(newRate) || 0;
        setItems(updatedItems);
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFinalizePurchase = () => {
        if (!formData.supplierId || items.length === 0) {
            showNotification("Please select a supplier and add items.");
            return;
        }

        if (formData.containerNumber && formData.containerNumber.trim() !== '') {
            const trimmedContainerNumber = formData.containerNumber.trim().toLowerCase();
            const isDuplicateInOriginals = state.originalPurchases.some(p => p.containerNumber && p.containerNumber.trim().toLowerCase() === trimmedContainerNumber);
            const isDuplicateInFinished = state.finishedGoodsPurchases.some(p => p.containerNumber && p.containerNumber.trim().toLowerCase() === trimmedContainerNumber);

            if (isDuplicateInOriginals || isDuplicateInFinished) {
                setContainerError(`DUPLICATE CONTAINER: The container number "${formData.containerNumber}" is already in use. Please enter a different one.`);
                return;
            }
        }

        const fullPurchase: FinishedGoodsPurchase = {
            id: purchaseId,
            date: formData.date!,
            supplierId: formData.supplierId,
            items: items,
            currency: formData.currency!,
            conversionRate: formData.conversionRate!,
            totalAmount: totals.totalAmount,
            totalAmountInDollar: totals.totalAmountInDollar,
            batchNumber: formData.batchNumber,
            containerNumber: formData.containerNumber,
            divisionId: formData.divisionId,
            subDivisionId: formData.subDivisionId,
            discountSurcharge: Number(formData.discountSurcharge) || undefined,
            freightForwarderId: formData.freightForwarderId,
            freightAmount: Number(formData.freightAmount) || undefined,
            freightCurrency: freightCurrencyData.currency,
            freightConversionRate: freightCurrencyData.conversionRate,
            clearingAgentId: formData.clearingAgentId,
            clearingAmount: Number(formData.clearingAmount) || undefined,
            clearingCurrency: clearingCurrencyData.currency,
            clearingConversionRate: clearingCurrencyData.conversionRate,
            commissionAgentId: formData.commissionAgentId,
            commissionAmount: Number(formData.commissionAmount) || undefined,
            commissionCurrency: commissionCurrencyData.currency,
            commissionConversionRate: commissionCurrencyData.conversionRate,
        };

        setPurchaseToSave(fullPurchase);
        setHasPrinted(false);
        setIsSummaryModalOpen(true);
    };

    const handleSaveAndContinue = async () => {
        if (!purchaseToSave) return;
        
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'finishedGoodsPurchases', data: purchaseToSave } });
        
        purchaseToSave.items.forEach(item => {
            const productionEntry: Production = { id: `prod_fgp_${purchaseToSave.id}_${item.itemId}`, date: purchaseToSave.date, itemId: item.itemId, quantityProduced: item.quantity };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: productionEntry } });
        });
        
        const jeDate = purchaseToSave.date;
        const supplierName = state.suppliers.find(s => s.id === purchaseToSave.supplierId)?.name || 'N/A';
        const baseDescription = `Bundle Purchase from ${supplierName}`;
        
        const itemValueUSD = purchaseToSave.totalAmountInDollar + (purchaseToSave.discountSurcharge || 0);
        const purchaseDebit: JournalEntry = { id: `je-d-fgp-${purchaseToSave.id}`, voucherId: `JV-FGP-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: 'EXP-007', debit: itemValueUSD, credit: 0, description: baseDescription };
        const supplierCredit: JournalEntry = { id: `je-c-fgp-${purchaseToSave.id}`, voucherId: `JV-FGP-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: 'AP-001', debit: 0, credit: itemValueUSD, description: baseDescription, entityId: purchaseToSave.supplierId, entityType: 'supplier' };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: purchaseDebit }});
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: supplierCredit }});

         const costs = [
            { type: 'Freight', id: purchaseToSave.freightForwarderId, amount: purchaseToSave.freightAmount, currencyData: freightCurrencyData, account: 'EXP-005', entityType: 'freightForwarder' as const, name: state.freightForwarders.find(f=>f.id===purchaseToSave.freightForwarderId)?.name },
            { type: 'Clearing', id: purchaseToSave.clearingAgentId, amount: purchaseToSave.clearingAmount, currencyData: clearingCurrencyData, account: 'EXP-006', entityType: 'clearingAgent' as const, name: state.clearingAgents.find(f=>f.id===purchaseToSave.clearingAgentId)?.name },
            { type: 'Commission', id: purchaseToSave.commissionAgentId, amount: purchaseToSave.commissionAmount, currencyData: commissionCurrencyData, account: 'EXP-008', entityType: 'commissionAgent' as const, name: state.commissionAgents.find(f=>f.id===purchaseToSave.commissionAgentId)?.name },
        ];
        
        costs.forEach(cost => {
            if (cost.id && (cost.amount || 0) > 0) {
                const costValueUSD = (cost.amount || 0) * cost.currencyData.conversionRate;
                const costDesc = `${cost.type} for Bundle INV ${purchaseToSave.id} from ${cost.name}`;
                const debit: JournalEntry = { id: `je-d-${cost.type.toLowerCase()}-fgp-${purchaseToSave.id}`, voucherId: `JV-FGP-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: cost.account, debit: costValueUSD, credit: 0, description: costDesc };
                const credit: JournalEntry = { id: `je-c-${cost.type.toLowerCase()}-fgp-${purchaseToSave.id}`, voucherId: `JV-FGP-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: 'AP-001', debit: 0, credit: costValueUSD, description: costDesc, entityId: cost.id, entityType: cost.entityType };
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debit }});
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: credit }});
            }
        });
        
        showNotification('Bundle Purchase Saved!');
        setFormData(getInitialState());
        setItems([]);
        setPurchaseId('');
        setIsSummaryModalOpen(false);
        setPurchaseToSave(null);
    };
    
    const isFreightDisabled = !formData.freightForwarderId;
    const isClearingDisabled = !formData.clearingAgentId;
    const isCommissionDisabled = !formData.commissionAgentId;

    const inputClasses = "mt-1 w-full p-2 rounded-md";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-lg bg-white">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Date</label>
                    <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required className={inputClasses}/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Supplier</label>
                    <EntitySelector
                        entities={state.suppliers}
                        selectedEntityId={formData.supplierId || ''}
                        onSelect={(id) => setFormData(prev => ({ ...prev, supplierId: id }))}
                        placeholder="Search Suppliers..."
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Batch Number</label>
                    <input type="text" value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} className={inputClasses} />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-slate-700">Currency & Rate</label>
                    <CurrencyInput value={{currency: formData.currency!, conversionRate: formData.conversionRate!}} onChange={(val) => setFormData(p => ({...p, ...val}))} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-10 gap-8">
                <div className="md:col-span-3">
                    <form onSubmit={handleAddItem} className="space-y-4 p-4 border rounded-lg bg-slate-50">
                        <h4 className="text-md font-semibold text-slate-700 border-b pb-2">Add Item</h4>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Item</label><ItemSelector inputRef={itemInputRef} items={state.items} selectedItemId={currentItem.itemId} onSelect={id => setCurrentItem(p => ({...p, itemId: id}))} /></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input type="number" value={currentItem.quantity} onChange={e => setCurrentItem(p => ({...p, quantity: e.target.value}))} className="w-full p-2 rounded-md" /></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Rate ({formData.currency})</label><input type="number" step="0.01" value={currentItem.rate} onChange={e => setCurrentItem(p => ({...p, rate: e.target.value}))} className="w-full p-2 rounded-md" /></div>
                        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Item</button>
                    </form>
                </div>
                <div className="md:col-span-7">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-slate-600">Current Items</h3>
                        <div className="text-right p-2 bg-slate-100 rounded-lg">
                            <p className="text-xs font-medium text-slate-500">Total Value (USD)</p>
                            <p className="text-lg font-bold text-slate-800">{totals.totalAmountInDollar.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                        </div>
                    </div>
                    <div className="overflow-y-auto border rounded-md max-h-[320px]">
                        <table className="w-full text-left table-auto">
                            <thead><tr className="bg-slate-100"><th className="p-2 font-semibold text-slate-600">Item</th><th className="p-2 font-semibold text-slate-600 text-right">Qty</th><th className="p-2 font-semibold text-slate-600 w-32">Rate</th><th className="p-2 font-semibold text-slate-600 text-right">Total</th><th></th></tr></thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index} className="border-b">
                                        <td className="p-2 text-slate-700">{state.items.find(i=>i.id===item.itemId)?.name}</td>
                                        <td className="p-2 text-right text-slate-700">{item.quantity.toLocaleString()}</td>
                                        <td className="p-2"><input type="number" value={item.rate} onChange={e => handleRateChange(index, e.target.value)} className="w-full p-1 border rounded-md text-right" /></td>
                                        <td className="p-2 text-right font-medium text-slate-800">{(item.quantity * item.rate).toFixed(2)}</td>
                                        <td className="p-1 text-center"><button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700">✕</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
             <div className="border rounded-lg p-4 bg-white">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Logistics & Destination</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700">Container #</label><input type="text" name="containerNumber" value={formData.containerNumber} onChange={handleChange} className={`${inputClasses}`}/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Division</label><select name="divisionId" value={formData.divisionId} onChange={handleChange} className={`${inputClasses}`}><option value="">Select Division</option>{state.divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700">Sub Division</label><select name="subDivisionId" value={formData.subDivisionId} onChange={handleChange} disabled={!formData.divisionId || availableSubDivisions.length === 0} className={`${inputClasses}`}><option value="">Select Sub-Division</option>{availableSubDivisions.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700">Discount(-) / Surcharge(+)</label><input type="number" name="discountSurcharge" step="0.01" value={formData.discountSurcharge || ''} onChange={handleChange} className={`${inputClasses}`} placeholder="Amount in USD"/></div>
                </div>
            </div>

            <div className="border rounded-lg p-4 bg-white">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Additional Cost</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Freight Forwarder</label>
                        <select name="freightForwarderId" value={formData.freightForwarderId} onChange={handleChange} className={`w-full p-2 rounded-md`}><option value="">Select...</option>{state.freightForwarders.map(ff => <option key={ff.id} value={ff.id}>{ff.name}</option>)}</select>
                        <input type="number" name="freightAmount" placeholder="Freight Amount" value={formData.freightAmount || ''} onChange={handleChange} disabled={isFreightDisabled} className={`w-full p-2 rounded-md`} />
                        <CurrencyInput value={freightCurrencyData} onChange={setFreightCurrencyData} disabled={isFreightDisabled} />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Clearing Agent</label>
                        <select name="clearingAgentId" value={formData.clearingAgentId} onChange={handleChange} className={`w-full p-2 rounded-md`}><option value="">Select...</option>{state.clearingAgents.map(ca => <option key={ca.id} value={ca.id}>{ca.name}</option>)}</select>
                        <input type="number" name="clearingAmount" placeholder="Clearing Amount" value={formData.clearingAmount || ''} onChange={handleChange} disabled={isClearingDisabled} className={`w-full p-2 rounded-md`} />
                        <CurrencyInput value={clearingCurrencyData} onChange={setClearingCurrencyData} disabled={isClearingDisabled} />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Commission Agent</label>
                        <select name="commissionAgentId" value={formData.commissionAgentId} onChange={handleChange} className={`w-full p-2 rounded-md`}><option value="">Select...</option>{state.commissionAgents.map(ca => <option key={ca.id} value={ca.id}>{ca.name}</option>)}</select>
                        <input type="number" name="commissionAmount" placeholder="Commission Amount" value={formData.commissionAmount || ''} onChange={handleChange} disabled={isCommissionDisabled} className={`w-full p-2 rounded-md`} />
                        <CurrencyInput value={commissionCurrencyData} onChange={setCommissionCurrencyData} disabled={isCommissionDisabled} />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
                <button onClick={handleFinalizePurchase} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Finalize Purchase</button>
            </div>
            
             {containerError && (
                <Modal isOpen={!!containerError} onClose={() => setContainerError(null)} title="Validation Error">
                    <div className="text-slate-700">
                        <p className="font-semibold text-red-600">Duplicate Container Number</p>
                        <p className="mt-2">{containerError}</p>
                        <div className="flex justify-end mt-6">
                            <button onClick={() => setContainerError(null)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">OK</button>
                        </div>
                    </div>
                </Modal>
            )}

             {purchaseToSave && (
                <FinishedGoodsPurchaseSummaryModal 
                    isOpen={isSummaryModalOpen}
                    onClose={() => setIsSummaryModalOpen(false)}
                    onSave={handleSaveAndContinue}
                    purchase={purchaseToSave}
                    state={state}
                    hasPrinted={hasPrinted}
                    setHasPrinted={setHasPrinted}
                />
            )}
        </div>
    );
};

export default StockLotPurchaseForm;