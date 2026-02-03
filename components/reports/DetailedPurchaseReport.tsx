import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { AppState, OriginalPurchased, FinishedGoodsPurchase, Currency } from '../../types.ts';
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
        if ([Currency.AED, Currency.AustralianDollar].includes(p.currency)) {
            totalValue = p.conversionRate > 0 ? totalForeign / p.conversionRate : 0;
        } else {
            totalValue = totalForeign * p.conversionRate;
        }
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

const DetailedPurchaseReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    type PurchaseType = 'All' | 'Original' | 'Finished Goods';
    
    const [filters, setFilters] = useState({
        startDate: firstDayOfMonth,
        endDate: today,
        supplierId: '',
        purchaseType: 'All' as PurchaseType,
        batchNumber: '',
        divisionId: '',
        subDivisionId: '',
    });
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [viewingPurchaseId, setViewingPurchaseId] = useState<string | null>(null);


    const handleFilterChange = (filterName: string, value: any) => {
        setIsInitialLoad(false);
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            if (filterName === 'divisionId') newFilters.subDivisionId = '';
            return newFilters;
        });
    };

    const availableSubDivisions = useMemo(() => {
        if (!filters.divisionId) return [];
        return state.subDivisions.filter(sd => sd.divisionId === filters.divisionId);
    }, [filters.divisionId, state.subDivisions]);

    const allBatchNumbers = useMemo(() => {
        const originalBatches = state.originalPurchases.map(p => p.batchNumber).filter(Boolean);
        const finishedBatches = state.finishedGoodsPurchases.map(p => p.batchNumber).filter(Boolean);
        const uniqueBatches = Array.from(new Set([...originalBatches, ...finishedBatches] as string[]));
        return uniqueBatches.sort();
    }, [state.originalPurchases, state.finishedGoodsPurchases]);

    const reportData = useMemo(() => {
        const convertToUSD = (amount: number, currency: Currency, conversionRate: number) => {
            if (currency === Currency.Dollar) return amount;
            return amount * conversionRate;
        };

        let data: any[] = [];

        if (filters.purchaseType === 'All' || filters.purchaseType === 'Original') {
            const originalData = state.originalPurchases.map((p: OriginalPurchased) => {
                const supplier = state.suppliers.find(s => s.id === p.supplierId);
                const originalType = state.originalTypes.find(ot => ot.id === p.originalTypeId);
                const division = state.divisions.find(d => d.id === p.divisionId);
                const subDivision = state.subDivisions.find(sd => sd.id === p.subDivisionId);

                const itemValueFC = p.quantityPurchased * p.rate;
                const itemValueUSD = convertToUSD(itemValueFC, p.currency, p.conversionRate);
                
                const freightUSD = convertToUSD(p.freightAmount || 0, p.freightCurrency || Currency.Dollar, p.freightConversionRate || 1);
                const clearingUSD = convertToUSD(p.clearingAmount || 0, p.clearingCurrency || Currency.Dollar, p.clearingConversionRate || 1);
                const commissionUSD = convertToUSD(p.commissionAmount || 0, p.commissionCurrency || Currency.Dollar, p.commissionConversionRate || 1);

                const totalCosts = freightUSD + clearingUSD + commissionUSD;
                const totalPriceUSD = itemValueUSD + totalCosts;

                return {
                    id: p.id, date: p.date, supplierId: p.supplierId, supplierName: supplier?.name || 'N/A', divisionId: p.divisionId, divisionName: division?.name || 'N/A', subDivisionId: p.subDivisionId, subDivisionName: subDivision?.name || 'N/A',
                    type: 'Original', itemId: p.originalTypeId, itemName: originalType?.name || 'N/A', category: 'Original', quantity: p.quantityPurchased, rate: p.rate, totalValue: totalPriceUSD, currency: p.currency, batchNumber: p.batchNumber,
                };
            });
            data.push(...originalData);
        }

        if (filters.purchaseType === 'All' || filters.purchaseType === 'Finished Goods') {
            const finishedData = state.finishedGoodsPurchases.flatMap((p: FinishedGoodsPurchase) => {
                 const supplier = state.suppliers.find(s => s.id === p.supplierId);
                 const division = state.divisions.find(d => d.id === p.divisionId);
                 const subDivision = state.subDivisions.find(sd => sd.id === p.subDivisionId);

                 const freightUSD = convertToUSD(p.freightAmount || 0, p.freightCurrency || Currency.Dollar, p.freightConversionRate || 1);
                 const clearingUSD = convertToUSD(p.clearingAmount || 0, p.clearingCurrency || Currency.Dollar, p.clearingConversionRate || 1);
                 const commissionUSD = convertToUSD(p.commissionAmount || 0, p.commissionCurrency || Currency.Dollar, p.commissionConversionRate || 1);
                 const totalPurchaseCosts = freightUSD + clearingUSD + commissionUSD;
                 const totalPurchaseValueFC = p.totalAmount;

                 return p.items.map(item => {
                     const itemDetails = state.items.find(i => i.id === item.itemId);
                     const itemValueFC = item.quantity * item.rate;

                     const itemValueProportion = totalPurchaseValueFC > 0 ? itemValueFC / totalPurchaseValueFC : 1 / p.items.length;
                     const allocatedCosts = totalPurchaseCosts * itemValueProportion;
                     
                     const itemValueUSD = convertToUSD(itemValueFC, p.currency, p.conversionRate);
                     const totalPriceUSD = itemValueUSD + allocatedCosts;

                     return {
                        id: p.id, date: p.date, supplierId: p.supplierId, supplierName: supplier?.name || 'N/A', divisionId: p.divisionId, divisionName: division?.name || 'N/A', subDivisionId: p.subDivisionId, subDivisionName: subDivision?.name || 'N/A',
                        type: 'Finished Goods', itemId: item.itemId, itemName: itemDetails?.name || 'N/A', category: state.categories.find(c => c.id === itemDetails?.categoryId)?.name || 'N/A', quantity: item.quantity, rate: item.rate, totalValue: totalPriceUSD, currency: p.currency, batchNumber: p.batchNumber
                     };
                 });
            });
            data.push(...finishedData);
        }

        let filteredData = data;
        
        if (isInitialLoad) {
            const last15PurchaseIds = [...new Set(filteredData
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(p => p.id))]
                .slice(0, 15);
            
            filteredData = filteredData.filter(p => last15PurchaseIds.includes(p.id));
        } else {
             filteredData = data.filter(row => 
                (row.date >= filters.startDate && row.date <= filters.endDate) &&
                (!filters.supplierId || row.supplierId === filters.supplierId) &&
                (!filters.divisionId || row.divisionId === filters.divisionId) &&
                (!filters.subDivisionId || row.subDivisionId === filters.subDivisionId) &&
                (!filters.batchNumber || row.batchNumber === filters.batchNumber)
            );
        }

        return filteredData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filters, state, isInitialLoad]);

    const exportHeaders = [
        { label: 'Date', key: 'date' }, { label: 'Purchase ID', key: 'id' }, { label: 'Supplier', key: 'supplierName' }, { label: 'Division', key: 'divisionName' }, { label: 'Sub-Division', key: 'subDivisionName' },
        { label: 'Item/Type', key: 'itemName' }, { label: 'Category', key: 'category' }, { label: 'Quantity', key: 'quantity' }, { label: 'Rate', key: 'rate' }, { label: 'Currency', key: 'currency' }, { label: 'Total Price ($)', key: 'totalValue' },
    ];
    
    const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalQuantity = useMemo(() => reportData.reduce((sum, row) => sum + row.quantity, 0), [reportData]);
    const totalPrice = useMemo(() => reportData.reduce((sum, row) => sum + row.totalValue, 0), [reportData]);

    return (
        <div className="report-print-area">
            <ReportToolbar title="Detailed Purchase Report" exportData={reportData} exportHeaders={exportHeaders} exportFilename={`DetailedPurchases_${filters.startDate}_to_${filters.endDate}`} />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label><select value={filters.supplierId} onChange={e => handleFilterChange('supplierId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm"><option value="">All Suppliers</option>{state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Purchase Type</label><select value={filters.purchaseType} onChange={e => handleFilterChange('purchaseType', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm"><option value="All">All</option><option value="Original">Original</option><option value="Finished Goods">Finished Goods</option></select></div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Batch Number</label>
                    <select
                        value={filters.batchNumber}
                        onChange={e => handleFilterChange('batchNumber', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    >
                        <option value="">All Batches</option>
                        {allBatchNumbers.map(batch => (
                            <option key={batch} value={batch}>{batch}</option>
                        ))}
                    </select>
                 </div>
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Division</label><select value={filters.divisionId} onChange={e => handleFilterChange('divisionId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm"><option value="">All Divisions</option>{state.divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Sub-Division</label><select value={filters.subDivisionId} onChange={e => handleFilterChange('subDivisionId', e.target.value)} disabled={!filters.divisionId} className="w-full p-2 border border-slate-300 rounded-md text-sm disabled:bg-slate-200"><option value="">All Sub-Divisions</option>{availableSubDivisions.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}</select></div>
            </ReportFilters>
             <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Date</th>
                            <th className="p-2 font-semibold text-slate-600">Purchase ID</th>
                            <th className="p-2 font-semibold text-slate-600">Supplier</th>
                            <th className="p-2 font-semibold text-slate-600">Division</th>
                            <th className="p-2 font-semibold text-slate-600">Sub-Division</th>
                            <th className="p-2 font-semibold text-slate-600">Item/Type</th>
                            <th className="p-2 font-semibold text-slate-600">Category</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Quantity</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Rate</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Total Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((row, index) => (<tr key={`${row.id}-${row.itemId}-${index}`} className="border-b hover:bg-slate-50">
                            <td className="p-2 text-slate-800">{row.date}</td>
                            <td className="p-2 text-slate-800">
                                <button onClick={() => setViewingPurchaseId(row.id)} className="text-blue-600 hover:underline">
                                    {row.id}
                                </button>
                            </td>
                            <td className="p-2 text-slate-800">{row.supplierName}</td>
                            <td className="p-2 text-slate-800">{row.divisionName}</td>
                            <td className="p-2 text-slate-800">{row.subDivisionName}</td>
                            <td className="p-2 text-slate-800">{row.itemName}</td>
                            <td className="p-2 text-slate-800">{row.category}</td>
                            <td className="p-2 text-right text-slate-800">{row.quantity.toLocaleString()}</td>
                            <td className="p-2 text-right text-slate-800">{`${formatCurrency(row.rate)} ${row.currency}`}</td>
                            <td className="p-2 text-right font-medium text-slate-900">${formatCurrency(row.totalValue)}</td>
                        </tr>))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-800">
                            <td colSpan={7} className="p-2 text-right">Totals</td>
                            <td className="p-2 text-right">{totalQuantity.toLocaleString()}</td>
                            <td className="p-2 text-right"></td>
                            <td className="p-2 text-right">${formatCurrency(totalPrice)}</td>
                        </tr>
                    </tfoot>
                </table>
                 {reportData.length === 0 && <p className="text-center text-slate-500 py-6">No purchase data found for the selected criteria.</p>}
            </div>
            {viewingPurchaseId && <PurchaseInvoiceViewModal purchaseId={viewingPurchaseId} onClose={() => setViewingPurchaseId(null)} state={state} />}
        </div>
    );
};
export default DetailedPurchaseReport;