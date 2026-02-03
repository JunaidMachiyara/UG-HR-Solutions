
import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { AppState, Currency, InvoiceItem, InvoiceStatus, PackingType, SalesInvoice } from '../../types.ts';
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
        // Logic Update: Total = Quantity * Rate (Rate is Per Unit/Package)
        if (!item.rate) return 0;
        return item.quantity * item.rate;
    };
    
    const itemsTotal = invoice.items.reduce((sum, item) => sum + calculateItemValue(item), 0);
    const grandTotal = itemsTotal + (invoice.freightAmount || 0) + (invoice.customCharges || 0);
    const currency = invoice.items.length > 0 ? (invoice.items[0].currency || Currency.Dollar) : Currency.Dollar;

    return (
        <Modal isOpen={true} onClose={onClose} title={`Invoice Details: ${invoice.id}`} size="5xl">
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


const SalesInvoiceReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    
    const [filters, setFilters] = useState({ startDate: firstDayOfYear, endDate: today, customerId: '' });
    const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const handleFilterChange = (filterName: string, value: any) => {
        setIsInitialLoad(false);
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const calculateTotalValue = (invoice: SalesInvoice) => {
        if (invoice.status === InvoiceStatus.Unposted || invoice.items.some(item => item.rate === undefined)) {
            return 0;
        }

        const itemsTotal = invoice.items.reduce((total, item) => {
            if (item.rate === undefined || item.currency === undefined || item.conversionRate === undefined) return total;

            // Logic update: Total = Quantity * Rate.
            const totalForeignAmount = item.quantity * item.rate;
            const itemValueInDollar = totalForeignAmount * item.conversionRate;
            
            return total + itemValueInDollar;
        }, 0);

        return itemsTotal + (invoice.freightAmount || 0) + (invoice.customCharges || 0);
    };

    const reportData = useMemo(() => {
        let invoices = state.salesInvoices;

        if (!isInitialLoad) {
            invoices = invoices.filter(inv => inv.date >= filters.startDate && inv.date <= filters.endDate);
        }

        return invoices
            .filter(inv => !filters.customerId || inv.customerId === filters.customerId)
            .map(inv => ({
                ...inv,
                customerName: state.customers.find(c => c.id === inv.customerId)?.name || 'N/A',
                totalValue: calculateTotalValue(inv),
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filters, state.salesInvoices, state.customers, state.items, isInitialLoad]);
    
    const exportHeaders = [
        { label: 'Invoice ID', key: 'id' }, { label: 'Date', key: 'date' }, { label: 'Customer', key: 'customerName' },
        { label: 'Status', key: 'status' }, { label: 'Total Bales', key: 'totalBales' }, { label: 'Total Kg', key: 'totalKg' },
        { label: 'Total Value ($)', key: 'totalValue' },
    ];

    const formatCurrency = (val: number) => val.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

    return (
        <div className="report-print-area">
            <ReportToolbar title="Sales Invoices Report" exportData={reportData.map(d => ({...d, totalValue: d.totalValue.toFixed(2)}))} exportHeaders={exportHeaders} exportFilename={`SalesInvoices_${filters.startDate}_to_${filters.endDate}`} />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                    <select value={filters.customerId} onChange={e => handleFilterChange('customerId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="">All Customers</option>
                        {state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </ReportFilters>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead><tr className="bg-slate-100"><th className="p-2 font-semibold text-slate-600">Invoice ID</th><th className="p-2 font-semibold text-slate-600">Date</th><th className="p-2 font-semibold text-slate-600">Customer</th><th className="p-2 font-semibold text-slate-600">Status</th><th className="p-2 font-semibold text-slate-600 text-right">Total Bales</th><th className="p-2 font-semibold text-slate-600 text-right">Total Kg</th><th className="p-2 font-semibold text-slate-600 text-right">Total Value</th></tr></thead>
                    <tbody>
                        {reportData.map(inv => (
                            <tr key={inv.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700 font-mono">
                                    <button onClick={() => setViewingInvoiceId(inv.id)} className="text-blue-600 hover:underline">
                                        {inv.id}
                                    </button>
                                </td>
                                <td className="p-2 text-slate-700">{inv.date}</td>
                                <td className="p-2 text-slate-700">{inv.customerName}</td>
                                <td className="p-2 text-slate-700">{inv.status}</td>
                                <td className="p-2 text-slate-700 text-right">{inv.totalBales.toLocaleString()}</td><td className="p-2 text-slate-700 text-right">{inv.totalKg.toLocaleString()}</td>
                                <td className="p-2 text-slate-700 text-right font-medium">{inv.status !== InvoiceStatus.Unposted ? formatCurrency(inv.totalValue) : 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {reportData.length === 0 && <p className="text-center text-slate-500 py-6">No sales invoices found for the selected criteria.</p>}
            </div>
            {viewingInvoiceId && <SalesInvoiceViewModal invoiceId={viewingInvoiceId} onClose={() => setViewingInvoiceId(null)} state={state} />}
        </div>
    );
};
export default SalesInvoiceReport;
