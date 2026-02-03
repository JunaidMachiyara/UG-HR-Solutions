import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { OriginalOpening, Production, OriginalType, PackingType, UserProfile, Module, InvoiceStatus, Item, JournalEntry, JournalEntryType, Currency, SalesInvoice, OriginalPurchased, LogisticsEntry, LogisticsStatus, FinishedGoodsPurchase, DocumentStatus } from '../types.ts';
import { generateInvoiceId } from '../utils/idGenerator.ts';
import SalesInvoiceModule from './SalesInvoiceModule.tsx';
import OngoingOrdersModule from './OngoingOrdersModule.tsx';
import PurchasesModule from './PurchasesModule.tsx';
import ItemSelector from './ui/ItemSelector.tsx';
import Modal from './ui/Modal.tsx';
import StockLotModule from './StockLotModule.tsx';
import CurrencyInput from './ui/CurrencyInput.tsx';
import EntitySelector from './ui/EntitySelector.tsx';

const Notification: React.FC<{ message: string; onTimeout: () => void }> = ({ message, onTimeout }) => {
    useEffect(() => {
        const timer = setTimeout(onTimeout, 2000);
        return () => clearTimeout(timer);
    }, [onTimeout]);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out">
            {message}
        </div>
    );
};

const OriginalOpeningForm: React.FC<{ showNotification: (msg: string) => void; userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], supplierId: '', subSupplierId: '', originalTypeId: '', originalProductId: '', opened: '' });
    
    const [totalKg, setTotalKg] = useState(0);
    const [availableStock, setAvailableStock] = useState(0);
    const supplierRef = useRef<HTMLSelectElement>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<OriginalOpening | null>(null);
    
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

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

    const availableSuppliers = useMemo(() => {
        const supplierIdsWithStock = new Set<string>();
        for (const key of stockByCombination.keys()) {
            const stock = stockByCombination.get(key) || 0;
            if (stock > 0) {
                supplierIdsWithStock.add(key.split('|')[0]);
            }
        }
        return state.suppliers.filter(s => supplierIdsWithStock.has(s.id));
    }, [stockByCombination, state.suppliers]);

    const availableSubSuppliers = useMemo(() => {
        if (!formData.supplierId) return [];
        const subSupplierIdsWithStock = new Set<string>();
        for (const key of stockByCombination.keys()) {
             const stock = stockByCombination.get(key) || 0;
             if (stock > 0) {
                const [supId, subSupId] = key.split('|');
                if (supId === formData.supplierId && subSupId !== 'none') {
                    subSupplierIdsWithStock.add(subSupId);
                }
             }
        }
        return state.subSuppliers.filter(ss => ss.supplierId === formData.supplierId && subSupplierIdsWithStock.has(ss.id));
    }, [formData.supplierId, stockByCombination, state.subSuppliers]);

     const availableOriginalTypes = useMemo(() => {
        if (!formData.supplierId) return [];
        const typeIdsWithStock = new Set<string>();
        for (const key of stockByCombination.keys()) {
            const stock = stockByCombination.get(key) || 0;
             if (stock > 0) {
                const [supId, subSupId, typeId] = key.split('|');
                if (supId === formData.supplierId && (subSupId === (formData.subSupplierId || 'none'))) {
                    typeIdsWithStock.add(typeId);
                }
             }
        }
        return state.originalTypes.filter(ot => typeIdsWithStock.has(ot.id));
    }, [formData.supplierId, formData.subSupplierId, stockByCombination, state.originalTypes]);

    const availableOriginalProducts = useMemo(() => {
        if (!formData.originalTypeId) return [];
        const productIdsWithStock = new Set<string>();
        for (const key of stockByCombination.keys()) {
            const stock = stockByCombination.get(key) || 0;
            if (stock > 0) {
                const [supId, subSupId, typeId, prodId] = key.split('|');
                if (supId === formData.supplierId && subSupId === (formData.subSupplierId || 'none') && typeId === formData.originalTypeId && prodId !== 'none') {
                    productIdsWithStock.add(prodId);
                }
            }
        }
        return state.originalProducts.filter(op => op.originalTypeId === formData.originalTypeId && productIdsWithStock.has(op.id));
    }, [formData.supplierId, formData.subSupplierId, formData.originalTypeId, stockByCombination, state.originalProducts]);

    useEffect(() => {
        setFormData(f => ({ ...f, subSupplierId: '', originalTypeId: '', originalProductId: '', opened: '' }));
    }, [formData.supplierId]);

    useEffect(() => {
        setFormData(f => ({ ...f, originalTypeId: '', originalProductId: '', opened: '' }));
    }, [formData.subSupplierId]);
    
    useEffect(() => {
        setFormData(f => ({ ...f, originalProductId: '', opened: '' }));
    }, [formData.originalTypeId]);

    useEffect(() => {
        const key = `${formData.supplierId || 'none'}|${formData.subSupplierId || 'none'}|${formData.originalTypeId || 'none'}|${formData.originalProductId || 'none'}`;
        const stock = stockByCombination.get(key) || 0;
        setAvailableStock(stock);
    }, [formData.supplierId, formData.subSupplierId, formData.originalTypeId, formData.originalProductId, stockByCombination]);
    
    useEffect(() => {
        const openedValue = Number(formData.opened) || 0;
        const originalType = state.originalTypes.find(ot => ot.id === formData.originalTypeId);

        if (originalType && openedValue > 0) {
            if (originalType.packingType === PackingType.Bales || originalType.packingType === PackingType.Sacks) {
                setTotalKg(openedValue * (originalType.packingSize || 0));
            } else {
                setTotalKg(openedValue);
            }
        } else {
            setTotalKg(0);
        }
    }, [formData.opened, formData.originalTypeId, state.originalTypes]);

    const openingsForDate = useMemo(() => {
        return state.originalOpenings
            .filter(o => o.date === formData.date && o.supplierId !== 'SUP-INTERNAL-STOCK')
            .map(o => {
                const supplier = state.suppliers.find(s => s.id === o.supplierId);
                const subSupplier = state.subSuppliers.find(ss => ss.id === o.subSupplierId);
                const originalType = state.originalTypes.find(ot => ot.id === o.originalTypeId);
                const originalProduct = state.originalProducts.find(op => op.id === o.originalProductId);
                return {
                    ...o,
                    supplierName: supplier?.name || 'Unknown',
                    subSupplierName: subSupplier?.name,
                    originalTypeName: originalType?.name || 'Unknown',
                    originalProductName: originalProduct?.name,
                };
            })
            .reverse(); // Show latest entry first
    }, [formData.date, state.originalOpenings, state.suppliers, state.subSuppliers, state.originalTypes, state.originalProducts]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { date, supplierId, subSupplierId, originalTypeId, originalProductId, opened } = formData;
        const openedNum = Number(opened);

        if (!date || !supplierId || !originalTypeId || !opened || openedNum <= 0) {
            alert("Please fill all required fields correctly.");
            return;
        }

        if (openedNum > availableStock) {
            alert(`Warning: You are opening ${openedNum} units, but only ${availableStock} are available. This will result in negative stock.`);
        }

        const newOpening: OriginalOpening = {
            id: `oo_${Date.now()}`,
            date,
            supplierId,
            subSupplierId: subSupplierId || undefined,
            originalTypeId,
            originalProductId: originalProductId || undefined,
            opened: openedNum,
            totalKg: totalKg,
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'originalOpenings', data: newOpening } });
        
        // --- START: Automatic Journal Entry ---
        const relevantPurchases = state.originalPurchases.filter(p =>
            p.supplierId === newOpening.supplierId &&
            (p.subSupplierId || undefined) === (newOpening.subSupplierId || undefined) &&
            p.originalTypeId === newOpening.originalTypeId &&
            (p.originalProductId || undefined) === (newOpening.originalProductId || undefined)
        );
    
        if (relevantPurchases.length > 0) {
            let totalCostUSD = 0;
            let totalKgPurchased = 0;
    
            relevantPurchases.forEach(p => {
                const oType = state.originalTypes.find(ot => ot.id === p.originalTypeId);
                if (!oType) return;
                
                const purchaseKg = oType.packingType === PackingType.Kg ? p.quantityPurchased : p.quantityPurchased * oType.packingSize;
                if (purchaseKg > 0) {
                    const itemValueUSD = (p.quantityPurchased * p.rate) * (p.conversionRate || 1);
                    const freightUSD = (p.freightAmount || 0) * (p.freightConversionRate || 1);
                    const clearingUSD = (p.clearingAmount || 0) * (p.clearingConversionRate || 1);
                    const commissionUSD = (p.commissionAmount || 0) * (p.commissionConversionRate || 1);
                    const discountSurchargeUSD = p.discountSurcharge || 0;
                    const landedCostUSD = itemValueUSD + freightUSD + clearingUSD + commissionUSD + discountSurchargeUSD;
                    
                    totalCostUSD += landedCostUSD;
                    totalKgPurchased += purchaseKg;
                }
            });
    
            if (totalKgPurchased > 0) {
                const avgCostPerKg = totalCostUSD / totalKgPurchased;
                const openingValue = newOpening.totalKg * avgCostPerKg;
                
                if (openingValue > 0) {
                    const voucherId = `AUTO-OPEN-${newOpening.id}`;
                    const supplier = state.suppliers.find(s => s.id === newOpening.supplierId);
                    const description = `Cost of raw material opened for production from ${supplier?.name || newOpening.supplierId}`;
    
                    // DEBIT: Move value into inventory asset account
                    const debitEntry: JournalEntry = {
                        id: `je-d-open-${newOpening.id}`,
                        voucherId,
                        date: newOpening.date,
                        entryType: JournalEntryType.Journal,
                        account: 'INV-FG-001', // Finished Goods Inventory
                        debit: openingValue,
                        credit: 0,
                        description,
                        createdBy: userProfile?.uid
                    };
                    
                    // CREDIT: Reduce the temporary purchases expense account
                    const creditEntry: JournalEntry = {
                        id: `je-c-open-${newOpening.id}`,
                        voucherId,
                        date: newOpening.date,
                        entryType: JournalEntryType.Journal,
                        account: 'EXP-004', // Raw Material Purchases
                        debit: 0,
                        credit: openingValue,
                        description,
                        createdBy: userProfile?.uid
                    };
                    
                    dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
                    dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
                }
            }
        }
        // --- END: Automatic Journal Entry ---


        setFormData({ ...formData, opened: '' }); // Keep selections, clear quantity
        showNotification("Data Submitted & Journal Entry Posted");
    };
    
    const handleOpenEditModal = (opening: OriginalOpening) => {
        setEditingItem(opening);
        setIsEditModalOpen(true);
    };
    
    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingItem(null);
    };

    const handleUpdateOpening = () => {
        if (!editingItem) return;
        
        const openedNum = Number(editingItem.opened);
        if (isNaN(openedNum) || openedNum <= 0) {
            alert("Please enter a valid, positive quantity.");
            return;
        }
        
        const originalOpening = state.originalOpenings.find(o => o.id === editingItem.id);
        if (!originalOpening) return;

        const key = `${originalOpening.supplierId || 'none'}|${originalOpening.subSupplierId || 'none'}|${originalOpening.originalTypeId || 'none'}|${originalOpening.originalProductId || 'none'}`;
        const currentStock = stockByCombination.get(key) || 0;
        const availableStockForEdit = currentStock + originalOpening.opened;

        if (openedNum > availableStockForEdit) {
           alert(`Warning: You are updating to ${openedNum} units, but only ${availableStockForEdit} are available in total for this combination. This will result in negative stock.`);
        }
        
        const originalType = state.originalTypes.find(ot => ot.id === originalOpening.originalTypeId);
        let newTotalKg = 0;
        if (originalType) {
            if (originalType.packingType === PackingType.Bales || originalType.packingType === PackingType.Sacks) {
                newTotalKg = openedNum * (originalType.packingSize || 0);
            } else {
                newTotalKg = openedNum;
            }
        }

        dispatch({
            type: 'UPDATE_ENTITY',
            payload: {
                entity: 'originalOpenings',
                data: { id: editingItem.id, opened: openedNum, totalKg: newTotalKg }
            }
        });
        handleCloseEditModal();
        showNotification("Entry updated successfully.");
    };

    const handleDeleteOpening = (id: string) => {
        if (window.confirm("Are you sure you want to delete this opening entry? This will return the items to raw material stock.")) {
            dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'originalOpenings', id } });
            showNotification("Entry deleted successfully.");
        }
    };

    const getFullCombinationName = (item: OriginalOpening) => {
        const supplier = state.suppliers.find(s => s.id === item.supplierId)?.name;
        const subSupplier = state.subSuppliers.find(s => s.id === item.subSupplierId)?.name;
        const type = state.originalTypes.find(s => s.id === item.originalTypeId)?.name;
        const product = state.originalProducts.find(s => s.id === item.originalProductId)?.name;
        return [supplier, subSupplier, type, product].filter(Boolean).join(' / ');
    };
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-10 gap-8">
            <div className="md:col-span-3">
                 <h3 className="text-lg font-bold text-slate-700 mb-4">New Opening Entry</h3>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} min={minDate} className="mt-1 w-full p-2 rounded-md"/></div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Supplier</label>
                        <EntitySelector
                            entities={availableSuppliers}
                            selectedEntityId={formData.supplierId}
                            onSelect={(id) => setFormData(prev => ({ ...prev, supplierId: id }))}
                            placeholder="Search Suppliers..."
                        />
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700">Sub-Supplier</label><select value={formData.subSupplierId} onChange={e => setFormData({...formData, subSupplierId: e.target.value})} disabled={!formData.supplierId || availableSubSuppliers.length === 0} className="mt-1 w-full p-2 rounded-md"><option value="">None / Direct</option>{availableSubSuppliers.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700">Original Type</label><select value={formData.originalTypeId} onChange={e => setFormData({...formData, originalTypeId: e.target.value})} className="mt-1 w-full p-2 rounded-md" disabled={!formData.supplierId}><option value="">Select Type</option>{availableOriginalTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700">Original Product</label><select value={formData.originalProductId} onChange={e => setFormData({...formData, originalProductId: e.target.value})} className="mt-1 w-full p-2 rounded-md" disabled={!formData.originalTypeId || availableOriginalProducts.length === 0}><option value="">None / Not Applicable</option>{availableOriginalProducts.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select></div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Available Stock (units)</label>
                        <input type="number" value={availableStock} readOnly className="mt-1 w-full p-2 rounded-md bg-slate-200 text-slate-500" />
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700">Opened (units)</label><input type="number" value={formData.opened} onChange={e => setFormData({...formData, opened: e.target.value})} className="mt-1 w-full p-2 rounded-md" min="1" disabled={!formData.originalTypeId}/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Total Kg</label><input type="number" value={totalKg} readOnly className="mt-1 w-full p-2 rounded-md bg-slate-200 text-slate-500"/></div>
                    <button type="submit" className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">Submit The Entry</button>
                </form>
            </div>
            <div className="md:col-span-7">
                <h3 className="text-lg font-bold text-slate-700 mb-4">Entries for {formData.date}</h3>
                {openingsForDate.length > 0 ? (
                    <div className="overflow-y-auto border rounded-md max-h-96">
                        <table className="w-full text-left table-auto text-sm">
                            <thead className="sticky top-0 bg-slate-100 z-10">
                                <tr>
                                    <th className="p-2 font-semibold text-slate-600">Combination</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Opened</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Total Kg</th>
                                    {userProfile?.isAdmin && <th className="p-2 font-semibold text-slate-600 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {openingsForDate.map((op) => (
                                    <tr key={op.id} className="border-b hover:bg-slate-50">
                                        <td className="p-2 text-slate-700">{getFullCombinationName(op)}</td>
                                        <td className="p-2 text-slate-700 text-right font-medium">{op.opened.toLocaleString()}</td>
                                        <td className="p-2 text-slate-700 text-right">{op.totalKg.toLocaleString()}</td>
                                        {userProfile?.isAdmin && (
                                            <td className="p-2 text-right">
                                                <button onClick={() => handleOpenEditModal(op)} className="text-blue-600 hover:text-blue-800 mr-2 text-xs font-semibold">Edit</button>
                                                <button onClick={() => handleDeleteOpening(op.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Delete</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-slate-500 py-8 border rounded-md">No entries for this date yet.</div>
                )}
            </div>

             {editingItem && (
                <Modal isOpen={isEditModalOpen} onClose={handleCloseEditModal} title="Edit Opening Entry" isForm>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Stock Combination</label>
                            <p className="p-2 border border-slate-200 rounded-md bg-slate-100 text-slate-600">
                                {getFullCombinationName(editingItem)}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Opened (units)</label>
                             <input 
                                type="number" 
                                value={editingItem.opened} 
                                onChange={e => setEditingItem(prev => prev ? {...prev, opened: Number(e.target.value) || 0} : null)}
                                className="mt-1 w-full p-2 rounded-md"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end pt-4 space-x-2">
                            <button onClick={handleCloseEditModal} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                            <button onClick={handleUpdateOpening} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Changes</button>
                        </div>
                    </div>
                </Modal>
             )}
        </div>
    );
};

const BalesOpeningForm: React.FC<{ showNotification: (msg: string) => void; userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], itemId: '', opened: '' });
    const [totalKg, setTotalKg] = useState(0);
    const [availableStock, setAvailableStock] = useState(0);
    const [stagedBaleOpenings, setStagedBaleOpenings] = useState<(OriginalOpening & { originalTypeName: string })[]>([]);

    const itemStock = useMemo(() => {
        const stockMap = new Map<string, number>();
        state.items.forEach(item => {
            const production = state.productions.filter(p => p.itemId === item.id).reduce((sum, p) => sum + p.quantityProduced, 0);
            const sales = state.salesInvoices.filter(inv => inv.status !== InvoiceStatus.Unposted).flatMap(inv => inv.items).filter(i => i.itemId === item.id).reduce((sum, i) => sum + i.quantity, 0);
            stockMap.set(item.id, (item.openingStock || 0) + production - sales);
        });
        return stockMap;
    }, [state.items, state.productions, state.salesInvoices]);

    useEffect(() => {
        setAvailableStock(itemStock.get(formData.itemId) || 0);
        const item = state.items.find(i => i.id === formData.itemId);
        const openedValue = Number(formData.opened) || 0;
        if (item && openedValue > 0) {
            const packingSize = item.packingType === PackingType.Kg ? 1 : item.baleSize;
            setTotalKg(openedValue * packingSize);
        } else {
            setTotalKg(0);
        }
    }, [formData.itemId, formData.opened, itemStock, state.items]);

    const openingsForDate = useMemo(() => {
        const posted = state.originalOpenings
            .filter(o => o.date === formData.date && o.supplierId === 'SUP-INTERNAL-STOCK')
            .map(o => {
                const originalType = state.originalTypes.find(ot => ot.id === o.originalTypeId);
                return { ...o, originalTypeName: originalType?.name || 'Unknown', status: 'Posted' as const };
            });
        
        const staged = stagedBaleOpenings.map(o => ({...o, status: 'Staged' as const }));

        // Combine, sort by status (Staged first), then by ID (latest first)
        return [...staged, ...posted].sort((a, b) => {
            if (a.status === 'Staged' && b.status !== 'Staged') return -1;
            if (a.status !== 'Staged' && b.status === 'Staged') return 1;
            // For items with the same status, sort by ID descending (newer first)
            return b.id.localeCompare(a.id);
        });
    }, [formData.date, state.originalOpenings, state.originalTypes, stagedBaleOpenings]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { date, itemId, opened } = formData;
        const openedNum = Number(opened);
        const item = state.items.find(i => i.id === itemId);

        if (!date || !itemId || !opened || openedNum <= 0 || !item) {
            alert("Please fill all required fields correctly.");
            return;
        }

        if (openedNum > availableStock) {
            alert(`Cannot open ${openedNum} units. Only ${availableStock} are available in stock. This will result in negative stock.`);
        }
        
        const DUMMY_SUPPLIER_ID = 'SUP-INTERNAL-STOCK';
        const dummyOriginalTypeId = `OT-FROM-${item.id}`;

        const newStagedOpening: OriginalOpening & { originalTypeName: string } = {
            id: `staged_${Date.now()}`, // Temporary ID
            date,
            supplierId: DUMMY_SUPPLIER_ID,
            originalTypeId: dummyOriginalTypeId,
            opened: openedNum,
            totalKg: totalKg,
            batchNumber: `From Stock: ${item.name}`,
            originalTypeName: `${item.name} (from Stock)`, // For display
        };

        setStagedBaleOpenings(prev => [...prev, newStagedOpening]);
        showNotification("Bale opening added to list. Press 'Post All Staged Openings' to finalize.");
        setFormData({ ...formData, itemId: '', opened: '' });
    };

    const handleRemoveStaged = (stagedId: string) => {
        setStagedBaleOpenings(prev => prev.filter(o => o.id !== stagedId));
        showNotification("Staged entry removed.");
    };
    
    const handleDeleteBalesOpening = (openingId: string) => {
        if (!window.confirm("Are you sure you want to permanently delete this posted entry and all its associated stock and accounting transactions? This is an admin-only action and cannot be undone.")) {
            return;
        }
    
        const openingEntry = state.originalOpenings.find(o => o.id === openingId);
        if (!openingEntry) {
            showNotification("Error: Opening entry not found.");
            return;
        }
    
        const batchActions: any[] = [];
        const potentialTransactionIds = new Set<string>();
    
        // Step 1: Gather all possible linking IDs from the opening entry itself.
        potentialTransactionIds.add(openingId);
        if (openingEntry.transactionId) {
            potentialTransactionIds.add(openingEntry.transactionId);
        }
        if (openingId.startsWith('oo_')) {
            potentialTransactionIds.add(openingId.substring(3));
        }
    
        // Step 2: Find the associated production entry using any of the potential IDs.
        let productionEntryToDelete: Production | undefined;
        for (const id of potentialTransactionIds) {
            productionEntryToDelete = state.productions.find(p => p.id === `prod_deduct_${id}`);
            if (productionEntryToDelete) break;
        }
    
        if (productionEntryToDelete) {
            batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'productions', id: productionEntryToDelete.id } });
        }
    
        // Step 3: Find all associated journal entries using all potential IDs as voucher IDs.
        const journalEntriesToDelete = state.journalEntries.filter(je => {
            for (const id of potentialTransactionIds) {
                if (
                    je.voucherId === id ||
                    je.voucherId === `JV-${id}` ||
                    je.voucherId.includes(id) 
                ) {
                    return true;
                }
            }
            return false;
        });
    
        journalEntriesToDelete.forEach(je => {
            batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: je.id } });
        });
    
        // Step 4: Delete the dummy OriginalType if it exists.
        if (openingEntry.originalTypeId && openingEntry.originalTypeId.startsWith('OT-FROM-')) {
            const typeExists = state.originalTypes.some(ot => ot.id === openingEntry.originalTypeId);
            if (typeExists) {
                batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'originalTypes', id: openingEntry.originalTypeId } });
            }
        }
    
        // Step 5: Delete the opening entry itself.
        batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'originalOpenings', id: openingId } });
    
        // Step 6: Execute the batch dispatch.
        if (batchActions.length > 1) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
            showNotification(`Entry ${openingId} and ${batchActions.length - 1} associated records have been deleted.`);
        } else {
            dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'originalOpenings', id: openingId } });
            showNotification(`Warning: Only the opening entry was deleted. Associated records not found.`);
        }
    };

    const handlePostAllStaged = () => {
        if (stagedBaleOpenings.length === 0) return;

        const batchActions: any[] = [];
        
        stagedBaleOpenings.forEach(stagedOpening => {
            const item = state.items.find(i => stagedOpening.originalTypeId === `OT-FROM-${i.id}`);
            if (!item) return;

            let originalType = state.originalTypes.find(ot => ot.id === stagedOpening.originalTypeId);
            if (!originalType) {
                originalType = {
                    id: stagedOpening.originalTypeId,
                    name: `${item.name} (from Stock)`,
                    packingType: item.packingType,
                    packingSize: item.packingType === PackingType.Kg ? 1 : item.baleSize,
                };
                batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'originalTypes', data: originalType } });
            }

            const transactionId = `bale_open_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const newOpening: OriginalOpening = {
                id: `oo_${transactionId}`,
                date: stagedOpening.date,
                supplierId: stagedOpening.supplierId,
                originalTypeId: stagedOpening.originalTypeId,
                opened: stagedOpening.opened,
                totalKg: stagedOpening.totalKg,
                batchNumber: stagedOpening.batchNumber,
                transactionId: transactionId,
            };
            batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'originalOpenings', data: newOpening } });

            const negativeProduction: Production = {
                id: `prod_deduct_${transactionId}`,
                date: stagedOpening.date,
                itemId: item.id,
                quantityProduced: -stagedOpening.opened,
            };
            batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: negativeProduction } });

            const value = stagedOpening.totalKg * item.avgProductionPrice;
            if (value > 0) {
                const voucherId = `JV-${transactionId}`;
                const description = `Transfer from FG Stock to Raw Material: ${item.name}`;
                const debitEntry: JournalEntry = { id: `je-d-${voucherId}`, voucherId, date: stagedOpening.date, entryType: JournalEntryType.Journal, account: 'EXP-004', debit: value, credit: 0, description, createdBy: userProfile?.uid };
                const creditEntry: JournalEntry = { id: `je-c-${voucherId}`, voucherId, date: stagedOpening.date, entryType: JournalEntryType.Journal, account: 'INV-FG-001', debit: 0, credit: value, description, createdBy: userProfile?.uid };
                batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
                batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
            }
        });
        
        if (batchActions.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
        }

        showNotification(`${stagedBaleOpenings.length} bale opening(s) posted successfully.`);
        setStagedBaleOpenings([]);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-10 gap-8">
            <div className="md:col-span-3">
                 <h3 className="text-lg font-bold text-slate-700 mb-4">New Bales Opening</h3>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="mt-1 w-full p-2 rounded-md"/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Item</label><ItemSelector items={state.items} selectedItemId={formData.itemId} onSelect={id => setFormData({...formData, itemId: id})} /></div>
                    <div><label className="block text-sm font-medium text-slate-700">Available Stock (units)</label><input type="number" value={availableStock} readOnly className="mt-1 w-full p-2 rounded-md bg-slate-200 text-slate-500" /></div>
                    <div><label className="block text-sm font-medium text-slate-700">Opened (units)</label><input type="number" value={formData.opened} onChange={e => setFormData({...formData, opened: e.target.value})} className="mt-1 w-full p-2 rounded-md" min="1" disabled={!formData.itemId}/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Total Kg</label><input type="number" value={totalKg} readOnly className="mt-1 w-full p-2 rounded-md bg-slate-200 text-slate-500"/></div>
                    <button type="submit" className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add to List</button>
                </form>
            </div>
            <div className="md:col-span-7">
                <h3 className="text-lg font-bold text-slate-700 mb-4">Bale Openings for {formData.date}</h3>
                <div className="overflow-y-auto border rounded-md max-h-96">
                    <table className="w-full text-left table-auto text-sm">
                        <thead className="sticky top-0 bg-slate-100 z-10">
                            <tr>
                                <th className="p-2 font-semibold text-slate-600">Item Opened</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Opened (Units)</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Total Kg</th>
                                <th className="p-2 font-semibold text-slate-600 text-right">Status</th>
                                {userProfile?.isAdmin && <th className="p-2 font-semibold text-slate-600 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {openingsForDate.map(op => (
                                <tr key={op.id} className={`border-b hover:bg-slate-50 ${op.status === 'Staged' ? 'bg-yellow-50' : ''}`}>
                                    <td className="p-2 text-slate-700">{op.originalTypeName}</td>
                                    <td className="p-2 text-slate-700 text-right font-medium">{op.opened.toLocaleString()}</td>
                                    <td className="p-2 text-slate-700 text-right">{op.totalKg.toLocaleString()}</td>
                                    <td className="p-2 text-right">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${op.status === 'Staged' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                            {op.status}
                                        </span>
                                    </td>
                                    {userProfile?.isAdmin && (
                                        <td className="p-2 text-right">
                                            {op.status === 'Staged' ? (
                                                <button onClick={() => handleRemoveStaged(op.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Remove</button>
                                            ) : op.status === 'Posted' ? (
                                                <button onClick={() => handleDeleteBalesOpening(op.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Remove</button>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {openingsForDate.length === 0 && <div className="text-center text-slate-500 py-8">No bale openings for this date yet.</div>}
                </div>
                 <div className="mt-4 flex justify-end">
                    <button 
                        onClick={handlePostAllStaged} 
                        disabled={stagedBaleOpenings.length === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                        Post All Staged Openings ({stagedBaleOpenings.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProductionForm: React.FC<{ 
    showNotification: (msg: string) => void;
    requestSetupItem: () => void;
    userProfile: UserProfile | null;
}> = ({ showNotification, requestSetupItem, userProfile }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], itemId: '', quantityProduced: '' });
    const [error, setError] = useState<string | null>(null);

    type StagedProduction = Production & { itemName: string; itemCategory: string; packingType: PackingType; packingSize: number; };
    const [stagedProductions, setStagedProductions] = useState<StagedProduction[]>([]);
    const [tempNextBaleNumbers, setTempNextBaleNumbers] = useState<Record<string, number>>({});
    
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    type SummaryProductionItem = StagedProduction & { yesterdayPackages: number; totalKg: number };
    const [summaryData, setSummaryData] = useState<SummaryProductionItem[]>([]);
    const [isPreviousEntriesOpen, setIsPreviousEntriesOpen] = useState(false);

    const itemRef = useRef<HTMLInputElement>(null);
    const quantityRef = useRef<HTMLInputElement>(null);
    const minDate = (userProfile?.isAdmin || userProfile?.name?.toLowerCase().includes('tanveer')) ? '' : new Date().toISOString().split('T')[0];
    
    useEffect(() => {
        // When date changes, clear the staged productions for the new day
        setStagedProductions([]);
        setTempNextBaleNumbers({});
    }, [formData.date]);

    const previouslySavedProductions = useMemo(() => {
        return state.productions
            .filter(p => p.date === formData.date)
            .map(p => {
                const itemDetails = state.items.find(i => i.id === p.itemId);
                return {
                    ...p,
                    itemName: itemDetails?.name || 'N/A',
                    itemCategory: state.categories.find(c => c.id === itemDetails?.categoryId)?.name || 'N/A',
                };
            })
            .sort((a, b) => (a.startBaleNumber || 0) - (b.startBaleNumber || 0));
    }, [formData.date, state.productions, state.items, state.categories]);

    const handleAddToList = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const { date, itemId, quantityProduced } = formData;
        const quantityNum = Number(quantityProduced);

        if (!date || !itemId || !quantityProduced || quantityNum <= 0) {
            setError("Please fill all fields correctly.");
            return;
        }

        const itemDetails = state.items.find(i => i.id === itemId);
        if (!itemDetails) {
            setError("Selected item not found.");
            return;
        }

        let newProduction: StagedProduction = {
            id: `temp_${Date.now()}`,
            date, itemId, quantityProduced: quantityNum,
            itemName: itemDetails.name,
            itemCategory: state.categories.find(c => c.id === itemDetails.categoryId)?.name || 'N/A',
            packingType: itemDetails.packingType,
            packingSize: itemDetails.baleSize,
        };

        if (itemDetails.packingType === PackingType.Bales) {
            const startBaleNumber = tempNextBaleNumbers[itemId] || itemDetails.nextBaleNumber || 1;
            const endBaleNumber = startBaleNumber + quantityNum - 1;
            newProduction = { ...newProduction, startBaleNumber, endBaleNumber };
            setTempNextBaleNumbers(prev => ({ ...prev, [itemId]: endBaleNumber + 1 }));
        }

        setStagedProductions(prev => [...prev, newProduction]);
        setFormData({ ...formData, itemId: '', quantityProduced: '' });
        showNotification("Entry added to list.");
        itemRef.current?.focus();
    };
    
    const handleRemoveFromList = (idToRemove: string) => {
        const itemToRemove = stagedProductions.find(p => p.id === idToRemove);
        if (!itemToRemove) return;

        const newStagedProductions = stagedProductions.filter(p => p.id !== idToRemove);
        const itemDetails = state.items.find(i => i.id === itemToRemove.itemId);

        if (itemDetails?.packingType !== PackingType.Bales) {
            setStagedProductions(newStagedProductions);
            return;
        }

        const itemsOfSameType = newStagedProductions
            .filter(p => p.itemId === itemToRemove.itemId)
            .sort((a,b) => (a.startBaleNumber || 0) - (b.startBaleNumber || 0));

        if (itemsOfSameType.length > 0) {
            let currentBaleNumber = itemDetails.nextBaleNumber || 1;
            
            const updatedProductions = newStagedProductions.map(p => {
                if (p.itemId === itemToRemove.itemId) {
                    const start = currentBaleNumber;
                    const end = start + p.quantityProduced - 1;
                    currentBaleNumber = end + 1;
                    return { ...p, startBaleNumber: start, endBaleNumber: end };
                }
                return p;
            });
            setStagedProductions(updatedProductions);
            setTempNextBaleNumbers(prev => ({ ...prev, [itemToRemove.itemId]: currentBaleNumber }));
        } else {
            setStagedProductions(newStagedProductions);
            setTempNextBaleNumbers(prev => {
                const newTemp = { ...prev };
                delete newTemp[itemToRemove.itemId];
                return newTemp;
            });
        }
    };

    const prepareProductionSummary = () => {
        if (stagedProductions.length === 0) {
            showNotification("No entries to save.");
            return;
        }
    
        const currentDate = new Date(formData.date);
        currentDate.setDate(currentDate.getDate() - 1);
        const yesterdayStr = currentDate.toISOString().split('T')[0];
    
        const yesterdayProductions = state.productions.filter(p => p.date === yesterdayStr);
    
        const newSummaryData = stagedProductions.map(prod => {
            const yesterdayPackages = yesterdayProductions
                .filter(p => p.itemId === prod.itemId)
                .reduce((sum, p) => {
                    const itemDetails = state.items.find(i => i.id === p.itemId);
                    const isPackage = itemDetails && [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(itemDetails.packingType);
                    return isPackage ? sum + p.quantityProduced : sum;
                }, 0);
            
            const totalKg = prod.packingType !== PackingType.Kg ? prod.quantityProduced * prod.packingSize : prod.quantityProduced;
            
            return {
                ...prod,
                yesterdayPackages,
                totalKg
            };
        });
    
        setSummaryData(newSummaryData);
        setIsSummaryModalOpen(true);
    };
    
    const handleFinalizeProduction = () => {
        if (stagedProductions.length === 0) return;

        stagedProductions.forEach(prod => {
            const finalProd: Production = {
                id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                date: formData.date,
                itemId: prod.itemId,
                quantityProduced: prod.quantityProduced,
                startBaleNumber: prod.startBaleNumber,
                endBaleNumber: prod.endBaleNumber,
            };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: finalProd } });
        });

        for (const itemId in tempNextBaleNumbers) {
            dispatch({
                type: 'UPDATE_ENTITY',
                payload: { entity: 'items', data: { id: itemId, nextBaleNumber: tempNextBaleNumbers[itemId] } }
            });
        }

        setStagedProductions([]);
        setTempNextBaleNumbers({});
        showNotification(`${stagedProductions.length} production entries saved successfully.`);
        setIsSummaryModalOpen(false);
        setSummaryData([]);
    };

    const { totalPackagesForDate, totalKgForDate } = useMemo(() => {
        return stagedProductions.reduce((acc, prod) => {
            const isPackage = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(prod.packingType);

            if (isPackage) {
                acc.totalPackagesForDate += prod.quantityProduced;
                acc.totalKgForDate += prod.quantityProduced * prod.packingSize;
            } else { // It must be PackingType.Kg
                acc.totalKgForDate += prod.quantityProduced;
            }
            return acc;
        }, { totalPackagesForDate: 0, totalKgForDate: 0 });
    }, [stagedProductions]);
    
    const itemDetails = state.items.find(i => i.id === formData.itemId);
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-10 gap-8">
            <div className="md:col-span-3">
                <h3 className="text-lg font-bold text-slate-700 mb-4">New Production Entry</h3>
                {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert"><p>{error}</p></div>}
                <form onSubmit={handleAddToList} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} min={minDate} className="mt-1 w-full p-2 rounded-md" /></div>
                    <div className="space-y-1">
                        <button type="button" onClick={requestSetupItem} className="text-xs text-blue-600 hover:underline float-right">Item not found? Add new item.</button>
                        <label className="block text-sm font-medium text-slate-700">Item</label>
                        <ItemSelector
                            inputRef={itemRef}
                            items={state.items.filter(i => i.id !== 'GRBG-001')}
                            selectedItemId={formData.itemId}
                            onSelect={(id) => setFormData(f => ({ ...f, itemId: id }))}
                        />
                        {itemDetails && <div className="text-xs text-slate-500 mt-1">Packing: {itemDetails.packingType}, Size: {itemDetails.baleSize} Kg</div>}
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700">Quantity Produced (units)</label><input ref={quantityRef} type="number" value={formData.quantityProduced} onChange={e => setFormData({ ...formData, quantityProduced: e.target.value })} className="mt-1 w-full p-2 rounded-md" min="1" disabled={!formData.itemId} /></div>

                    <button type="submit" className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add to List</button>
                </form>
            </div>
            <div className="md:col-span-7">
                <h3 className="text-lg font-bold text-slate-700 mb-2">Staged Entries for {formData.date}</h3>
                <div className="flex justify-end text-sm font-semibold text-slate-600 mb-2 space-x-4">
                    <span>Total Packages: {totalPackagesForDate.toLocaleString()}</span>
                    <span>Total Kg: {totalKgForDate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                {stagedProductions.length > 0 ? (
                    <div className="overflow-y-auto border rounded-md max-h-96">
                        <table className="w-full text-left table-auto text-sm">
                            <thead className="sticky top-0 bg-slate-100 z-10">
                                <tr>
                                    <th className="p-2 font-semibold text-slate-600">Item</th>
                                    <th className="p-2 font-semibold text-slate-600">Category</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Qty</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Bale Nos.</th>
                                    {(userProfile?.isAdmin || userProfile?.name?.toLowerCase().includes('tanveer')) && <th className="p-2 font-semibold text-slate-600 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {stagedProductions.map((p) => (
                                    <tr key={p.id} className="border-b hover:bg-slate-50">
                                        <td className="p-2 text-slate-700">{p.itemName}</td>
                                        <td className="p-2 text-slate-700">{p.itemCategory}</td>
                                        <td className="p-2 text-slate-700 text-right font-medium">{p.quantityProduced.toLocaleString()}</td>
                                        <td className="p-2 text-slate-700 text-right font-mono text-xs">{p.startBaleNumber ? `${p.startBaleNumber}-${p.endBaleNumber}` : '-'}</td>
                                        {(userProfile?.isAdmin || userProfile?.name?.toLowerCase().includes('tanveer')) && (
                                            <td className="p-2 text-right">
                                                <button onClick={() => handleRemoveFromList(p.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Remove</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-slate-500 py-8 border rounded-md">No entries staged for this date yet.</div>
                )}
                {stagedProductions.length > 0 && (
                    <div className="mt-4 flex justify-end">
                        <button onClick={prepareProductionSummary} className="py-2 px-6 bg-green-600 text-white rounded-md hover:bg-green-700">
                            Finalize & Save Production
                        </button>
                    </div>
                )}

                {previouslySavedProductions.length > 0 && (
                    <div className="mt-6 border rounded-md">
                        <button
                            type="button"
                            className="w-full flex justify-between items-center p-3 bg-slate-100 hover:bg-slate-200 transition-colors rounded-t-md"
                            onClick={() => setIsPreviousEntriesOpen(!isPreviousEntriesOpen)}
                        >
                            <h4 className="font-semibold text-slate-700">Previously Saved Entries for {formData.date}</h4>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transform transition-transform ${isPreviousEntriesOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {isPreviousEntriesOpen && (
                             <div className="p-2">
                                <div className="overflow-y-auto border rounded-md max-h-60">
                                    <table className="w-full text-left table-auto text-sm">
                                        <thead className="sticky top-0 bg-slate-100 z-10">
                                            <tr>
                                                <th className="p-2 font-semibold text-slate-600">Item</th>
                                                <th className="p-2 font-semibold text-slate-600">Category</th>
                                                <th className="p-2 font-semibold text-slate-600 text-right">Qty</th>
                                                <th className="p-2 font-semibold text-slate-600 text-right">Bale Nos.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previouslySavedProductions.map((p) => (
                                                <tr key={p.id} className="border-b">
                                                    <td className="p-2 text-slate-600">{p.itemName}</td>
                                                    <td className="p-2 text-slate-600">{p.itemCategory}</td>
                                                    <td className="p-2 text-slate-600 text-right">{p.quantityProduced.toLocaleString()}</td>
                                                    <td className="p-2 text-slate-600 text-right font-mono text-xs">{p.startBaleNumber ? `${p.startBaleNumber}-${p.endBaleNumber}` : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {isSummaryModalOpen && (
                <Modal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} title="Confirm Production Summary" size="5xl">
                    <div className="space-y-4 text-slate-800">
                        <p className="text-sm text-slate-600">Please review the production entries for <strong>{formData.date}</strong> before saving.</p>
                        <div className="overflow-y-auto border rounded-md max-h-96">
                            <table className="w-full text-left table-auto text-sm">
                                <thead className="sticky top-0 bg-slate-100 z-10">
                                    <tr>
                                        <th className="p-2 font-semibold text-slate-600">Item</th>
                                        <th className="p-2 font-semibold text-slate-600">Category</th>
                                        <th className="p-2 font-semibold text-slate-600 text-right">Qty (Pkgs)</th>
                                        <th className="p-2 font-semibold text-slate-600 text-right">Pkg Size</th>
                                        <th className="p-2 font-semibold text-slate-600 text-right">Total Kg</th>
                                        <th className="p-2 font-semibold text-slate-600 text-center">Bale Nos.</th>
                                        <th className="p-2 font-semibold text-slate-600 text-right">Yesterday's Pkgs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryData.map(p => (
                                        <tr key={p.id} className="border-b">
                                            <td className="p-2">{p.itemName}</td>
                                            <td className="p-2">{p.itemCategory}</td>
                                            <td className="p-2 text-right">{p.quantityProduced.toLocaleString()}</td>
                                            <td className="p-2 text-right">{p.packingType !== PackingType.Kg ? p.packingSize : 'N/A'}</td>
                                            <td className="p-2 text-right font-medium">{p.totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                            <td className="p-2 text-center font-mono text-xs">{p.startBaleNumber ? `${p.startBaleNumber}-${p.endBaleNumber}` : '-'}</td>
                                            <td className="p-2 text-right">{p.yesterdayPackages > 0 ? p.yesterdayPackages.toLocaleString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end text-sm font-semibold space-x-6 pt-4 border-t">
                             <span>Total Packages: {summaryData.reduce((sum, p) => {
                                const isPackage = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(p.packingType);
                                return sum + (isPackage ? p.quantityProduced : 0);
                             }, 0).toLocaleString()}</span>
                            <span>Total Kg: {summaryData.reduce((sum, p) => sum + p.totalKg, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="flex justify-end pt-6 space-x-2">
                        <button onClick={() => setIsSummaryModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Go Back</button>
                        <button onClick={handleFinalizeProduction} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save and Continue</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- START: Re-baling Form ---
interface RebalingListItem {
    itemId: string;
    itemName: string;
    quantity: number;
    totalKg: number;
}

const RebalingForm: React.FC<{ showNotification: (msg: string) => void; userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [fromItems, setFromItems] = useState<RebalingListItem[]>([]);
    const [toItems, setToItems] = useState<RebalingListItem[]>([]);

    const [fromItem, setFromItem] = useState({ itemId: '', quantity: '' });
    const [toItem, setToItem] = useState({ itemId: '', quantity: '' });
    
    const fromItemRef = useRef<HTMLInputElement>(null);
    const toItemRef = useRef<HTMLInputElement>(null);
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    const fromItemStock = useMemo(() => {
        if (!fromItem.itemId) return 0;
        const item = state.items.find(i => i.id === fromItem.itemId);
        if (!item) return 0;

        const production = state.productions.filter(p => p.itemId === item.id).reduce((sum, p) => sum + p.quantityProduced, 0);
        const sales = state.salesInvoices.filter(inv => inv.status !== InvoiceStatus.Unposted).flatMap(inv => inv.items).filter(i => i.itemId === item.id).reduce((sum, i) => sum + i.quantity, 0);

        return (item.openingStock || 0) + production - sales;
    }, [fromItem.itemId, state.productions, state.salesInvoices, state.items]);

    const handleAddItem = (side: 'from' | 'to') => {
        const itemState = side === 'from' ? fromItem : toItem;
        const setItemState = side === 'from' ? setFromItem : setToItem;
        const itemRef = side === 'from' ? fromItemRef : toItemRef;

        if (!itemState.itemId || !itemState.quantity || Number(itemState.quantity) <= 0) {
            showNotification("Please select an item and enter a valid quantity.");
            return;
        }
        const itemDetails = state.items.find(i => i.id === itemState.itemId);
        if (!itemDetails) {
            showNotification("Selected item not found.");
            return;
        }

        const quantity = Number(itemState.quantity);
        if (side === 'from') {
            const alreadyConsumed = fromItems.filter(i => i.itemId === itemState.itemId).reduce((sum, i) => sum + i.quantity, 0);
            if (quantity + alreadyConsumed > fromItemStock) {
                showNotification(`Cannot consume ${quantity} units. Only ${fromItemStock - alreadyConsumed} available in stock.`);
                return;
            }
        }

        const totalKg = quantity * (itemDetails.packingType === PackingType.Bales ? itemDetails.baleSize : 1);
        const newItem: RebalingListItem = { itemId: itemState.itemId, itemName: itemDetails.name, quantity, totalKg };

        if (side === 'from') setFromItems([...fromItems, newItem]);
        else setToItems([...toItems, newItem]);

        setItemState({ itemId: '', quantity: '' });
        itemRef.current?.focus();
    };


    const handleRemoveItem = (side: 'from' | 'to', index: number) => {
        if (side === 'from') setFromItems(fromItems.filter((_, i) => i !== index));
        else setToItems(toItems.filter((_, i) => i !== index));
    };
    
    const { totalFromKg, totalToKg, differenceKg } = useMemo(() => {
        const fromKg = fromItems.reduce((sum, item) => sum + item.totalKg, 0);
        const toKg = toItems.reduce((sum, item) => sum + item.totalKg, 0);
        return { totalFromKg: fromKg, totalToKg: toKg, differenceKg: fromKg - toKg };
    }, [fromItems, toItems]);

    const handleFinalize = () => {
        if (fromItems.length === 0 || toItems.length === 0) {
            showNotification("Please add items to both 'Consume' and 'Produce' lists.");
            return;
        }
        
        const transactionId = `${Date.now()}`;
        
        fromItems.forEach(item => {
            const negativeProduction: Production = { id: `rebaling_from_${item.itemId}_${transactionId}`, date, itemId: item.itemId, quantityProduced: -item.quantity };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: negativeProduction } });
        });
        
        toItems.forEach(item => {
            const itemDetails = state.items.find(i => i.id === item.itemId)!;
            const positiveProduction: Production = {
                id: `rebaling_to_${item.itemId}_${transactionId}`, date, itemId: item.itemId, quantityProduced: item.quantity,
                ...(itemDetails.packingType === PackingType.Bales && {
                    startBaleNumber: itemDetails.nextBaleNumber || 1,
                    endBaleNumber: (itemDetails.nextBaleNumber || 0) + item.quantity - 1,
                }),
            };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: positiveProduction } });
            if (itemDetails.packingType === PackingType.Bales) {
                dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'items', data: { id: item.itemId, nextBaleNumber: (itemDetails.nextBaleNumber || 0) + item.quantity } } });
            }
        });

        showNotification("Re-baling transaction saved successfully.");
        setDate(new Date().toISOString().split('T')[0]);
        setFromItems([]);
        setToItems([]);
    };

    const renderItemList = (items: RebalingListItem[], side: 'from' | 'to') => (
        <div className="border rounded-md min-h-[200px]">
            <table className="w-full text-left table-auto text-sm">
                <thead><tr className="bg-slate-100"><th className="p-2 font-semibold text-slate-600">Item</th><th className="p-2 font-semibold text-slate-600 text-right">Qty</th><th className="p-2 font-semibold text-slate-600 text-right">Kg</th><th></th></tr></thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index} className="border-b">
                            <td className="p-2 text-slate-800">{item.itemName}</td>
                            <td className="p-2 text-right text-slate-800">{item.quantity}</td>
                            <td className="p-2 text-right text-slate-800">{item.totalKg.toFixed(2)}</td>
                            <td className="p-1 text-center"><button onClick={() => handleRemoveItem(side, index)} className="text-red-500 hover:text-red-700 text-xs">✕</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-6">
            <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} min={minDate} className="mt-1 p-2 rounded-md w-full md:w-1/4"/></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-slate-50">
                {/* Consume Column */}
                <div className="space-y-3">
                    <h4 className="text-md font-semibold text-slate-700">Add Item to Consume</h4>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
                        <ItemSelector inputRef={fromItemRef} items={state.items} selectedItemId={fromItem.itemId} onSelect={(id) => setFromItem(f => ({ ...f, itemId: id }))}/>
                        {fromItem.itemId && <p className="text-xs text-slate-500 mt-1">Available Stock: {fromItemStock.toLocaleString()} units</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                        <input type="number" value={fromItem.quantity} onChange={e => setFromItem(f => ({ ...f, quantity: e.target.value }))} className="w-full p-2 rounded-md" placeholder="e.g., 10" />
                    </div>
                    <button type="button" onClick={() => handleAddItem('from')} className="w-full py-2 px-3 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm font-semibold">Add to Consume</button>
                </div>

                {/* Produce Column */}
                <div className="space-y-3">
                    <h4 className="text-md font-semibold text-slate-700">Add Item to Produce</h4>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
                        <ItemSelector inputRef={toItemRef} items={state.items} selectedItemId={toItem.itemId} onSelect={(id) => setToItem(f => ({ ...f, itemId: id }))}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                        <input type="number" value={toItem.quantity} onChange={e => setToItem(f => ({ ...f, quantity: e.target.value }))} className="w-full p-2 rounded-md" placeholder="e.g., 10" />
                    </div>
                    <button type="button" onClick={() => handleAddItem('to')} className="w-full py-2 px-3 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm font-semibold">Add to Produce</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div><h3 className="text-lg font-bold text-slate-700 mb-2">Items to Consume (From)</h3>{renderItemList(fromItems, 'from')}</div>
                <div><h3 className="text-lg font-bold text-slate-700 mb-2">Items to Produce (To)</h3>{renderItemList(toItems, 'to')}</div>
            </div>

            <div className="p-4 bg-slate-100 rounded-lg flex justify-around items-center text-center">
                <div><p className="text-sm text-slate-500">Total Kg Consumed</p><p className="text-xl font-bold text-red-600">{totalFromKg.toFixed(2)}</p></div>
                <div><p className="text-sm text-slate-500">Total Kg Produced</p><p className="text-xl font-bold text-green-600">{totalToKg.toFixed(2)}</p></div>
                <div><p className="text-sm text-slate-500">Difference / Loss</p><p className={`text-xl font-bold ${differenceKg >= 0 ? 'text-slate-800' : 'text-red-700'}`}>{differenceKg.toFixed(2)}</p></div>
            </div>

            <div className="flex justify-end"><button onClick={handleFinalize} className="py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Finalize Re-baling</button></div>
        </div>
    );
};
// --- END: Re-baling Form ---

const DirectSalesForm: React.FC<{ showNotification: (msg: string) => void; userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
    const formatCurrency = (val: number | undefined) => val ? val.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00';

    // State for the form
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [customerId, setCustomerId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [originalPurchaseId, setOriginalPurchaseId] = useState('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [currencyData, setCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [rate, setRate] = useState<number | ''>('');
    const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<{
        itemValue: number; freightCost: number; clearingCost: number; commissionCost: number; surchargeDiscount: number;
        totalCost: number; totalKg: number; costPerKg: number;
    } | null>(null);

    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    const availableOriginals = useMemo(() => {
        const openedKgs = new Map<string, number>();
        state.originalOpenings.forEach(op => {
            const purchase = state.originalPurchases.find(p => p.supplierId === op.supplierId && p.originalTypeId === op.originalTypeId && p.batchNumber === op.batchNumber);
            if(purchase) {
                openedKgs.set(purchase.id, (openedKgs.get(purchase.id) || 0) + op.totalKg);
            }
        });

        const soldKgs = new Map<string, number>();
        state.salesInvoices
            .filter(inv => inv.directSalesDetails?.originalPurchaseId)
            .forEach(inv => {
                const purchaseId = inv.directSalesDetails!.originalPurchaseId;
                const soldQty = inv.items.find(i => i.itemId === 'DS-001')?.quantity || 0;
                soldKgs.set(purchaseId, (soldKgs.get(purchaseId) || 0) + soldQty);
            });

        return state.originalPurchases.map(p => {
            const originalType = state.originalTypes.find(ot => ot.id === p.originalTypeId);
            if (!originalType) return null;

            const purchaseKg = originalType.packingType === PackingType.Kg ? p.quantityPurchased : p.quantityPurchased * originalType.packingSize;
            
            const totalOpened = openedKgs.get(p.id) || 0;
            const totalSold = soldKgs.get(p.id) || 0;
            
            const availableKg = purchaseKg - totalOpened - totalSold;
            
            return { id: p.id, supplierId: p.supplierId, batchNumber: p.batchNumber, availableKg };
        }).filter(p => p && p.availableKg > 0.01) as { id: string, supplierId: string, batchNumber: string, availableKg: number }[];
    }, [state.originalPurchases, state.originalOpenings, state.salesInvoices, state.originalTypes]);

    const suppliersWithStock = useMemo(() => {
        const supplierIds = new Set(availableOriginals.map(p => p.supplierId));
        return state.suppliers.filter(s => supplierIds.has(s.id));
    }, [availableOriginals, state.suppliers]);

    const batchesForSupplier = useMemo(() => {
        if (!supplierId) return [];
        return availableOriginals.filter(p => p.supplierId === supplierId);
    }, [supplierId, availableOriginals]);

    const getPurchaseCostDetails = (purchase: OriginalPurchased) => {
        const originalType = state.originalTypes.find(ot => ot.id === purchase.originalTypeId);
        if (!originalType) return null;
        
        const totalPurchaseKg = originalType.packingType === PackingType.Kg ? purchase.quantityPurchased : purchase.quantityPurchased * originalType.packingSize;
        if(totalPurchaseKg === 0) return null;

        const itemValueUSD = (purchase.quantityPurchased * purchase.rate) * (purchase.conversionRate || 1);
        const freightUSD = (purchase.freightAmount || 0) * (purchase.freightConversionRate || 1);
        const clearingUSD = (purchase.clearingAmount || 0) * (purchase.clearingConversionRate || 1);
        const commissionUSD = (purchase.commissionAmount || 0) * (purchase.commissionConversionRate || 1);
        const discountSurchargeUSD = purchase.discountSurcharge || 0;

        const totalCostUSD = itemValueUSD + freightUSD + clearingUSD + commissionUSD + discountSurchargeUSD;
        const costPerKg = totalCostUSD / totalPurchaseKg;
        
        return {
            itemValue: itemValueUSD, freightCost: freightUSD, clearingCost: clearingUSD, commissionCost: commissionUSD,
            surchargeDiscount: discountSurchargeUSD, totalCost: totalCostUSD, totalKg: totalPurchaseKg, costPerKg: costPerKg,
        };
    };

    useEffect(() => {
        if (supplierId && batchNumber) {
            const purchase = state.originalPurchases.find(p => p.supplierId === supplierId && p.batchNumber === batchNumber);
            if (purchase) {
                setOriginalPurchaseId(purchase.id);
                const details = getPurchaseCostDetails(purchase);
                setSelectedPurchaseDetails(details);
            }
        } else {
            setOriginalPurchaseId('');
            setSelectedPurchaseDetails(null);
        }
    }, [supplierId, batchNumber, state.originalPurchases]);

    const selectedBatchDetails = useMemo(() => {
        if (!supplierId || !batchNumber) return null;
        return batchesForSupplier.find(b => b.batchNumber === batchNumber);
    }, [supplierId, batchNumber, batchesForSupplier]);

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setCustomerId('');
        setSupplierId('');
        setBatchNumber('');
        setOriginalPurchaseId('');
        setQuantity('');
        setRate('');
        setCurrencyData({ currency: Currency.Dollar, conversionRate: 1 });
        setSelectedPurchaseDetails(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qtyNum = Number(quantity);
        const rateNum = Number(rate);

        if (!customerId || !originalPurchaseId || !quantity || qtyNum <= 0 || !rate || rateNum <= 0) {
            showNotification("Please fill all fields with valid values.");
            return;
        }

        if (selectedBatchDetails && qtyNum > selectedBatchDetails.availableKg) {
            showNotification(`Cannot sell ${qtyNum}kg. Only ${selectedBatchDetails.availableKg.toFixed(2)}kg available.`);
            return;
        }
        
        const originalPurchase = state.originalPurchases.find(p => p.id === originalPurchaseId);
        if (!originalPurchase || !selectedPurchaseDetails) {
            showNotification("Selected purchase batch not found or cost could not be calculated.");
            return;
        }

        const totalCostOfGoodsSold = selectedPurchaseDetails.costPerKg * qtyNum;
        const totalSaleValue = qtyNum * rateNum;
        const totalSaleValueUSD = totalSaleValue * currencyData.conversionRate;
        
        const newInvoiceId = generateInvoiceId(state.nextInvoiceNumber);
        const newInvoice: SalesInvoice = {
            id: newInvoiceId, date, customerId,
            items: [{
                itemId: 'DS-001', quantity: qtyNum, rate: rateNum,
                currency: currencyData.currency, conversionRate: currencyData.conversionRate,
            }],
            status: InvoiceStatus.Posted, totalBales: 0, totalKg: qtyNum,
            directSalesDetails: { originalPurchaseId, originalPurchaseCost: totalCostOfGoodsSold }
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'salesInvoices', data: newInvoice } });

        const customer = state.customers.find(c => c.id === customerId);
        const salesDesc = `Direct Sale of Raw Goods (Batch: ${originalPurchase.batchNumber}) to ${customer?.name}`;
        
        const debitAR: JournalEntry = { id: `je-d-ds-${newInvoiceId}`, voucherId: newInvoiceId, date, entryType: JournalEntryType.Journal, account: 'AR-001', debit: totalSaleValueUSD, credit: 0, description: salesDesc, entityId: customerId, entityType: 'customer', createdBy: userProfile?.uid };
        const creditRevenue: JournalEntry = { id: `je-c-ds-${newInvoiceId}`, voucherId: newInvoiceId, date, entryType: JournalEntryType.Journal, account: 'REV-001', debit: 0, credit: totalSaleValueUSD, description: salesDesc, createdBy: userProfile?.uid };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitAR } });
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditRevenue } });
        
        const cogsDesc = `Cost for Direct Sale INV ${newInvoiceId}`;
        const debitCOGS: JournalEntry = { id: `je-d-cogs-ds-${newInvoiceId}`, voucherId: `COGS-${newInvoiceId}`, date, entryType: JournalEntryType.Journal, account: 'EXP-010', debit: totalCostOfGoodsSold, credit: 0, description: cogsDesc, createdBy: userProfile?.uid };
        const creditPurchases: JournalEntry = { id: `je-c-cogs-ds-${newInvoiceId}`, voucherId: `COGS-${newInvoiceId}`, date, entryType: JournalEntryType.Journal, account: 'EXP-004', debit: 0, credit: totalCostOfGoodsSold, description: cogsDesc, createdBy: userProfile?.uid };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitCOGS } });
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditPurchases } });

        showNotification("Direct Sale recorded successfully!");
        resetForm();
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-bold text-slate-700 mb-4">New Direct Sale Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} min={minDate} required className="mt-1 w-full p-2 rounded-md"/>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Customer</label>
                        <EntitySelector
                            entities={state.customers}
                            selectedEntityId={customerId}
                            onSelect={setCustomerId}
                            placeholder="Search Customers..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Supplier</label>
                        <EntitySelector
                            entities={suppliersWithStock}
                            selectedEntityId={supplierId}
                            onSelect={(id) => {setSupplierId(id); setBatchNumber('');}}
                            placeholder="Search Suppliers..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Batch Number</label>
                        <select value={batchNumber} onChange={e => setBatchNumber(e.target.value)} required className="mt-1 w-full p-2 rounded-md" disabled={!supplierId}>
                            <option value="">Select Batch</option>
                            {batchesForSupplier.map(b => (
                                <option key={b.id} value={b.batchNumber}>{b.batchNumber} (Available: {b.availableKg.toFixed(2)} Kg)</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedPurchaseDetails && (
                    <div className="mt-4 p-4 border rounded-lg bg-slate-50">
                        <h4 className="text-md font-semibold text-slate-700 mb-2">Cost Breakdown for Batch: {batchNumber}</h4>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                            <span className="text-slate-600">Item Value (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.itemValue)}</span>
                            <span className="text-slate-600">Freight Cost (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.freightCost)}</span>
                            <span className="text-slate-600">Clearing Cost (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.clearingCost)}</span>
                            <span className="text-slate-600">Commission Cost (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.commissionCost)}</span>
                            <span className="text-slate-600">Discount/Surcharge (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.surchargeDiscount)}</span>
                            <span className="text-slate-600 font-bold border-t pt-1 mt-1">Total Cost (USD):</span><span className="text-right font-bold text-slate-800 border-t pt-1 mt-1">{formatCurrency(selectedPurchaseDetails.totalCost)}</span>
                            <span className="text-slate-600">Total Weight (Kg):</span><span className="text-right font-medium text-slate-800">{selectedPurchaseDetails.totalKg.toFixed(2)} Kg</span>
                            <span className="text-blue-700 font-bold text-lg border-t pt-2 mt-2">Landed Cost per Kg:</span><span className="text-right font-bold text-blue-700 text-lg border-t pt-2 mt-2">{formatCurrency(selectedPurchaseDetails.costPerKg)}</span>
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Quantity to Sell (Kg)</label>
                        <input type="number" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} max={selectedBatchDetails?.availableKg} required className="mt-1 w-full p-2 rounded-md" placeholder="e.g., 500" disabled={!batchNumber}/>
                         {selectedBatchDetails && <p className="text-xs text-slate-500 mt-1">Max: {selectedBatchDetails.availableKg.toFixed(2)} Kg</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Sale Rate (per Kg)</label>
                        <input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value === '' ? '' : Number(e.target.value))} required className="mt-1 w-full p-2 rounded-md" placeholder="e.g., 0.75" disabled={!batchNumber}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Currency & Rate</label>
                        <CurrencyInput value={currencyData} onChange={setCurrencyData} />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        Record Direct Sale
                    </button>
                </div>
            </form>
        </div>
    );
};
const OffloadingForm: React.FC<{ showNotification: (msg: string) => void; userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();

    // Form State
    const [selectedLogisticsId, setSelectedLogisticsId] = useState<number | ''>('');
    const [offloadDate, setOffloadDate] = useState(new Date().toISOString().split('T')[0]);
    const [receivedWeight, setReceivedWeight] = useState<number | ''>('');
    const [warehouseId, setWarehouseId] = useState<string>('');
    
    // Staged items for tallying (for Finished Goods)
    type StagedItem = { itemId: string; itemName: string; quantity: number };
    const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
    
    // Current item being added (for Finished Goods)
    const [currentItem, setCurrentItem] = useState<{ itemId: string; quantity: string }>({ itemId: '', quantity: '' });
    const itemInputRef = useRef<HTMLInputElement>(null);
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    // FIX: Define a type for the purchase source to help with type inference.
    type PurchaseSource = (OriginalPurchased | FinishedGoodsPurchase) & { purchaseType: 'original' | 'finished' };
    
    // Combined map of all purchases for easy lookup
    const allPurchasesMap = useMemo(() => {
        const map = new Map<string, PurchaseSource>();
        state.originalPurchases.forEach(p => map.set(p.id, { ...p, purchaseType: 'original' }));
        state.finishedGoodsPurchases.forEach(p => map.set(p.id, { ...p, purchaseType: 'finished' }));
        return map;
    }, [state.originalPurchases, state.finishedGoodsPurchases]);

    // Filter and find eligible containers for off-loading
    const eligibleLogisticsEntries = useMemo(() => {
        // FIX: Cast the array from map values to the correct type to resolve type inference issues.
        const allPurchasesWithContainers = (Array.from(allPurchasesMap.values()) as PurchaseSource[]).filter(p => p.containerNumber);
        const existingLogisticsPurchaseIds = new Set(state.logisticsEntries.map(e => e.purchaseId));

        // Create placeholder entries for purchases that have a container but no logistics entry yet.
        // These are implicitly "In Transit".
        const placeholderEntries: LogisticsEntry[] = allPurchasesWithContainers
            .filter(p => !existingLogisticsPurchaseIds.has(p.id))
            .map((p, index) => ({
                id: -(index + 1), // Use temporary negative ID for uniqueness
                purchaseId: p.id,
                batchNumber: p.batchNumber,
                dateOfLoading: p.date, 
                status: LogisticsStatus.InTransit,
                etd: '', 
                eta: '', 
                portStorage: '', 
                doVld: '', 
                ground: '', 
                unload: '', 
                documentStatus: DocumentStatus.Pending, 
                freightForwarderId: p.freightForwarderId
            }));

        // Combine existing entries with placeholders
        const allPossibleEntries = [...state.logisticsEntries, ...placeholderEntries];
        
        // Now filter the combined list for "In Transit" status
        return allPossibleEntries.filter(entry => entry.status === LogisticsStatus.InTransit);

    }, [state.logisticsEntries, allPurchasesMap]);

    // Details of the selected purchase
    const selectedPurchaseDetails = useMemo(() => {
        if (!selectedLogisticsId) return null;

        const logisticsEntry = eligibleLogisticsEntries.find(e => e.id === selectedLogisticsId);
        if (!logisticsEntry) return null;

        const purchase = allPurchasesMap.get(logisticsEntry.purchaseId);
        if (!purchase) return null;

        const supplier = state.suppliers.find(s => s.id === purchase.supplierId);
        const division = state.divisions.find(d => d.id === purchase.divisionId);
        const subDivision = state.subDivisions.find(sd => sd.id === purchase.subDivisionId);

        return {
            purchase,
            purchaseType: purchase.purchaseType,
            supplierName: supplier?.name || 'N/A',
            batchNumber: purchase.batchNumber || 'N/A',
            containerNumber: purchase.containerNumber || 'N/A',
            invoicedWeight: purchase.containerInvoicedWeight || 0,
            divisionName: division?.name || 'N/A',
            subDivisionName: subDivision?.name || 'N/A',
        };
    }, [selectedLogisticsId, eligibleLogisticsEntries, allPurchasesMap, state.suppliers, state.divisions, state.subDivisions]);

    // Reset form fields when selection changes to avoid stale data
    useEffect(() => {
        setReceivedWeight('');
        setWarehouseId('');
        setStagedItems([]);
        setCurrentItem({ itemId: '', quantity: '' });
    }, [selectedLogisticsId]);
    
    // Totals for tallied items (for Finished Goods)
    const tallyTotals = useMemo(() => {
        let totalBales = 0;
        let totalKg = 0;

        stagedItems.forEach(({ itemId, quantity }) => {
            const itemDetails = state.items.find(i => i.id === itemId);
            if (itemDetails) {
                if (itemDetails.packingType === PackingType.Bales) {
                    totalBales += quantity;
                    totalKg += quantity * itemDetails.baleSize;
                } else {
                    totalKg += quantity;
                }
            }
        });
        return { totalBales, totalKg };
    }, [stagedItems, state.items]);

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const { itemId, quantity } = currentItem;
        if (!itemId || !quantity || Number(quantity) <= 0) {
            showNotification("Please select an item and enter a valid quantity.");
            return;
        }

        const itemDetails = state.items.find(i => i.id === itemId);
        if (!itemDetails) return;

        setStagedItems(prev => [...prev, { itemId, itemName: itemDetails.name, quantity: Number(quantity) }]);
        setCurrentItem({ itemId: '', quantity: '' });
        if (itemInputRef.current) {
            itemInputRef.current.focus();
        }
    };

    const handleRemoveItem = (index: number) => {
        setStagedItems(prev => prev.filter((_, i) => i !== index));
    };
    
    const resetForm = () => {
        setSelectedLogisticsId('');
        setOffloadDate(new Date().toISOString().split('T')[0]);
        setReceivedWeight('');
        setWarehouseId('');
        setStagedItems([]);
        setCurrentItem({ itemId: '', quantity: '' });
    };

    const handleFinalize = () => {
        if (!selectedLogisticsId || !warehouseId) {
            showNotification("Please select a container and a warehouse.");
            return;
        }

        const isFinishedGoods = selectedPurchaseDetails?.purchaseType === 'finished';
        let finalReceivedWeight: number;

        if (isFinishedGoods) {
            if (stagedItems.length === 0) {
                showNotification("For Finished Goods, you must tally at least one item.");
                return;
            }
            finalReceivedWeight = tallyTotals.totalKg;
            
            // Create Production entries for each tallied item
            stagedItems.forEach(item => {
                const productionEntry: Production = {
                    id: `prod_offload_${selectedLogisticsId}_${item.itemId}_${Date.now()}`,
                    date: offloadDate,
                    itemId: item.itemId,
                    quantityProduced: item.quantity
                };
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: productionEntry } });
            });
        } else {
            if (!receivedWeight || Number(receivedWeight) <= 0) {
                showNotification("Please enter a valid received weight.");
                return;
            }
            finalReceivedWeight = Number(receivedWeight);
        }

        // Update the Logistics Entry
        const logisticsUpdate = {
            id: selectedLogisticsId,
            status: LogisticsStatus.Cleared,
            unload: offloadDate,
            receiveWeight: finalReceivedWeight,
            warehouseId: warehouseId,
        };
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'logisticsEntries', data: logisticsUpdate } });
        
        showNotification(`Container off-loading for ${selectedPurchaseDetails?.containerNumber} saved successfully.`);
        resetForm();
    };

    const loadingWeight = selectedPurchaseDetails?.invoicedWeight || 0;
    const isFinishedGoodsPurchase = selectedPurchaseDetails?.purchaseType === 'finished';
    const weightDifference = isFinishedGoodsPurchase ? tallyTotals.totalKg - loadingWeight : (loadingWeight > 0 && receivedWeight ? Number(receivedWeight) - loadingWeight : null);

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-700">Container Off-loading</h3>

            {/* Top selection area */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end p-4 border rounded-lg bg-slate-50">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Date</label>
                    <input type="date" value={offloadDate} onChange={e => setOffloadDate(e.target.value)} min={minDate} className="mt-1 w-full p-2 rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Batch Number (In Transit)</label>
                    <select value={selectedLogisticsId} onChange={e => setSelectedLogisticsId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full p-2 rounded-md">
                        <option value="">Select a batch...</option>
                        {eligibleLogisticsEntries.map(entry => {
                            const purchase = allPurchasesMap.get(entry.purchaseId);
                            if (!purchase || !purchase.batchNumber) return null;
                            return ( <option key={`batch-${entry.id}`} value={entry.id}> {purchase.batchNumber} </option> );
                        })}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Container Number (In Transit)</label>
                    <select value={selectedLogisticsId} onChange={e => setSelectedLogisticsId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full p-2 rounded-md">
                        <option value="">Select a container...</option>
                        {eligibleLogisticsEntries.map(entry => {
                            const purchase = allPurchasesMap.get(entry.purchaseId);
                            if (!purchase || !purchase.containerNumber) return null;
                            return ( <option key={`container-${entry.id}`} value={entry.id}> {purchase.containerNumber} </option> );
                        })}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Warehouse</label>
                    <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} disabled={!selectedLogisticsId} className="mt-1 w-full p-2 rounded-md disabled:bg-slate-200">
                        <option value="">Select warehouse...</option>
                        {state.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedPurchaseDetails && (
                <div className="space-y-6">
                    {/* Details Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-left table-auto text-sm">
                            <thead className="bg-slate-100"><tr className="border-b"><th colSpan={4} className="p-2 font-semibold text-slate-700">Selected Container Details</th></tr></thead>
                            <tbody>
                                <tr className="border-b">
                                    <td className="p-2 font-medium text-slate-600 bg-slate-50 w-1/4">Supplier</td><td className="p-2 text-slate-800 w-1/4">{selectedPurchaseDetails.supplierName}</td>
                                    <td className="p-2 font-medium text-slate-600 bg-slate-50 w-1/4">Invoiced Weight</td><td className="p-2 text-slate-800 w-1/4">{selectedPurchaseDetails.invoicedWeight.toLocaleString()} Kg</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="p-2 font-medium text-slate-600 bg-slate-50">Division</td><td className="p-2 text-slate-800">{selectedPurchaseDetails.divisionName}</td>
                                    <td className="p-2 font-medium text-slate-600 bg-slate-50">Sub-Division</td><td className="p-2 text-slate-800">{selectedPurchaseDetails.subDivisionName}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Weight Input (for Original Purchase) */}
                    {!isFinishedGoodsPurchase && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label className="block text-sm font-medium text-slate-700">Received Weight (Kg)</label>
                                <input type="number" value={receivedWeight} onChange={e => setReceivedWeight(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full p-2 rounded-md" placeholder="Enter total weight received" />
                                {weightDifference !== null && (
                                    <p className={`mt-2 text-sm font-semibold ${weightDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        Difference: {weightDifference.toLocaleString()} Kg
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Conditional Tallying Section */}
                    {isFinishedGoodsPurchase && (
                        <div className="grid grid-cols-12 gap-8 pt-4 border-t">
                            <div className="col-span-3">
                                <form onSubmit={handleAddItem} className="space-y-4 p-4 border rounded-lg bg-slate-50">
                                    <h4 className="text-md font-semibold text-slate-700 border-b pb-2">Tally Item</h4>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Item</label><ItemSelector inputRef={itemInputRef} items={state.items} selectedItemId={currentItem.itemId} onSelect={id => setCurrentItem(p => ({...p, itemId: id}))} /></div>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input type="number" min="1" value={currentItem.quantity} onChange={e => setCurrentItem(p => ({...p, quantity: e.target.value}))} className="w-full p-2 rounded-md" required/></div>
                                    <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Item to Tally</button>
                                </form>
                            </div>
                            <div className="col-span-5">
                                <h3 className="text-lg font-semibold text-slate-600 mb-2">Tallied Items</h3>
                                <div className="overflow-y-auto border rounded-md max-h-[250px]">
                                    <table className="w-full text-left table-auto">
                                        <thead className="sticky top-0 bg-slate-100 z-10"><tr className="border-b"><th className="p-3 font-semibold text-slate-800">Item</th><th className="p-3 font-semibold text-slate-800 text-right">Quantity</th><th className="p-3"></th></tr></thead>
                                        <tbody>
                                            {stagedItems.map((item, index) => (
                                                <tr key={`${item.itemId}-${index}`} className="border-b">
                                                    <td className="p-3 text-slate-800">{item.itemName}</td>
                                                    <td className="p-3 text-right text-slate-800">{item.quantity.toLocaleString()}</td>
                                                    <td className="p-3 text-center"><button onClick={() => handleRemoveItem(index)} className="text-red-500">✕</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                 <div className="mt-4 p-4 bg-slate-100 rounded-lg flex justify-around items-center text-center">
                                    <div><p className="text-sm text-slate-500">Total Bales</p><p className="text-xl font-bold text-slate-800">{tallyTotals.totalBales.toLocaleString()}</p></div>
                                    <div><p className="text-sm text-slate-500">Total Kg</p><p className="text-xl font-bold text-slate-800">{tallyTotals.totalKg.toLocaleString(undefined, {maximumFractionDigits: 2})}</p></div>
                                    <div>
                                        <p className="text-sm text-slate-500">Weight Difference</p>
                                        <p className={`text-xl font-bold ${weightDifference !== null && weightDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {weightDifference?.toLocaleString(undefined, {maximumFractionDigits: 2})} kg
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-4">
                                <h3 className="text-lg font-semibold text-slate-600 mb-2">Expected Items (from PO)</h3>
                                <div className="overflow-y-auto border rounded-md max-h-[350px] bg-slate-50">
                                    <table className="w-full text-left table-auto text-sm">
                                        <thead className="sticky top-0 bg-slate-200 z-10">
                                            <tr className="border-b">
                                                <th className="p-2 font-semibold text-slate-800">Item</th>
                                                <th className="p-2 font-semibold text-slate-800 text-right">Expected Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedPurchaseDetails?.purchase as FinishedGoodsPurchase).items.map((item, index) => {
                                                const itemDetails = state.items.find(i => i.id === item.itemId);
                                                return (
                                                    <tr key={`${item.itemId}-${index}`} className="border-b">
                                                        <td className="p-2 text-slate-800">{itemDetails?.name || 'N/A'}</td>
                                                        <td className="p-2 text-right text-slate-800">{item.quantity.toLocaleString()}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Finalize Button */}
                    <div className="flex justify-end pt-4 border-t">
                        <button onClick={handleFinalize} className="py-2 px-6 bg-green-600 text-white rounded-md hover:bg-green-700">Finalize & Save</button>
                    </div>
                </div>
            )}
        </div>
    );
};

type FormView = 'opening' | 'production' | 'purchases' | 'sales' | 'ongoing' | 'rebaling' | 'directSales' | 'offloading' | 'stockLot';

interface DataEntryProps {
    setModule: (module: Module) => void;
    requestSetupItem: () => void;
    userProfile: UserProfile | null;
    initialView?: string | null;
}

const DataEntryModule: React.FC<DataEntryProps> = ({ setModule, requestSetupItem, userProfile, initialView }) => {
    const [view, setView] = useState<FormView>('opening');
    const [notification, setNotification] = useState<string | null>(null);
    const [openingView, setOpeningView] = useState<'original' | 'bales'>('original');
    
    const dataEntrySubModules = [
        { key: 'opening', label: 'Original Opening', shortcut: 'Alt + O' },
        { key: 'production', label: 'Production', shortcut: 'Alt + P' },
        { key: 'purchases', label: 'Purchases' },
        { key: 'sales', label: 'Sales Invoice', shortcut: 'Alt + S' },
        { key: 'stockLot', label: 'Bundle Purchase' },
        { key: 'ongoing', label: 'Ongoing Orders', shortcut: 'Alt + U' },
        { key: 'rebaling', label: 'Re-baling' },
        { key: 'directSales', label: 'Direct Sales' },
        { key: 'offloading', label: 'Container Off-loading' }
    ];

    useEffect(() => {
        if (initialView && dataEntrySubModules.some(v => v.key === initialView)) {
            setView(initialView as FormView);
        }
    }, [initialView]);

    const showNotification = (message: string) => {
        setNotification(message);
    };

    const getOpeningButtonClass = (v: 'original' | 'bales') => 
        `px-4 py-2 rounded-md transition-colors text-sm font-medium ${openingView === v ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`;

    const renderView = () => {
        switch (view) {
            case 'opening': 
                return (
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2 border-b pb-4">
                            <button onClick={() => setOpeningView('original')} className={getOpeningButtonClass('original')}>Supplier Opening</button>
                            <button onClick={() => setOpeningView('bales')} className={getOpeningButtonClass('bales')}>Bales Opening</button>
                        </div>
                        {openingView === 'original' && <OriginalOpeningForm showNotification={showNotification} userProfile={userProfile} />}
                        {openingView === 'bales' && <BalesOpeningForm showNotification={showNotification} userProfile={userProfile} />}
                    </div>
                );
            case 'production': return <ProductionForm showNotification={showNotification} requestSetupItem={requestSetupItem} userProfile={userProfile} />;
            case 'purchases': return <PurchasesModule showNotification={showNotification} userProfile={userProfile} />;
            case 'sales': return <SalesInvoiceModule setModule={setModule} userProfile={userProfile} />;
            case 'ongoing': return <OngoingOrdersModule setModule={setModule} userProfile={userProfile} />;
            case 'rebaling': return <RebalingForm showNotification={showNotification} userProfile={userProfile} />;
            case 'directSales': return <DirectSalesForm showNotification={showNotification} userProfile={userProfile} />;
            case 'offloading': return <OffloadingForm showNotification={showNotification} userProfile={userProfile} />;
            case 'stockLot': return <StockLotModule setModule={setModule} showNotification={showNotification} userProfile={userProfile} />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
            <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex flex-wrap items-center gap-2">
                    {dataEntrySubModules.map(module => (
                        <button
                            key={module.key}
                            onClick={() => setView(module.key as FormView)}
                            className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${view === module.key ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                            title={module.shortcut ? `Shortcut: ${module.shortcut}` : ''}
                        >
                            {module.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                {renderView()}
            </div>
        </div>
    );
};

export default DataEntryModule;