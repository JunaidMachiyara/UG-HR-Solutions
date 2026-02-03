import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { OngoingOrderStatus, InvoiceStatus } from '../../types.ts';
import ItemSelector from '../ui/ItemSelector.tsx';

const OrderFulfillmentDashboard: React.FC = () => {
    const { state } = useData();
    const [filters, setFilters] = useState({
        customerId: '',
        itemId: '',
    });
    const [lookbackDays, setLookbackDays] = useState(30);

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const itemsInOpenOrders = useMemo(() => {
        const itemIds = new Set<string>();
        let activeOrders = state.ongoingOrders.filter(o => o.status === OngoingOrderStatus.Active || o.status === OngoingOrderStatus.PartiallyShipped);

        if (filters.customerId) {
            activeOrders = activeOrders.filter(o => o.customerId === filters.customerId);
        }

        activeOrders.forEach(order => {
            order.items.forEach(item => {
                if (item.quantity - item.shippedQuantity > 0) {
                    itemIds.add(item.itemId);
                }
            });
        });
        return state.items.filter(item => itemIds.has(item.id));
    }, [state.ongoingOrders, state.items, filters.customerId]);

    const { summaryData, detailedData } = useMemo(() => {
        const currentStock: { [itemId: string]: number } = {};
        state.items.forEach(item => {
            const production = state.productions.filter(p => p.itemId === item.id).reduce((sum, p) => sum + p.quantityProduced, 0);
            const sales = state.salesInvoices.filter(s => s.status !== InvoiceStatus.Unposted).flatMap(s => s.items).filter(i => i.itemId === item.id).reduce((sum, i) => sum + i.quantity, 0);
            currentStock[item.id] = (item.openingStock || 0) + production - sales;
        });

        let activeOrders = state.ongoingOrders.filter(o => o.status === OngoingOrderStatus.Active || o.status === OngoingOrderStatus.PartiallyShipped);
        
        if (filters.customerId) {
            activeOrders = activeOrders.filter(o => o.customerId === filters.customerId);
        }

        if (!filters.itemId) {
            const itemDemand: { [itemId: string]: number } = {};
            activeOrders.forEach(order => {
                order.items.forEach(item => {
                    const remaining = item.quantity - item.shippedQuantity;
                    if (remaining > 0) {
                        itemDemand[item.itemId] = (itemDemand[item.itemId] || 0) + remaining;
                    }
                });
            });

            const summary = itemsInOpenOrders.map(item => {
                const stock = currentStock[item.id] || 0;
                const demand = itemDemand[item.id] || 0;
                return {
                    itemId: item.id,
                    itemName: item.name,
                    totalDemand: demand,
                    currentStock: stock,
                    status: stock >= demand ? 'Sufficient Stock' : 'Shortfall'
                };
            });
            return { summaryData: summary, detailedData: null };
        }

        const selectedItemId = filters.itemId;

        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
        const lookbackDateString = lookbackDate.toISOString().split('T')[0];

        const productionInPeriod = state.productions
            .filter(p => p.itemId === selectedItemId && p.date >= lookbackDateString)
            .reduce((sum, p) => sum + p.quantityProduced, 0);
        
        const dailyProductionRate = lookbackDays > 0 ? productionInPeriod / lookbackDays : 0;
        
        const ordersForItem = activeOrders
            .map(order => {
                const item = order.items.find(i => i.itemId === selectedItemId);
                if (!item) return null;
                const remaining = item.quantity - item.shippedQuantity;
                if (remaining <= 0) return null;
                return {
                    orderId: order.id,
                    date: order.date,
                    customerName: state.customers.find(c => c.id === order.customerId)?.name || 'N/A',
                    remainingQty: remaining,
                };
            })
            .filter((o): o is NonNullable<typeof o> => o !== null)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let simulatedStock = currentStock[selectedItemId] || 0;
        let currentDate = new Date();
        const predictions: any[] = [];

        for (const order of ordersForItem) {
            let needed = order.remainingQty;
            const status = simulatedStock >= needed ? 'Completed' : 'In Process';
            const shortfall = status === 'Completed' ? 0 : needed - simulatedStock;
            let predictedDateStr = '';

            if (status === 'Completed') {
                simulatedStock -= needed;
                predictedDateStr = currentDate.toISOString().split('T')[0];
            } else {
                needed -= simulatedStock;
                simulatedStock = 0;
                
                if (dailyProductionRate > 0) {
                    const daysToProduce = Math.ceil(needed / dailyProductionRate);
                    currentDate.setDate(currentDate.getDate() + daysToProduce);
                    predictedDateStr = currentDate.toISOString().split('T')[0];
                } else {
                    predictedDateStr = 'Unknown';
                }
            }
            predictions.push({ ...order, predictedDate: predictedDateStr, status, shortfall });
        }
        
        const totalDemand = ordersForItem.reduce((sum, o) => sum + o.remainingQty, 0);

        const detail = {
            totalDemand,
            currentStock: currentStock[selectedItemId] || 0,
            productionRate: dailyProductionRate,
            predictionData: predictions,
        };

        return { summaryData: [], detailedData: detail };
    }, [filters, lookbackDays, state, itemsInOpenOrders]);
    
    const formatNumber = (num: number) => num.toLocaleString(undefined, { maximumFractionDigits: 1 });

    const renderSummaryView = () => (
        <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Items with Open Orders</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Item</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Total Demand</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Current Stock</th>
                            <th className="p-2 font-semibold text-slate-600">Status</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summaryData && summaryData.map(item => (
                            <tr key={item.itemId} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{item.itemName} ({item.itemId})</td>
                                <td className="p-2 text-slate-700 text-right">{formatNumber(item.totalDemand)}</td>
                                <td className="p-2 text-slate-700 text-right">{formatNumber(item.currentStock)}</td>
                                <td className="p-2">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.status === 'Sufficient Stock' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="p-2 text-center">
                                    <button onClick={() => handleFilterChange('itemId', item.itemId)} className="text-blue-600 hover:underline text-xs font-semibold">
                                        View Queue
                                    </button>
                                </td>
                            </tr>
                        ))}
                         {summaryData && summaryData.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center text-slate-500 py-6">
                                    No open orders match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderDetailedView = () => {
        if (!detailedData) return null;
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-blue-100 rounded-lg"><h4 className="text-sm font-semibold text-blue-700">Total Demand</h4><p className="text-2xl font-bold text-blue-800">{formatNumber(detailedData.totalDemand)}</p></div>
                    <div className="p-4 bg-green-100 rounded-lg"><h4 className="text-sm font-semibold text-green-700">Current Stock</h4><p className="text-2xl font-bold text-green-800">{formatNumber(detailedData.currentStock)}</p></div>
                    <div className="p-4 bg-indigo-100 rounded-lg"><h4 className="text-sm font-semibold text-indigo-700">Avg. Daily Production</h4><p className="text-2xl font-bold text-indigo-800">{formatNumber(detailedData.productionRate)}</p></div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Fulfillment Queue</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-auto text-sm">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="p-2 font-semibold text-slate-600">Order Date</th>
                                    <th className="p-2 font-semibold text-slate-600">Order ID</th>
                                    <th className="p-2 font-semibold text-slate-600">Customer</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Un-shipped Qty</th>
                                    <th className="p-2 font-semibold text-slate-600">Status</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Shortfall</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Predicted Fulfillment Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailedData.predictionData.map(order => (
                                    <tr key={order.orderId} className="border-b hover:bg-slate-50">
                                        <td className="p-2 text-slate-700">{order.date}</td>
                                        <td className="p-2 text-slate-700 font-mono">{order.orderId}</td>
                                        <td className="p-2 text-slate-700">{order.customerName}</td>
                                        <td className="p-2 text-slate-700 text-right">{formatNumber(order.remainingQty)}</td>
                                        <td className="p-2">
                                             <span className={`px-2 py-1 text-xs font-semibold rounded-full ${order.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className={`p-2 text-right font-medium ${order.shortfall > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                            {order.shortfall > 0 ? formatNumber(order.shortfall) : ''}
                                        </td>
                                        <td className="p-2 text-slate-700 text-right font-medium">{order.predictedDate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800">Order Fulfillment Dashboard</h2>
                {filters.itemId && (
                    <button
                        onClick={() => handleFilterChange('itemId', '')}
                        className="flex items-center px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Summary
                    </button>
                )}
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex-grow min-w-[250px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Customer</label>
                    <select value={filters.customerId} onChange={e => handleFilterChange('customerId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="">All Customers</option>
                        {state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex-grow min-w-[300px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Item</label>
                    <ItemSelector
                        items={itemsInOpenOrders}
                        selectedItemId={filters.itemId}
                        onSelect={(itemId) => handleFilterChange('itemId', itemId)}
                        placeholder="All Items with Open Orders"
                    />
                </div>
                {filters.itemId && (
                    <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">Production Lookback</label>
                         <select value={lookbackDays} onChange={e => setLookbackDays(Number(e.target.value))} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                            <option value={7}>7 Days</option>
                            <option value={15}>15 Days</option>
                            <option value={30}>30 Days</option>
                            <option value={60}>60 Days</option>
                         </select>
                    </div>
                )}
            </div>
            
            {filters.itemId ? renderDetailedView() : renderSummaryView()}
        </div>
    );
};

export default OrderFulfillmentDashboard;