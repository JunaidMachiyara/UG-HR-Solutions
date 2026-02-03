import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext.tsx';
import { generateOngoingOrderId, generateInvoiceId } from '../utils/idGenerator.ts';
import { OngoingOrderItem, OngoingOrder, OngoingOrderStatus, PackingType, Module, UserProfile, InvoiceStatus, SalesInvoice, InvoiceItem, JournalEntry, JournalEntryType, Currency } from '../types.ts';
import Modal from './ui/Modal.tsx';
import ItemSelector from './ui/ItemSelector.tsx';
import CurrencyInput from './ui/CurrencyInput.tsx';
import EntitySelector from './ui/EntitySelector.tsx';

// FIX: Added a Notification component to handle its own timeout via useEffect, preventing memory leaks.
const Notification: React.FC<{ message: string; onTimeout: () => void }> = ({ message, onTimeout }) => {
    useEffect(() => {
        const timer = setTimeout(onTimeout, 3000);
        return () => clearTimeout(timer);
    }, [onTimeout]);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out">
            {message}
        </div>
    );
};

interface OngoingOrdersProps {
    setModule: (module: Module) => void;
    userProfile: UserProfile | null;
}

const OngoingOrdersModule: React.FC<OngoingOrdersProps> = ({ userProfile }) => {
    const { state, dispatch } = useData();
    const [subModule, setSubModule] = useState<'new' | 'list'>('new');
    const [notification, setNotification] = useState<string | null>(null);
    const [orderToShip, setOrderToShip] = useState<OngoingOrder | null>(null);

    const showNotification = (message: string) => {
        setNotification(message);
    };

    const handleOrderShipped = () => {
        setOrderToShip(null);
        showNotification("Order converted to unposted invoice successfully!");
        setSubModule('list');
    };

    return (
        <div className="space-y-6">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
            
            <div className="bg-white p-4 rounded-lg shadow-md flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-700 mr-4">Ongoing Orders</h2>
                <button onClick={() => setSubModule('new')} className={`px-4 py-2 text-sm font-medium rounded-md ${subModule === 'new' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>New Order</button>
                <button onClick={() => setSubModule('list')} className={`px-4 py-2 text-sm font-medium rounded-md ${subModule === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>Order List</button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                {subModule === 'new' && <NewOrderForm showNotification={showNotification} onSaveSuccess={() => setSubModule('list')} userProfile={userProfile} />}
                {subModule === 'list' && <OrderList onShipOrder={setOrderToShip} />}
            </div>

            {orderToShip && (
                <ShipmentModal
                    order={orderToShip}
                    isOpen={!!orderToShip}
                    onClose={() => setOrderToShip(null)}
                    onShipmentSuccess={handleOrderShipped}
                    userProfile={userProfile}
                />
            )}
        </div>
    );
};

// ... a lot more code will go here for the sub-components
const NewOrderForm: React.FC<{ showNotification: (msg: string) => void, onSaveSuccess: () => void, userProfile: UserProfile | null }> = ({ showNotification, onSaveSuccess, userProfile }) => {
    const { state, dispatch } = useData();
    const [customerId, setCustomerId] = useState('');
    const [orderId, setOrderId] = useState('');
    const [orderDate, setOrderDate] = useState('');
    const [currentItemId, setCurrentItemId] = useState('');
    const [currentQuantity, setCurrentQuantity] = useState<number | ''>('');
    const [currentOrderItems, setCurrentOrderItems] = useState<Omit<OngoingOrderItem, 'shippedQuantity'>[]>([]);

    const customerRef = useRef<HTMLSelectElement>(null);
    const itemRef = useRef<HTMLInputElement>(null);
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (customerId && !orderId) {
            setOrderId(generateOngoingOrderId(state.nextOngoingOrderNumber));
            setOrderDate(new Date().toISOString().split('T')[0]);
        }
    }, [customerId, orderId, state.nextOngoingOrderNumber]);

    const resetOrder = () => {
        setCustomerId(''); setOrderId(''); setOrderDate(''); setCurrentItemId('');
        setCurrentQuantity(''); setCurrentOrderItems([]);
    };

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentItemId || !currentQuantity || currentQuantity <= 0) return;
        setCurrentOrderItems([...currentOrderItems, { itemId: currentItemId, quantity: Number(currentQuantity) }]);
        setCurrentItemId(''); setCurrentQuantity('');
        itemRef.current?.focus();
    };

    const handleDeleteItem = (indexToDelete: number) => {
        setCurrentOrderItems(currentOrderItems.filter((_, index) => index !== indexToDelete));
    };

    const handleSaveOrder = () => {
        if (!customerId || currentOrderItems.length === 0) {
            alert("Please select a customer and add at least one item.");
            return;
        }

        const { totalBales, totalKg } = currentOrderItems.reduce((acc, item) => {
            const itemDetails = state.items.find(i => i.id === item.itemId);
            if (itemDetails) {
                if (itemDetails.packingType === PackingType.Bales) {
                    acc.totalBales += item.quantity;
                    acc.totalKg += item.quantity * itemDetails.baleSize;
                } else {
                    acc.totalKg += item.quantity;
                }
            }
            return acc;
        }, { totalBales: 0, totalKg: 0 });

        const newOrder: OngoingOrder = {
            id: orderId, date: orderDate, customerId,
            items: currentOrderItems.map(item => ({ ...item, shippedQuantity: 0 })),
            status: OngoingOrderStatus.Active, totalBales, totalKg
        };

        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'ongoingOrders', data: newOrder } });
        showNotification("New order booked successfully!");
        resetOrder();
        onSaveSuccess();
    };

    return (
        <div className="space-y-6">
             <h2 className="text-2xl font-bold text-slate-700">Book New Order</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Customer</label>
                    <EntitySelector
                        entities={state.customers}
                        selectedEntityId={customerId}
                        onSelect={setCustomerId}
                        placeholder="Search Customers..."
                        disabled={!!orderId}
                        inputRef={customerRef as any}
                    />
                </div>
                <div><label className="block text-sm font-medium text-slate-700">Order ID</label><input type="text" value={orderId} readOnly className="mt-1 w-full p-2 border border-slate-300 rounded-md bg-slate-200"/></div>
                <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} disabled={!orderId} min={minDate} className="mt-1 w-full p-2 border border-slate-300 rounded-md disabled:bg-slate-200"/></div>
            </div>

            {orderId && (
                <>
                    <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-md bg-slate-50">
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Item</label><ItemSelector inputRef={itemRef} items={state.items} selectedItemId={currentItemId} onSelect={setCurrentItemId}/></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input type="number" value={currentQuantity} onChange={e => setCurrentQuantity(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 border border-slate-300 rounded-md"/></div>
                        <button type="submit" className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 h-10">Add Item</button>
                    </form>
                    
                    {currentOrderItems.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-slate-600 mb-2">Order Items</h3>
                            <ul className="space-y-2">
                                {currentOrderItems.map((item, index) => {
                                    const itemDetails = state.items.find(i => i.id === item.itemId);
                                    return (
                                    <li key={index} className="flex justify-between items-center p-2 bg-white border rounded-md">
                                        <span className="text-slate-800">{itemDetails?.name} - Qty: {item.quantity}</span>
                                        <button onClick={() => handleDeleteItem(index)} className="text-red-500 hover:text-red-700">Remove</button>
                                    </li>)
                                })}
                            </ul>
                            <div className="flex justify-end mt-4">
                                <button onClick={handleSaveOrder} className="py-2 px-6 bg-green-600 text-white rounded-md hover:bg-green-700">Save Order</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const OrderList: React.FC<{ onShipOrder: (order: OngoingOrder) => void }> = ({ onShipOrder }) => {
    const { state } = useData();
    const [statusFilter, setStatusFilter] = useState<OngoingOrderStatus | 'All'>('All');

    const filteredOrders = useMemo(() => {
        return state.ongoingOrders
            .filter(order => statusFilter === 'All' || order.status === statusFilter)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.ongoingOrders, statusFilter]);

    const getStatusColor = (status: OngoingOrderStatus) => {
        switch (status) {
            case OngoingOrderStatus.Active: return 'bg-blue-100 text-blue-800';
            case OngoingOrderStatus.PartiallyShipped: return 'bg-yellow-100 text-yellow-800';
            case OngoingOrderStatus.Completed: return 'bg-green-100 text-green-800';
            case OngoingOrderStatus.Cancelled: return 'bg-red-100 text-red-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-700">Order List</h2>
                <div>
                    <label className="text-sm font-medium text-slate-700 mr-2">Filter by Status:</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="p-2 border border-slate-300 rounded-md text-sm">
                        <option value="All">All</option>
                        {Object.values(OngoingOrderStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead><tr className="bg-slate-100"><th className="p-3 font-semibold text-slate-600">Order ID</th><th className="p-3 font-semibold text-slate-600">Date</th><th className="p-3 font-semibold text-slate-600">Customer</th><th className="p-3 font-semibold text-slate-600">Status</th><th className="p-3 font-semibold text-slate-600 text-right">Actions</th></tr></thead>
                    <tbody>
                        {filteredOrders.map(order => (
                            <tr key={order.id} className="border-b hover:bg-slate-50">
                                <td className="p-3 text-slate-700 font-mono">{order.id}</td>
                                <td className="p-3 text-slate-700">{order.date}</td>
                                <td className="p-3 text-slate-700">{state.customers.find(c=>c.id === order.customerId)?.name}</td>
                                <td className="p-3"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>{order.status}</span></td>
                                <td className="p-3 text-right">
                                    {(order.status === OngoingOrderStatus.Active || order.status === OngoingOrderStatus.PartiallyShipped) && (
                                        <button onClick={() => onShipOrder(order)} className="py-1 px-3 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">Convert to Invoice</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </div>
    );
};

const ShipmentModal: React.FC<{ order: OngoingOrder, isOpen: boolean, onClose: () => void, onShipmentSuccess: () => void, userProfile: UserProfile | null }> = ({ order, isOpen, onClose, onShipmentSuccess, userProfile }) => {
    const { state, dispatch } = useData();
    
    type ShipmentItem = { itemId: string; name: string; ordered: number; shipped: number; remaining: number; toShip: number | ''; };
    const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([]);

    useEffect(() => {
        if (order) {
            const items = order.items.map(item => {
                const itemDetails = state.items.find(i => i.id === item.itemId);
                const remaining = item.quantity - item.shippedQuantity;
                return {
                    itemId: item.itemId,
                    name: itemDetails?.name || 'Unknown',
                    ordered: item.quantity,
                    shipped: item.shippedQuantity,
                    remaining,
                    toShip: remaining,
                };
            }).filter(item => item.remaining > 0);
            setShipmentItems(items);
        }
    }, [order, state.items]);
    
    const handleItemChange = (index: number, field: keyof ShipmentItem, value: any) => {
        const newItems = [...shipmentItems];
        (newItems[index] as any)[field] = value;
        setShipmentItems(newItems);
    };

    const handleConfirmShipment = () => {
        const itemsToShip = shipmentItems.filter(item => Number(item.toShip) > 0);
        if (itemsToShip.length === 0) {
            alert("Please enter a quantity to ship for at least one item.");
            return;
        }

        for (const item of itemsToShip) {
            if (Number(item.toShip) > item.remaining) {
                alert(`Cannot ship more than the remaining quantity for ${item.name}.`);
                return;
            }
        }
        
        // 1. Create UNPOSTED Sales Invoice
        const newInvoiceId = generateInvoiceId(state.nextInvoiceNumber);

        const newInvoiceItems: InvoiceItem[] = itemsToShip.map(item => ({
            itemId: item.itemId,
            quantity: Number(item.toShip),
            rate: undefined,
            currency: undefined,
            conversionRate: undefined,
        }));
        
        const { totalBales, totalKg } = newInvoiceItems.reduce((acc, item) => {
            const itemDetails = state.items.find(i => i.id === item.itemId)!;
            if (itemDetails.packingType === PackingType.Bales) { acc.totalBales += item.quantity; acc.totalKg += item.quantity * itemDetails.baleSize; }
            else { acc.totalKg += item.quantity; }
            return acc;
        }, { totalBales: 0, totalKg: 0 });
        
        const customer = state.customers.find(c => c.id === order.customerId);

        const newInvoice: SalesInvoice = {
            id: newInvoiceId,
            date: new Date().toISOString().split('T')[0],
            customerId: order.customerId,
            items: newInvoiceItems,
            status: InvoiceStatus.Unposted,
            sourceOrderId: order.id,
            totalBales,
            totalKg,
            divisionId: customer?.divisionId,
            subDivisionId: customer?.subDivisionId,
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'salesInvoices', data: newInvoice } });

        // 2. Update Ongoing Order
        const updatedOrderItems = order.items.map(origItem => {
            const shippedItem = itemsToShip.find(si => si.itemId === origItem.itemId);
            if (shippedItem) {
                return { ...origItem, shippedQuantity: origItem.shippedQuantity + Number(shippedItem.toShip) };
            }
            return origItem;
        });
        
        const isFullyShipped = updatedOrderItems.every(item => item.shippedQuantity >= item.quantity);
        const newStatus = isFullyShipped ? OngoingOrderStatus.Completed : OngoingOrderStatus.PartiallyShipped;

        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'ongoingOrders', data: { id: order.id, items: updatedOrderItems, status: newStatus } } });

        onShipmentSuccess();
    };
    
    const customer = state.customers.find(c => c.id === order.customerId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Convert Order to Invoice: ${order.id}`} size="5xl">
            <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm font-medium text-slate-500">Customer</p>
                        <p className="text-lg font-semibold text-slate-800">{customer?.name || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Order Date</p>
                        <p className="text-lg font-semibold text-slate-800">{order.date}</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left table-auto text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="p-3 font-semibold text-slate-700">Item</th>
                                <th className="p-3 font-semibold text-slate-700 text-right">Ordered</th>
                                <th className="p-3 font-semibold text-slate-700 text-right">Previously Shipped</th>
                                <th className="p-3 font-semibold text-slate-700 text-right">Remaining to Ship</th>
                                <th className="p-3 font-semibold text-slate-700 w-32">Quantity to Ship Now</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shipmentItems.map((item, index) => (
                            <tr key={item.itemId} className="border-b hover:bg-slate-50">
                                <td className="p-3 text-slate-800 align-middle font-medium">{item.name}</td>
                                <td className="p-3 text-slate-800 align-middle text-right">{item.ordered}</td>
                                <td className="p-3 text-slate-800 align-middle text-right">{item.shipped}</td>
                                <td className="p-3 text-blue-600 align-middle text-right font-bold">{item.remaining}</td>
                                <td className="p-3 align-middle">
                                    <input
                                        type="number"
                                        value={item.toShip}
                                        onChange={e => handleItemChange(index, 'toShip', e.target.value === '' ? '' : Number(e.target.value))}
                                        max={item.remaining}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end pt-4">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 mr-2">Cancel</button>
                    <button onClick={handleConfirmShipment} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Create Unposted Invoice</button>
                </div>
            </div>
        </Modal>
    );
};


export default OngoingOrdersModule;