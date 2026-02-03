import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { PackingMaterialItem, PackingMaterialPurchase, UserProfile, JournalEntry, JournalEntryType, Currency } from '../types.ts';
import { generatePackingMaterialItemId, generatePackingMaterialPurchaseId } from '../utils/idGenerator.ts';
import Modal from './ui/Modal.tsx';
import CurrencyInput from './ui/CurrencyInput.tsx';

// A simplified CRUD component for managing packing material items
const PackingMaterialSetup: React.FC<{ items: PackingMaterialItem[], dispatch: React.Dispatch<any>, showNotification: (msg: string) => void }> = ({ items, dispatch, showNotification }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<PackingMaterialItem>>({});

    const handleOpenModal = (item: PackingMaterialItem | null = null) => {
        if (item) {
            setCurrentItem({ ...item });
            setIsEditing(true);
        } else {
            setCurrentItem({ name: '', unit: 'Roll', openingStock: 0 });
            setIsEditing(false);
        }
        setIsOpen(true);
    };

    const handleSave = () => {
        if (!currentItem.name || !currentItem.unit) {
            alert("Name and Unit are required.");
            return;
        }

        if (isEditing) {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'packingMaterialItems', data: currentItem } });
            showNotification('Item updated successfully.');
        } else {
            const newItem: PackingMaterialItem = {
                id: generatePackingMaterialItemId(items),
                name: currentItem.name,
                unit: currentItem.unit!,
                openingStock: Number(currentItem.openingStock) || 0,
            };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'packingMaterialItems', data: newItem } });
            showNotification('New packing material created.');
        }
        setIsOpen(false);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-700">Packing Material Definitions</h3>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold">Add New Material</button>
            </div>
            <table className="w-full text-left table-auto text-sm">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="p-2 font-semibold text-slate-600">ID</th>
                        <th className="p-2 font-semibold text-slate-600">Name</th>
                        <th className="p-2 font-semibold text-slate-600">Unit</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Opening Stock</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(item => (
                        <tr key={item.id} className="border-b">
                            <td className="p-2">{item.id}</td>
                            <td className="p-2">{item.name}</td>
                            <td className="p-2">{item.unit}</td>
                            <td className="p-2 text-right">{item.openingStock || 0}</td>
                            <td className="p-2 text-right">
                                <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:underline">Edit</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
             <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={isEditing ? "Edit Packing Material" : "Add New Packing Material"}>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Name</label><input type="text" value={currentItem.name || ''} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} className="w-full p-2 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Unit</label><select value={currentItem.unit || 'Roll'} onChange={e => setCurrentItem({...currentItem, unit: e.target.value as any})} className="w-full p-2 rounded-md"><option>Roll</option><option>Kg</option><option>Box</option><option>Pcs</option></select></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Opening Stock</label><input type="number" value={currentItem.openingStock || 0} onChange={e => setCurrentItem({...currentItem, openingStock: Number(e.target.value)})} className="w-full p-2 rounded-md" /></div>
                    <div className="flex justify-end gap-2 pt-4"><button onClick={() => setIsOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button><button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md">Save</button></div>
                </div>
            </Modal>
        </div>
    );
};

const PackingMaterialPurchaseForm: React.FC<{ showNotification: (msg: string) => void, userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
    const getInitialState = () => ({
        date: new Date().toISOString().split('T')[0],
        vendorId: '',
        itemId: '',
        quantity: '',
        rate: '',
    });
    const [formData, setFormData] = useState(getInitialState());
    const [currencyData, setCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { date, vendorId, itemId, quantity, rate } = formData;
        if (!date || !vendorId || !itemId || !quantity || !rate) {
            alert("All fields are required.");
            return;
        }

        const quantityNum = Number(quantity);
        const rateNum = Number(rate);
        const totalAmountUSD = quantityNum * rateNum * currencyData.conversionRate;
        const purchaseId = generatePackingMaterialPurchaseId(state.nextPackingMaterialPurchaseNumber);

        const newPurchase: PackingMaterialPurchase = {
            id: purchaseId, date, vendorId, itemId, quantity: quantityNum, rate: rateNum,
            currency: currencyData.currency, conversionRate: currencyData.conversionRate, totalAmountUSD,
        };

        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'packingMaterialPurchases', data: newPurchase } });

        const vendorName = state.vendors.find(v => v.id === vendorId)?.name;
        const itemName = state.packingMaterialItems.find(i => i.id === itemId)?.name;
        const description = `Packing Material Purchase: ${itemName} from ${vendorName}`;
        
        const debitEntry: JournalEntry = { id: `je-d-pmp-${purchaseId}`, voucherId: purchaseId, date, entryType: JournalEntryType.Journal, account: 'INV-PM-001', debit: totalAmountUSD, credit: 0, description, createdBy: userProfile?.uid };
        const creditEntry: JournalEntry = { id: `je-c-pmp-${purchaseId}`, voucherId: purchaseId, date, entryType: JournalEntryType.Journal, account: 'AP-001', debit: 0, credit: totalAmountUSD, description, entityId: vendorId, entityType: 'vendor', createdBy: userProfile?.uid };

        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });

        showNotification("Purchase recorded successfully.");
        setFormData(getInitialState());
    };
    
    return (
        <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4">New Packing Material Purchase</h3>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label><select value={formData.vendorId} onChange={e => setFormData({...formData, vendorId: e.target.value})} className="w-full p-2 rounded-md"><option value="">Select</option>{state.vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Material</label><select value={formData.itemId} onChange={e => setFormData({...formData, itemId: e.target.value})} className="w-full p-2 rounded-md"><option value="">Select</option>{state.packingMaterialItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full p-2 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Rate (per unit)</label><input type="number" step="0.01" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} className="w-full p-2 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Currency</label><CurrencyInput value={currencyData} onChange={setCurrencyData} /></div>
                </div>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md">Save Purchase</button>
            </form>
        </div>
    );
};

const PackingMaterialStockReport: React.FC = () => {
    const { state } = useData();
    const stockData = useMemo(() => {
        const stock: { [itemId: string]: number } = {};
        state.packingMaterialItems.forEach(item => {
            stock[item.id] = item.openingStock || 0;
        });
        state.packingMaterialPurchases.forEach(purchase => {
            stock[purchase.itemId] = (stock[purchase.itemId] || 0) + purchase.quantity;
        });
        // Consumption logic will be added here later
        return Object.entries(stock).map(([itemId, quantity]) => {
            const item = state.packingMaterialItems.find(i => i.id === itemId);
            return { item, quantity };
        }).filter(d => d.item);
    }, [state.packingMaterialItems, state.packingMaterialPurchases]);

    return (
         <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4">Stock In Hand</h3>
            <table className="w-full text-left table-auto text-sm">
                <thead><tr className="bg-slate-100"><th className="p-2 font-semibold text-slate-600">Material</th><th className="p-2 font-semibold text-slate-600 text-right">Quantity In Hand</th><th className="p-2 font-semibold text-slate-600">Unit</th></tr></thead>
                <tbody>
                    {stockData.map(({ item, quantity }) => (
                        <tr key={item!.id} className="border-b"><td className="p-2">{item!.name}</td><td className="p-2 text-right font-medium">{quantity.toLocaleString()}</td><td className="p-2">{item!.unit}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


const PackingMaterialModule: React.FC<{ userProfile: UserProfile | null, showNotification: (msg: string) => void }> = ({ userProfile, showNotification }) => {
    const { state, dispatch } = useData();
    const [view, setView] = useState<'setup' | 'purchase' | 'stock'>('stock');
    
    const getButtonClass = (v: 'setup' | 'purchase' | 'stock') => `px-4 py-2 rounded-md text-sm font-medium ${view === v ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`;

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-2 border-b pb-4">
                <h2 className="text-xl font-bold text-slate-700 mr-4">Packing Material Management</h2>
                <button onClick={() => setView('setup')} className={getButtonClass('setup')}>Setup</button>
                <button onClick={() => setView('purchase')} className={getButtonClass('purchase')}>Purchase</button>
                <button onClick={() => setView('stock')} className={getButtonClass('stock')}>Stock Report</button>
            </div>

            {view === 'setup' && <PackingMaterialSetup items={state.packingMaterialItems} dispatch={dispatch} showNotification={showNotification} />}
            {view === 'purchase' && <PackingMaterialPurchaseForm showNotification={showNotification} userProfile={userProfile} />}
            {view === 'stock' && <PackingMaterialStockReport />}
        </div>
    );
};

export default PackingMaterialModule;