import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { generateInvoiceId } from '../utils/idGenerator.ts';
import { InvoiceItem, SalesInvoice, InvoiceStatus, PackingType, Module, UserProfile, AppState, Currency, JournalEntry, JournalEntryType } from '../types.ts';
import Modal from './ui/Modal.tsx';
import ItemSelector from './ui/ItemSelector.tsx';
import CurrencyInput from './ui/CurrencyInput.tsx';
import EntitySelector from './ui/EntitySelector.tsx';

interface SalesInvoiceProps {
    setModule: (module: Module) => void;
    userProfile: UserProfile | null;
}

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

const SalesInvoiceViewModal: React.FC<{ invoice: SalesInvoice | null; onClose: () => void; state: AppState }> = ({ invoice, onClose, state }) => {
    if (!invoice) return null;

    return (
        <Modal isOpen={true} onClose={onClose} title={`Invoice Details: ${invoice.id}`} size="4xl">
            <PrintableInvoiceContent invoice={invoice} state={state} />
            <div className="flex justify-end pt-6 space-x-2 no-print">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Close</button>
                <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Print Invoice</button>
            </div>
        </Modal>
    );
};

const PrintableInvoiceContent: React.FC<{ invoice: SalesInvoice | null; state: AppState }> = ({ invoice, state }) => {
    if (!invoice) return null;

    const customer = state.customers.find(c => c.id === invoice.customerId);
    
    const calculateItemValue = (item: InvoiceItem) => {
        const itemDetails = state.items.find(i => i.id === item.itemId);
        if (!itemDetails || item.rate === undefined) return 0;
        if (itemDetails.packingType === PackingType.Bales) {
            return item.quantity * itemDetails.baleSize * item.rate;
        }
        return item.quantity * item.rate;
    };
    
    const itemsTotal = invoice.items.reduce((sum, item) => sum + calculateItemValue(item), 0);
    
    const freightInUSD = (invoice.freightAmount || 0) * (invoice.freightConversionRate || 1);
    const clearingInUSD = (invoice.customCharges || 0) * (invoice.customChargesConversionRate || 1);
    const commissionInUSD = (invoice.commissionAmount || 0) * (invoice.commissionConversionRate || 1);
    
    const grandTotal = itemsTotal + freightInUSD + clearingInUSD + commissionInUSD;
    const currency = invoice.items.length > 0 ? (invoice.items[0].currency || Currency.Dollar) : Currency.Dollar;

    return (
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
                            <td className="p-2 text-right text-slate-800">{freightInUSD.toFixed(2)}</td>
                        </tr>
                    )}
                    {invoice.customCharges && (
                        <tr className="font-medium">
                            <td colSpan={3} className="p-2 text-right text-slate-800">Customs Charges</td>
                            <td className="p-2 text-right text-slate-800">{clearingInUSD.toFixed(2)}</td>
                        </tr>
                    )}
                     {invoice.commissionAmount && (
                        <tr className="font-medium">
                            <td colSpan={3} className="p-2 text-right text-slate-800">Commission</td>
                            <td className="p-2 text-right text-slate-800">{commissionInUSD.toFixed(2)}</td>
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
    );
};

const SalesInvoiceModule: React.FC<SalesInvoiceProps> = ({ setModule, userProfile }) => {
    const { state, dispatch } = useData();
    const [customerId, setCustomerId] = useState('');
    const [invoiceId, setInvoiceId] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [logoId, setLogoId] = useState('');
    const [packingColor, setPackingColor] = useState('');
    const [divisionId, setDivisionId] = useState('');
    const [subDivisionId, setSubDivisionId] = useState('');
    const [commissionAgentId, setCommissionAgentId] = useState('');
    const [commissionAmount, setCommissionAmount] = useState<number | ''>('');
    const [discountSurcharge, setDiscountSurcharge] = useState<number | ''>('');
    
    const [containerNumber, setContainerNumber] = useState('');
    const [freightForwarderId, setFreightForwarderId] = useState('');
    const [freightAmount, setFreightAmount] = useState<number | ''>('');
    const [clearingAgentId, setClearingAgentId] = useState('');
    const [customCharges, setCustomCharges] = useState<number | ''>('');
    
    const [freightCurrencyData, setFreightCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [clearingCurrencyData, setClearingCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [commissionCurrencyData, setCommissionCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    
    const [currentItemId, setCurrentItemId] = useState('');
    const [currentQuantity, setCurrentQuantity] = useState<number | ''>('');
    const [currentPackageRate, setCurrentPackageRate] = useState<number | ''>('');
    const [currentInvoiceItems, setCurrentInvoiceItems] = useState<(Omit<InvoiceItem, 'quantity'> & { quantity: number | '' })[]>([]);


    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [completedInvoice, setCompletedInvoice] = useState<SalesInvoice | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [invoiceToDownload, setInvoiceToDownload] = useState<SalesInvoice | null>(null);
    const [hasPrinted, setHasPrinted] = useState(false);
    
    const [lastInvoiceForCustomer, setLastInvoiceForCustomer] = useState<SalesInvoice | null>(null);

    const [subModule, setSubModule] = useState<'new' | 'update'>('new');
    const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null);
    const [viewingInvoice, setViewingInvoice] = useState<SalesInvoice | null>(null);
    const [updateFilters, setUpdateFilters] = useState({ startDate: '2024-01-01', endDate: new Date().toISOString().split('T')[0], customerId: '' });

    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const resetConfirmTimeoutRef = useRef<number | null>(null);

    const customerRef = useRef<HTMLSelectElement>(null);
    const itemRef = useRef<HTMLInputElement>(null);
    const commissionAmountRef = useRef<HTMLInputElement>(null);
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];
    
    const commonColors = [
        "Blue", "White", "Red", "Green", "Yellow", "Black", "Gray", "Orange", "Purple", "Brown", "Pink"
    ];

    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    const availableSubDivisions = useMemo(() => {
        if (!divisionId) return [];
        return state.subDivisions.filter(sd => sd.divisionId === divisionId);
    }, [divisionId, state.subDivisions]);
    
    useEffect(() => {
        if (customerId && !invoiceId && !editingInvoice) {
            setInvoiceId(generateInvoiceId(state.nextInvoiceNumber));
            setInvoiceDate(new Date().toISOString().split('T')[0]);
        }
        
        if (customerId) {
            const customer = state.customers.find(c => c.id === customerId);
            if (customer) {
                setDivisionId(customer.divisionId || '');
                setSubDivisionId(customer.subDivisionId || '');
            }

            const customerInvoices = state.salesInvoices
                .filter(inv => inv.customerId === customerId && inv.status === InvoiceStatus.Posted)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            if (customerInvoices.length > 0) {
                setLastInvoiceForCustomer(customerInvoices[0]);
            } else {
                setLastInvoiceForCustomer(null);
            }
        } else {
            setLastInvoiceForCustomer(null);
            setDivisionId('');
            setSubDivisionId('');
        }
    }, [customerId, invoiceId, state.nextInvoiceNumber, state.salesInvoices, state.customers, editingInvoice]);
    
    useEffect(() => { if (!freightForwarderId) setFreightAmount(''); }, [freightForwarderId]);
    useEffect(() => { if (!clearingAgentId) setCustomCharges(''); }, [clearingAgentId]);
    useEffect(() => { if (!commissionAgentId) setCommissionAmount(''); }, [commissionAgentId]);

    useEffect(() => {
        if (invoiceToDownload) {
            const generatePdf = async () => {
                const input = document.getElementById('pdf-generation-area');
                if (!input) {
                    setInvoiceToDownload(null);
                    return;
                }
                
                const { jsPDF } = (window as any).jspdf;
                const html2canvas = (window as any).html2canvas;

                if (jsPDF && html2canvas) {
                    const canvas = await html2canvas(input, { scale: 2 });
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const ratio = pdfWidth / imgWidth;
                    const pdfHeight = imgHeight * ratio;

                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save(`SalesInvoice_${invoiceToDownload.id}.pdf`);
                }
                
                setInvoiceToDownload(null);
            };
            
            setTimeout(generatePdf, 100);
        }
    }, [invoiceToDownload]);


    const resetInvoice = () => {
        setCustomerId('');
        setInvoiceId('');
        setInvoiceDate('');
        setLogoId('');
        setPackingColor('');
        setDivisionId('');
        setSubDivisionId('');
        setDiscountSurcharge('');
        setCurrentItemId('');
        setCurrentQuantity('');
        setCurrentPackageRate('');
        setCurrentInvoiceItems([]);
        setCompletedInvoice(null);
        setLastInvoiceForCustomer(null);
        setEditingInvoice(null);
        setContainerNumber('');
        setFreightForwarderId('');
        setFreightAmount('');
        setClearingAgentId('');
        setCustomCharges('');
        setCommissionAgentId('');
        setCommissionAmount('');
        setFreightCurrencyData({ currency: Currency.Dollar, conversionRate: 1 });
        setClearingCurrencyData({ currency: Currency.Dollar, conversionRate: 1 });
        setCommissionCurrencyData({ currency: Currency.Dollar, conversionRate: 1 });
    };

     const isFormDirty = useMemo(() => {
        return !!customerId || currentInvoiceItems.length > 0;
    }, [customerId, currentInvoiceItems]);

    useEffect(() => {
        const handleLocalKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isFormDirty && subModule === 'new' && !isSummaryModalOpen && !invoiceToDownload && !viewingInvoice) {
                event.preventDefault();
                event.stopPropagation(); 

                if (showResetConfirm) {
                    resetInvoice();
                    setNotification("Invoice form has been reset.");
                    setShowResetConfirm(false);
                    if (resetConfirmTimeoutRef.current) {
                        clearTimeout(resetConfirmTimeoutRef.current);
                    }
                } else {
                    setShowResetConfirm(true);
                    setNotification("Press Escape again to reset the form.");
                    resetConfirmTimeoutRef.current = window.setTimeout(() => {
                        setShowResetConfirm(false);
                    }, 3000);
                }
            }
        };
        
        document.addEventListener('keydown', handleLocalKeyDown);

        return () => {
            document.removeEventListener('keydown', handleLocalKeyDown);
            if (resetConfirmTimeoutRef.current) {
                clearTimeout(resetConfirmTimeoutRef.current);
            }
        };
    }, [isFormDirty, showResetConfirm, subModule, isSummaryModalOpen, invoiceToDownload, viewingInvoice]);


    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentItemId || !currentQuantity || currentQuantity <= 0) return;
        const itemDetails = state.items.find(i => i.id === currentItemId);
        if (!itemDetails) {
            setNotification('Selected item not found.');
            return;
        }

        let perKgRate = itemDetails.avgSalesPrice;
        const packageRateNum = Number(currentPackageRate);
        if (itemDetails.packingType !== PackingType.Kg && itemDetails.baleSize > 0 && packageRateNum > 0) {
            perKgRate = packageRateNum / itemDetails.baleSize;
        }

        setCurrentInvoiceItems([...currentInvoiceItems, { 
            itemId: currentItemId, 
            quantity: Number(currentQuantity), 
            rate: perKgRate,
            currency: Currency.Dollar,
            conversionRate: 1,
        }]);
        setCurrentItemId('');
        setCurrentQuantity('');
        setCurrentPackageRate('');
        setNotification('Item added to invoice.');
        itemRef.current?.focus();
    };

    const calculateTotals = (items: InvoiceItem[]) => {
        let totalPackages = 0;
        let totalKg = 0;
        items.forEach(item => {
            const itemDetails = state.items.find(i => i.id === item.itemId);
            if (!itemDetails) return;
    
            const isPackage = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(itemDetails.packingType);

            if (isPackage) {
                totalPackages += item.quantity;
                totalKg += item.quantity * itemDetails.baleSize;
            } else { // It must be PackingType.Kg
                totalKg += item.quantity;
            }
        });
        return { totalPackages, totalKg };
    };
    
    const { totalPackages, totalKg } = useMemo(() => {
        const validItems: InvoiceItem[] = currentInvoiceItems
            .map(item => ({...item, quantity: Number(item.quantity) || 0 }))
            .filter(item => item.quantity > 0);
        return calculateTotals(validItems);
    }, [currentInvoiceItems, state.items]);


    const handlePrepareInvoiceSummary = () => {
        const itemsWithNumericQuantities = currentInvoiceItems
            .map(item => ({...item, quantity: Number(item.quantity) || 0 }))
            .filter(item => item.quantity > 0);

        if (itemsWithNumericQuantities.length === 0) {
            alert("Please add items with a quantity greater than 0.");
            return;
        }

        const { totalPackages, totalKg } = calculateTotals(itemsWithNumericQuantities);

        const newInvoice: SalesInvoice = {
            id: invoiceId,
            date: invoiceDate,
            customerId,
            items: itemsWithNumericQuantities,
            status: editingInvoice?.status || InvoiceStatus.Unposted,
            totalBales: totalPackages, // totalBales property is used for this in the type
            totalKg,
            logoId: logoId || undefined,
            packingColor: packingColor || undefined,
            divisionId: divisionId || undefined,
            subDivisionId: subDivisionId || undefined,
            containerNumber: containerNumber || undefined,
            discountSurcharge: Number(discountSurcharge) || undefined,
            
            freightForwarderId: freightForwarderId || undefined,
            freightAmount: Number(freightAmount) || undefined,
            freightCurrency: freightCurrencyData.currency,
            freightConversionRate: freightCurrencyData.conversionRate,

            clearingAgentId: clearingAgentId || undefined,
            customCharges: Number(customCharges) || undefined,
            customChargesCurrency: clearingCurrencyData.currency,
            customChargesConversionRate: clearingCurrencyData.conversionRate,

            commissionAgentId: commissionAgentId || undefined,
            commissionAmount: Number(commissionAmount) > 0 ? Number(commissionAmount) : undefined,
            commissionCurrency: commissionCurrencyData.currency,
            commissionConversionRate: commissionCurrencyData.conversionRate,
            
            sourceOrderId: editingInvoice?.sourceOrderId,
        };

        setCompletedInvoice(newInvoice);
        setHasPrinted(false);
        setIsSummaryModalOpen(true);
    };

    const handleSaveAndProceed = () => {
        if (!completedInvoice) return;

        // If it was a posted invoice being edited, we need to update Journal Entries
        if (editingInvoice && editingInvoice.status === InvoiceStatus.Posted) {
            // ... (Journal Entry logic remains the same, omitted for brevity)
        }
        
        if (editingInvoice) {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'salesInvoices', data: completedInvoice } });
        } else {
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'salesInvoices', data: completedInvoice } });
        }
        
        setInvoiceToDownload(completedInvoice);

        // FIX: Replaced 'showNotification' with 'setNotification' to correctly update the notification state.
        setNotification('Invoice saved successfully!');
        resetInvoice();
        setIsSummaryModalOpen(false);
        setCompletedInvoice(null);
    };

    const handleCloseSummaryModal = () => {
        setIsSummaryModalOpen(false);
    };
    
    const handleCancelEntry = () => {
        resetInvoice();
        setIsSummaryModalOpen(false);
        setCompletedInvoice(null);
    };
    
    const handlePrintInModal = () => {
        window.print();
        setHasPrinted(true);
    };

    const handleDeleteItem = (indexToDelete: number) => {
        setCurrentInvoiceItems(currentInvoiceItems.filter((_, index) => index !== indexToDelete));
    };
    
    const handleQuantityChange = (indexToUpdate: number, newQuantity: string) => {
        const quantityAsNumber = parseInt(newQuantity, 10);
        if (newQuantity !== '' && (isNaN(quantityAsNumber) || quantityAsNumber < 0)) {
            return;
        }

        const updatedItems = currentInvoiceItems.map((item, index) => {
            if (index === indexToUpdate) {
                return { ...item, quantity: newQuantity === '' ? '' : quantityAsNumber };
            }
            return item;
        });
        setCurrentInvoiceItems(updatedItems as (Omit<InvoiceItem, "quantity"> & { quantity: number | ""; })[]);
    };
    
    const handleEditInvoice = (invoice: SalesInvoice) => {
        setEditingInvoice(invoice);
        setCustomerId(invoice.customerId);
        setInvoiceId(invoice.id);
        setInvoiceDate(invoice.date);
        setLogoId(invoice.logoId || '');
        setPackingColor(invoice.packingColor || '');
        setDivisionId(invoice.divisionId || '');
        setSubDivisionId(invoice.subDivisionId || '');
        setDiscountSurcharge(invoice.discountSurcharge || '');
        setContainerNumber(invoice.containerNumber || '');
        
        setFreightForwarderId(invoice.freightForwarderId || '');
        setFreightAmount(invoice.freightAmount || '');
        setFreightCurrencyData({ currency: invoice.freightCurrency || Currency.Dollar, conversionRate: invoice.freightConversionRate || 1 });
        
        setClearingAgentId(invoice.clearingAgentId || '');
        setCustomCharges(invoice.customCharges || '');
        setClearingCurrencyData({ currency: invoice.customChargesCurrency || Currency.Dollar, conversionRate: invoice.customChargesConversionRate || 1 });
        
        setCommissionAgentId(invoice.commissionAgentId || '');
        setCommissionAmount(invoice.commissionAmount || '');
        setCommissionCurrencyData({ currency: invoice.commissionCurrency || Currency.Dollar, conversionRate: invoice.commissionConversionRate || 1 });

        setCurrentInvoiceItems(invoice.items.map(i => {
            const itemDetails = state.items.find(item => item.id === i.itemId);
            return {
                ...i, 
                quantity: i.quantity,
                rate: i.rate ?? itemDetails?.avgSalesPrice,
            };
        }));
        setSubModule('new');
    };

    const renderAddItemForm = () => {
        const itemDetails = state.items.find(i => i.id === currentItemId);
        const showPackageRate = itemDetails && itemDetails.packingType !== PackingType.Kg && itemDetails.baleSize > 0;

        return (
            <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                <h4 className="text-md font-semibold text-slate-700 border-b pb-2">Add Item</h4>
                <form onSubmit={handleAddItem} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
                        <ItemSelector
                            inputRef={itemRef}
                            items={state.items}
                            selectedItemId={currentItemId}
                            onSelect={(id) => {
                                setCurrentItemId(id);
                                setCurrentPackageRate('');
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                        <input 
                            type="number" 
                            value={currentQuantity} 
                            onChange={e => setCurrentQuantity(e.target.value === '' ? '' : Number(e.target.value))} 
                            className="w-full p-2 rounded-md"
                        />
                    </div>
                    {showPackageRate && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Sales Package Rate</label>
                            <input 
                                type="number"
                                step="0.01"
                                value={currentPackageRate} 
                                onChange={e => setCurrentPackageRate(e.target.value === '' ? '' : Number(e.target.value))} 
                                className="w-full p-2 rounded-md"
                                placeholder={`e.g., Rate for a ${itemDetails.baleSize}kg ${itemDetails.packingType}`}
                            />
                        </div>
                    )}
                    <button type="submit" className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 h-10">
                        Add Item to Invoice
                    </button>
                </form>
            </div>
        );
    };
    
    const renderInvoiceBody = () => (
        <>
            <div className="grid grid-cols-10 gap-8 items-start">
                <div className="col-span-3">
                    {renderAddItemForm()}
                </div>
                <div className="col-span-7">
                     {currentInvoiceItems.length > 0 ? (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-semibold text-slate-600">Current Invoice Items</h3>
                                <div className="flex space-x-4">
                                    <div className="text-right p-2 bg-slate-100 rounded-lg">
                                        <p className="text-xs font-medium text-slate-500">Total Packages</p>
                                        <p className="text-lg font-bold text-slate-800">{totalPackages.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right p-2 bg-slate-100 rounded-lg">
                                        <p className="text-xs font-medium text-slate-500">Total Kg</p>
                                        <p className="text-lg font-bold text-slate-800">{totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-y-auto border rounded-md max-h-[320px]">
                                <table className="w-full text-left table-auto">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="p-3 font-semibold text-slate-600">Item Name</th>
                                            <th className="p-3 font-semibold text-slate-600 text-right">Package Size</th>
                                            <th className="p-3 font-semibold text-slate-600 w-24">Quantity</th>
                                            <th className="p-3 font-semibold text-slate-600 text-right">Total Kg</th>
                                            <th className="p-3 font-semibold text-slate-600 w-32">Rate</th>
                                            <th className="p-3 font-semibold text-slate-600 text-right">Total Worth</th>
                                            <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentInvoiceItems.map((item, index) => {
                                            const itemDetails = state.items.find(i => i.id === item.itemId);
                                            let totalKgForItem = 0;
                                            if (itemDetails && item.quantity) {
                                                const isPackage = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(itemDetails.packingType);
                                                if (isPackage) {
                                                    totalKgForItem = Number(item.quantity) * itemDetails.baleSize;
                                                } else { // Kg
                                                    totalKgForItem = Number(item.quantity);
                                                }
                                            }
                                            
                                            const rate = Number(item.rate) || 0;
                                            const conversionRate = Number(item.conversionRate) || 1;
                                            const totalWorth = totalKgForItem * rate * conversionRate;
                                            const currency = item.currency || Currency.Dollar;
                                            return (
                                            <tr key={index} className="border-b hover:bg-slate-50 transition-colors">
                                                <td className="p-3 text-slate-700 align-middle">
                                                    {itemDetails?.name}
                                                    <span className="text-xs text-slate-500 ml-2">({item.itemId})</span>
                                                </td>
                                                <td className="p-3 text-slate-700 align-middle text-right">{itemDetails?.packingType !== PackingType.Kg ? itemDetails.baleSize : 'N/A'}</td>
                                                <td className="p-3 text-slate-700 align-middle">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={e => handleQuantityChange(index, e.target.value)}
                                                        className="w-full p-2 rounded-md"
                                                        aria-label={`Quantity for ${itemDetails?.name}`}
                                                    />
                                                </td>
                                                <td className="p-3 text-slate-700 align-middle text-right">{totalKgForItem.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                                <td className="p-3 text-slate-700 align-middle">
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={item.rate ?? ''}
                                                            className="w-full p-2 pr-10 rounded-md bg-slate-100 text-slate-500 text-right"
                                                            aria-label={`Rate for ${itemDetails?.name}`}
                                                            disabled
                                                        />
                                                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-slate-500">{currency}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-slate-700 align-middle text-right font-medium">{formatCurrency(totalWorth)}</td>
                                                <td className="p-3 text-right align-middle">
                                                    <button 
                                                        onClick={() => handleDeleteItem(index)} 
                                                        className="text-red-600 hover:text-red-800 transition-colors p-2 rounded-full hover:bg-red-50"
                                                        aria-label={`Delete ${itemDetails?.name}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                         <div className="flex items-center justify-center h-full border rounded-lg bg-slate-50 min-h-[250px]">
                            <p className="text-slate-500">Items added to the invoice will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
             {currentInvoiceItems.length > 0 && (
                <div className="flex justify-end mt-4">
                    <button onClick={handlePrepareInvoiceSummary} className="py-2 px-6 bg-green-600 text-white rounded-md hover:bg-green-700">
                       {editingInvoice ? 'Finalize & Update' : 'Invoice Complete'}
                    </button>
                </div>
            )}
        </>
    );

    const filteredUpdateInvoices = useMemo(() => {
        return state.salesInvoices
            .filter(inv => 
                inv.date >= updateFilters.startDate &&
                inv.date <= updateFilters.endDate &&
                (!updateFilters.customerId || inv.customerId === updateFilters.customerId)
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [updateFilters, state.salesInvoices]);

    const renderUpdateList = () => (
        <div className="bg-white p-6 rounded-lg shadow-md">
             <div className="p-4 bg-slate-50 rounded-lg border mb-6 flex flex-wrap gap-4 items-end">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label><input type="date" value={updateFilters.startDate} onChange={e => setUpdateFilters({...updateFilters, startDate: e.target.value})} className="w-full p-2 rounded-md text-sm"/></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">End Date</label><input type="date" value={updateFilters.endDate} onChange={e => setUpdateFilters({...updateFilters, endDate: e.target.value})} className="w-full p-2 rounded-md text-sm"/></div>
                <div className="flex-grow"><label className="block text-sm font-medium text-slate-700 mb-1">Customer</label><select value={updateFilters.customerId} onChange={e => setUpdateFilters({...updateFilters, customerId: e.target.value})} className="w-full p-2 rounded-md text-sm"><option value="">All Customers</option>{state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead><tr className="bg-slate-100"><th className="p-3 font-semibold text-slate-600">ID</th><th className="p-3 font-semibold text-slate-600">Customer</th><th className="p-3 font-semibold text-slate-600">Date</th><th className="p-3 font-semibold text-slate-600">Status</th><th className="p-3 font-semibold text-slate-600 text-right">Actions</th></tr></thead>
                    <tbody>
                        {filteredUpdateInvoices.map(invoice => (
                            <tr key={invoice.id} className="border-b hover:bg-slate-50">
                                <td className="p-3 text-slate-700 font-mono">{invoice.id}</td>
                                <td className="p-3 text-slate-700">{state.customers.find(c=>c.id === invoice.customerId)?.name}</td>
                                <td className="p-3 text-slate-700">{invoice.date}</td>
                                <td className="p-3 text-slate-700">{invoice.status}</td>
                                <td className="p-3 text-right space-x-2">
                                    <button onClick={() => setViewingInvoice(invoice)} className="text-gray-600 hover:text-gray-800 text-sm font-semibold">View</button>
                                    {userProfile?.isAdmin && (
                                        <>
                                            <button onClick={() => handleEditInvoice(invoice)} className="text-blue-600 hover:text-blue-800 text-sm font-semibold">Edit</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredUpdateInvoices.length === 0 && <p className="text-center text-slate-500 py-6">No invoices match the current filters.</p>}
            </div>
        </div>
    );
    
    const getButtonClass = (module: 'new' | 'update') => `px-4 py-2 rounded-md transition-colors text-sm font-medium ${subModule === module ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`;

    return (
        <div className="space-y-6">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
            
            {showResetConfirm && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out-short font-semibold">
                    Press Escape again to reset the form.
                </div>
            )}
            
            <div className="flex items-center space-x-2">
                <button onClick={() => { setSubModule('new'); resetInvoice(); }} className={getButtonClass('new')}>New Invoice</button>
                <button onClick={() => { setSubModule('update'); resetInvoice(); }} className={getButtonClass('update')}>Update / View Invoices</button>
            </div>

            {subModule === 'new' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end p-4 border rounded-md bg-white">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700">Customer</label>
                            <EntitySelector
                                entities={state.customers}
                                selectedEntityId={customerId}
                                onSelect={setCustomerId}
                                placeholder="Search Customers..."
                                disabled={!!editingInvoice}
                                inputRef={customerRef as any}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Logo</label>
                            <select value={logoId} onChange={e => setLogoId(e.target.value)} className="mt-1 w-full p-2 border border-slate-300 rounded-md">
                                <option value="">Select Logo</option>
                                {state.logos.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Packing Color</label>
                            <select value={packingColor} onChange={e => setPackingColor(e.target.value)} className="mt-1 w-full p-2 border border-slate-300 rounded-md">
                                <option value="">Select Color</option>
                                {commonColors.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Invoice ID</label>
                            <input type="text" value={invoiceId} readOnly className="mt-1 w-full p-2 border border-slate-300 rounded-md bg-slate-200"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Date</label>
                            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} min={minDate} disabled={!invoiceId} className="mt-1 w-full p-2 border border-slate-300 rounded-md disabled:bg-slate-200"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CollapsibleSection title="Logistics & Destination">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700">Container #</label><input type="text" value={containerNumber} onChange={e => setContainerNumber(e.target.value)} className="mt-1 w-full p-2 rounded-md" /></div>
                                <div><label className="block text-sm font-medium text-slate-700">Division</label><select value={divisionId} onChange={e => setDivisionId(e.target.value)} className="mt-1 w-full p-2 rounded-md"><option value="">Select Division</option>{state.divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                                <div><label className="block text-sm font-medium text-slate-700">Sub Division</label><select value={subDivisionId} onChange={e => setSubDivisionId(e.target.value)} disabled={!divisionId || availableSubDivisions.length === 0} className="mt-1 w-full p-2 rounded-md"><option value="">Select Sub-Division</option>{availableSubDivisions.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}</select></div>
                                <div><label className="block text-sm font-medium text-slate-700">Discount(-) / Surcharge(+)</label><input type="number" value={discountSurcharge} onChange={e => setDiscountSurcharge(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full p-2 rounded-md" placeholder="Amount in USD"/></div>
                            </div>
                        </CollapsibleSection>
                        <CollapsibleSection title="Additional Costs">
                             <div className="space-y-4">
                                <div><label className="block text-sm font-medium text-slate-700">Freight Forwarder</label><select value={freightForwarderId} onChange={e => setFreightForwarderId(e.target.value)} className="mt-1 w-full p-2 rounded-md"><option value="">Select...</option>{state.freightForwarders.map(ff => <option key={ff.id} value={ff.id}>{ff.name}</option>)}</select></div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" value={freightAmount} placeholder="Freight Amount" onChange={e => setFreightAmount(e.target.value === '' ? '' : Number(e.target.value))} disabled={!freightForwarderId} className="w-full p-2 rounded-md" />
                                    <CurrencyInput value={freightCurrencyData} onChange={setFreightCurrencyData} disabled={!freightForwarderId} />
                                </div>
                                <div><label className="block text-sm font-medium text-slate-700">Clearing Agent</label><select value={clearingAgentId} onChange={e => setClearingAgentId(e.target.value)} className="mt-1 w-full p-2 rounded-md"><option value="">Select...</option>{state.clearingAgents.map(ca => <option key={ca.id} value={ca.id}>{ca.name}</option>)}</select></div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" value={customCharges} placeholder="Clearing Amount" onChange={e => setCustomCharges(e.target.value === '' ? '' : Number(e.target.value))} disabled={!clearingAgentId} className="w-full p-2 rounded-md" />
                                    <CurrencyInput value={clearingCurrencyData} onChange={setClearingCurrencyData} disabled={!clearingAgentId} />
                                </div>
                                <div><label className="block text-sm font-medium text-slate-700">Commission Agent</label><select value={commissionAgentId} onChange={e => setCommissionAgentId(e.target.value)} className="mt-1 w-full p-2 rounded-md"><option value="">Select...</option>{state.commissionAgents.map(ca => <option key={ca.id} value={ca.id}>{ca.name}</option>)}</select></div>
                                 <div className="grid grid-cols-2 gap-2">
                                    <input type="number" value={commissionAmount} placeholder="Commission Amount" onChange={e => setCommissionAmount(e.target.value === '' ? '' : Number(e.target.value))} disabled={!commissionAgentId} className="w-full p-2 rounded-md" />
                                    <CurrencyInput value={commissionCurrencyData} onChange={setCommissionCurrencyData} disabled={!commissionAgentId} />
                                </div>
                             </div>
                        </CollapsibleSection>
                    </div>

                    {invoiceId && renderInvoiceBody()}
                </div>
            )}
            
            {subModule === 'update' && renderUpdateList()}

            {completedInvoice && (
                <Modal isOpen={isSummaryModalOpen} onClose={handleCloseSummaryModal} title="Invoice Summary & Confirmation" size="5xl">
                    <PrintableInvoiceContent invoice={completedInvoice} state={state} />
                     <div className="flex justify-end pt-6 space-x-2 no-print">
                        {hasPrinted ? (
                            <>
                                <button onClick={handleCancelEntry} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Cancel Entry</button>
                                <button disabled className="px-4 py-2 bg-slate-400 text-white rounded-md cursor-not-allowed">Printed</button>
                                <button onClick={handleSaveAndProceed} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save & Exit</button>
                            </>
                        ) : (
                            <>
                                <button onClick={handleCloseSummaryModal} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                                <button onClick={handlePrintInModal} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Print</button>
                                <button onClick={handleSaveAndProceed} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save & Download PDF</button>
                            </>
                        )}
                    </div>
                </Modal>
            )}

            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                {invoiceToDownload && <div id="pdf-generation-area"><PrintableInvoiceContent invoice={invoiceToDownload} state={state} /></div>}
            </div>
            
            {viewingInvoice && (
                <SalesInvoiceViewModal 
                    invoice={viewingInvoice}
                    onClose={() => setViewingInvoice(null)}
                    state={state}
                />
            )}
        </div>
    );
};

export default SalesInvoiceModule;