import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { PackingType } from '../../types.ts';

const SectionProductionReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        startDate: firstDayOfMonth,
        endDate: today,
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const reportData = useMemo(() => {
        const productionsInPeriod = state.productions.filter(p => p.date >= filters.startDate && p.date <= filters.endDate);

        const dataBySection: { [sectionId: string]: { name: string; totalBales: number; totalKg: number; uniqueItems: Set<string> } } = {};

        productionsInPeriod.forEach(prod => {
            const item = state.items.find(i => i.id === prod.itemId);
            if (!item || !item.sectionId) return;

            const section = state.sections.find(s => s.id === item.sectionId);
            if (!section) return;

            if (!dataBySection[section.id]) {
                dataBySection[section.id] = {
                    name: section.name,
                    totalBales: 0,
                    totalKg: 0,
                    uniqueItems: new Set(),
                };
            }

            dataBySection[section.id].uniqueItems.add(item.id);

            if (item.packingType === PackingType.Bales) {
                dataBySection[section.id].totalBales += prod.quantityProduced;
            }
            if (item.packingType !== PackingType.Kg) {
                dataBySection[section.id].totalKg += prod.quantityProduced * item.baleSize;
            } else {
                dataBySection[section.id].totalKg += prod.quantityProduced;
            }
        });

        return Object.values(dataBySection)
            .map(sectionData => ({
                ...sectionData,
                itemCount: sectionData.uniqueItems.size,
            }))
            .sort((a, b) => b.totalKg - a.totalKg);

    }, [filters, state.productions, state.items, state.sections]);

    const totals = useMemo(() => {
        return reportData.reduce((acc, row) => {
            acc.totalBales += row.totalBales;
            acc.totalKg += row.totalKg;
            return acc;
        }, { totalBales: 0, totalKg: 0 });
    }, [reportData]);
    
    const exportHeaders = [
        { label: 'Section', key: 'name' },
        { label: 'Total Bales Produced', key: 'totalBales' },
        { label: 'Total Kg Produced', key: 'totalKg' },
        { label: 'Unique Items Produced', key: 'itemCount' },
    ];
    
    const Recharts = (window as any).Recharts;
    const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = Recharts || {};


    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Section Production Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`SectionProduction_${filters.startDate}_to_${filters.endDate}`}
            />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-left table-auto text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="p-2 font-semibold text-slate-600">Section</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Total Bales</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Total Kg</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Unique Items</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map(row => (
                                <tr key={row.name} className="border-b hover:bg-slate-50">
                                    <td className="p-2 text-slate-700 font-medium">{row.name}</td>
                                    <td className="p-2 text-slate-700 text-right">{row.totalBales.toLocaleString()}</td>
                                    <td className="p-2 text-slate-700 text-right">{row.totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="p-2 text-slate-700 text-right">{row.itemCount}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-100 font-bold">
                                <td className="p-2 text-right text-slate-800">Totals</td>
                                <td className="p-2 text-right text-slate-800">{totals.totalBales.toLocaleString()}</td>
                                <td className="p-2 text-right text-slate-800">{totals.totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                {Recharts && reportData.length > 0 && (
                     <div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">Production by Section (Kg)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={reportData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value: number) => `${value.toLocaleString()} Kg`} />
                                <Legend />
                                <Bar dataKey="totalKg" name="Total Kg Produced" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {reportData.length === 0 && (
                <p className="text-center text-slate-500 py-6">
                    No production data found for the selected period.
                </p>
            )}
        </div>
    );
};

export default SectionProductionReport;