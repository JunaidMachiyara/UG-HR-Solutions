import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { InvoiceStatus } from '../../types.ts';

const ProductionAnalysisReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        startDate: firstDayOfYear,
        endDate: today,
        minDemandFactor: 7,
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const reportData = useMemo(() => {
        return state.items.filter(item => item.demandFactor >= filters.minDemandFactor).map(item => {
            const productionQtyInPeriod = state.productions
                .filter(p => p.itemId === item.id && p.date >= filters.startDate && p.date <= filters.endDate)
                .reduce((sum, p) => sum + p.quantityProduced, 0);
            
            const salesQtyInPeriod = state.salesInvoices
                .filter(s => s.date >= filters.startDate && s.date <= filters.endDate && s.status !== InvoiceStatus.Unposted)
                .flatMap(s => s.items)
                .filter(i => i.itemId === item.id)
                .reduce((sum, i) => sum + i.quantity, 0);

            return {
                id: item.id,
                name: item.name,
                demandFactor: item.demandFactor,
                productionQty: productionQtyInPeriod,
                salesQty: salesQtyInPeriod,
                shortfall: Math.max(0, salesQtyInPeriod - productionQtyInPeriod),
            };
        }).filter(item => item.productionQty < item.salesQty || (item.salesQty > 0 && item.productionQty === 0));

    }, [filters, state]);

    const exportHeaders = [
        { label: 'Item ID', key: 'id' },
        { label: 'Item Name', key: 'name' },
        { label: 'Demand Factor', key: 'demandFactor' },
        { label: 'Production Qty (Period)', key: 'productionQty' },
        { label: 'Sales Qty (Period)', key: 'salesQty' },
        { label: 'Shortfall', key: 'shortfall' },
    ];

    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Production Analysis Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`ProductionAnalysis_${filters.startDate}_to_${filters.endDate}`}
            />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                <div>
                    <label htmlFor="minDemandFactor" className="block text-sm font-medium text-slate-700 mb-1">
                        Min Demand Factor ({filters.minDemandFactor})
                    </label>
                    <input
                        id="minDemandFactor"
                        type="range"
                        min="1"
                        max="10"
                        value={filters.minDemandFactor}
                        onChange={(e) => handleFilterChange('minDemandFactor', Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </ReportFilters>
            
            <p className="text-sm text-slate-600 mb-4">
                Showing high-demand items (factor &ge; {filters.minDemandFactor}) where production may not be meeting sales within the period.
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Item Name</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Demand Factor</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Production (Period)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Sales (Period)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Shortfall</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(item => (
                            <tr key={item.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{item.name} ({item.id})</td>
                                <td className="p-2 text-slate-700 text-center">{item.demandFactor}</td>
                                <td className="p-2 text-slate-700 text-right">{item.productionQty.toLocaleString()}</td>
                                <td className="p-2 text-slate-700 text-right">{item.salesQty.toLocaleString()}</td>
                                <td className="p-2 text-red-600 font-bold text-right">{item.shortfall.toLocaleString()}</td>
                            </tr>
                        ))}
                        {reportData.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center text-slate-500 py-6">
                                    No production shortfalls found for high-demand items in this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProductionAnalysisReport;
