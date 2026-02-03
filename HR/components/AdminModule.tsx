import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData, auth, db, allPermissions, dataEntrySubModules, mainModules } from '../context/DataContext.tsx';
import { Module, UserProfile, AppState, PackingType, Production, JournalEntry, SalesInvoice, InvoiceItem, Currency } from '../types.ts';
import { reportStructure } from './ReportsModule.tsx';
import Modal from './ui/Modal.tsx';

const UserManager: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<UserProfile> & { password?: string } | null>(null);

    useEffect(() => {
        if (!db) return;
        const unsubscribe = db.collection('users').onSnapshot((snapshot: any) => {
            const userList: UserProfile[] = [];
            snapshot.forEach((doc: any) => {
                userList.push({ ...doc.data(), uid: doc.id });
            });
            setUsers(userList);
        });
        return () => unsubscribe();
    }, []);

    const handleOpenModal = (user: UserProfile | null = null) => {
        if (user) {
            setEditingUser({ ...user, password: '' });
        } else {
            setEditingUser({ name: '', email: '', password: '', isAdmin: false, permissions: [] });
        }
        setIsModalOpen(true);
    };

    const handleSaveUser = async () => {
        if (!editingUser || !editingUser.email || !editingUser.name) {
            setNotification({ msg: 'Name and email are required.', type: 'error' });
            return;
        }

        try {
            if (editingUser.uid) { // Editing existing user
                await db.collection('users').doc(editingUser.uid).update({
                    name: editingUser.name,
                    isAdmin: editingUser.isAdmin,
                    permissions: editingUser.isAdmin ? allPermissions : editingUser.permissions,
                });
                setNotification({ msg: 'User updated successfully.', type: 'success' });
            } else { // Creating new user
                if (!editingUser.password || editingUser.password.length < 6) {
                    setNotification({ msg: 'Password must be at least 6 characters.', type: 'error' });
                    return;
                }
                const userCredential = await auth.createUserWithEmailAndPassword(editingUser.email, editingUser.password);
                const newUser = userCredential.user;
                if (newUser) {
                    await db.collection('users').doc(newUser.uid).set({
                        name: editingUser.name,
                        email: editingUser.email,
                        isAdmin: editingUser.isAdmin,
                        permissions: editingUser.isAdmin ? allPermissions : editingUser.permissions,
                    });
                    setNotification({ msg: 'User created successfully.', type: 'success' });
                }
            }
            setIsModalOpen(false);
        } catch (error: any) {
            setNotification({ msg: `Error: ${error.message}`, type: 'error' });
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-700">User Management</h2>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md">Add New User</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead><tr className="bg-slate-100"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Actions</th></tr></thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.uid} className="border-b">
                                <td className="p-2 text-slate-800">{user.name}</td>
                                <td className="p-2 text-slate-800">{user.email}</td>
                                <td className="p-2 text-slate-800">{user.isAdmin ? 'Admin' : 'User'}</td>
                                <td className="p-2"><button onClick={() => handleOpenModal(user)} className="text-blue-600 hover:underline">Edit</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isModalOpen && editingUser && <UserEditModal user={editingUser} setUser={setEditingUser} onClose={() => setIsModalOpen(false)} onSave={handleSaveUser} />}
        </div>
    );
};

const UserEditModal: React.FC<{ user: Partial<UserProfile> & { password?: string }, setUser: React.Dispatch<any>, onClose: () => void, onSave: () => void }> = ({ user, setUser, onClose, onSave }) => {
    
    const handlePermissionChange = (permission: string, checked: boolean) => {
        const currentPermissions = user.permissions || [];
        if (checked) {
            setUser({ ...user, permissions: [...currentPermissions, permission] });
        } else {
            setUser({ ...user, permissions: currentPermissions.filter(p => p !== permission) });
        }
    };
    
    const reportSubModules = reportStructure.flatMap(cat => cat.subReports?.map(sub => sub.key) ?? `${cat.key}/main`);
    
    const inputStyle = { backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' };

    return (
        <Modal isOpen={true} onClose={onClose} title={user.uid ? "Edit User" : "Add New User"}>
            <div className="space-y-4">
                <div><label className="text-slate-700">Name</label><input type="text" value={user.name} onChange={e => setUser({...user, name: e.target.value})} className="w-full p-2 rounded-md" style={inputStyle} /></div>
                <div><label className="text-slate-700">Email</label><input type="email" value={user.email} onChange={e => setUser({...user, email: e.target.value})} className="w-full p-2 rounded-md" disabled={!!user.uid} style={inputStyle} /></div>
                {!user.uid && <div><label className="text-slate-700">Password</label><input type="password" value={user.password} onChange={e => setUser({...user, password: e.target.value})} className="w-full p-2 rounded-md" style={inputStyle} /></div>}
                <div><label className="flex items-center text-slate-700"><input type="checkbox" checked={user.isAdmin} onChange={e => setUser({...user, isAdmin: e.target.checked})} className="mr-2"/> Is Admin?</label></div>

                {!user.isAdmin && (
                    <div className="space-y-2 border p-2 rounded-md max-h-60 overflow-y-auto">
                        <h4 className="font-semibold text-slate-700">Permissions</h4>
                        {[...mainModules, ...dataEntrySubModules.map(m => m.key), ...reportSubModules].map(permission => (
                            <div key={permission}><label className="text-slate-700"><input type="checkbox" checked={user.permissions?.includes(permission)} onChange={e => handlePermissionChange(permission as string, e.target.checked)} className="mr-2" /> {permission} </label></div>
                        ))}
                    </div>
                )}
                 <div className="flex justify-end gap-2 pt-4"><button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button><button onClick={onSave} className="px-4 py-2 bg-blue-600 text-white rounded-md">Save</button></div>
            </div>
        </Modal>
    );
};

const ManualEditManager: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const { state, dispatch } = useData();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedType, setSelectedType] = useState<'Invoices' | 'Vouchers'>('Invoices');
    const [selectedId, setSelectedId] = useState('');
    const [documentToEdit, setDocumentToEdit] = useState<SalesInvoice | JournalEntry[] | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const availableIds = useMemo(() => {
        if (selectedType === 'Invoices') {
            return state.salesInvoices
                .filter(inv => inv.date === selectedDate)
                .map(inv => inv.id);
        } else { // Vouchers
            const voucherIds = new Set<string>();
            state.journalEntries
                .filter(je => je.date === selectedDate && !je.voucherId.startsWith('SI') && !je.voucherId.startsWith('COGS-'))
                .forEach(je => voucherIds.add(je.voucherId));
            return Array.from(voucherIds);
        }
    }, [selectedDate, selectedType, state.salesInvoices, state.journalEntries]);
    
    useEffect(() => {
        setSelectedId('');
    }, [selectedDate, selectedType]);

    useEffect(() => {
        if (selectedId) {
            if (selectedType === 'Invoices') {
                const invoice = state.salesInvoices.find(inv => inv.id === selectedId);
                setDocumentToEdit(invoice || null);
            } else {
                const entries = state.journalEntries.filter(je => je.voucherId === selectedId);
                setDocumentToEdit(entries.length > 0 ? entries : null);
            }
            setIsModalOpen(true);
        }
    }, [selectedId, selectedType, state.salesInvoices, state.journalEntries]);
    
    const handleSave = (updatedDocument: SalesInvoice | JournalEntry[]) => {
        if (Array.isArray(updatedDocument)) { // It's a voucher
            const batchActions = updatedDocument.map(entry => ({
                type: 'UPDATE_ENTITY' as const,
                payload: { entity: 'journalEntries' as const, data: entry }
            }));
            dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
            setNotification({ msg: `Voucher ${updatedDocument[0].voucherId} updated successfully.`, type: 'success' });
        } else { // It's an invoice
             const { totalBales, totalKg } = updatedDocument.items.reduce((acc, item) => {
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
            
            const finalInvoice = { ...updatedDocument, totalBales, totalKg };
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'salesInvoices', data: finalInvoice } });
            setNotification({ msg: `Invoice ${updatedDocument.id} updated successfully.`, type: 'success' });
        }
        setIsModalOpen(false);
        setSelectedId('');
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-slate-700 mb-4">Manual Entry Editor</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 border rounded-md bg-slate-50">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Date</label>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="mt-1 w-full p-2 rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Type</label>
                    <select value={selectedType} onChange={e => setSelectedType(e.target.value as any)} className="mt-1 w-full p-2 rounded-md">
                        <option>Invoices</option>
                        <option>Vouchers</option>
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">ID</label>
                    <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="mt-1 w-full p-2 rounded-md" disabled={availableIds.length === 0}>
                        <option value="">Select ID...</option>
                        {availableIds.map(id => <option key={id} value={id}>{id}</option>)}
                    </select>
                </div>
            </div>

            {isModalOpen && documentToEdit && (
                <EditModal
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setSelectedId(''); }}
                    document={documentToEdit}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    document: SalesInvoice | JournalEntry[];
    onSave: (updatedDocument: SalesInvoice | JournalEntry[]) => void;
}

const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, document, onSave }) => {
    const { state } = useData();
    const isInvoice = !Array.isArray(document);
    const [editedDoc, setEditedDoc] = useState(JSON.parse(JSON.stringify(document)));
    const [balanceError, setBalanceError] = useState<string | null>(null);

    const inputStyle = { backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' };
    
     useEffect(() => {
        if (!isInvoice) {
            const { debit, credit } = (editedDoc as JournalEntry[]).reduce((acc, entry) => ({
                debit: acc.debit + Number(entry.debit || 0),
                credit: acc.credit + Number(entry.credit || 0)
            }), { debit: 0, credit: 0 });
            
            if (Math.abs(debit - credit) > 0.001) {
                setBalanceError(`Voucher is unbalanced. Difference: ${(debit - credit).toFixed(2)}`);
            } else {
                setBalanceError(null);
            }
        }
    }, [editedDoc, isInvoice]);

    const handleSave = () => {
        if (!isInvoice && balanceError) {
            alert(balanceError);
            return;
        }
        onSave(editedDoc);
    };
    
    const handleInvoiceChange = (field: keyof SalesInvoice, value: any) => {
        setEditedDoc((prev: SalesInvoice) => ({ ...prev, [field]: value }));
    };

    const handleInvoiceItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
        setEditedDoc((prev: SalesInvoice) => {
            const newItems = [...prev.items];
            (newItems[index] as any)[field] = value;
            return { ...prev, items: newItems };
        });
    };
    
    const handleJournalEntryChange = (index: number, field: keyof JournalEntry, value: any) => {
        setEditedDoc((prev: JournalEntry[]) => {
            const newEntries = [...prev];
            (newEntries[index] as any)[field] = value;
            return newEntries;
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${isInvoice ? 'Invoice' : 'Voucher'} ${isInvoice ? (editedDoc as SalesInvoice).id : (editedDoc as JournalEntry[])[0].voucherId}`} size="5xl">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                {isInvoice ? (
                    // INVOICE EDIT FORM
                    <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={(editedDoc as SalesInvoice).date} onChange={e => handleInvoiceChange('date', e.target.value)} className="w-full p-2 rounded-md" style={inputStyle} /></div>
                            <div><label className="block text-sm font-medium text-slate-700">Customer</label><select value={(editedDoc as SalesInvoice).customerId} onChange={e => handleInvoiceChange('customerId', e.target.value)} className="w-full p-2 rounded-md" style={inputStyle}><option value="">Select</option>{state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="text-slate-700"><tr className="bg-slate-100"><th className="p-2">Item</th><th className="p-2 w-28">Quantity</th><th className="p-2 w-32">Rate</th><th className="p-2 w-32">Currency</th></tr></thead>
                            <tbody>
                                {(editedDoc as SalesInvoice).items.map((item, index) => (
                                    <tr key={index}><td className="p-1 text-slate-800">{state.items.find(i=>i.id===item.itemId)?.name}</td><td className="p-1"><input type="number" value={item.quantity} onChange={e => handleInvoiceItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-1 rounded-md text-right" style={inputStyle} /></td><td className="p-1"><input type="number" value={item.rate} onChange={e => handleInvoiceItemChange(index, 'rate', Number(e.target.value))} className="w-full p-1 rounded-md text-right" style={inputStyle} /></td><td className="p-1"><select value={item.currency} onChange={e => handleInvoiceItemChange(index, 'currency', e.target.value)} className="w-full p-1 rounded-md" style={inputStyle}>{Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}</select></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // VOUCHER EDIT FORM
                    <div className="space-y-4">
                        <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-md" style={{color: '#c2410c'}}>Note: Debit/Credit fields are always in USD. If you change Original Amount/Currency, please manually recalculate and update the Debit/Credit fields.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={(editedDoc as JournalEntry[])[0].date} onChange={e => handleJournalEntryChange(0, 'date', e.target.value)} className="w-full p-2 rounded-md" style={inputStyle} /></div>
                            <div><label className="block text-sm font-medium text-slate-700">Description</label><input type="text" value={(editedDoc as JournalEntry[])[0].description} onChange={e => handleJournalEntryChange(0, 'description', e.target.value)} className="w-full p-2 rounded-md" style={inputStyle} /></div>
                        </div>
                         <table className="w-full text-sm">
                            <thead className="text-slate-700"><tr className="bg-slate-100"><th className="p-2">Account</th><th className="p-2">Description</th><th className="p-2 w-32">Original Amt</th><th className="p-2 w-32">Currency</th><th className="p-2 w-32">Debit (USD)</th><th className="p-2 w-32">Credit (USD)</th></tr></thead>
                            <tbody>
                                {(editedDoc as JournalEntry[]).map((entry, index) => (
                                    <tr key={entry.id}>
                                        <td className="p-1 text-slate-800">{state.customers.find(c => c.id === entry.entityId)?.name || state.suppliers.find(s => s.id === entry.entityId)?.name || state.banks.find(b => b.id === entry.account)?.accountTitle || state.cashAccounts.find(c => c.id === entry.account)?.name || entry.account}</td>
                                        <td className="p-1"><input type="text" value={entry.description} onChange={e => handleJournalEntryChange(index, 'description', e.target.value)} className="w-full p-1 rounded-md" style={inputStyle}/></td>
                                        <td className="p-1"><input type="number" value={entry.originalAmount?.amount || ''} onChange={e => { const current = entry.originalAmount || { currency: Currency.Dollar, amount: 0 }; handleJournalEntryChange(index, 'originalAmount', { ...current, amount: Number(e.target.value) }); }} className="w-full p-1 rounded-md text-right" style={inputStyle}/></td>
                                        <td className="p-1"><select value={entry.originalAmount?.currency || ''} onChange={e => { const current = entry.originalAmount || { currency: Currency.Dollar, amount: 0 }; handleJournalEntryChange(index, 'originalAmount', { ...current, currency: e.target.value as Currency }); }} className="w-full p-1 rounded-md" style={inputStyle}>{Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                                        <td className="p-1"><input type="number" value={entry.debit} onChange={e => handleJournalEntryChange(index, 'debit', Number(e.target.value))} className="w-full p-1 rounded-md text-right" style={inputStyle}/></td>
                                        <td className="p-1"><input type="number" value={entry.credit} onChange={e => handleJournalEntryChange(index, 'credit', Number(e.target.value))} className="w-full p-1 rounded-md text-right" style={inputStyle}/></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {balanceError && <p className="text-right font-semibold text-red-600">{balanceError}</p>}
                    </div>
                )}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                <button onClick={handleSave} disabled={!!balanceError} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">Save Changes</button>
            </div>
        </Modal>
    );
};


const DataCorrectionManager: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const { state, dispatch } = useData();
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isBalanceResetConfirmOpen, setIsBalanceResetConfirmOpen] = useState(false);
    const [isHardResetConfirmOpen, setIsHardResetConfirmOpen] = useState(false);
    const [isClearStockConfirmOpen, setIsClearStockConfirmOpen] = useState(false);

    // New state for date-specific deletions
    const [productionDeleteDate, setProductionDeleteDate] = useState('');
    const [salesDeleteDate, setSalesDeleteDate] = useState('');
    const [isDeleteProductionConfirmOpen, setIsDeleteProductionConfirmOpen] = useState(false);
    const [isDeleteSalesConfirmOpen, setIsDeleteSalesConfirmOpen] = useState(false);

    const executePriceCorrection = () => {
        const batchUpdates: any[] = [];
        let updatedCount = 0;

        state.items.forEach(item => {
            if (item.packingType !== PackingType.Kg && item.baleSize > 0) {
                const newAvgProductionPrice = item.avgProductionPrice / item.baleSize;
                const newAvgSalesPrice = item.avgSalesPrice / item.baleSize;

                // Check if there's an actual change to avoid unnecessary updates
                if (newAvgProductionPrice !== item.avgProductionPrice || newAvgSalesPrice !== item.avgSalesPrice) {
                    batchUpdates.push({
                        type: 'UPDATE_ENTITY',
                        payload: {
                            entity: 'items',
                            data: {
                                id: item.id,
                                avgProductionPrice: newAvgProductionPrice,
                                avgSalesPrice: newAvgSalesPrice,
                            },
                        },
                    });
                    updatedCount++;
                }
            }
        });

        if (batchUpdates.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchUpdates });
            setNotification({ msg: `Successfully corrected prices for ${updatedCount} items.`, type: 'success' });
        } else {
            setNotification({ msg: "No items required price correction.", type: 'success' });
        }
        setIsConfirmModalOpen(false); // Close modal on completion
    };
    
    const handlePriceCorrection = () => {
        setIsConfirmModalOpen(true);
    };

    const handleCancel = () => {
        setIsConfirmModalOpen(false);
        setNotification({ msg: "Price Correction cancelled.", type: 'success' });
    };
    
    const executeBalanceReset = () => {
        const batchUpdates: any[] = [];
        let updatedCount = 0;

        const processEntityList = (entityName: 'customers' | 'suppliers' | 'commissionAgents' | 'freightForwarders' | 'clearingAgents' | 'expenseAccounts') => {
            const list = state[entityName] as ({ id: string, startingBalance?: number })[];
            list.forEach(entity => {
                if (entity.startingBalance && entity.startingBalance !== 0) {
                    batchUpdates.push({
                        type: 'UPDATE_ENTITY',
                        payload: {
                            entity: entityName,
                            data: { id: entity.id, startingBalance: 0 }
                        }
                    });
                    updatedCount++;
                }

                // Delete associated opening balance journal entries
                const debitEntryId = `je-d-ob-${entity.id}`;
                const creditEntryId = `je-c-ob-${entity.id}`;
                
                if (state.journalEntries.some(je => je.id === debitEntryId)) {
                    batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: debitEntryId } });
                }
                if (state.journalEntries.some(je => je.id === creditEntryId)) {
                     batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: creditEntryId } });
                }
            });
        };

        processEntityList('customers');
        processEntityList('suppliers');
        processEntityList('commissionAgents');
        processEntityList('freightForwarders');
        processEntityList('clearingAgents');
        processEntityList('expenseAccounts');
        
        if (batchUpdates.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchUpdates });
            setNotification({ msg: `Successfully reset opening balances for ${updatedCount} entities and cleared related journal entries.`, type: 'success' });
        } else {
            setNotification({ msg: "No entity opening balances needed resetting.", type: 'success' });
        }
        setIsBalanceResetConfirmOpen(false);
    };

    const executeHardReset = () => {
        dispatch({ type: 'HARD_RESET_TRANSACTIONS' });
        setNotification({ msg: `Successfully reset all transactional data.`, type: 'success' });
        setIsHardResetConfirmOpen(false);
    };
    
    const executeClearOpeningStock = () => {
        const batchUpdates: any[] = [];
        let updatedCount = 0;

        state.items.forEach(item => {
            if (item.openingStock && item.openingStock > 0) {
                // 1. Set opening stock to 0
                batchUpdates.push({
                    type: 'UPDATE_ENTITY',
                    payload: {
                        entity: 'items',
                        data: { id: item.id, openingStock: 0 }
                    }
                });

                // 2. Delete the associated production entry
                const prodId = `prod_open_stock_${item.id}`;
                if (state.productions.some(p => p.id === prodId)) {
                    batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'productions', id: prodId } });
                }

                // 3. Delete the associated journal entries
                const osDebitId = `je-d-os-${item.id}`;
                const osCreditId = `je-c-os-${item.id}`;
                if (state.journalEntries.some(je => je.id === osDebitId)) {
                    batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: osDebitId } });
                }
                if (state.journalEntries.some(je => je.id === osCreditId)) {
                    batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: osCreditId } });
                }
                
                updatedCount++;
            }
        });

        if (batchUpdates.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchUpdates });
            setNotification({ msg: `Successfully cleared opening stock for ${updatedCount} items and removed associated entries.`, type: 'success' });
        } else {
            setNotification({ msg: "No items had opening stock to clear.", type: 'success' });
        }
        setIsClearStockConfirmOpen(false);
    };

    const executeDeleteProductionByDate = () => {
        if (!productionDeleteDate) return;
        
        const entriesToDelete = state.productions.filter(p => p.date === productionDeleteDate);
        const batchActions = entriesToDelete.map(p => ({
            type: 'DELETE_ENTITY' as const,
            payload: { entity: 'productions' as const, id: p.id }
        }));

        if (batchActions.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
            setNotification({ msg: `Successfully deleted ${batchActions.length} production records for ${productionDeleteDate}.`, type: 'success' });
        } else {
            setNotification({ msg: `No production records found for ${productionDeleteDate}.`, type: 'error' });
        }
        setIsDeleteProductionConfirmOpen(false);
    };

    const executeDeleteSalesByDate = () => {
        if (!salesDeleteDate) return;

        const invoicesToDelete = state.salesInvoices.filter(inv => inv.date === salesDeleteDate);
        const batchActions: any[] = [];

        invoicesToDelete.forEach(inv => {
            // 1. Delete Invoice
            batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'salesInvoices', id: inv.id } });

            // 2. Find and delete associated Journal Entries
            // Logic: Find JEs where voucherId contains the invoice ID.
            // Standard Invoice Voucher: inv.id (e.g., SI-001)
            // COGS Voucher: COGS-{inv.id} (e.g., COGS-SI-001)
            // Also check description just in case
            const associatedJEs = state.journalEntries.filter(je => 
                je.voucherId === inv.id || 
                je.voucherId === `COGS-${inv.id}` ||
                je.description.includes(inv.id)
            );
            
            associatedJEs.forEach(je => {
                batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: je.id } });
            });
        });

        if (batchActions.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
            setNotification({ msg: `Successfully deleted ${invoicesToDelete.length} sales invoices and related journal entries for ${salesDeleteDate}.`, type: 'success' });
        } else {
            setNotification({ msg: `No sales invoices found for ${salesDeleteDate}.`, type: 'error' });
        }
        setIsDeleteSalesConfirmOpen(false);
    };


    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-slate-700 mb-4">Data Correction Tools</h2>
             <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6" role="alert">
                <h3 className="font-bold text-red-800">Use with Extreme Caution</h3>
                <p className="text-sm text-red-700 mt-1">
                    The tools in this section perform irreversible bulk data operations. Always download a backup before proceeding.
                </p>
            </div>
            
             <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Date-Specific Data Deletion</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Production Deletion */}
                    <div className="p-4 border rounded-md bg-slate-50">
                         <label className="block text-sm font-medium text-slate-700 mb-1">Delete Production Data</label>
                         <div className="flex gap-2">
                             <input 
                                type="date" 
                                value={productionDeleteDate} 
                                onChange={(e) => setProductionDeleteDate(e.target.value)} 
                                className="flex-grow p-2 border border-slate-300 rounded-md text-sm"
                            />
                            <button
                                onClick={() => {
                                    if (productionDeleteDate) setIsDeleteProductionConfirmOpen(true);
                                    else setNotification({ msg: "Please select a date first.", type: "error" });
                                }}
                                className="px-3 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors text-sm"
                            >
                                Delete
                            </button>
                         </div>
                         <p className="text-xs text-slate-500 mt-1">Deletes all production entries for the selected date.</p>
                    </div>

                    {/* Sales Deletion */}
                    <div className="p-4 border rounded-md bg-slate-50">
                         <label className="block text-sm font-medium text-slate-700 mb-1">Delete Sales Data</label>
                         <div className="flex gap-2">
                             <input 
                                type="date" 
                                value={salesDeleteDate} 
                                onChange={(e) => setSalesDeleteDate(e.target.value)} 
                                className="flex-grow p-2 border border-slate-300 rounded-md text-sm"
                            />
                            <button
                                onClick={() => {
                                    if (salesDeleteDate) setIsDeleteSalesConfirmOpen(true);
                                    else setNotification({ msg: "Please select a date first.", type: "error" });
                                }}
                                className="px-3 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors text-sm"
                            >
                                Delete
                            </button>
                         </div>
                         <p className="text-xs text-slate-500 mt-1">Deletes all invoices and related journal entries for the selected date.</p>
                    </div>
                </div>
            </div>
            
            <div className="border-t pt-4 mt-6">
                <h3 className="text-lg font-semibold text-slate-800">Correct Item Prices (Unit to Kg)</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    This tool converts 'Average Production Price' and 'Average Sales Price' from a per-unit (Bale, Box, Sack) price to a per-Kg price by dividing by the item's 'Packing Size'. This is useful if you accidentally imported unit prices instead of Kg prices.
                </p>
                <button
                    onClick={handlePriceCorrection}
                    className="px-4 py-2 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Run Price Correction Script
                </button>
            </div>
            
            <div className="border-t pt-4 mt-6">
                <h3 className="text-lg font-semibold text-slate-800">Clear All Item Opening Stock</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    This action will set the 'openingStock' of all items to 0. It will also delete the special production and journal entries that were created to account for this opening stock. Regular production entries will not be affected.
                </p>
                <button
                    onClick={() => setIsClearStockConfirmOpen(true)}
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.5 9.5a7 7 0 112.1-5.1" /></svg>
                    Clear Item Opening Stock
                </button>
            </div>

            <div className="border-t pt-4 mt-6">
                <h3 className="text-lg font-semibold text-slate-800">Reset All Entity Opening Balances</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    This action will set the 'startingBalance' of all Customers, Suppliers, all Agents, and Expense Accounts to 0. It will also delete their associated opening balance journal entries.
                </p>
                <button
                    onClick={() => setIsBalanceResetConfirmOpen(true)}
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.5 9.5a7 7 0 112.1-5.1" /></svg>
                    Reset Opening Balances
                </button>
            </div>

            <div className="border-t pt-4 mt-6">
                <h3 className="text-lg font-semibold text-red-800">Hard Reset All Transactions</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    This action will permanently delete <strong>ALL</strong> transactional data, including:
                    <ul className="list-disc list-inside ml-4 mt-2">
                        <li>All Sales Invoices & Purchase Invoices</li>
                        <li>All Accounting Vouchers (Receipts, Payments, etc.)</li>
                        <li>All Journal Entries</li>
                        <li>All Production, Opening, & Stock Movement records</li>
                    </ul>
                    This will effectively reset all account balances (like Accounts Receivable, Revenue) to zero. Setup data (customers, items, etc.) will NOT be deleted.
                </p>
                <button
                    onClick={() => setIsHardResetConfirmOpen(true)}
                    className="px-4 py-2 bg-red-700 text-white font-semibold rounded-md hover:bg-red-800 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Hard Reset All Transactions
                </button>
            </div>

             {isConfirmModalOpen && (
                 <Modal
                    isOpen={isConfirmModalOpen}
                    onClose={handleCancel}
                    title="Confirm Price Correction"
                    size="lg"
                 >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600">WARNING: This is an irreversible action.</p>
                        <p className="text-slate-700">This will permanently modify the prices of all items not packed in 'Kg'.</p>
                        <p className="text-slate-600 bg-slate-100 p-2 rounded-md font-mono text-sm">
                            New Price = Current Price / Packing Size
                        </p>
                        <p className="text-slate-700">Are you sure you want to proceed?</p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={handleCancel} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executePriceCorrection} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                 </Modal>
            )}
            
            {isClearStockConfirmOpen && (
                 <Modal
                    isOpen={isClearStockConfirmOpen}
                    onClose={() => setIsClearStockConfirmOpen(false)}
                    title="Confirm Clear Opening Stock"
                    size="lg"
                 >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600">DANGER: This action is irreversible.</p>
                        <p className="text-slate-700">This will permanently set the `openingStock` of <strong>ALL</strong> items to 0.</p>
                        <p className="text-slate-700">It will also delete the associated opening stock production and journal entries. <strong>Regular production entries will not be affected.</strong></p>
                        <p className="text-slate-700">Are you absolutely sure you want to proceed?</p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsClearStockConfirmOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executeClearOpeningStock} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Yes, Clear Opening Stock
                            </button>
                        </div>
                    </div>
                 </Modal>
            )}

            {isBalanceResetConfirmOpen && (
                 <Modal
                    isOpen={isBalanceResetConfirmOpen}
                    onClose={() => setIsBalanceResetConfirmOpen(false)}
                    title="Confirm Opening Balances Reset"
                    size="lg"
                 >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600">DANGER: This is an irreversible bulk data operation.</p>
                        <p className="text-slate-700">This will permanently set the `startingBalance` of <strong>ALL</strong> Customers, Suppliers, all Agents, and Expense Accounts to 0.</p>
                        <p className="text-slate-700">It will also delete all associated opening balance journal entries, which could affect historical reports if not done carefully.</p>
                        <p className="text-slate-700">Are you absolutely sure you want to proceed?</p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsBalanceResetConfirmOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executeBalanceReset} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Yes, Reset Opening Balances
                            </button>
                        </div>
                    </div>
                 </Modal>
            )}

            {isHardResetConfirmOpen && (
                 <Modal
                    isOpen={isHardResetConfirmOpen}
                    onClose={() => setIsHardResetConfirmOpen(false)}
                    title="CONFIRM HARD RESET"
                    size="lg"
                 >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600 text-lg">DANGER: THIS WILL DELETE ALL TRANSACTIONAL DATA.</p>
                        <p className="text-slate-700">You are about to delete all sales, purchases, vouchers, and journal entries. This action cannot be undone and will reset your accounting and inventory to a clean slate.</p>
                        <p className="text-slate-700">Are you absolutely sure you want to proceed?</p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsHardResetConfirmOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executeHardReset} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-800">
                                Yes, Delete All Transactions
                            </button>
                        </div>
                    </div>
                 </Modal>
            )}

            {/* Date-Specific Delete Confirmation Modals */}
            {isDeleteProductionConfirmOpen && (
                <Modal
                    isOpen={isDeleteProductionConfirmOpen}
                    onClose={() => setIsDeleteProductionConfirmOpen(false)}
                    title={`Confirm Delete Production Data`}
                    size="lg"
                >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600">WARNING: This action cannot be undone.</p>
                        <p className="text-slate-700">
                            You are about to delete <strong>ALL</strong> production entries for date: <strong>{productionDeleteDate}</strong>.
                        </p>
                        <p className="text-slate-700">
                             Found: <strong>{state.productions.filter(p => p.date === productionDeleteDate).length}</strong> entries.
                        </p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsDeleteProductionConfirmOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executeDeleteProductionByDate} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isDeleteSalesConfirmOpen && (
                <Modal
                    isOpen={isDeleteSalesConfirmOpen}
                    onClose={() => setIsDeleteSalesConfirmOpen(false)}
                    title={`Confirm Delete Sales Data`}
                    size="lg"
                >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600">WARNING: This action cannot be undone.</p>
                        <p className="text-slate-700">
                            You are about to delete <strong>ALL</strong> sales invoices and their associated journal entries for date: <strong>{salesDeleteDate}</strong>.
                        </p>
                         <p className="text-slate-700">
                             Found: <strong>{state.salesInvoices.filter(p => p.date === salesDeleteDate).length}</strong> invoices.
                        </p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsDeleteSalesConfirmOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executeDeleteSalesByDate} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};


const BackupRestoreManager: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const { state, dispatch } = useData();
    const [isRestoring, setIsRestoring] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadBackup = () => {
        try {
            const stateJson = JSON.stringify(state, null, 2);
            const blob = new Blob([stateJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            link.download = `backup_${date}.json`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setNotification({ msg: "Backup downloaded successfully.", type: 'success' });
        } catch (error) {
            console.error("Backup failed:", error);
            setNotification({ msg: "Backup failed. See console for details.", type: 'error' });
        }
    };
    
    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsRestoring(true);
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parsedData = JSON.parse(text) as AppState;

                // Basic validation
                if (typeof parsedData !== 'object' || !parsedData.customers || !parsedData.items) {
                    throw new Error("Invalid backup file format.");
                }
                
                const confirmation = window.confirm(
                    "WARNING: You are about to overwrite ALL existing data with the content of this backup file. This action CANNOT be undone. Are you absolutely sure you want to proceed?"
                );

                if (confirmation) {
                    dispatch({ type: 'RESTORE_STATE', payload: parsedData });
                    setNotification({ msg: "Data restored successfully. The page will now reload.", type: 'success' });
                    // Reload to ensure all components re-render with fresh state
                    setTimeout(() => window.location.reload(), 2000);
                }
            } catch (error) {
                console.error("Restore failed:", error);
                setNotification({ msg: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}.`, type: 'error' });
            } finally {
                setIsRestoring(false);
                 if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        
        reader.onerror = () => {
             setNotification({ msg: "Failed to read the file.", type: 'error' });
             setIsRestoring(false);
        };

        reader.readAsText(file);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-slate-700 mb-4">Data Backup & Restore</h2>
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6" role="alert">
                <h3 className="font-bold text-amber-800">Important Information</h3>
                <ul className="list-disc list-inside text-sm text-amber-700 mt-2 space-y-1">
                    <li><b>Download Backup:</b> Saves a complete copy of all your application data to your computer as a <code>.json</code> file.</li>
                    <li><b>Upload & Restore:</b> Overwrites <b>ALL</b> current data in the application with the data from a selected backup file. This action cannot be undone.</li>
                    <li className="font-semibold">It is strongly recommended to download a fresh backup before restoring from an old one.</li>
                </ul>
            </div>
            <div className="flex space-x-4">
                <button 
                    onClick={handleDownloadBackup}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Backup
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} accept=".json" />
                <button 
                    onClick={handleRestoreClick}
                    disabled={isRestoring}
                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors disabled:bg-green-300 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    {isRestoring ? 'Restoring...' : 'Upload & Restore'}
                </button>
            </div>
        </div>
    );
};


const AdminModule: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const { userProfile } = useData();
    
    return (
        <div className="space-y-8">
            {userProfile?.isAdmin && <UserManager setNotification={setNotification} />}
            <ManualEditManager setNotification={setNotification} />
            {userProfile?.isAdmin && <DataCorrectionManager setNotification={setNotification} />}
            {userProfile?.isAdmin && <BackupRestoreManager setNotification={setNotification} />}
        </div>
    );
};

export default AdminModule;