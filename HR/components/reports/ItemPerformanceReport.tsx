import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { InvoiceStatus, PackingType, OngoingOrderStatus } from '../../types.ts';
import ItemSelector from '../ui/ItemSelector.tsx';

const ItemPerformanceReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    
    const [filters, setFilters] = useState({
        startDate: '2024-01-01',
        endDate: today,
        categoryId: '',
        sectionId: '',
        itemId: '',
    });

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
        
        const activeOngoingOrders = state.ongoingOrders.filter(
            o => o.status === OngoingOrderStatus.Active || o.status === OngoingOrderStatus.PartiallyShipped
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
                
                const salesForThisItemInPeriod = salesInPeriod
                    .flatMap(s => s.items)
                    .filter(i => i.itemId === item.id);

                const salesQtyInPeriod = salesForThisItemInPeriod.reduce((sum, i) => sum + i.quantity, 0);
                
                const closingStock = openingStock + productionQtyInPeriod - salesQtyInPeriod;

                const ongoingOrderQty = activeOngoingOrders
                    .flatMap(o => o.items)
                    .filter(i => i.itemId === item.id)
                    .reduce((sum, i) => sum + (i.quantity - i.shippedQuantity), 0);
                
                let salesDifference = 0;
                if (salesQtyInPeriod > 0) {
                    const totalRevenueInPeriod = salesForThisItemInPeriod.reduce((sum, soldItem) => {
                        const rate = soldItem.rate || 0;
                        if (rate === 0) return sum;

                        if (item.packingType === PackingType.Bales) {
                            return sum + (soldItem.quantity * item.baleSize * rate);
                        } else {
                            return sum + (soldItem.quantity * rate);
                        }
                    }, 0);

                    const totalKgSoldInPeriod = salesForThisItemInPeriod.reduce((sum, soldItem) => {
                        if (item.packingType === PackingType.Bales) {
                            return sum + (soldItem.quantity * item.baleSize);
                        } else {
                            return sum + soldItem.quantity;
                        }
                    }, 0);
                    
                    const totalProductionCostInPeriod = totalKgSoldInPeriod * item.avgProductionPrice;

                    salesDifference = totalRevenueInPeriod - totalProductionCostInPeriod;
                }

                return {
                    id: item.id,
                    name: item.name,
                    category: state.categories.find(c => c.id === item.categoryId)?.name || '',
                    openingStock,
                    productionQty: productionQtyInPeriod,
                    salesQty: salesQtyInPeriod,
                    ongoingOrderQty,
                    salesDifference,
                    closingStock,
                };
            });
    }, [filters, state.items, state.productions, state.salesInvoices, state.categories, state.ongoingOrders]);
    
    const chartData = useMemo(() => {
        return reportData
            .filter(d => d.productionQty > 0 || d.salesQty > 0 || d.ongoingOrderQty > 0)
            .sort((a, b) => (b.productionQty + b.salesQty + b.ongoingOrderQty) - (a.productionQty + a.salesQty + a.ongoingOrderQty))
            .slice(0, 10);
    }, [reportData]);

    const exportHeaders = [
        { label: 'Item ID', key: 'id' },
        { label: 'Item Name', key: 'name' },
        { label: 'Category', key: 'category' },
        { label: 'Opening Stock', key: 'openingStock' },
        { label: 'Production (Period)', key: 'productionQty' },
        { label: 'Sales (Period)', key: 'salesQty' },
        { label: 'Ongoing Orders', key: 'ongoingOrderQty' },
        { label: 'Sales Difference (P/L)', key: 'salesDifference' },
        { label: 'Closing Stock', key: 'closingStock' },
    ];
    
    const Recharts = (window as any).Recharts;
    const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = Recharts || {};

    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Item Performance Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`ItemPerformance_${filters.startDate}_to_${filters.endDate}`}
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Item Code</label>
                    <ItemSelector
                        items={filteredItemsForSelector}
                        selectedItemId={filters.itemId}
                        onSelect={(itemId) => handleFilterChange('itemId', itemId)}
                        placeholder="Filter by Item..."
                    />
                </div>
            </ReportFilters>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                 <div className="overflow-x-auto">
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Performance Data</h3>
                    <table className="w-full text-left table-auto text-sm">
                        <thead><tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Item</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Opening Stock</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Prod. (Period)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Sales (Period)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Ongoing Orders</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Sales Difference (P/L)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Closing Stock</th>
                        </tr></thead>
                        <tbody>
                            {reportData.map(item => (
                                <tr key={item.id} className="border-b hover:bg-slate-50">
                                    <td className="p-2 text-slate-700">{item.name} ({item.id})</td>
                                    <td className="p-2 text-slate-700 text-right">{item.openingStock.toLocaleString()}</td>
                                    <td className="p-2 text-slate-700 text-right">{item.productionQty.toLocaleString()}</td>
                                    <td className="p-2 text-slate-700 text-right">{item.salesQty.toLocaleString()}</td>
                                    <td className="p-2 text-blue-700 text-right">{item.ongoingOrderQty.toLocaleString()}</td>
                                    <td className={`p-2 text-right font-medium ${item.salesDifference > 0 ? 'text-green-700' : item.salesDifference < 0 ? 'text-red-700' : 'text-slate-700'}`}>
                                        {item.salesDifference.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="p-2 text-slate-700 text-right font-medium">{item.closingStock.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {Recharts && chartData.length > 0 && (
                     <div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">Top 10 Items: Production, Sales & Orders (in Period)</h3>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={1}/>
                                <YAxis />
                                <Tooltip />
                                <Legend verticalAlign="top" />
                                <Bar dataKey="productionQty" name="Production" fill="#8884d8" />
                                <Bar dataKey="salesQty" name="Sales" fill="#82ca9d" />
                                <Bar dataKey="ongoingOrderQty" name="Ongoing Orders" fill="#ffc658" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ItemPerformanceReport;