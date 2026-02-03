import React from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { OriginalPurchased, PackingType } from '../../types.ts';

const OriginalStockReportV2: React.FC = () => {
    const { state } = useData();

    // Stable and performant data calculation
    const reportData = React.useMemo(() => {
        const stockByCombination = new Map<string, { inHand: number; purchase: OriginalPurchased | null }>();
        const getKey = (p: { supplierId: string; subSupplierId?: string; originalTypeId: string; originalProductId?: string }) => {
            return `${p.supplierId || 'none'}|${p.subSupplierId || 'none'}|${p.originalTypeId || 'none'}|${p.originalProductId || 'none'}`;
        };

        state.originalPurchases.forEach(p => {
            const key = getKey(p);
            const current = stockByCombination.get(key) || { inHand: 0, purchase: p };
            current.inHand += p.quantityPurchased;
            stockByCombination.set(key, current);
        });

        state.originalOpenings.forEach(o => {
            const key = getKey(o);
            const current = stockByCombination.get(key);
            if (current) {
                current.inHand -= o.opened;
                stockByCombination.set(key, current);
            }
        });

        const data = [];
        for (const [key, { inHand, purchase }] of stockByCombination.entries()) {
            if (inHand <= 0.001 || !purchase) continue;

            const [supplierId, subSupplierId, originalTypeId, originalProductId] = key.split('|');
            
            const supplier = state.suppliers.find(s => s.id === supplierId);
            const subSupplier = subSupplierId !== 'none' ? state.subSuppliers.find(ss => ss.id === subSupplierId) : undefined;
            const originalType = state.originalTypes.find(ot => ot.id === originalTypeId);
            const originalProduct = originalProductId !== 'none' ? state.originalProducts.find(op => op.id === originalProductId) : undefined;

            data.push({
                key,
                supplierName: supplier?.name || 'N/A',
                subSupplierName: subSupplier?.name || '-',
                originalTypeName: originalType?.name || 'N/A',
                originalProductName: originalProduct?.name || '-',
                inHand: inHand,
            });
        }

        return data.sort((a, b) => a.supplierName.localeCompare(b.supplierName));

    }, [state.originalPurchases, state.originalOpenings, state.suppliers, state.originalTypes, state.subSuppliers, state.originalProducts]);

    const totals = React.useMemo(() => {
        return reportData.reduce((acc, row) => {
            acc.inHand += row.inHand;
            return acc;
        }, { inHand: 0 });
    }, [reportData]);

    const exportHeaders = [
        { label: 'Supplier', key: 'supplierName' },
        { label: 'Sub-Supplier', key: 'subSupplierName' },
        { label: 'Original Type', key: 'originalTypeName' },
        { label: 'Original Product', key: 'originalProductName' },
        { label: 'In Hand', key: 'inHand' },
    ];
    
    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Original Stock In Hand Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`OriginalStockInHand`}
            />
            
            <p className="text-sm text-slate-600 mb-4">
                This report shows a summary of all original materials currently in stock.
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Supplier</th>
                            <th className="p-2 font-semibold text-slate-600">Sub-Supplier</th>
                            <th className="p-2 font-semibold text-slate-600">Original Type</th>
                            <th className="p-2 font-semibold text-slate-600">Original Product</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">In Hand (Units)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(row => (
                            <tr key={row.key} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{row.supplierName}</td>
                                <td className="p-2 text-slate-700">{row.subSupplierName}</td>
                                <td className="p-2 text-slate-700">{row.originalTypeName}</td>
                                <td className="p-2 text-slate-700">{row.originalProductName}</td>
                                <td className="p-2 text-slate-700 text-right font-bold">{(Number(row.inHand) || 0).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-bold">
                            <td colSpan={4} className="p-2 text-right text-slate-800">Total In Hand</td>
                            <td className="p-2 text-right text-slate-800">{(Number(totals.inHand) || 0).toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
                 {reportData.length === 0 && (
                    <p className="text-center text-slate-500 py-6">No original stock currently in hand.</p>
                )}
            </div>
        </div>
    );
};

export default OriginalStockReportV2;