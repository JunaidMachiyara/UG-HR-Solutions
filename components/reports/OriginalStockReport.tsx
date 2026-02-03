import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import ReportFilters from './ReportFilters.tsx';
import { OriginalPurchased, PackingType } from '../../types.ts';

const OriginalStockReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        supplierId: '',
        subSupplierId: '',
        originalTypeId: '',
        originalProductId: '',
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            if (filterName === 'supplierId') {
                newFilters.subSupplierId = '';
            }
            if (filterName === 'originalTypeId') {
                newFilters.originalProductId = '';
            }
            return newFilters;
        });
    };

    const resetFilters = () => {
        setFilters({
            supplierId: '',
            subSupplierId: '',
            originalTypeId: '',
            originalProductId: '',
        });
    };

    const stockByCombination = useMemo(() => {
        const stock = new Map<string, number>();
        const getKey = (p: { supplierId: string; subSupplierId?: string; originalTypeId: string; originalProductId?: string }) => {
            return `${p.supplierId || 'none'}|${p.subSupplierId || 'none'}|${p.originalTypeId || 'none'}|${p.originalProductId || 'none'}`;
        };

        state.originalPurchases.forEach(p => {
            const key = getKey(p);
            stock.set(key, (stock.get(key) || 0) + p.quantityPurchased);
        });

        state.originalOpenings.forEach(o => {
            const key = getKey(o);
            stock.set(key, (stock.get(key) || 0) - o.opened);
        });
        return stock;
    }, [state.originalPurchases, state.originalOpenings]);

    const reportData = React.useMemo(() => {
        const data = [];
        for (const [key, inHand] of stockByCombination.entries()) {
            if (inHand <= 0.001) continue;

            const [supplierId, subSupplierId, originalTypeId, originalProductId] = key.split('|');

            if (filters.supplierId && filters.supplierId !== supplierId) continue;
            if (filters.subSupplierId && filters.subSupplierId !== subSupplierId) continue;
            if (filters.originalTypeId && filters.originalTypeId !== originalTypeId) continue;
            if (filters.originalProductId && filters.originalProductId !== originalProductId) continue;
            
            const supplier = state.suppliers.find(s => s.id === supplierId);
            const subSupplier = subSupplierId !== 'none' ? state.subSuppliers.find(ss => ss.id === subSupplierId) : undefined;
            const originalType = state.originalTypes.find(ot => ot.id === originalTypeId);
            const originalProduct = originalProductId !== 'none' ? state.originalProducts.find(op => op.id === originalProductId) : undefined;

            let inHandKg = 0;
            if (originalType) {
                if (originalType.packingType === PackingType.Kg) {
                    inHandKg = inHand;
                } else {
                    inHandKg = inHand * originalType.packingSize;
                }
            }

            data.push({
                key,
                supplierName: supplier?.name || 'N/A',
                subSupplierName: subSupplier?.name || '-',
                originalTypeName: originalType?.name || 'N/A',
                originalProductName: originalProduct?.name || '-',
                inHandUnits: inHand,
                inHandKg,
            });
        }
        return data.sort((a,b) => a.supplierName.localeCompare(b.supplierName));
    }, [filters, stockByCombination, state.suppliers, state.subSuppliers, state.originalTypes, state.originalProducts]);
    
    const availableSubSuppliers = useMemo(() => {
        if (!filters.supplierId) return state.subSuppliers;
        return state.subSuppliers.filter(ss => ss.supplierId === filters.supplierId);
    }, [filters.supplierId, state.subSuppliers]);

    const availableOriginalProducts = useMemo(() => {
        if (!filters.originalTypeId) return state.originalProducts;
        return state.originalProducts.filter(op => op.originalTypeId === filters.originalTypeId);
    }, [filters.originalTypeId, state.originalProducts]);


    const totals = React.useMemo(() => {
        return reportData.reduce((acc, row) => {
            acc.inHandUnits += row.inHandUnits;
            acc.inHandKg += row.inHandKg;
            return acc;
        }, { inHandUnits: 0, inHandKg: 0 });
    }, [reportData]);

    const exportHeaders = [
        { label: 'Supplier', key: 'supplierName' },
        { label: 'Sub-Supplier', key: 'subSupplierName' },
        { label: 'Original Type', key: 'originalTypeName' },
        { label: 'Original Product', key: 'originalProductName' },
        { label: 'In Hand (Units)', key: 'inHandUnits' },
        { label: 'In Hand (Kg)', key: 'inHandKg' },
    ];
    
    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Original Stock Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`OriginalStockInHand`}
            />
            
             <div className="p-4 bg-slate-50 rounded-lg border mb-6 flex flex-wrap gap-4 items-end no-print">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                    <select value={filters.supplierId} onChange={(e) => handleFilterChange('supplierId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="">All Suppliers</option>
                        {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Supplier</label>
                    <select value={filters.subSupplierId} onChange={(e) => handleFilterChange('subSupplierId', e.target.value)} disabled={!filters.supplierId} className="w-full p-2 border border-slate-300 rounded-md text-sm disabled:bg-slate-200">
                        <option value="">All Sub-Suppliers</option>
                        {availableSubSuppliers.map(ss => <option key={ss.id} value={ss.id}>{ss.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Original Type</label>
                    <select value={filters.originalTypeId} onChange={(e) => handleFilterChange('originalTypeId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="">All Types</option>
                        {state.originalTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Original Product</label>
                    <select value={filters.originalProductId} onChange={(e) => handleFilterChange('originalProductId', e.target.value)} disabled={!filters.originalTypeId} className="w-full p-2 border border-slate-300 rounded-md text-sm disabled:bg-slate-200">
                        <option value="">All Products</option>
                        {availableOriginalProducts.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                    </select>
                </div>
                 <button onClick={resetFilters} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm mt-auto">Reset Filters</button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Supplier</th>
                            <th className="p-2 font-semibold text-slate-600">Sub-Supplier</th>
                            <th className="p-2 font-semibold text-slate-600">Original Type</th>
                            <th className="p-2 font-semibold text-slate-600">Original Product</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">In Hand (Units)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">In Hand (Kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(row => (
                            <tr key={row.key} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{row.supplierName}</td>
                                <td className="p-2 text-slate-700">{row.subSupplierName}</td>
                                <td className="p-2 text-slate-700">{row.originalTypeName}</td>
                                <td className="p-2 text-slate-700">{row.originalProductName}</td>
                                <td className="p-2 text-slate-700 text-right font-medium">{(Number(row.inHandUnits) || 0).toLocaleString()}</td>
                                <td className="p-2 text-slate-700 text-right font-bold">{(Number(row.inHandKg) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-bold">
                            <td colSpan={4} className="p-2 text-right text-slate-800">Totals</td>
                            <td className="p-2 text-right text-slate-800">{(Number(totals.inHandUnits) || 0).toLocaleString()}</td>
                            <td className="p-2 text-right text-slate-800">{(Number(totals.inHandKg) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
                 {reportData.length === 0 && (
                    <p className="text-center text-slate-500 py-6">No original stock found for the selected criteria.</p>
                )}
            </div>
        </div>
    );
};

export default OriginalStockReport;