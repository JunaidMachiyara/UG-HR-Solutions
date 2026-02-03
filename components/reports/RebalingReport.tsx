import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import ItemSelector from '../ui/ItemSelector.tsx';
import Modal from '../ui/Modal.tsx';
import { Production, PackingType } from '../../types.ts';

interface RebalingItem {
    itemId: string;
    itemName: string;
    quantity: number;
    totalKg: number;
}

interface RebalingTransaction {
    id: string; // The timestamp from the production ID
    date: string;
    fromItems: RebalingItem[];
    toItems: RebalingItem[];
    totalFromKg: number;
    totalToKg: number;
    differenceKg: number;
}

const RebalingReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        startDate: firstDayOfYear,
        endDate: today,
        itemId: '',
    });
    const [viewingTransaction, setViewingTransaction] = useState<RebalingTransaction | null>(null);

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const reportData = useMemo(() => {
        const rebalingProductions = state.productions.filter(p => p.id.startsWith('rebaling_'));
        
        const groups: { [key: string]: Production[] } = {};
        rebalingProductions.forEach(p => {
            const parts = p.id.split('_');
            const timestamp = parts[parts.length - 1];
            if (!groups[timestamp]) {
                groups[timestamp] = [];
            }
            groups[timestamp].push(p);
        });

        const transactions: RebalingTransaction[] = Object.entries(groups).map(([timestamp, entries]) => {
            const fromItems: RebalingItem[] = [];
            const toItems: RebalingItem[] = [];

            entries.forEach(entry => {
                const itemDetails = state.items.find(i => i.id === entry.itemId);
                if (!itemDetails) return;

                const quantity = Math.abs(entry.quantityProduced);
                const totalKg = quantity * (itemDetails.packingType === PackingType.Bales ? itemDetails.baleSize : 1);

                const rebalingItem: RebalingItem = {
                    itemId: itemDetails.id,
                    itemName: itemDetails.name,
                    quantity,
                    totalKg,
                };

                if (entry.quantityProduced < 0) {
                    fromItems.push(rebalingItem);
                } else {
                    toItems.push(rebalingItem);
                }
            });
            
            const totalFromKg = fromItems.reduce((sum, item) => sum + item.totalKg, 0);
            const totalToKg = toItems.reduce((sum, item) => sum + item.totalKg, 0);

            return {
                id: timestamp,
                date: entries[0].date,
                fromItems,
                toItems,
                totalFromKg,
                totalToKg,
                differenceKg: totalFromKg - totalToKg,
            };
        });

        // Apply filters
        return transactions
            .filter(t => t.date >= filters.startDate && t.date <= filters.endDate)
            .filter(t => {
                if (!filters.itemId) return true;
                const hasItem = t.fromItems.some(i => i.itemId === filters.itemId) || t.toItems.some(i => i.itemId === filters.itemId);
                return hasItem;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [filters, state.productions, state.items]);
    
    const formatNumber = (num: number) => num.toLocaleString(undefined, { maximumFractionDigits: 2 });

    const exportHeaders = [
        { label: 'Rebaling ID', key: 'id' },
        { label: 'Date', key: 'date' },
        { label: 'Items Consumed', key: 'fromItemCount' },
        { label: 'Items Produced', key: 'toItemCount' },
        { label: 'Kg Consumed', key: 'totalFromKg' },
        { label: 'Kg Produced', key: 'toItemCount' },
        { label: 'Difference (Kg)', key: 'differenceKg' },
    ];
    
    const exportData = reportData.map(t => ({
        id: t.id,
        date: t.date,
        fromItemCount: t.fromItems.length,
        toItemCount: t.toItems.length,
        totalFromKg: t.totalFromKg.toFixed(2),
        totalToKg: t.totalToKg.toFixed(2),
        differenceKg: t.differenceKg.toFixed(2),
    }));

    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Rebaling Report"
                exportData={exportData}
                exportHeaders={exportHeaders}
                exportFilename={`RebalingReport_${filters.startDate}_to_${filters.endDate}`}
            />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                <div className="flex-grow min-w-[250px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Item</label>
                    <ItemSelector
                        items={state.items}
                        selectedItemId={filters.itemId}
                        onSelect={(itemId) => handleFilterChange('itemId', itemId)}
                        placeholder="Filter by item involved..."
                    />
                </div>
            </ReportFilters>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Rebaling ID</th>
                            <th className="p-2 font-semibold text-slate-600">Date</th>
                            <th className="p-2 font-semibold text-slate-600 text-center"># Items Consumed</th>
                            <th className="p-2 font-semibold text-slate-600 text-center"># Items Produced</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Kg Consumed</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Kg Produced</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Difference (Kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(t => (
                            <tr key={t.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">
                                    <button onClick={() => setViewingTransaction(t)} className="text-blue-600 hover:underline font-mono">
                                        {t.id}
                                    </button>
                                </td>
                                <td className="p-2 text-slate-700">{t.date}</td>
                                <td className="p-2 text-slate-700 text-center">{t.fromItems.length}</td>
                                <td className="p-2 text-slate-700 text-center">{t.toItems.length}</td>
                                <td className="p-2 text-slate-700 text-right">{formatNumber(t.totalFromKg)}</td>
                                <td className="p-2 text-slate-700 text-right">{formatNumber(t.totalToKg)}</td>
                                <td className={`p-2 text-right font-medium ${t.differenceKg > 0.01 ? 'text-red-600' : 'text-slate-700'}`}>
                                    {formatNumber(t.differenceKg)}
                                </td>
                            </tr>
                        ))}
                        {reportData.length === 0 && (
                            <tr><td colSpan={7} className="text-center text-slate-500 py-6">No rebaling transactions found for the selected criteria.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {viewingTransaction && (
                <Modal
                    isOpen={!!viewingTransaction}
                    onClose={() => setViewingTransaction(null)}
                    title={`Rebaling Details: ${viewingTransaction.id}`}
                    size="3xl"
                >
                    <div className="space-y-6">
                        <p className="text-sm text-slate-700"><strong>Date:</strong> {viewingTransaction.date}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* From Items */}
                            <div className="space-y-2">
                                <h4 className="font-semibold text-red-700">Items Consumed (From)</h4>
                                <table className="w-full text-left table-auto text-sm">
                                    <thead className="bg-red-50"><tr><th className="p-2 font-semibold text-red-800">Item</th><th className="p-2 font-semibold text-red-800 text-right">Qty</th><th className="p-2 font-semibold text-red-800 text-right">Kg</th></tr></thead>
                                    <tbody>{viewingTransaction.fromItems.map(item => (<tr key={item.itemId} className="border-b"><td className="p-2 text-slate-800">{item.itemName}</td><td className="p-2 text-right text-slate-800">{item.quantity}</td><td className="p-2 text-right text-slate-800">{formatNumber(item.totalKg)}</td></tr>))}</tbody>
                                    <tfoot><tr className="font-bold bg-red-100 text-red-900"><td className="p-2 text-right">Total</td><td></td><td className="p-2 text-right">{formatNumber(viewingTransaction.totalFromKg)}</td></tr></tfoot>
                                </table>
                            </div>
                             {/* To Items */}
                             <div className="space-y-2">
                                <h4 className="font-semibold text-green-700">Items Produced (To)</h4>
                                <table className="w-full text-left table-auto text-sm">
                                    <thead className="bg-green-50"><tr><th className="p-2 font-semibold text-green-800">Item</th><th className="p-2 font-semibold text-green-800 text-right">Qty</th><th className="p-2 font-semibold text-green-800 text-right">Kg</th></tr></thead>
                                    <tbody>{viewingTransaction.toItems.map(item => (<tr key={item.itemId} className="border-b"><td className="p-2 text-slate-800">{item.itemName}</td><td className="p-2 text-right text-slate-800">{item.quantity}</td><td className="p-2 text-right text-slate-800">{formatNumber(item.totalKg)}</td></tr>))}</tbody>
                                    <tfoot><tr className="font-bold bg-green-100 text-green-900"><td className="p-2 text-right">Total</td><td></td><td className="p-2 text-right">{formatNumber(viewingTransaction.totalToKg)}</td></tr></tfoot>
                                </table>
                            </div>
                        </div>
                         <div className="text-right font-semibold text-slate-800 border-t pt-2">
                            Difference (Unaccounted): <span className={viewingTransaction.differenceKg > 0.01 ? 'text-red-600' : 'text-slate-800'}>{formatNumber(viewingTransaction.differenceKg)} Kg</span>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default RebalingReport;