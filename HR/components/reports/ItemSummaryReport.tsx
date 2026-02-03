
import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { InvoiceStatus, PackingType } from '../../types.ts';
import ItemSelector from '../ui/ItemSelector.tsx';

const ItemSummaryReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        startDate: firstDayOfYear,
        endDate: today,
        itemId: '',
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const reportData = useMemo(() => {
        if (!filters.itemId) {
            return [];
        }

        const itemDetails = state.items.find(i => i.id === filters.itemId);
        if (!itemDetails) {
            return [];
        }

        const salesInPeriod = state.salesInvoices.filter(s => 
            s.date >= filters.startDate && s.date <= filters.endDate && s.status !== InvoiceStatus.Unposted
        );

        const salesHistory = salesInPeriod.flatMap(invoice => 
            invoice.items
                .filter(item => item.itemId === filters.itemId)
                .map(item => {
                    const customer = state.customers.find(c => c.id === invoice.customerId);
                    const rate = item.rate || 0;
                    
                    // Logic Update: Total Value is Quantity * Rate (Rate is Per Unit/Package)
                    const totalValue = item.quantity * rate;
                    
                    // Profit calculation: Revenue - COGS
                    // COGS is based on Kg cost because production cost is typically per Kg
                    let totalKgSold = 0;
                    if (itemDetails.packingType === PackingType.Bales) {
                        totalKgSold = item.quantity * itemDetails.baleSize;
                    } else {
                        totalKgSold = item.quantity;
                    }
                    
                    const totalCost = totalKgSold * itemDetails.avgProductionPrice;
                    const salesDifference = totalValue - totalCost;

                    return {
                        invoiceId: invoice.id,
                        date: invoice.date,
                        customerName: customer?.name || 'N/A',
                        quantity: item.quantity,
                        rate,
                        totalValue,
                        salesDifference,
                    };
                })
        );
        
        return salesHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filters, state]);

    const exportHeaders = [
        { label: 'Invoice ID', key: 'invoiceId' },
        { label: 'Date', key: 'date' },
        { label: 'Customer', key: 'customerName' },
        { label: 'Quantity', key: 'quantity' },
        { label: 'Rate', key: 'rate' },
        { label: 'Total Value', key: 'totalValue' },
        { label: 'Sales Difference (P/L)', key: 'salesDifference' },
    ];
    
    const selectedItem = state.items.find(i => i.id === filters.itemId);

    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Item Sales Summary"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`ItemSummary_${filters.itemId || 'all'}_${filters.startDate}_to_${filters.endDate}`}
            />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                <div className="flex-grow min-w-[250px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Item</label>
                    <ItemSelector
                        items={state.items}
                        selectedItemId={filters.itemId}
                        onSelect={(itemId) => handleFilterChange('itemId', itemId)}
                        placeholder="Select an item to view summary..."
                    />
                </div>
            </ReportFilters>

            {filters.itemId && selectedItem ? (
                 <div className="overflow-x-auto">
                     <p className="text-sm text-slate-600 mb-4">
                        Showing sales for <strong>{selectedItem.name} ({selectedItem.id})</strong> between {filters.startDate} and {filters.endDate}.
                    </p>
                    <table className="w-full text-left table-auto text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="p-2 font-semibold text-slate-600">Invoice ID</th>
                                <th className="p-2 font-semibold text-slate-600">Date</th>
                                <th className="p-2 font-semibold text-slate-600">Customer</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Quantity</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Rate</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Total Value</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Sales Difference (P/L)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map((sale, index) => (
                                <tr key={`${sale.invoiceId}-${index}`} className="border-b hover:bg-slate-50">
                                    <td className="p-2 text-slate-700 font-mono">{sale.invoiceId}</td>
                                    <td className="p-2 text-slate-700">{sale.date}</td>
                                    <td className="p-2 text-slate-700">{sale.customerName}</td>
                                    <td className="p-2 text-slate-700 text-right">{sale.quantity.toLocaleString()}</td>
                                    <td className="p-2 text-slate-700 text-right">{sale.rate.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</td>
                                    <td className="p-2 text-slate-700 text-right font-medium">{sale.totalValue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</td>
                                    <td className={`p-2 text-right font-medium ${sale.salesDifference > 0 ? 'text-green-700' : sale.salesDifference < 0 ? 'text-red-700' : 'text-slate-700'}`}>
                                        {sale.salesDifference.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                    </td>
                                </tr>
                            ))}
                             {reportData.length > 0 && (
                                <tr className="bg-slate-50 font-bold text-slate-800">
                                    <td colSpan={5} className="p-2 text-right">Grand Total</td>
                                    <td className="p-2 text-right">
                                        {reportData.reduce((sum, sale) => sum + sale.totalValue, 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="p-2 text-right">
                                        {reportData.reduce((sum, sale) => sum + sale.salesDifference, 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                     {reportData.length === 0 && (
                        <p className="text-center text-slate-500 py-6">No sales found for this item in the selected period.</p>
                     )}
                </div>
            ) : (
                <p className="text-center text-slate-500 py-8">Please select an item to view its sales summary.</p>
            )}
        </div>
    );
};

export default ItemSummaryReport;
