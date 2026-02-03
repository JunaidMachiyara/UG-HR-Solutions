
import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { AppState, Currency, InvoiceItem, InvoiceStatus, PackingType, SalesInvoice } from '../../types.ts';
import ItemSelector from '../ui/ItemSelector.tsx';
import Modal from '../ui/Modal.tsx';

const SalesInvoiceViewModal: React.FC<{ invoiceId: string; onClose: () => void; state: AppState }> = ({ invoiceId, onClose, state }) => {
    const invoice = state.salesInvoices.find(inv => inv.id === invoiceId);

    if (!invoice) {
        return (
             <Modal isOpen={true} onClose={onClose} title="Error">
                <p>Could not find invoice with ID: {invoiceId}</p>
             </Modal>
        );
    }

    const customer = state.customers.find(c => c.id === invoice.customerId);
    const handlePrint = () => window.print();

    const calculateItemValue = (item: InvoiceItem) => {
        // Logic Update: Total = Quantity * Rate
        if (!item.rate) return 0;
        return item.quantity * item.rate;
    };
    
    const grandTotal = invoice.items.reduce((sum, item) => sum + calculateItemValue(item), 0);
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
                            <th className="p-2 font-semibold text-slate-600 text-right">Rate</th>
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

export const DetailedSalesReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        startDate: firstDayOfMonth,
        endDate: today,
        customerId: '',
        categoryId: '',
        itemId: '',
        divisionId: '',
        subDivisionId: '',
    });
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

    const handleFilterChange = (filterName: string, value: any) => {
        setIsInitialLoad(false);
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            if (filterName === 'divisionId') {
                newFilters.subDivisionId = '';
            }
            if (filterName === 'categoryId') {
                newFilters.itemId = '';
            }
            return newFilters;
        });
    };
    
    const availableSubDivisions = useMemo(() => {
        if (!filters.divisionId) return [];
        return state.subDivisions.filter(sd => sd.divisionId === filters.divisionId);
    }, [filters.divisionId, state.subDivisions]);

    const itemsForSelector = useMemo(() => {
        if (!filters.categoryId) return state.items;
        return state.items.filter(i => i.categoryId === filters.categoryId);
    }, [filters.categoryId, state.items]);
    
    const reportData = useMemo(() => {
        let invoicesToProcess: SalesInvoice[] = state.salesInvoices
            .filter(inv => inv.status !== InvoiceStatus.Unposted);

        if (isInitialLoad) {
            const last15InvoiceIds = [...new Set(invoicesToProcess
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(inv => inv.id))]
                .slice(0, 15);
            invoicesToProcess = invoicesToProcess.filter(inv => last15InvoiceIds.includes(inv.id));
        } else {
            invoicesToProcess = invoicesToProcess.filter(inv => 
                (inv.date >= filters.startDate && inv.date <= filters.endDate) &&
                (!filters.customerId || inv.customerId === filters.customerId) &&
                (!filters.divisionId || inv.divisionId === filters.divisionId) &&
                (!filters.subDivisionId || inv.subDivisionId === filters.subDivisionId)
            );
        }

        const flattenedData = invoicesToProcess.flatMap(inv => {
            const customer = state.customers.find(c => c.id === inv.customerId);
            return inv.items.map(item => {
                const itemDetails = state.items.find(i => i.id === item.itemId);
                const division = state.divisions.find(d => d.id === customer?.divisionId);
                const subDivision = state.subDivisions.find(sd => sd.id === customer?.subDivisionId);

                const rate = item.rate || 0;
                // Logic Update: Use Qty * Rate directly
                const totalValue = item.quantity * rate;

                return {
                        id: inv.id, date: inv.date, customerId: inv.customerId, customerName: customer?.name || 'N/A', divisionId: customer?.divisionId, divisionName: division?.name || 'N/A', subDivisionId: customer?.subDivisionId, subDivisionName: subDivision?.name || 'N/A',
                        itemId: item.itemId, itemName: itemDetails?.name || 'N/A', categoryId: itemDetails?.categoryId, categoryName: state.categories.find(c => c.id === itemDetails?.categoryId)?.name || 'N/A',
                        quantity: item.quantity,
                        rate,
                        totalValue,
                    };
                })
        });

        let filteredData = flattenedData;
        if (!isInitialLoad) {
             filteredData = flattenedData.filter(row => 
                (!filters.itemId || row.itemId === filters.itemId) &&
                (!filters.categoryId || row.categoryId === filters.categoryId)
            );
        }
        
        return filteredData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [filters, state, isInitialLoad]);

    const exportHeaders = [
        { label: 'Date', key: 'date' }, { label: 'Invoice ID', key: 'id' }, { label: 'Customer', key: 'customerName' }, { label: 'Division', key: 'divisionName' }, { label: 'Sub-Division', key: 'subDivisionName' },
        { label: 'Item', key: 'itemName' }, { label: 'Category', key: 'categoryName' }, { label: 'Quantity', key: 'quantity' }, { label: 'Rate', key: 'rate' }, { label: 'Total Value ($)', key: 'totalValue' },
    ];
    
    const formatCurrency = (val: number) => val.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    const totalQuantity = useMemo(() => reportData.reduce((sum, row) => sum + row.quantity, 0), [reportData]);
    const totalPrice = useMemo(() => reportData.reduce((sum, row) => sum + row.totalValue, 0), [reportData]);


    return (
        <div className="report-print-area">
            <ReportToolbar title="Detailed Sales Report" exportData={reportData.map(d => ({...d, totalValue: d.totalValue.toFixed(2), rate: d.rate.toFixed(2)}))} exportHeaders={exportHeaders} exportFilename={`DetailedSales_${filters.startDate}_to_${filters.endDate}`} />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer</label><select value={filters.customerId} onChange={e => handleFilterChange('customerId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm"><option value="">All Customers</option>{state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Division</label><select value={filters.divisionId} onChange={e => handleFilterChange('divisionId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm"><option value="">All Divisions</option>{state.divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Sub-Division</label><select value={filters.subDivisionId} onChange={e => handleFilterChange('subDivisionId', e.target.value)} disabled={!filters.divisionId} className="w-full p-2 border border-slate-300 rounded-md text-sm disabled:bg-slate-200"><option value="">All Sub-Divisions</option>{availableSubDivisions.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><select value={filters.categoryId} onChange={e => handleFilterChange('categoryId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm"><option value="">All Categories</option>{state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="flex-grow min-w-[250px]"><label className="block text-sm font-medium text-slate-700 mb-1">Item</label><ItemSelector items={itemsForSelector} selectedItemId={filters.itemId} onSelect={(itemId) => handleFilterChange('itemId', itemId)} placeholder="Filter by Item..."/></div>
            </ReportFilters>
             <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Date</th>
                            <th className="p-2 font-semibold text-slate-600">Invoice ID</th>
                            <th className="p-2 font-semibold text-slate-600">Customer</th>
                            <th className="p-2 font-semibold text-slate-600">Division</th>
                            <th className="p-2 font-semibold text-slate-600">Sub-Division</th>
                            <th className="p-2 font-semibold text-slate-600">Item</th>
                            <th className="p-2 font-semibold text-slate-600">Category</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Qty</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Rate</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Total Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((row, index) => (<tr key={`${row.id}-${row.itemId}-${index}`} className="border-b hover:bg-slate-50">
                            <td className="p-2 text-slate-800">{row.date}</td>
                            <td className="p-2 text-slate-800">
                                <button onClick={() => setViewingInvoiceId(row.id)} className="text-blue-600 hover:underline">
                                    {row.id}
                                </button>
                            </td>
                            <td className="p-2 text-slate-800">{row.customerName}</td>
                            <td className="p-2 text-slate-800">{row.divisionName}</td>
                            <td className="p-2 text-slate-800">{row.subDivisionName}</td>
                            <td className="p-2 text-slate-800">{row.itemName}</td>
                            <td className="p-2 text-slate-800">{row.categoryName}</td>
                            <td className="p-2 text-right text-slate-800">{row.quantity.toLocaleString()}</td>
                            <td className="p-2 text-right text-slate-800">{formatCurrency(row.rate)}</td>
                            <td className="p-2 text-right font-medium text-slate-900">{formatCurrency(row.totalValue)}</td>
                        </tr>))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-800">
                            <td colSpan={7} className="p-2 text-right">Totals</td>
                            <td className="p-2 text-right">{totalQuantity.toLocaleString()}</td>
                            <td className="p-2 text-right"></td>
                            <td className="p-2 text-right">{formatCurrency(totalPrice)}</td>
                        </tr>
                    </tfoot>
                </table>
                {reportData.length === 0 && <p className="text-center text-slate-500 py-6">No sales data found for the selected criteria.</p>}
            </div>
            {viewingInvoiceId && <SalesInvoiceViewModal invoiceId={viewingInvoiceId} onClose={() => setViewingInvoiceId(null)} state={state} />}
        </div>
    );
};
export default DetailedSalesReport;
