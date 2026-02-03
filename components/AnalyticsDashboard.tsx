
import React, { useState, useEffect, useMemo, useReducer } from 'react';
import { useData } from '../context/DataContext.tsx';
import { InvoiceStatus, PackingType } from '../types.ts';

const AnalyticsDashboard: React.FC = () => {
    const { state } = useData();
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    useEffect(() => {
        if ((window as any).Recharts?.ResponsiveContainer) {
            return;
        }
        const intervalId = setInterval(() => {
            if ((window as any).Recharts?.ResponsiveContainer) {
                // FIX: Force a re-render by updating state
                forceUpdate();
                clearInterval(intervalId);
            }
        }, 100);
        return () => clearInterval(intervalId);
    }, []);

    const COLORS = ['#06b6d4', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
    
    const formatKpiValue = (value: number) => {
        if (value >= 1_000_000) {
            return `${(value / 1_000_000).toFixed(1)}M`;
        }
        if (value >= 1_000) {
            return `${(value / 1_000).toFixed(1)}K`;
        }
        return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

    const { grossSalesRevenue, grossMarginPercentage } = useMemo(() => {
        const revenue = state.journalEntries
            .filter(je => je.voucherId.startsWith('SI') && je.account === 'AR-001')
            .reduce((sum, je) => sum + je.debit, 0);

        const cogs = state.journalEntries
            .filter(je => je.account === 'EXP-011' || je.account === 'EXP-010')
            .reduce((sum, je) => sum + je.debit, 0);
            
        if (revenue === 0) return { grossSalesRevenue: 0, grossMarginPercentage: 0 };

        const margin = ((revenue - cogs) / revenue) * 100;
        return { grossSalesRevenue: revenue, grossMarginPercentage: margin };
    }, [state.journalEntries]);

    const activeStockUnits = useMemo(() => {
        const productionByItem = new Map<string, number>();
        state.productions.forEach(p => {
            productionByItem.set(p.itemId, (productionByItem.get(p.itemId) || 0) + p.quantityProduced);
        });

        const salesByItem = new Map<string, number>();
        state.salesInvoices.filter(inv => inv.status !== InvoiceStatus.Unposted).forEach(inv => {
            inv.items.forEach(item => {
                salesByItem.set(item.itemId, (salesByItem.get(item.itemId) || 0) + item.quantity);
            });
        });

        let totalStock = 0;
        for (const item of state.items) {
            const produced = productionByItem.get(item.id) || 0;
            const sold = salesByItem.get(item.id) || 0;
            totalStock += (produced - sold);
        }
        return totalStock;
    }, [state.productions, state.salesInvoices, state.items]);

    const newCustomersThisMonth = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const firstInvoiceDates = new Map<string, Date>();
        const sortedInvoices = [...state.salesInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const invoice of sortedInvoices) {
            if (!firstInvoiceDates.has(invoice.customerId)) {
                firstInvoiceDates.set(invoice.customerId, new Date(invoice.date));
            }
        }

        let count = 0;
        for (const date of firstInvoiceDates.values()) {
            if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                count++;
            }
        }
        return count;
    }, [state.salesInvoices]);

    const monthlySalesData = useMemo(() => {
        const data: { [key: string]: number } = {};
        const monthLabels: { key: string, name: string }[] = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            monthLabels.push({ key, name: d.toLocaleString('default', { month: 'short' }) });
            data[key] = 0;
        }

        state.journalEntries.filter(je => je.voucherId.startsWith('SI') && je.account === 'AR-001').forEach(je => {
            const entryDate = new Date(je.date);
            const key = `${entryDate.getFullYear()}-${entryDate.getMonth()}`;
            if (data[key] !== undefined) data[key] += je.debit;
        });

        return monthLabels.map(m => ({ name: m.name, Sales: data[m.key] }));
    }, [state.journalEntries]);

    const productionVsTargetData = useMemo(() => {
        const WEEKLY_TARGET = 500;
        const data: { name: string, Actual: number, Target: number }[] = [];
        const now = new Date();
        for (let i = 4; i >= 0; i--) {
            const weekStartDate = new Date(now);
            weekStartDate.setDate(now.getDate() - now.getDay() + 1 - (i * 7));
            weekStartDate.setHours(0, 0, 0, 0);
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekStartDate.getDate() + 6);
            weekEndDate.setHours(23, 59, 59, 999);
            
            const productionsThisWeek = state.productions.filter(p => {
                const pDate = new Date(p.date);
                return pDate >= weekStartDate && pDate <= weekEndDate;
            }).length;
            
            data.push({ 
                name: `Wk of ${weekStartDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`, 
                Actual: productionsThisWeek, 
                Target: WEEKLY_TARGET 
            });
        }
        return data;
    }, [state.productions]);

    const monthlyExpenseData = useMemo(() => {
        const expenseTypeMap: { [key: string]: 'payroll' | 'marketing' | 'operational' } = {
            'Salaries Expense': 'payroll', 'Commission Expense': 'marketing', 'Raw Material Purchases': 'operational', 'Freight Expense': 'operational', 'Clearing Expense': 'operational', 'Finished Goods Purchases': 'operational', 'Garbage/Wastage Expense': 'operational', 'Rent Expense': 'operational', 'Utilities Expense': 'operational', 'Cost of Goods Sold - Direct': 'operational', 'Cost of Goods Sold': 'operational', 'Production Variance': 'operational',
        };
        const expenseAccountIds = new Set(state.expenseAccounts.map(acc => acc.id));
        const data: { [key: string]: { payroll: number; marketing: number; operational: number } } = {};
        const monthLabels: { key: string, name: string }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            monthLabels.push({ key, name: d.toLocaleString('default', { month: 'short' }) });
            data[key] = { payroll: 0, marketing: 0, operational: 0 };
        }
        state.journalEntries.filter(je => expenseAccountIds.has(je.account) && je.debit > 0).forEach(je => {
            const entryDate = new Date(je.date);
            const key = `${entryDate.getFullYear()}-${entryDate.getMonth()}`;
            if (data[key] !== undefined) {
                const accountName = state.expenseAccounts.find(acc => acc.id === je.account)?.name;
                const expenseType = accountName ? expenseTypeMap[accountName] : 'operational';
                if (expenseType) data[key][expenseType] += je.debit;
            }
        });
        return monthLabels.map(m => ({ name: m.name, ...data[m.key] }));
    }, [state.journalEntries, state.expenseAccounts]);

    const stockGradeDistributionData = useMemo(() => {
        const stockByCategory: { [categoryId: string]: number } = {};
        const stockByItem = new Map<string, number>();
        state.items.forEach(item => {
            const production = state.productions.filter(p => p.itemId === item.id).reduce((sum, p) => sum + p.quantityProduced, 0);
            const sales = state.salesInvoices.filter(inv => inv.status !== InvoiceStatus.Unposted).flatMap(inv => inv.items).filter(i => i.itemId === item.id).reduce((sum, i) => sum + i.quantity, 0);
            stockByItem.set(item.id, production - sales);
        });
        state.items.forEach(item => {
            const stock = stockByItem.get(item.id) || 0;
            const packingWeight = item.packingType === PackingType.Bales ? item.baleSize : 1;
            if (stock > 0) stockByCategory[item.categoryId] = (stockByCategory[item.categoryId] || 0) + (stock * packingWeight);
        });
        const sortedCategories = Object.entries(stockByCategory).sort(([, a], [, b]) => b - a);
        const top3 = sortedCategories.slice(0, 3);
        const others = sortedCategories.slice(3);
        const chartData = top3.map(([categoryId, value]) => ({ name: state.categories.find(c => c.id === categoryId)?.name || categoryId, value }));
        if (others.length > 0) chartData.push({ name: 'Other', value: others.reduce((sum, [, value]) => sum + value, 0) });
        return chartData;
    }, [state.items, state.productions, state.salesInvoices, state.categories]);

    const KpiCards = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-cyan-500"><h2 className="text-sm font-medium text-gray-400">Gross Sales Revenue</h2><p className="text-3xl font-bold text-gray-100 mt-2">${formatKpiValue(grossSalesRevenue)}</p></div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-green-500"><h2 className="text-sm font-medium text-gray-400">Active Stock Units</h2><p className="text-3xl font-bold text-gray-100 mt-2">{formatKpiValue(activeStockUnits)}</p></div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-blue-500"><h2 className="text-sm font-medium text-gray-400">New Customers This Month</h2><p className="text-3xl font-bold text-gray-100 mt-2">{newCustomersThisMonth}</p></div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-indigo-500"><h2 className="text-sm font-medium text-gray-400">Gross Margin</h2><p className="text-3xl font-bold text-gray-100 mt-2">{grossMarginPercentage.toFixed(1)}%</p></div>
        </div>
    );
    
    const Recharts = (window as any).Recharts;

    const ChartPlaceholder = ({ title }: { title: string }) => (
        <div className="flex items-center justify-center h-full min-h-[300px] w-full text-gray-400">
            <p>{title}</p>
        </div>
    );
    
    if (!Recharts || !Recharts.ResponsiveContainer) {
        return (
            <div className="bg-gray-900 text-white min-h-screen p-6 -m-8">
                <h1 className="text-3xl font-bold text-gray-200 mb-6">Analytics Dashboard</h1>
                <KpiCards />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-h-[360px]"><h3 className="text-lg font-semibold text-gray-300 mb-4">Monthly Sales Trend</h3><ChartPlaceholder title="Loading Chart Library..." /></div>
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-h-[360px]"><h3 className="text-lg font-semibold text-gray-300 mb-4">Production Batches vs. Target (Last 5 Weeks)</h3><ChartPlaceholder title="Loading Chart Library..." /></div>
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-h-[360px]"><h3 className="text-lg font-semibold text-gray-300 mb-4">Monthly Expense Breakdown</h3><ChartPlaceholder title="Loading Chart Library..." /></div>
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-h-[360px]"><h3 className="text-lg font-semibold text-gray-300 mb-4">Stock Distribution by Grade (Top 3 + Other)</h3><ChartPlaceholder title="Loading Chart Library..." /></div>
                </div>
            </div>
        );
    }
    
    const { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = Recharts;
    
    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        if (percent < 0.05) return null;
        return (<text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="bold">{`${(percent * 100).toFixed(0)}%`}</text>);
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen p-6 -m-8">
            <h1 className="text-3xl font-bold text-gray-200 mb-6">Analytics Dashboard</h1>
            <KpiCards />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-h-[360px]">
                    <h3 className="text-lg font-semibold text-gray-300 mb-4">Monthly Sales Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={monthlySalesData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${formatKpiValue(value)}`} />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563' }} />
                            <Legend wrapperStyle={{ color: '#d1d5db' }} />
                            <Line type="monotone" dataKey="Sales" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-h-[360px]">
                    <h3 className="text-lg font-semibold text-gray-300 mb-4">Production Batches vs. Target (Last 5 Weeks)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={productionVsTargetData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563' }} />
                            <Legend wrapperStyle={{ color: '#d1d5db' }} />
                            <Bar dataKey="Target" fill="#4b5563" />
                            <Bar dataKey="Actual" fill="#22c55e" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-h-[360px]">
                    <h3 className="text-lg font-semibold text-gray-300 mb-4">Monthly Expense Breakdown</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyExpenseData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${formatKpiValue(value)}`} />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563' }} formatter={(value: number) => `$${value.toLocaleString()}`} />
                            <Legend wrapperStyle={{ color: '#d1d5db' }} />
                            <Bar dataKey="operational" stackId="a" name="Operational" fill="#3b82f6" />
                            <Bar dataKey="payroll" stackId="a" name="Payroll" fill="#8b5cf6" />
                            <Bar dataKey="marketing" stackId="a" name="Marketing" fill="#ec4899" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg min-h-[360px]">
                    <h3 className="text-lg font-semibold text-gray-300 mb-4">Stock Distribution by Grade (Top 3 + Other)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={stockGradeDistributionData} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} outerRadius={120} fill="#8884d8" dataKey="value">
                                {stockGradeDistributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563' }} formatter={(value: number) => `${value.toLocaleString()} Kg`} />
                            <Legend wrapperStyle={{ color: '#d1d5db' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
