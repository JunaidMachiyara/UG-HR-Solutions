import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { 
    OriginalPurchased, FinishedGoodsPurchase, FinishedGoodsPurchaseItem, Supplier, OriginalType, 
    Item, PackingType, Currency, JournalEntry, JournalEntryType, AppState, UserProfile 
} from '../types.ts';
import { generateFinishedGoodsPurchaseId } from '../utils/idGenerator.ts';
import ItemSelector from './ui/ItemSelector.tsx';
import CurrencyInput from './ui/CurrencyInput.tsx';
import Modal from './ui/Modal.tsx';
import EntitySelector from './ui/EntitySelector.tsx';

// --- Reusable Helper Components ---
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-md bg-slate-50/50">
            <button
                type="button"
                className="w-full flex justify-between items-center p-3 bg-slate-100 hover:bg-slate-200 transition-colors rounded-t-md"
                onClick={() => setIsOpen(!isOpen)}
            >
                <h4 className="font-semibold text-slate-700">{title}</h4>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && <div className="p-4 space-y-4">{children}</div>}
        </div>
    );
};

// --- Main Purchases Module ---
type PurchaseView = 'original' | 'finishedGoods';

interface PurchasesModuleProps {
    showNotification: (msg: string) => void;
    userProfile: UserProfile | null;
}

const PurchasesModule: React.FC<PurchasesModuleProps> = ({ showNotification, userProfile }) => {
    const [view, setView] = useState<PurchaseView>('original');

    const getButtonClass = (v: PurchaseView) => 
        `px-4 py-2 rounded-md transition-colors text-sm font-medium ${view === v ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`;
    
    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-700 mr-4">New Purchase</h2>
                <button onClick={() => setView('original')} className={getButtonClass('original')}>Original Purchase</button>
                <button onClick={() => setView('finishedGoods')} className={getButtonClass('finishedGoods')} disabled>Finished Goods</button>
            </div>

            <div>
                {view === 'original' && <OriginalPurchaseFormInternal showNotification={showNotification} userProfile={userProfile} />}
                {view === 'finishedGoods' && <FinishedGoodsPurchaseFormInternal showNotification={showNotification} userProfile={userProfile} />}
            </div>
        </div>
    );
};

const OriginalPurchaseFormInternal: React.FC<Omit<PurchasesModuleProps, 'selectedSupplierId'>> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
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
            date: new Date().toISOString().split('T')[0], supplierId: '', originalTypeId: '', quantityPurchased: undefined,
            rate: undefined, currency: Currency.Dollar, conversionRate: 1, divisionId: '', subDivisionId: '',
            batchNumber: newBatchNumber, containerNumber: '', discountSurcharge: undefined, 
            freightForwarderId: '', freightAmount: undefined,
            clearingAgentId: '', clearingAmount: undefined, 
            commissionAgentId: '', commissionAmount: undefined,
            subSupplierId: '',
            originalProductId: '',
        };
    };

    const [formData, setFormData] = useState<Partial<OriginalPurchased>>(getInitialState());
    const [freightCurrencyData, setFreightCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [clearingCurrencyData, setClearingCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [commissionCurrencyData, setCommissionCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });

    const [purchaseToSave, setPurchaseToSave] = useState<OriginalPurchased | null>(null);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [hasPrinted, setHasPrinted] = useState(false);

    const availableSubDivisions = useMemo(() => {
        if (!formData.divisionId) return [];
        return state.subDivisions.filter(sd => sd.divisionId === formData.divisionId);
    }, [formData.divisionId, state.subDivisions]);

    const availableSubSuppliers = useMemo(() => {
        if (!formData.supplierId) return [];
        return state.subSuppliers.filter(ss => ss.supplierId === formData.supplierId);
    }, [formData.supplierId, state.subSuppliers]);

    const availableOriginalProducts = useMemo(() => {
        if (!formData.originalTypeId) return [];
        return state.originalProducts.filter(op => op.originalTypeId === formData.originalTypeId);
    }, [formData.originalTypeId, state.originalProducts]);

    useEffect(() => {
        const supplier = state.suppliers.find(s => s.id === formData.supplierId);
        setFormData(prev => ({
            ...prev,
            currency: supplier?.defaultCurrency || Currency.Dollar,
            subSupplierId: '',
        }));
    }, [formData.supplierId, state.suppliers]);
    
    useEffect(() => {
        setFormData(prev => ({ ...prev, originalProductId: '' }));
    }, [formData.originalTypeId]);

    // Effects to clear amounts when default agents are selected
    useEffect(() => {
        if (!formData.freightForwarderId) {
            setFormData(prev => ({ ...prev, freightAmount: undefined }));
        }
    }, [formData.freightForwarderId]);

    useEffect(() => {
        if (!formData.clearingAgentId) {
            setFormData(prev => ({ ...prev, clearingAmount: undefined }));
        }
    }, [formData.clearingAgentId]);

    useEffect(() => {
        if (!formData.commissionAgentId) {
            setFormData(prev => ({ ...prev, commissionAmount: undefined }));
        }
    }, [formData.commissionAgentId]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCurrencyChange = (newCurrency: { currency: Currency; conversionRate: number }) => {
        setFormData(prev => ({ ...prev, ...newCurrency }));
    };
    
    const handlePrepareSummary = (e: React.FormEvent) => {
        e.preventDefault();

        const fullPurchaseData: OriginalPurchased = {
            id: `pur_orig_${Date.now()}`,
            ...getInitialState(),
            ...formData,
            quantityPurchased: Number(formData.quantityPurchased) || 0,
            rate: Number(formData.rate) || 0,
            discountSurcharge: Number(formData.discountSurcharge) || 0,
            freightAmount: Number(formData.freightAmount) || 0,
            clearingAmount: Number(formData.clearingAmount) || 0,
            commissionAmount: Number(formData.commissionAmount) || 0,
            freightCurrency: freightCurrencyData.currency,
            freightConversionRate: freightCurrencyData.conversionRate,
            clearingCurrency: clearingCurrencyData.currency,
            clearingConversionRate: clearingCurrencyData.conversionRate,
            commissionCurrency: commissionCurrencyData.currency,
            commissionConversionRate: commissionCurrencyData.conversionRate,
        };
        setPurchaseToSave(fullPurchaseData);
        setHasPrinted(false);
        setIsSummaryModalOpen(true);
    };

    const handleSaveAndContinue = async () => {
        if (!purchaseToSave) return;
        
        // 1. Generate and download PDF
        const { jsPDF } = (window as any).jspdf;
        const html2canvas = (window as any).html2canvas;
        const input = document.getElementById('purchase-voucher-content');
        if (input && jsPDF && html2canvas) {
            const canvas = await html2canvas(input, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = pdfWidth / imgWidth;
            const pdfHeight = imgHeight * ratio;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`PurchaseInvoice_${purchaseToSave.id}.pdf`);
        }

        // 2. Dispatch actions to save data
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'originalPurchases', data: purchaseToSave } });
        
        const jeDate = purchaseToSave.date;
        const baseDescription = `Purchase from ${state.suppliers.find(s => s.id === purchaseToSave.supplierId)?.name}`;
        
        const itemValueFC = purchaseToSave.quantityPurchased * purchaseToSave.rate;
        const itemValueUSD = (itemValueFC * (purchaseToSave.conversionRate || 1)) + (purchaseToSave.discountSurcharge || 0);

        const purchaseDebit: JournalEntry = { id: `je-d-${purchaseToSave.id}`, voucherId: `JV-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: 'EXP-004', debit: itemValueUSD, credit: 0, description: baseDescription };
        const supplierCredit: JournalEntry = { 
            id: `je-c-${purchaseToSave.id}`, voucherId: `JV-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: 'AP-001', 
            debit: 0, credit: itemValueUSD, description: baseDescription, entityId: purchaseToSave.supplierId, entityType: 'supplier',
            originalAmount: purchaseToSave.currency !== Currency.Dollar ? { amount: itemValueFC, currency: purchaseToSave.currency } : undefined,
        };
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
                const costDesc = `${cost.type} for INV ${purchaseToSave.id} from ${cost.name}`;
                const debit: JournalEntry = { id: `je-d-${cost.type.toLowerCase()}-${purchaseToSave.id}`, voucherId: `JV-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: cost.account, debit: costValueUSD, credit: 0, description: costDesc };
                const credit: JournalEntry = { 
                    id: `je-c-${cost.type.toLowerCase()}-${purchaseToSave.id}`, voucherId: `JV-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, 
                    account: 'AP-001', debit: 0, credit: costValueUSD, description: costDesc, entityId: cost.id, entityType: cost.entityType,
                    originalAmount: cost.currencyData.currency !== Currency.Dollar ? { amount: cost.amount || 0, currency: cost.currencyData.currency } : undefined
                };
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debit }});
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: credit }});
            }
        });
        
        // 3. Reset and close
        showNotification('Original Purchase Saved!');
        setFormData(getInitialState());
        setIsSummaryModalOpen(false);
        setPurchaseToSave(null);
    };

    const isFreightDisabled = !formData.freightForwarderId;
    const isClearingDisabled = !formData.clearingAgentId;
    const isCommissionDisabled = !formData.commissionAgentId;

    const inputClasses = "mt-1 w-full p-2 rounded-md";

    return (
        <>
            <form onSubmit={handlePrepareSummary} className="space-y-6">
                <div className="border rounded-lg p-4 bg-white">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Core Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" name="date" value={formData.date} onChange={handleChange} required className={`${inputClasses}`}/></div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Supplier</label>
                            <EntitySelector
                                entities={state.suppliers}
                                selectedEntityId={formData.supplierId || ''}
                                onSelect={(id) => handleChange({ target: { name: 'supplierId', value: id } } as any)}
                                placeholder="Search Suppliers..."
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Sub-Supplier</label>
                            <select name="subSupplierId" value={formData.subSupplierId} onChange={handleChange} disabled={!formData.supplierId || availableSubSuppliers.length === 0} className={`${inputClasses}`}>
                                <option value="">Select Sub-Supplier (Optional)</option>
                                {availableSubSuppliers.map(ss => <option key={ss.id} value={ss.id}>{ss.name}</option>)}
                            </select>
                        </div>
                        <div><label className="block text-sm font-medium text-slate-700">Batch Number</label><input type="text" name="batchNumber" value={formData.batchNumber} onChange={handleChange} disabled className={`${inputClasses} bg-slate-200`}/></div>
                        <div><label className="block text-sm font-medium text-slate-700">Original Type</label><select name="originalTypeId" value={formData.originalTypeId} onChange={handleChange} required className={`${inputClasses}`}><option value="">Select Type</option>{state.originalTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}</select></div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Original Product</label>
                            <select name="originalProductId" value={formData.originalProductId} onChange={handleChange} disabled={!formData.originalTypeId || availableOriginalProducts.length === 0} className={`${inputClasses}`}>
                                <option value="">Select Product (Optional)</option>
                                {availableOriginalProducts.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="border rounded-lg p-4 bg-white">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Quantity & Pricing</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-sm font-medium text-slate-700">Quantity</label><input type="number" name="quantityPurchased" value={formData.quantityPurchased || ''} onChange={handleChange} required className={`${inputClasses}`}/></div>
                        <div><label className="block text-sm font-medium text-slate-700">Purchase Rate</label><input type="number" name="rate" step="0.01" value={formData.rate || ''} onChange={handleChange} required className={`${inputClasses}`}/></div>
                        <div className="md:col-span-1"><label className="block text-sm font-medium text-slate-700">Currency</label><CurrencyInput value={{currency: formData.currency!, conversionRate: formData.conversionRate!}} onChange={handleCurrencyChange} /></div>
                        <div><label className="block text-sm font-medium text-slate-700">Discount(-) / Surcharge(+)</label><input type="number" name="discountSurcharge" step="0.01" value={formData.discountSurcharge || ''} onChange={handleChange} className={`${inputClasses}`} placeholder="Amount in USD"/></div>
                    </div>
                </div>
                
                <div className="border rounded-lg p-4 bg-white">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Logistics & Destination</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-sm font-medium text-slate-700">Container #</label><input type="text" name="containerNumber" value={formData.containerNumber} onChange={handleChange} className={`${inputClasses}`}/></div>
                        <div><label className="block text-sm font-medium text-slate-700">Division</label><select name="divisionId" value={formData.divisionId} onChange={handleChange} required className={`${inputClasses}`}><option value="">Select Division</option>{state.divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                        <div><label className="block text-sm font-medium text-slate-700">Sub Division</label><select name="subDivisionId" value={formData.subDivisionId} onChange={handleChange} disabled={!formData.divisionId || availableSubDivisions.length === 0} className={`${inputClasses}`}><option value="">Select Sub-Division</option>{availableSubDivisions.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}</select></div>
                    </div>
                </div>

                <div className="border rounded-lg p-4 bg-white">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Additional Cost</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Freight Forwarder</label>
                            <select name="freightForwarderId" value={formData.freightForwarderId} onChange={handleChange} className={`w-full p-2 rounded-md`}>
                                <option value="">Select...</option>
                                {state.freightForwarders.map(ff => <option key={ff.id} value={ff.id}>{ff.name}</option>)}
                            </select>
                            <input type="number" name="freightAmount" placeholder="Freight Amount" value={formData.freightAmount || ''} onChange={handleChange} disabled={isFreightDisabled} className={`w-full p-2 rounded-md`} />
                            <CurrencyInput value={freightCurrencyData} onChange={setFreightCurrencyData} disabled={isFreightDisabled} />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Clearing Agent</label>
                            <select name="clearingAgentId" value={formData.clearingAgentId} onChange={handleChange} className={`w-full p-2 rounded-md`}>
                                <option value="">Select...</option>
                                {state.clearingAgents.map(ca => <option key={ca.id} value={ca.id}>{ca.name}</option>)}
                            </select>
                            <input type="number" name="clearingAmount" placeholder="Clearing Amount" value={formData.clearingAmount || ''} onChange={handleChange} disabled={isClearingDisabled} className={`w-full p-2 rounded-md`} />
                            <CurrencyInput value={clearingCurrencyData} onChange={setClearingCurrencyData} disabled={isClearingDisabled} />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Commission Agent</label>
                            <select name="commissionAgentId" value={formData.commissionAgentId} onChange={handleChange} className={`w-full p-2 rounded-md`}>
                                <option value="">Select...</option>
                                {state.commissionAgents.map(ca => <option key={ca.id} value={ca.id}>{ca.name}</option>)}
                            </select>
                            <input type="number" name="commissionAmount" placeholder="Commission Amount" value={formData.commissionAmount || ''} onChange={handleChange} disabled={isCommissionDisabled} className={`w-full p-2 rounded-md`} />
                            <CurrencyInput value={commissionCurrencyData} onChange={setCommissionCurrencyData} disabled={isCommissionDisabled} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end"><button type="submit" disabled={!formData.supplierId} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">Finalize Purchase</button></div>
            </form>

            {purchaseToSave && (
                <PurchaseSummaryModal 
                    isOpen={isSummaryModalOpen}
                    onClose={() => setIsSummaryModalOpen(false)}
                    onSave={handleSaveAndContinue}
                    purchase={purchaseToSave}
                    state={state}
                    hasPrinted={hasPrinted}
                    setHasPrinted={setHasPrinted}
                />
            )}
        </>
    );
};

interface FinishedGoodsPurchaseFormProps {
    showNotification: (msg: string) => void;
    userProfile: UserProfile | null;
}

const FinishedGoodsPurchaseFormInternal: React.FC<FinishedGoodsPurchaseFormProps> = ({ showNotification, userProfile }) => {
    // This component is now an alias for StockLotPurchaseForm, but keeping the structure for clarity
    // In a real refactor, this would be removed and StockLotPurchaseForm would be used directly.
    return <div className="text-slate-500">This feature has been integrated into the "Stock-Lot / Bundle Purchase" module.</div>
};

// --- Modals for Purchase Summaries and Print ---
interface PurchaseSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    purchase: OriginalPurchased;
    state: AppState;
    hasPrinted: boolean;
    setHasPrinted: (p: boolean) => void;
}

interface FinishedGoodsPurchaseSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    purchase: FinishedGoodsPurchase;
    state: AppState;
    hasPrinted: boolean;
    setHasPrinted: (p: boolean) => void;
}

const PurchaseSummaryModal: React.FC<PurchaseSummaryModalProps> = ({ isOpen, onClose, onSave, purchase, state, hasPrinted, setHasPrinted }) => {
    
    const handlePrint = () => {
        window.print();
        setHasPrinted(true);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Purchase Summary" size="4xl">
            <PrintablePurchaseVoucher purchase={purchase} state={state} />
            <div className="flex justify-end pt-6 space-x-2 no-print">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                    {hasPrinted ? 'Cancel Entry' : 'Cancel'}
                </button>
                <button onClick={handlePrint} disabled={hasPrinted} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
                    Print
                </button>
                <button onClick={onSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    {hasPrinted ? 'Save & Exit' : 'Save & Continue'}
                </button>
            </div>
        </Modal>
    );
};

const PrintablePurchaseVoucher: React.FC<{ purchase: OriginalPurchased, state: AppState }> = ({ purchase, state }) => {
    const { supplierId, originalTypeId, date, rate, quantityPurchased, currency, conversionRate, discountSurcharge } = purchase;
    const supplier = state.suppliers.find(s => s.id === supplierId);
    const subSupplier = state.subSuppliers.find(ss => ss.id === purchase.subSupplierId);
    const originalType = state.originalTypes.find(ot => ot.id === originalTypeId);
    const originalProduct = state.originalProducts.find(op => op.id === purchase.originalProductId);
    
    const itemValueFC = quantityPurchased * rate;
    const itemValueUSD = itemValueFC * (conversionRate || 1) + (discountSurcharge || 0);

    const freightValueUSD = (purchase.freightAmount || 0) * (purchase.freightConversionRate || 1);
    const clearingValueUSD = (purchase.clearingAmount || 0) * (purchase.clearingConversionRate || 1);
    const commissionValueUSD = (purchase.commissionAmount || 0) * (purchase.commissionConversionRate || 1);
    
    const totalValueUSD = itemValueUSD + freightValueUSD + clearingValueUSD + commissionValueUSD;
    
    const costs = [
        { label: 'Freight', name: state.freightForwarders.find(e => e.id === purchase.freightForwarderId)?.name, amount: purchase.freightAmount, currency: purchase.freightCurrency },
        { label: 'Clearing', name: state.clearingAgents.find(e => e.id === purchase.clearingAgentId)?.name, amount: purchase.clearingAmount, currency: purchase.clearingCurrency },
        { label: 'Commission', name: state.commissionAgents.find(e => e.id === purchase.commissionAgentId)?.name, amount: purchase.commissionAmount, currency: purchase.commissionCurrency },
    ].filter(c => c.amount && c.amount > 0);

    return (
        <div id="purchase-voucher-content" className="p-4 bg-white font-sans text-sm">
            <h2 className="text-xl font-bold text-center text-slate-900">Purchase Voucher</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-4 border-b pb-2 text-slate-700">
                <p><strong>Date:</strong> {date}</p>
                <p><strong>Supplier:</strong> {supplier?.name} {subSupplier ? `(${subSupplier.name})` : ''}</p>
                <p><strong>Batch No:</strong> {purchase.batchNumber}</p>
                <p><strong>Container No:</strong> {purchase.containerNumber || 'N/A'}</p>
            </div>
            <table className="w-full text-left my-4">
                <thead className="border-b">
                    <tr className="bg-slate-50">
                        <th className="p-1 font-semibold text-slate-600">Description</th>
                        <th className="p-1 font-semibold text-slate-600 text-right">Qty</th>
                        <th className="p-1 font-semibold text-slate-600 text-right">Rate ({currency})</th>
                        <th className="p-1 font-semibold text-slate-600 text-right">Total ({currency})</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="p-1 text-slate-800">{originalType?.name} {originalProduct ? `- ${originalProduct.name}` : ''}</td>
                        <td className="p-1 text-slate-800 text-right">{quantityPurchased.toLocaleString()}</td>
                        <td className="p-1 text-slate-800 text-right">{rate.toFixed(2)}</td>
                        <td className="p-1 text-slate-800 text-right">{itemValueFC.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            {costs.length > 0 && (<>
                <h4 className="font-semibold mt-2 text-slate-800">Additional Costs</h4>
                <table className="w-full text-left my-2 text-xs">
                    <tbody>
                        {costs.map(c => (
                            <tr key={c.label}>
                                <td className="p-1 text-slate-700">{c.label} ({c.name})</td>
                                <td className="p-1 text-slate-700 text-right">{c.amount?.toFixed(2)} {c.currency}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </>)}
            <div className="text-right font-bold text-lg bg-slate-100 p-2 rounded-md mt-4 text-slate-900">
                Grand Total (USD): ${totalValueUSD.toFixed(2)}
            </div>
        </div>
    );
};


export default PurchasesModule;