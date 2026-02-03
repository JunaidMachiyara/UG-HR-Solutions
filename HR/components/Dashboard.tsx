import React, { useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { InvoiceStatus, PackingType, Module, SalesInvoice, Production, Item, InvoiceItem, OriginalPurchased } from '../types.ts';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

// --- SVG Icons for Dashboard ---
const Icons = {
    customers: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 01-5.197-9" /></svg>,
    suppliers: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17H6V6h12v4l-4 4H9" /></svg>,
    items: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m0 0v10l8 4m0-14L4 7" /></svg>,
    invoices: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    cash: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    bank: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    receivables: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4m10 4h-2m-4 0H7m10 4h-2m-4 0H7m10 4h-2m-4 0H7m12-4v-4m0 4h-2" /></svg>,
    payables: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4m-2 4h14m-2 4H7m12 4H7" /></svg>,
    rawStock: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12l-8-8-8 8m16 0l-8 8-8-8" /></svg>,
    finishedStock: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    newInvoice: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    newProduction: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>,
    newPurchase: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    combination: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 00-1 1v1a2 2 0 11-4 0v-1a1 1 0 00-1-1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>,
    fulfillment: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    planner: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string, onClick?: () => void }> = ({ title, value, icon, color, onClick }) => (
    <button 
        onClick={onClick} 
        disabled={!onClick}
        className={`w-full bg-white p-5 rounded-xl shadow-md flex items-center space-x-4 border-l-4 text-left ${color} ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all' : ''}`}
    >
        <div className={`p-3 rounded-full bg-opacity-10 ${color.replace('border', 'bg').replace('-500', '-100')}`}>
            <span className={color.replace('border', 'text')}>{icon}</span>
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
    </button>
);

const SquareStatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string, onClick?: () => void }> = ({ title, value, icon, color, onClick }) => (
    <button
        onClick={onClick}
        disabled={!onClick}
        className={`w-full lg:w-36 h-36 bg-white p-4 rounded-xl shadow-lg flex flex-col items-center justify-center text-center ${onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all' : ''} border-t-4 ${color}`}
    >
        <span className={`${color.replace('border', 'text')} mb-2`}>{icon}</span>
        <p className="text-xs font-semibold text-slate-600 leading-tight">{title}</p>
        <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
    </button>
);


interface ShareData {
    name: string;
    percentage: number;
    color: string;
    value: number;
}
interface HorizontalShareCardProps {
    title: string;
    data: ShareData[];
    formatValue: (value: number) => string;
}

const HorizontalShareCard: React.FC<HorizontalShareCardProps> = ({ title, data, formatValue }) => {
    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
            <div className="space-y-4">
                {data.map(item => (
                    <div key={item.name}>
                        <div className="flex justify-between items-center mb-1 text-sm">
                            <span className="font-semibold text-slate-800">{item.name}</span>
                            <span className="font-bold text-slate-600">
                               {formatValue(item.value)} ({item.percentage.toFixed(1)}%)
                            </span>
                        </div>
                        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out 
                                    ${item.color === 'red' && 'from-red-400 to-red-600'}
                                    ${item.color === 'orange' && 'from-orange-400 to-orange-600'}
                                    ${item.color === 'yellow' && 'from-yellow-400 to-yellow-600'}
                                    ${item.color === 'lime' && 'from-lime-400 to-lime-600'}
                                    ${item.color === 'teal' && 'from-teal-400 to-teal-600'}
                                    ${item.color === 'cyan' && 'from-cyan-400 to-cyan-600'}
                                    ${item.color === 'emerald' && 'from-emerald-400 to-emerald-600'}
                                    ${item.color === 'amber' && 'from-amber-400 to-amber-600'}
                                    ${item.color === 'violet' && 'from-violet-400 to-violet-600'}
                                    ${item.color === 'rose' && 'from-rose-400 to-rose-600'}
                                    ${item.color === 'sky' && 'from-sky-400 to-sky-600'}
                                    ${item.color === 'purple' && 'from-purple-400 to-purple-600'}
                                    ${item.color === 'pink' && 'from-pink-400 to-pink-600'}
                                    ${item.color === 'indigo' && 'from-indigo-400 to-indigo-600'}
                                    ${item.color === 'fuchsia' && 'from-fuchsia-400 to-fuchsia-600'}
                                    ${item.color === 'blue' && 'from-blue-400 to-blue-600'}
                                    ${item.color === 'green' && 'from-green-400 to-green-600'}
                                `}
                                style={{ width: `${item.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
                {data.length === 0 && <p className="text-slate-500 text-center py-8">No production data for this period.</p>}
            </div>
        </div>
    );
};

const PieChartCard: React.FC<{ title: string; data: ShareData[]; formatValue: (value: number) => string; }> = ({ title, data, formatValue }) => {
    const COLORS: { [key: string]: string } = {
        sky: '#38bdf8', teal: '#2dd4bf', emerald: '#34d399', orange: '#fb923c', red: '#f87171',
        blue: '#60a5fa', green: '#4ade80', yellow: '#facc15', purple: '#c084fc', pink: '#f472b6',
    };
    const defaultColor = '#94a3b8';

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (percent < 0.07) return null; // Don't render label for small slices
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="bold">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
            {data.length > 0 ? (
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={renderCustomizedLabel}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.color] || defaultColor} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number, name: string, props: any) => [`${formatValue(props.payload.value)} (${props.payload.percentage.toFixed(1)}%)`, name]} />
                            <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex items-center justify-center h-48">
                    <p className="text-slate-500">No sales data for this period.</p>
                </div>
            )}
        </div>
    );
};


interface DashboardProps {
    setModule: (module: Module, subView?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setModule }) => {
    const { state } = useData();
    
    const unpostedInvoices = state.salesInvoices.filter(inv => inv.status === InvoiceStatus.Unposted).length;

    const formatCurrency = (value: number) => {
        if (Math.abs(value) >= 1_000_000) {
            return `$${(value / 1_000_000).toFixed(2)}M`;
        }
        if (Math.abs(value) >= 1_000) {
            return `$${(value / 1_000).toFixed(1)}K`;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };
    
    const formatKg = (value: number) => {
        if (Math.abs(value) >= 1000) {
            return `${(value / 1000).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}k kg`;
        }
        return `${value.toLocaleString()} kg`;
    };

    const cashAccountIds = state.cashAccounts.map(c => c.id);
    const cashInHand = state.journalEntries.filter(je => cashAccountIds.includes(je.account)).reduce((acc, je) => acc + je.debit - je.credit, 0);

    const bankAccountIds = state.banks.map(b => b.id);
    const cashInBank = state.journalEntries.filter(je => bankAccountIds.includes(je.account)).reduce((acc, je) => acc + je.debit - je.credit, 0);

    const { accountsReceivable, accountsPayable } = useMemo(() => {
        const receivableAccountId = state.receivableAccounts[0]?.id;
        const payableAccountId = state.payableAccounts[0]?.id;
        let totalReceivable = 0;
        let totalPayable = 0;

        state.journalEntries.forEach(je => {
            if (je.account === receivableAccountId) totalReceivable += je.debit - je.credit;
            if (je.account === payableAccountId) totalPayable += je.credit - je.debit;
        });

        return { accountsReceivable: totalReceivable, accountsPayable: totalPayable };
    }, [state.journalEntries, state.receivableAccounts, state.payableAccounts]);


    const originalInHandKg = useMemo(() => {
        const purchasesKg = state.originalPurchases.reduce((acc, purchase) => {
            const originalType = state.originalTypes.find(ot => ot.id === purchase.originalTypeId);
            if (!originalType) return acc;
            const packingSize = originalType.packingSize || 1;
            if (originalType.packingType === PackingType.Kg) {
                return acc + purchase.quantityPurchased;
            }
            return acc + (purchase.quantityPurchased * packingSize);
        }, 0);
        const openingsKg = state.originalOpenings.reduce((acc, opening) => acc + opening.totalKg, 0);
        return purchasesKg - openingsKg;
    }, [state.originalPurchases, state.originalOpenings, state.originalTypes]);

    const finishedGoodsStockKg = useMemo(() => {
        const openingStockKg = state.items.reduce((acc, item) => {
            const stockUnits = item.openingStock || 0;
            if (stockUnits > 0) {
                const unitWeight = item.packingType !== PackingType.Kg ? item.baleSize : 1;
                return acc + (stockUnits * unitWeight);
            }
            return acc;
        }, 0);

        const productionKg = state.productions.reduce((acc, p) => {
            const item = state.items.find(i => i.id === p.itemId);
            if (!item) return acc;
            const itemKg = item.packingType !== PackingType.Kg ? item.baleSize : 1;
            return acc + p.quantityProduced * itemKg;
        }, 0);

        const salesKg = state.salesInvoices
            .filter(inv => inv.status !== InvoiceStatus.Unposted)
            .reduce((acc, inv) => acc + inv.totalKg, 0);
        return openingStockKg + productionKg - salesKg;
    }, [state.productions, state.salesInvoices, state.items]);
    
     const productionStats = useMemo(() => {
        const yesterdayGradientColors = ['red', 'orange', 'yellow', 'lime', 'teal'];
        const sevenDayGradientColors = ['cyan', 'emerald', 'amber', 'violet', 'rose'];
        const lastMonthGradientColors = ['sky', 'lime', 'orange', 'purple', 'pink'];

        const calculateShares = (productions: Production[], colors: string[]): ShareData[] => {
            if (productions.length === 0) return [];
            
            const productionByCat: { [catId: string]: number } = {};
            let totalKg = 0;

            productions.forEach(prod => {
                const item = state.items.find(i => i.id === prod.itemId);
                if (item) {
                    const producedKg = prod.quantityProduced * (item.packingType !== PackingType.Kg ? item.baleSize : 1);
                    productionByCat[item.categoryId] = (productionByCat[item.categoryId] || 0) + producedKg;
                    totalKg += producedKg;
                }
            });

            if (totalKg === 0) return [];

            return Object.entries(productionByCat)
                .map(([catId, kg], index) => {
                    const category = state.categories.find(c => c.id === catId);
                    return {
                        name: category?.name || 'Unknown',
                        percentage: (kg / totalKg) * 100,
                        color: colors[index % colors.length],
                        value: kg,
                    };
                })
                .sort((a, b) => b.percentage - a.percentage);
        };

        const now = new Date();
        
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        
        const lastMonthEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
        const lastMonthStartDate = new Date(lastMonthEndDate.getFullYear(), lastMonthEndDate.getMonth(), 1);
        const lastMonthStartStr = lastMonthStartDate.toISOString().split('T')[0];
        const lastMonthEndStr = lastMonthEndDate.toISOString().split('T')[0];

        const yesterdayProductions = state.productions.filter(p => p.date === yesterdayStr);
        const sevenDayProductions = state.productions.filter(p => p.date >= sevenDaysAgoStr);
        const lastMonthProductions = state.productions.filter(p => p.date >= lastMonthStartStr && p.date <= lastMonthEndStr);

        return {
            yesterdayData: calculateShares(yesterdayProductions, yesterdayGradientColors),
            sevenDayData: calculateShares(sevenDayProductions, sevenDayGradientColors),
            lastMonthData: calculateShares(lastMonthProductions, lastMonthGradientColors),
        };

    }, [state.productions, state.items, state.categories]);

    const purchaseStats = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

        const purchasesInPeriod = state.originalPurchases.filter(p => p.date >= thirtyDaysAgoStr);
        const openingsInPeriod = state.originalOpenings.filter(o => o.date >= thirtyDaysAgoStr);
        const calculatePurchaseValue = (p: OriginalPurchased) => (p.quantityPurchased * p.rate) * p.conversionRate;

        const processData = (groupedData: { [key: string]: number }, totalValue: number, nameMap: Map<string, string>, colors: string[]): ShareData[] => {
            if (totalValue === 0) return [];
            return Object.entries(groupedData)
                .map(([id, value]) => ({ name: nameMap.get(id) || 'Unknown', value, percentage: (value / totalValue) * 100 }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)
                .map((item, index) => ({ ...item, color: colors[index % colors.length] }));
        };
        
        const byType: { [key: string]: number } = {}; let totalValueByType = 0;
        purchasesInPeriod.forEach(p => { const value = calculatePurchaseValue(p); byType[p.originalTypeId] = (byType[p.originalTypeId] || 0) + value; totalValueByType += value; });
        const byTypeData = processData(byType, totalValueByType, new Map(state.originalTypes.map(ot => [ot.id, ot.name])), ['red', 'orange', 'yellow', 'lime', 'teal']);

        const bySupplier: { [key: string]: number } = {}; let totalValueBySupplier = 0;
        purchasesInPeriod.forEach(p => { const value = calculatePurchaseValue(p); bySupplier[p.supplierId] = (bySupplier[p.supplierId] || 0) + value; totalValueBySupplier += value; });
        const bySupplierData = processData(bySupplier, totalValueBySupplier, new Map(state.suppliers.map(s => [s.id, s.name])), ['cyan', 'emerald', 'amber', 'violet', 'rose']);

        const byDivision: { [key: string]: number } = {}; let totalValueByDivision = 0;
        purchasesInPeriod.forEach(p => { if (p.divisionId) { const value = calculatePurchaseValue(p); byDivision[p.divisionId] = (byDivision[p.divisionId] || 0) + value; totalValueByDivision += value; } });
        const byDivisionData = processData(byDivision, totalValueByDivision, new Map(state.divisions.map(d => [d.id, d.name])), ['sky', 'lime', 'orange', 'purple', 'pink']);

        const byOffloadType: { [key: string]: number } = {}; let totalKgByOffloadType = 0;
        openingsInPeriod.forEach(o => { const kg = o.totalKg; byOffloadType[o.originalTypeId] = (byOffloadType[o.originalTypeId] || 0) + kg; totalKgByOffloadType += kg; });
        const byOffloadTypeData = processData(byOffloadType, totalKgByOffloadType, new Map(state.originalTypes.map(ot => [ot.id, ot.name])), ['red', 'yellow', 'teal', 'indigo', 'fuchsia']);
        
        return { byTypeData, bySupplierData, byDivisionData, byOffloadTypeData };
    }, [state]);
    
    const salesStats = useMemo(() => {
        const postedInvoices = state.salesInvoices.filter(inv => 
            inv.status === InvoiceStatus.Posted
        );
        
        const colors = ['sky', 'teal', 'emerald', 'orange', 'red'];

        const processSalesData = (groupedData: { [key: string]: number }, totalValue: number, nameMap: Map<string, string>): ShareData[] => {
            if (totalValue === 0) return [];
            return Object.entries(groupedData)
                .map(([id, value]) => ({ name: nameMap.get(id) || 'Unknown', value, percentage: (value / totalValue) * 100 }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)
                .map((item, index) => ({ ...item, color: colors[index % colors.length] }));
        };
        
        let totalSalesValue = 0;
        const byCategory: { [key: string]: number } = {};
        const byCustomer: { [key: string]: number } = {};
        const byDivision: { [key: string]: number } = {};

        postedInvoices.forEach(inv => {
            let invoiceValue = 0;
            inv.items.forEach(item => {
                const itemDetails = state.items.find(i => i.id === item.itemId);
                // FIX: Use itemDetails.packingType, as item (InvoiceItem) doesn't have this property.
                if (itemDetails && item.rate !== undefined) {
                    const totalKg = itemDetails.packingType !== PackingType.Kg ? item.quantity * itemDetails.baleSize : item.quantity;
                    const itemValueUSD = totalKg * item.rate * (item.conversionRate || 1);
                    
                    invoiceValue += itemValueUSD;
                    byCategory[itemDetails.categoryId] = (byCategory[itemDetails.categoryId] || 0) + itemValueUSD;
                }
            });
            totalSalesValue += invoiceValue;
            byCustomer[inv.customerId] = (byCustomer[inv.customerId] || 0) + invoiceValue;

            const customer = state.customers.find(c => c.id === inv.customerId);
            if (customer?.divisionId) {
                byDivision[customer.divisionId] = (byDivision[customer.divisionId] || 0) + invoiceValue;
            }
        });

        return {
            byCategoryData: processSalesData(byCategory, totalSalesValue, new Map(state.categories.map(c => [c.id, c.name]))),
            byCustomerData: processSalesData(byCustomer, totalSalesValue, new Map(state.customers.map(c => [c.id, c.name]))),
            byDivisionData: processSalesData(byDivision, totalSalesValue, new Map(state.divisions.map(d => [d.id, d.name]))),
        };
    }, [state]);

    const handleShortcutClick = (reportKey: string) => {
        setModule('reports', reportKey);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content Area */}
            <div className="flex-grow space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Dashboard Overview</h1>
                    <p className="text-slate-500">Welcome back! Here's a snapshot of your business.</p>
                </div>

                {/* Combined Key Metrics & Inventory Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
                    <StatCard title="Total Customers" value={state.customers.length} icon={Icons.customers} color="border-blue-500 text-blue-500" onClick={() => setModule('setup', 'customers')} />
                    <StatCard title="Total Suppliers" value={state.suppliers.length} icon={Icons.suppliers} color="border-green-500 text-green-500" onClick={() => setModule('setup', 'suppliers')} />
                    <StatCard title="Total Items" value={state.items.length} icon={Icons.items} color="border-orange-500 text-orange-500" onClick={() => setModule('setup', 'items')} />
                    <StatCard title="Unposted Invoices" value={unpostedInvoices} icon={Icons.invoices} color="border-red-500 text-red-500" onClick={() => setModule('posting')} />
                    <StatCard title="Raw Material Stock" value={formatKg(originalInHandKg)} icon={Icons.rawStock} color="border-amber-500 text-amber-500" onClick={() => setModule('reports', 'original-stock-v1/main')} />
                    <StatCard title="Finished Goods Stock" value={formatKg(finishedGoodsStockKg)} icon={Icons.finishedStock} color="border-purple-500 text-purple-500" onClick={() => setModule('reports', 'item-performance/summary')} />
                </div>
                
                {/* Quick Actions */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h3>
                    <div className="flex flex-wrap gap-4">
                        <button onClick={() => setModule('dataEntry', 'sales')} className="flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-semibold hover:bg-blue-200 transition-colors">
                            {Icons.newInvoice} New Sales Invoice
                        </button>
                        <button onClick={() => setModule('dataEntry', 'production')} className="flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-lg font-semibold hover:bg-green-200 transition-colors">
                            {Icons.newProduction} New Production Entry
                        </button>
                        <button onClick={() => setModule('dataEntry', 'purchase')} className="flex items-center px-4 py-2 bg-orange-100 text-orange-800 rounded-lg font-semibold hover:bg-orange-200 transition-colors">
                            {Icons.newPurchase} New Purchase
                        </button>
                        <button onClick={() => setModule('reports', 'production/original-combination')} className="flex items-center px-4 py-2 bg-purple-100 text-purple-800 rounded-lg font-semibold hover:bg-purple-200 transition-colors">
                            {Icons.combination} View Production Combinations
                        </button>
                        <button onClick={() => setModule('reports', 'fulfillment/dashboard')} className="flex items-center px-4 py-2 bg-indigo-100 text-indigo-800 rounded-lg font-semibold hover:bg-indigo-200 transition-colors">
                            {Icons.fulfillment} Order Fulfillment
                        </button>
                        <button onClick={() => setModule('reports', 'financial/payment-planner')} className="flex items-center px-4 py-2 bg-pink-100 text-pink-800 rounded-lg font-semibold hover:bg-pink-200 transition-colors">
                            {Icons.planner} Receipts & Payments Planner
                        </button>
                    </div>
                </div>

                {/* Production Analysis */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Production Analysis</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <HorizontalShareCard title="Yesterday's Production Share" data={productionStats.yesterdayData} formatValue={formatKg} />
                        <HorizontalShareCard title="Last 7 Days Production Share" data={productionStats.sevenDayData} formatValue={formatKg} />
                        <HorizontalShareCard title="Last Month's Production Share" data={productionStats.lastMonthData} formatValue={formatKg} />
                    </div>
                </div>

                {/* Sales Analysis */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Sales Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <PieChartCard title="Sales by Category" data={salesStats.byCategoryData} formatValue={formatCurrency} />
                        <PieChartCard title="Sales by Customer" data={salesStats.byCustomerData} formatValue={formatCurrency} />
                        <PieChartCard title="Sales by Division" data={salesStats.byDivisionData} formatValue={formatCurrency} />
                    </div>
                </div>
                
                {/* Purchase Analysis */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Purchase Analysis (Last 30 Days)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <HorizontalShareCard title="Purchase by Original Type" data={purchaseStats.byTypeData} formatValue={formatCurrency} />
                        <HorizontalShareCard title="Purchase by Supplier" data={purchaseStats.bySupplierData} formatValue={formatCurrency} />
                        <HorizontalShareCard title="Purchase by Division" data={purchaseStats.byDivisionData} formatValue={formatCurrency} />
                        <HorizontalShareCard title="Off-load by Original Type" data={purchaseStats.byOffloadTypeData} formatValue={formatKg} />
                    </div>
                </div>

                {/* Quick Reports */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                     <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Reports</h3>
                     <div className="flex flex-wrap gap-4 text-sm font-medium">
                        <button onClick={() => handleShortcutClick('ledger/main')} className="text-blue-600 hover:underline">Ledger</button>
                        <button onClick={() => handleShortcutClick('item-performance/summary')} className="text-blue-600 hover:underline">Item Performance</button>
                        <button onClick={() => handleShortcutClick('invoices/sales')} className="text-blue-600 hover:underline">Sales Invoices</button>
                        <button onClick={() => handleShortcutClick('cash-bank/ledger')} className="text-blue-600 hover:underline">Cash & Bank</button>
                        <button onClick={() => handleShortcutClick('financial/balance-sheet')} className="text-blue-600 hover:underline">Balance Sheet</button>
                     </div>
                </div>
            </div>

            {/* Right Sidebar for Square Cards */}
            <div className="w-full lg:w-auto flex flex-row lg:flex-col gap-4 flex-shrink-0">
                 <SquareStatCard 
                    title="Cash in Hand" 
                    value={formatCurrency(cashInHand)} 
                    icon={React.cloneElement(Icons.cash, { className: 'h-7 w-7' })}
                    color="border-teal-500 text-teal-500" 
                    onClick={() => setModule('reports', 'cash-bank/cash-book')} 
                 />
                 <SquareStatCard 
                    title="Cash in Bank" 
                    value={formatCurrency(cashInBank)} 
                    icon={React.cloneElement(Icons.bank, { className: 'h-7 w-7' })}
                    color="border-sky-500 text-sky-500" 
                    onClick={() => setModule('reports', 'cash-bank/bank-book')} 
                 />
                 <SquareStatCard 
                    title="Accounts Receivable" 
                    value={formatCurrency(accountsReceivable)} 
                    icon={React.cloneElement(Icons.receivables, { className: 'h-7 w-7' })}
                    color="border-indigo-500 text-indigo-500" 
                    onClick={() => setModule('reports', 'ledger/main')} 
                 />
                 <SquareStatCard 
                    title="Accounts Payable" 
                    value={formatCurrency(accountsPayable)} 
                    icon={React.cloneElement(Icons.payables, { className: 'h-7 w-7' })}
                    color="border-rose-500 text-rose-500" 
                    onClick={() => setModule('reports', 'ledger/main')} 
                 />
            </div>
        </div>
    );
};
export default Dashboard;