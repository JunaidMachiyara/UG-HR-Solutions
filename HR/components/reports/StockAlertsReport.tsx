import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { InvoiceStatus } from '../../types.ts';

const StockAlertsReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: today,
        threshold: 50,
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const reportData = useMemo(() => {
        return state.items.map(item => {
            const totalProduction = state.productions
                .filter(p => p.itemId === item.id && p.date <= filters.endDate)
                .reduce((sum, p) => sum + p.quantityProduced, 0);

            const totalSales = state.salesInvoices
                .filter(s => s.status !== InvoiceStatus.Unposted && s.date <= filters.endDate)
                .flatMap(s => s.items)
                .filter(i => i.itemId === item.id)
                .reduce((sum, i) => sum + i.quantity, 0);
            
            const openingStock = item.openingStock || 0;
            
            const closingStock = openingStock + totalProduction - totalSales;
            
            return {
                id: item.id,
                name: item.name,
                category: state.categories.find(c => c.id === item.categoryId)?.name || 'N/A',
                closingStock,
            };
        }).filter(item => item.closingStock < filters.threshold);

    }, [filters, state]);

    const exportHeaders = [
        { label: 'Item ID', key: 'id' },
        { label: 'Item Name', key: 'name' },
        { label: 'Category', key: 'category' },
        { label: 'Closing Stock', key: 'closingStock' },
    ];

    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Stock Alerts Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`StockAlerts_as_of_${filters.endDate}`}
            />
            <ReportFilters filters={{ startDate: '', endDate: filters.endDate }} onFilterChange={handleFilterChange}>
                 <div>
                    <label htmlFor="threshold" className="block text-sm font-medium text-slate-700 mb-1">Alert Threshold</label>
                    <input
                        id="threshold"
                        type="number"
                        value={filters.threshold}
                        onChange={(e) => handleFilterChange('threshold', Number(e.target.value))}
                        className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    />
                </div>
            </ReportFilters>
            <p className="text-sm text-slate-600 mb-4">
                Showing items with stock less than <strong>{filters.threshold}</strong> units as of <strong>{filters.endDate}</strong>.
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Item ID</th>
                            <th className="p-2 font-semibold text-slate-600">Item Name</th>
                            <th className="p-2 font-semibold text-slate-600">Category</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Closing Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(item => (
                            <tr key={item.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700 font-mono">{item.id}</td>
                                <td className="p-2 text-slate-700">{item.name}</td>
                                <td className="p-2 text-slate-700">{item.category}</td>
                                <td className="p-2 text-red-600 font-bold text-right">{item.closingStock.toLocaleString()}</td>
                            </tr>
                        ))}
                        {reportData.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center text-slate-500 py-6">
                                    No items are below the stock threshold.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StockAlertsReport;