import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { InvoiceStatus } from '../../types.ts';

const NonMovingItemsReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        startDate: firstDayOfYear,
        endDate: today,
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const reportData = useMemo(() => {
        const salesInPeriod = state.salesInvoices.filter(s =>
            s.date >= filters.startDate && s.date <= filters.endDate && s.status !== InvoiceStatus.Unposted
        );

        const soldItemIds = new Set<string>();
        salesInPeriod.forEach(invoice => {
            invoice.items.forEach(item => {
                soldItemIds.add(item.itemId);
            });
        });

        const nonMovingItems = state.items.filter(item => !soldItemIds.has(item.id));

        return nonMovingItems.map(item => {
            const totalProduction = state.productions
                .filter(p => p.itemId === item.id)
                .reduce((sum, p) => sum + p.quantityProduced, 0);

            const totalSales = state.salesInvoices
                .filter(s => s.status !== InvoiceStatus.Unposted)
                .flatMap(s => s.items)
                .filter(i => i.itemId === item.id)
                .reduce((sum, i) => sum + i.quantity, 0);

            const openingStock = item.openingStock || 0;

            return {
                id: item.id,
                name: item.name,
                category: state.categories.find(c => c.id === item.categoryId)?.name || 'N/A',
                closingStock: openingStock + totalProduction - totalSales,
            };
        });
    }, [filters, state]);

    const exportHeaders = [
        { label: 'Item ID', key: 'id' },
        { label: 'Item Name', key: 'name' },
        { label: 'Category', key: 'category' },
        { label: 'Current Stock', key: 'closingStock' },
    ];

    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Non-Moving Items Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`NonMovingItems_${filters.startDate}_to_${filters.endDate}`}
            />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange} />

            <div className="overflow-x-auto">
                <p className="text-sm text-slate-600 mb-4">
                    Showing items with zero sales between {filters.startDate} and {filters.endDate}.
                </p>
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Item ID</th>
                            <th className="p-2 font-semibold text-slate-600">Item Name</th>
                            <th className="p-2 font-semibold text-slate-600">Category</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Current Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(item => (
                            <tr key={item.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700 font-mono">{item.id}</td>
                                <td className="p-2 text-slate-700">{item.name}</td>
                                <td className="p-2 text-slate-700">{item.category}</td>
                                <td className="p-2 text-slate-700 text-right font-medium">{item.closingStock.toLocaleString()}</td>
                            </tr>
                        ))}
                        {reportData.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center text-slate-500 py-6">
                                    All items have been sold within the selected period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default NonMovingItemsReport;