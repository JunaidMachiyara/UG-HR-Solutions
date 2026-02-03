
import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { PackingType } from '../../types.ts';

type SortKey = 'entry' | 'itemName' | 'category' | 'section' | 'packageSize' | 'quantityProduced';

const DailyProductionReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    
    const [filters, setFilters] = useState({
        date: today,
    });

    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
        key: 'entry', // Default to Data Entry Sequence
        direction: 'asc',
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const reportData = useMemo(() => {
        const data = state.productions
            .filter(p => p.date === filters.date)
            .map(p => {
                const item = state.items.find(i => i.id === p.itemId);
                const packageTypesWithSize = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags];
                const packageSize = item?.packingType === PackingType.Kg ? 1 : (item && packageTypesWithSize.includes(item.packingType) ? item.baleSize : 0);
                
                return {
                    id: p.id, // Used for Entry Sequence sort (contains timestamp)
                    itemId: p.itemId,
                    itemName: item?.name || 'Unknown',
                    category: state.categories.find(c => c.id === item?.categoryId)?.name || 'N/A',
                    section: state.sections.find(s => s.id === item?.sectionId)?.name || 'N/A',
                    packingType: item?.packingType || PackingType.Kg,
                    packageSize: packageSize,
                    packageSizeDisplay: item?.packingType === PackingType.Kg ? 1 : (item && packageTypesWithSize.includes(item.packingType) ? item.baleSize : 'N/A'),
                    quantityProduced: p.quantityProduced,
                };
            });

        return data.sort((a, b) => {
            const modifier = sortConfig.direction === 'asc' ? 1 : -1;

            if (sortConfig.key === 'entry') {
                // Sort by ID (timestamp based) ensures entry sequence
                return a.id.localeCompare(b.id) * modifier;
            }

            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return aValue.localeCompare(bValue) * modifier;
            }
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return (aValue - bValue) * modifier;
            }
            return 0;
        });

    }, [filters.date, state.productions, state.items, state.categories, state.sections, sortConfig]);
    
    const { totalPackages, totalKg } = useMemo(() => {
        let packages = 0;
        let kg = 0;
        reportData.forEach(row => {
            const itemDetails = state.items.find(i => i.id === row.itemId);
            if (!itemDetails) return;
    
            const isPackage = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(itemDetails.packingType);

            if (isPackage) {
                packages += row.quantityProduced;
                kg += row.quantityProduced * itemDetails.baleSize;
            } else { // It must be PackingType.Kg
                kg += row.quantityProduced;
            }
        });
        return { totalPackages: packages, totalKg: kg };
    }, [reportData, state.items]);

    const exportHeaders = [
        { label: 'Item ID', key: 'itemId' },
        { label: 'Item Name', key: 'itemName' },
        { label: 'Category', key: 'category' },
        { label: 'Section', key: 'section' },
        { label: 'Packing Type', key: 'packingType' },
        { label: 'Package Size (Kg)', key: 'packageSizeDisplay' },
        { label: 'Quantity Produced', key: 'quantityProduced' },
    ];

    const renderSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <span className="text-slate-300 ml-1">⇅</span>;
        return sortConfig.direction === 'asc' ? <span className="ml-1 text-blue-600">↑</span> : <span className="ml-1 text-blue-600">↓</span>;
    };

    return (
        <div className="report-print-area">
            <ReportToolbar
                title={`Daily Production Report for ${filters.date}`}
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`DailyProduction_${filters.date}`}
            />
            <div className="p-4 bg-slate-50 rounded-lg border mb-6 flex flex-wrap gap-4 items-end no-print">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input
                        type="date"
                        value={filters.date}
                        onChange={(e) => handleFilterChange('date', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    />
                </div>
                <div className="flex-grow flex justify-end">
                     <button 
                        onClick={() => handleSort('entry')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${sortConfig.key === 'entry' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    >
                        Reset Sort (Entry Sequence) {sortConfig.key === 'entry' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th 
                                className="p-2 font-semibold text-slate-600 cursor-pointer hover:bg-slate-200 select-none"
                                onClick={() => handleSort('itemName')}
                            >
                                Item Name {renderSortIcon('itemName')}
                            </th>
                            <th 
                                className="p-2 font-semibold text-slate-600 cursor-pointer hover:bg-slate-200 select-none"
                                onClick={() => handleSort('category')}
                            >
                                Category {renderSortIcon('category')}
                            </th>
                            <th 
                                className="p-2 font-semibold text-slate-600 cursor-pointer hover:bg-slate-200 select-none"
                                onClick={() => handleSort('section')}
                            >
                                Section {renderSortIcon('section')}
                            </th>
                            <th 
                                className="p-2 font-semibold text-slate-600 text-right cursor-pointer hover:bg-slate-200 select-none"
                                onClick={() => handleSort('packageSize')}
                            >
                                Package Size (Kg) {renderSortIcon('packageSize')}
                            </th>
                            <th 
                                className="p-2 font-semibold text-slate-600 text-right cursor-pointer hover:bg-slate-200 select-none"
                                onClick={() => handleSort('quantityProduced')}
                            >
                                Quantity Produced {renderSortIcon('quantityProduced')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(row => (
                            <tr key={row.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{row.itemName} <span className="text-xs text-slate-400">({row.itemId})</span></td>
                                <td className="p-2 text-slate-700">{row.category}</td>
                                <td className="p-2 text-slate-700">{row.section}</td>
                                <td className="p-2 text-slate-700 text-right">{row.packageSizeDisplay}</td>
                                <td className="p-2 text-slate-700 text-right font-medium">{row.quantityProduced.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-800">
                            <td colSpan={3} className="p-2 text-right">Totals</td>
                            <td className="p-2 text-right"></td>
                            <td className="p-2 text-right">{totalPackages.toLocaleString()} Packages / {totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} Kg</td>
                        </tr>
                    </tfoot>
                </table>
                 {reportData.length === 0 && (
                    <p className="text-center text-slate-500 py-6">No production entries for this date.</p>
                )}
            </div>
        </div>
    );
};

export default DailyProductionReport;
