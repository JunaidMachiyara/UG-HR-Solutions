import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { InvoiceStatus, PackingType } from '../../types.ts';
import ItemSelector from '../ui/ItemSelector.tsx';

interface StockWorthReportProps {
    initialFilters?: any;
}

const StockWorthReport: React.FC<StockWorthReportProps> = ({ initialFilters }) => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    
    const [filters, setFilters] = useState({
        startDate: '2024-01-01',
        endDate: today,
        categoryId: '',
        sectionId: '',
        itemId: '',
    });

    useEffect(() => {
        if (initialFilters) {
            setFilters(prev => ({ ...prev, ...initialFilters }));
        }
    }, [initialFilters]);

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            // When the category or section changes, reset the selected item.
            if (filterName === 'categoryId' || filterName === 'sectionId') {
                newFilters.itemId = '';
            }
            return newFilters;
        });
    };
    
    const filteredItemsForSelector = useMemo(() => {
        let filtered = state.items;
        if (filters.categoryId) {
            filtered = filtered.filter(item => item.categoryId === filters.categoryId);
        }
        if (filters.sectionId) {
            filtered = filtered.filter(item => item.sectionId === filters.sectionId);
        }
        return filtered;
    }, [filters.categoryId, filters.sectionId, state.items]);


    const reportData = useMemo(() => {
        const productionsInPeriod = state.productions.filter(p => p.date >= filters.startDate && p.date <= filters.endDate);
        const salesInPeriod = state.salesInvoices.filter(s => 
            s.date >= filters.startDate && s.date <= filters.endDate && s.status !== InvoiceStatus.Unposted
        );
        
        const productionsBeforePeriod = state.productions.filter(p => p.date < filters.startDate);
        const salesBeforePeriod = state.salesInvoices.filter(s => 
            s.date < filters.startDate && s.status !== InvoiceStatus.Unposted
        );
        
        return state.items
            .filter(item => !filters.categoryId || item.categoryId === filters.categoryId)
            .filter(item => !filters.sectionId || item.sectionId === filters.sectionId)
            .filter(item => !filters.itemId || item.id === filters.itemId)
            .map(item => {
                const totalProductionBefore = productionsBeforePeriod
                    .filter(p => p.itemId === item.id)
                    .reduce((sum, p) => sum + p.quantityProduced, 0);

                const totalSalesBefore = salesBeforePeriod
                    .flatMap(s => s.items)
                    .filter(i => i.itemId === item.id)
                    .reduce((sum, i) => sum + i.quantity, 0);
                
                const openingStockFromSetup = item.openingStock || 0;
                
                const openingStock = openingStockFromSetup + totalProductionBefore - totalSalesBefore;

                const productionQtyInPeriod = productionsInPeriod
                    .filter(p => p.itemId === item.id)
                    .reduce((sum, p) => sum + p.quantityProduced, 0);
                
                const salesQtyInPeriod = salesInPeriod
                    .flatMap(s => s.items)
                    .filter(i => i.itemId === item.id)
                    .reduce((sum, i) => sum + i.quantity, 0);
                
                const closingStock = openingStock + productionQtyInPeriod - salesQtyInPeriod;

                const unitWeight = item.packingType !== PackingType.Kg ? (item.baleSize || 0) : 1;
                const closingStockKg = closingStock * unitWeight;
                const stockWorth = closingStockKg * item.avgProductionPrice;

                return {
                    id: item.id,
                    name: item.name,
                    category: state.categories.find(c => c.id === item.categoryId)?.name || '',
                    openingStock,
                    closingStock,
                    stockWorth,
                };
            }).filter(d => d.closingStock > 0.001); // Only show items with stock
    }, [filters, state.items, state.productions, state.salesInvoices, state.categories]);
    
    const totalStockWorth = useMemo(() => {
        return reportData.reduce((sum, item) => sum + item.stockWorth, 0);
    }, [reportData]);

    const exportHeaders = [
        { label: 'Item ID', key: 'id' },
        { label: 'Item Name', key: 'name' },
        { label: 'Category', key: 'category' },
        { label: 'Opening Stock', key: 'openingStock' },
        { label: 'Closing Stock', key: 'closingStock' },
        { label: 'Stock Worth ($)', key: 'stockWorth' },
    ];
    
    const exportableData = reportData.map(d => ({...d, stockWorth: d.stockWorth.toFixed(2)}));

    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Stock Worth Report"
                exportData={exportableData}
                exportHeaders={exportHeaders}
                exportFilename={`StockWorth_as_of_${filters.endDate}`}
            />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                <div className="flex-grow min-w-[200px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select
                        value={filters.categoryId}
                        onChange={(e) => handleFilterChange('categoryId', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    >
                        <option value="">All Categories</option>
                        {state.categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                </div>
                <div className="flex-grow min-w-[200px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
                    <select
                        value={filters.sectionId}
                        onChange={(e) => handleFilterChange('sectionId', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    >
                        <option value="">All Sections</option>
                        {state.sections.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                    </select>
                </div>
                 <div className="flex-grow min-w-[250px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
                    <ItemSelector
                        items={filteredItemsForSelector}
                        selectedItemId={filters.itemId}
                        onSelect={(itemId) => handleFilterChange('itemId', itemId)}
                        placeholder="Filter by Item..."
                    />
                </div>
            </ReportFilters>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead><tr className="bg-slate-100">
                        <th className="p-2 font-semibold text-slate-600">Item</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Opening Stock (Units)</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Closing Stock (Units)</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Stock Worth</th>
                    </tr></thead>
                    <tbody>
                        {reportData.map(item => (
                            <tr key={item.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{item.name} ({item.id})</td>
                                <td className="p-2 text-slate-700 text-right">{item.openingStock.toLocaleString()}</td>
                                <td className="p-2 text-slate-700 text-right font-medium">{item.closingStock.toLocaleString()}</td>
                                <td className="p-2 text-right font-bold text-green-800">
                                    {item.stockWorth.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-800">
                            <td colSpan={3} className="p-2 text-right">Total Stock Worth</td>
                            <td className="p-2 text-right">
                                {totalStockWorth.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                            </td>
                        </tr>
                    </tfoot>
                </table>
                 {reportData.length === 0 && (
                    <p className="text-center text-slate-500 py-6">
                        No items with stock match the current filters.
                    </p>
                 )}
            </div>
        </div>
    );
};

export default StockWorthReport;
