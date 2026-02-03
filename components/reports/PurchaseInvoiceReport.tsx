import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { AppState, Currency, OriginalPurchased, FinishedGoodsPurchase } from '../../types.ts';
import Modal from '../ui/Modal.tsx';

const PurchaseInvoiceViewModal: React.FC<{ purchaseId: string, onClose: () => void, state: AppState }> = ({ purchaseId, onClose, state }) => {
    const originalPurchase = state.originalPurchases.find(p => p.id === purchaseId);
    const finishedGoodsPurchase = state.finishedGoodsPurchases.find(p => p.id === purchaseId);
    const purchase = originalPurchase || finishedGoodsPurchase;
    const purchaseType = originalPurchase ? 'Original' : 'Finished Goods';

    if (!purchase) {
        return (
             <Modal isOpen={true} onClose={onClose} title="Error">
                <p>Could not find purchase with ID: {purchaseId}</p>
             </Modal>
        );
    }

    const supplier = state.suppliers.find(c => c.id === purchase.supplierId);
    const handlePrint = () => window.print();

    let totalValue = 0;
    if (purchaseType === 'Original') {
        const p = purchase as OriginalPurchased;
        const totalForeign = p.quantityPurchased * p.rate;
        // FIX: The conversion rate is consistently stored as (USD per 1 unit of FCY), so multiplication is always correct.
        totalValue = totalForeign * p.conversionRate;

    } else {
        totalValue = (purchase as FinishedGoodsPurchase).totalAmountInDollar;
    }

    const currency = purchase.currency || Currency.Dollar;
    
    return (
        <Modal isOpen={true} onClose={onClose} title={`Purchase Details: ${purchase.id}`} size="4xl">
            <div id="voucher-print-area" className="space-y-4 text-sm text-slate-800">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Purchase Invoice</h2>
                    <p className="text-slate-600">USMAN GLOBAL</p>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-b pb-4 text-slate-700">
                    <p><strong className="text-slate-800">Purchase ID:</strong> {purchase.id}</p>
                    <p><strong className="text-slate-800">Date:</strong> {purchase.date}</p>
                    <p><strong className="text-slate-800">Supplier:</strong> {supplier?.name || 'N/A'}</p>
                    <p><strong className="text-slate-800">Batch #:</strong> {purchase.batchNumber || 'N/A'}</p>
                    <p><strong className="text-slate-800">Container #:</strong> {purchase.containerNumber || 'N/A'}</p>
                </div>
                
                <h3 className="font-bold text-slate-800 mt-4">Items Purchased</h3>
                <table className="w-full text-left table-auto my-4 border-t border-b">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="p-2 font-semibold text-slate-600">Description</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Quantity</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Rate</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Total ({currency})</th>
                        </tr>
                    </thead>
                    <tbody>
                        {purchaseType === 'Original' && (() => {
                            const p = purchase as OriginalPurchased;
                            const originalType = state.originalTypes.find(ot => ot.id === p.originalTypeId);
                            return (
                                <tr className="border-b">
                                    <td className="p-2 text-slate-700">{originalType?.name || 'Unknown Type'}</td>
                                    <td className="p-2 text-slate-700 text-right">{p.quantityPurchased.toLocaleString()}</td>
                                    <td className="p-2 text-slate-700 text-right">{(p.rate || 0).toFixed(2)}</td>
                                    <td className="p-2 text-slate-700 text-right">{(p.quantityPurchased * p.rate).toFixed(2)}</td>
                                </tr>
                            );
                        })()}
                        {purchaseType === 'Finished Goods' && (purchase as FinishedGoodsPurchase).items.map((item, index) => {
                            const itemDetails = state.items.find(i => i.id === item.itemId);
                            return (
                                <tr key={index} className="border-b">
                                    <td className="p-2 text-slate-700">{itemDetails?.name || 'Unknown Item'}</td>
                                    <td className="p-2 text-slate-700 text-right">{item.quantity.toLocaleString()}</td>
                                    <td className="p-2 text-slate-700 text-right">{(item.rate || 0).toFixed(2)}</td>
                                    <td className="p-2 text-slate-700 text-right">{(item.quantity * item.rate).toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold bg-slate-100">
                            <td colSpan={3} className="p-2 text-right text-slate-800">Subtotal ({currency})</td>
                            <td className="p-2 text-right text-slate-800">
                                {purchaseType === 'Finished Goods' 
                                    ? (purchase as FinishedGoodsPurchase).totalAmount.toFixed(2) 
                                    : ((purchase as OriginalPurchased).quantityPurchased * (purchase as OriginalPurchased).rate).toFixed(2)
                                }
                            </td>
                        </tr>
                    </tfoot>
                </table>

                {(purchase.freightAmount || purchase.clearingAmount || purchase.commissionAmount) && (
                    <>
                        <h3 className="font-bold text-slate-800 mt-4">Additional Costs</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-t pt-4 text-slate-700">
                            {purchase.freightAmount && <p><strong>Freight Amount:</strong> ${purchase.freightAmount.toFixed(2)}</p>}
                            {purchase.clearingAmount && <p><strong>Clearing Amount:</strong> ${purchase.clearingAmount.toFixed(2)}</p>}
                            {purchase.commissionAmount && <p><strong>Commission Amount:</strong> ${purchase.commissionAmount.toFixed(2)}</p>}
                        </div>
                    </>
                )}

                <div className="text-right font-bold text-lg bg-slate-100 p-3 rounded-md mt-4">
                    Grand Total (USD): ${totalValue.toFixed(2)}
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


const PurchaseInvoiceReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    type PurchaseType = 'All' | 'Original' | 'Finished Goods';
    const [filters, setFilters] = useState({ startDate: firstDayOfMonth, endDate: today, supplierId: '', purchaseType: 'All' as PurchaseType });
    const [viewingPurchaseId, setViewingPurchaseId] = useState<string | null>(null);

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const calculateTotalValue = (purchase: OriginalPurchased) => {
        const totalForeignAmount = purchase.quantityPurchased * purchase.rate;
        // The original logic incorrectly divided for some currencies. The conversion rate
        // is consistently stored as (USD per 1 unit of FCY), so multiplication is always correct.
        return totalForeignAmount * purchase.conversionRate;
    };

    const reportData = useMemo(() => {
        const originalPurchases = filters.purchaseType === 'All' || filters.purchaseType === 'Original'
            ? state.originalPurchases.map(p => ({ ...p, type: 'Original', totalValue: calculateTotalValue(p) }))
            : [];
        
        const finishedGoodsPurchases = filters.purchaseType === 'All' || filters.purchaseType === 'Finished Goods'
            ? state.finishedGoodsPurchases.map(p => ({ ...p, type: 'Finished Goods', totalValue: p.totalAmountInDollar }))
            : [];
        
        const allPurchases = [...originalPurchases, ...finishedGoodsPurchases];

        return allPurchases
            .filter(p => p.date >= filters.startDate && p.date <= filters.endDate)
            .filter(p => !filters.supplierId || p.supplierId === filters.supplierId)
            .map(p => ({
                ...p,
                supplierName: state.suppliers.find(s => s.id === p.supplierId)?.name || 'N/A',
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filters, state]);
    
    const exportHeaders = [
        { label: 'ID', key: 'id' }, { label: 'Date', key: 'date' }, { label: 'Supplier', key: 'supplierName' },
        { label: 'Type', key: 'type' }, { label: 'Batch #', key: 'batchNumber' }, { label: 'Container #', key: 'containerNumber' },
        { label: 'Total Value ($)', key: 'totalValue' },
    ];

    const formatCurrency = (val: number) => val.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

    return (
        <div className="report-print-area">
            <ReportToolbar title="Purchase Invoices Report" exportData={reportData.map(d => ({...d, totalValue: d.totalValue.toFixed(2), containerNumber: d.containerNumber || ''}))} exportHeaders={exportHeaders} exportFilename={`PurchaseInvoices_${filters.startDate}_to_${filters.endDate}`} />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                    <select value={filters.supplierId} onChange={e => handleFilterChange('supplierId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="">All Suppliers</option>
                        {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Type</label>
                    <select value={filters.purchaseType} onChange={e => handleFilterChange('purchaseType', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="All">All</option>
                        <option value="Original">Original</option>
                        <option value="Finished Goods">Finished Goods</option>
                    </select>
                </div>
            </ReportFilters>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead><tr className="bg-slate-100"><th className="p-2 font-semibold text-slate-600">ID</th><th className="p-2 font-semibold text-slate-600">Date</th><th className="p-2 font-semibold text-slate-600">Supplier</th><th className="p-2 font-semibold text-slate-600">Type</th><th className="p-2 font-semibold text-slate-600">Batch #</th><th className="p-2 font-semibold text-slate-600">Container #</th><th className="p-2 font-semibold text-slate-600 text-right">Total Value</th></tr></thead>
                    <tbody>
                        {reportData.map(p => (
                            <tr key={p.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700 font-mono">
                                    <button onClick={() => setViewingPurchaseId(p.id)} className="text-blue-600 hover:underline">
                                        {p.id}
                                    </button>
                                </td>
                                <td className="p-2 text-slate-700">{p.date}</td>
                                <td className="p-2 text-slate-700">{p.supplierName}</td><td className="p-2 text-slate-700">{p.type}</td>
                                <td className="p-2 text-slate-700">{p.batchNumber}</td><td className="p-2 text-slate-700">{p.containerNumber || 'N/A'}</td>
                                <td className="p-2 text-slate-700 text-right font-medium">{formatCurrency(p.totalValue)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {reportData.length === 0 && <p className="text-center text-slate-500 py-6">No purchase invoices found for the selected criteria.</p>}
            </div>

            {viewingPurchaseId && <PurchaseInvoiceViewModal purchaseId={viewingPurchaseId} onClose={() => setViewingPurchaseId(null)} state={state} />}
        </div>
    );
};
export default PurchaseInvoiceReport;