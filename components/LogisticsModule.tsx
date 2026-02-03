import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext.tsx';
import { LogisticsEntry, LogisticsStatus, DocumentStatus, OriginalPurchased, FinishedGoodsPurchase, Supplier, UserProfile } from '../types.ts';

const LogisticsModule: React.FC<{ userProfile: UserProfile | null }> = ({ userProfile }) => {
    const { state, dispatch } = useData();
    const [editingRowId, setEditingRowId] = useState<number | null>(null);
    const [editedData, setEditedData] = useState<LogisticsEntry | null>(null);
    const [filters, setFilters] = useState({
        supplierId: '',
        containerNumber: '',
        batchNumber: '',
        status: '',
    });
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    type PurchaseSource = (OriginalPurchased | FinishedGoodsPurchase) & { type: 'original' | 'finished' };
    
    const purchasesWithContainers = useMemo<PurchaseSource[]>(() => {
        const original = state.originalPurchases
            .filter(p => p.containerNumber)
            .map(p => ({ ...p, type: 'original' as const }));
        const finished = state.finishedGoodsPurchases
            .filter(p => p.containerNumber)
            .map(p => ({ ...p, type: 'finished' as const }));
        
        return [...original, ...finished];
    }, [state.originalPurchases, state.finishedGoodsPurchases]);

    const uniqueContainerNumbers = useMemo(() => {
        const relevantPurchases = filters.supplierId
            ? purchasesWithContainers.filter(p => p.supplierId === filters.supplierId)
            : purchasesWithContainers;
            
        const numbers = new Set<string>();
        relevantPurchases.forEach(p => {
            if (p.containerNumber) {
                numbers.add(p.containerNumber);
            }
        });
        return Array.from(numbers).sort();
    }, [purchasesWithContainers, filters.supplierId]);

    const uniqueBatchNumbers = useMemo(() => {
        const relevantPurchases = filters.supplierId
            ? purchasesWithContainers.filter(p => p.supplierId === filters.supplierId)
            : purchasesWithContainers;

        const numbers = new Set<string>();
        relevantPurchases.forEach(p => {
            if (p.batchNumber) {
                numbers.add(p.batchNumber);
            }
        });
        return Array.from(numbers).sort();
    }, [purchasesWithContainers, filters.supplierId]);


    const suppliersMap = useMemo(() => new Map(state.suppliers.map(s => [s.id, s.name])), [state.suppliers]);
    const clearingAgentsMap = useMemo(() => new Map(state.clearingAgents.map(c => [c.id, c.name])), [state.clearingAgents]);
    const divisionsMap = useMemo(() => new Map(state.divisions.map(d => [d.id, d.name])), [state.divisions]);
    const originalTypesMap = useMemo(() => new Map(state.originalTypes.map(ot => [ot.id, ot.name])), [state.originalTypes]);
    const purchasesWithContainersMap = useMemo(() => new Map(purchasesWithContainers.map(p => [p.id, p])), [purchasesWithContainers]);
    const warehousesMap = useMemo(() => new Map(state.warehouses.map(w => [w.id, w.name])), [state.warehouses]);
    
    const allLogisticsEntries = useMemo(() => {
        const existingPurchaseIds = new Set(state.logisticsEntries.map(e => e.purchaseId));
        const existingEntries = state.logisticsEntries;

        // FIX: Cast the array from map values to the correct type to resolve type inference issues.
        const placeholderEntries: LogisticsEntry[] = (Array.from(purchasesWithContainersMap.values()) as PurchaseSource[])
            .filter(p => !existingPurchaseIds.has(p.id))
            .map((p, index) => ({
                id: -(index + 1), // temporary negative ID
                purchaseId: p.id,
                batchNumber: p.batchNumber || '',
                dateOfLoading: p.date,
                status: LogisticsStatus.InTransit,
                etd: '', eta: '', portStorage: '', doVld: '', ground: '', unload: '',
                receiveWeight: undefined,
                freightForwarderId: p.freightForwarderId,
                documentStatus: DocumentStatus.Pending,
                clearingBill: '',
            }));

        return [...existingEntries, ...placeholderEntries];
    }, [purchasesWithContainersMap, state.logisticsEntries]);

    const notifications = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const twoDaysFromNow = new Date(today);
        twoDaysFromNow.setDate(today.getDate() + 2);

        const activeNotifications: { id: string; message: string }[] = [];

        allLogisticsEntries.forEach(entry => {
            if (entry.status === LogisticsStatus.Cleared) {
                return; // Skip cleared containers
            }

            const purchase = purchasesWithContainersMap.get(entry.purchaseId);
            const containerNumber = purchase?.containerNumber || 'N/A';

            const checkDate = (dateStr: string | undefined, type: 'ETD' | 'ETA') => {
                if (!dateStr) return;
                
                const [year, month, day] = dateStr.split('-').map(Number);
                const eventDate = new Date(year, month - 1, day);
                eventDate.setHours(0,0,0,0);

                if (eventDate >= today && eventDate <= twoDaysFromNow) {
                    const timeDiff = eventDate.getTime() - today.getTime();
                    const daysLeft = Math.round(timeDiff / (1000 * 3600 * 24));
                    
                    let dayString;
                    if (daysLeft === 0) dayString = 'is today';
                    else if (daysLeft === 1) dayString = 'is tomorrow';
                    else dayString = `is in ${daysLeft} days`;

                    activeNotifications.push({
                        id: `${entry.id}-${type}`,
                        message: `Container ${containerNumber} ${type} ${dayString} (on ${dateStr}).`,
                    });
                }
            };
            
            checkDate(entry.etd, 'ETD');
            // FIX: Removed redundant comment. The logic is correct as it checks for ETA notifications only when the container has not arrived.
            if (entry.status !== LogisticsStatus.Arrived) {
                 checkDate(entry.eta, 'ETA');
            }
        });

        return activeNotifications;
    }, [allLogisticsEntries, purchasesWithContainersMap]);

    const displayEntries = useMemo(() => {
        const filteredEntries = allLogisticsEntries.filter(entry => {
            const purchase = purchasesWithContainersMap.get(entry.purchaseId);
            if (!purchase) return false;

            const supplierMatch = !filters.supplierId || purchase.supplierId === filters.supplierId;
            const containerMatch = !filters.containerNumber || purchase.containerNumber === filters.containerNumber;
            const batchMatch = !filters.batchNumber || purchase.batchNumber === filters.batchNumber;
            const statusMatch = !filters.status || entry.status === filters.status;
            
            return supplierMatch && containerMatch && batchMatch && statusMatch;
        });
        
        // Sort by purchase date, descending
        filteredEntries.sort((a, b) => {
            const dateA = new Date(purchasesWithContainersMap.get(a.purchaseId)?.date || 0);
            const dateB = new Date(purchasesWithContainersMap.get(b.purchaseId)?.date || 0);
            return dateB.getTime() - dateA.getTime();
        });

        return filteredEntries;
    }, [allLogisticsEntries, filters, purchasesWithContainersMap]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [notificationRef]);

    const getPurchaseDetails = (purchaseId: string) => {
        const purchase = purchasesWithContainersMap.get(purchaseId);
        if (!purchase) return null;

        let category = 'N/A';
        if (purchase.type === 'original') {
            category = originalTypesMap.get((purchase as OriginalPurchased).originalTypeId) || 'Original';
        } else {
            category = 'Finished Goods';
        }

        return {
            supplierName: suppliersMap.get(purchase.supplierId) || 'N/A',
            category,
            divisionName: divisionsMap.get(purchase.divisionId) || 'N/A',
            batchNumber: purchase.batchNumber || '',
            containerNumber: purchase.containerNumber || 'N/A',
            invoicedWeight: purchase.containerInvoicedWeight || 0,
            clearingAgentName: clearingAgentsMap.get(purchase.clearingAgentId || '') || 'N/A',
        };
    };
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => {
            const newFilters = { ...prev, [name]: value };
            if (name === 'supplierId') {
                newFilters.containerNumber = '';
                newFilters.batchNumber = '';
            }
            return newFilters;
        });
    };

    const resetFilters = () => {
        setFilters({
            supplierId: '',
            containerNumber: '',
            batchNumber: '',
            status: '',
        });
    };

    const handleEditedDataChange = (field: keyof LogisticsEntry, value: any) => {
        if (!editedData) return;
        setEditedData(prev => prev ? ({ ...prev, [field]: value }) : null);
    };
    
    const handleStartEdit = (entry: LogisticsEntry) => {
        setEditingRowId(entry.id);
        setEditedData({ ...entry });
    };

    const handleCancelEdit = () => {
        setEditingRowId(null);
        setEditedData(null);
    };

    const handleSaveEdit = () => {
        if (!editedData) return;

        if (editedData.id < 0) {
            const entryToSave: LogisticsEntry = {
                ...editedData,
                id: state.nextLogisticsSNo,
                receiveWeight: Number(editedData.receiveWeight) || undefined,
            };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'logisticsEntries', data: entryToSave } });
        } else {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'logisticsEntries', data: {...editedData, receiveWeight: Number(editedData.receiveWeight) || undefined} } });
        }
        
        handleCancelEdit();
    };
    
    const handleDelete = (id: number) => {
        if (window.confirm('Are you sure you want to delete this logistics entry?')) {
            dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'logisticsEntries', id } });
        }
    };
    
    const renderCell = (value: React.ReactNode, className = "") => (
        <td className={`p-1 border border-slate-300 whitespace-nowrap text-slate-800 ${className}`}>{value}</td>
    );

    const renderInput = (value: string | number | undefined, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type = "text") => (
        <input type={type} value={value || ''} onChange={onChange} className="w-full p-1 bg-transparent border-blue-400 border rounded-sm text-slate-800" />
    );

    const renderDateInput = (value: string | undefined, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, min?: string) => (
        <input type="date" value={value || ''} onChange={onChange} min={min} className="w-full p-1 bg-transparent border-blue-400 border rounded-sm text-slate-800" />
    );

    const renderSelect = (value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: {value: string, label: string}[]) => (
         <select value={value} onChange={onChange} className="w-full p-1 bg-transparent border-blue-400 border rounded-sm text-slate-800">
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    );

    const renderSelectWithOptions = (value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: {value: string, label: string}[]) => (
        <select value={value} onChange={onChange} className="w-full p-1 bg-transparent border-blue-400 border rounded-sm text-slate-800">
           <option value="">Select...</option>
           {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
       </select>
   );
    
    const renderRow = (rowData: LogisticsEntry, isEditing: boolean) => {
        const data = isEditing ? editedData : rowData;
        if (!data) return null;

        const purchase = purchasesWithContainersMap.get(data.purchaseId);
        const details = getPurchaseDetails(data.purchaseId);
        const handleChange = (field: keyof LogisticsEntry, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => handleEditedDataChange(field, e.target.value);
        
        const ffId = data.freightForwarderId || purchase?.freightForwarderId;
        const freightForwarder = ffId ? state.freightForwarders.find(ff => ff.id === ffId) : undefined;
        
        const warehouseName = data.warehouseId ? warehousesMap.get(data.warehouseId) : '';

        const clearingDisplay = data.clearingBill || (purchase?.clearingAmount ? `${purchase.clearingAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${purchase.clearingCurrency}` : '');

        return (
            <tr key={data.id} className={isEditing ? 'bg-yellow-100' : (data.id < 0 ? 'bg-slate-50' : 'bg-white')}>
                {renderCell(data.id > 0 ? data.id : 'New', "text-center font-medium")}
                {isEditing ? renderCell(renderInput(data.batchNumber, e => handleChange('batchNumber', e))) : renderCell(details?.batchNumber || data.batchNumber)}
                {isEditing ? renderCell(renderDateInput(data.dateOfLoading, e => handleChange('dateOfLoading', e))) : renderCell(data.dateOfLoading)}
                {renderCell(details?.supplierName)}
                {renderCell(details?.divisionName)}
                {renderCell(details?.containerNumber)}
                {renderCell(details?.category)}
                {renderCell(details?.invoicedWeight, 'text-right')}
                {isEditing ? renderCell(renderSelect(data.status, e => handleChange('status', e), Object.values(LogisticsStatus).map(s => ({value: s, label: s})))) : renderCell(data.status)}
                {isEditing ? renderCell(renderDateInput(data.etd, e => handleChange('etd', e))) : renderCell(data.etd)}
                {isEditing ? renderCell(renderDateInput(data.eta, e => handleChange('eta', e))) : renderCell(data.eta)}
                {isEditing ? renderCell(renderDateInput(data.portStorage, e => handleChange('portStorage', e))) : renderCell(data.portStorage)}
                {isEditing ? renderCell(renderDateInput(data.doVld, e => handleChange('doVld', e))) : renderCell(data.doVld)}
                {isEditing ? renderCell(renderDateInput(data.ground, e => handleChange('ground', e))) : renderCell(data.ground)}
                {isEditing ? renderCell(renderDateInput(data.unload, e => handleChange('unload', e))) : renderCell(data.unload)}
                {isEditing ? renderCell(renderInput(data.receiveWeight, e => handleChange('receiveWeight', e), "number"), "text-right") : renderCell(data.receiveWeight, "text-right")}
                {isEditing ? renderCell(renderSelectWithOptions(data.warehouseId || '', e => handleChange('warehouseId', e), state.warehouses.map(w => ({value: w.id, label: w.name})))) : renderCell(warehouseName)}
                {isEditing ? renderCell(renderSelectWithOptions(data.freightForwarderId || '', e => handleChange('freightForwarderId', e), state.freightForwarders.map(ff => ({value: ff.id, label: ff.name})))) : renderCell(freightForwarder?.name)}
                {isEditing ? renderCell(renderSelect(data.documentStatus, e => handleChange('documentStatus', e), Object.values(DocumentStatus).map(s => ({value: s, label: s})))) : renderCell(data.documentStatus)}
                {renderCell(details?.clearingAgentName)}
                {isEditing ? renderCell(renderInput(data.clearingBill, e => handleChange('clearingBill', e))) : renderCell(clearingDisplay)}
                {renderCell(isEditing ? (
                    <div className="flex gap-1">
                        <button onClick={handleSaveEdit} className="px-2 py-1 bg-green-500 text-white rounded text-xs">Save</button>
                        <button onClick={handleCancelEdit} className="px-2 py-1 bg-gray-500 text-white rounded text-xs">Cancel</button>
                    </div>
                ) : (
                    <div className="flex gap-1">
                        {userProfile?.isAdmin && (
                            <>
                                <button onClick={() => handleStartEdit(rowData)} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">Edit</button>
                                <button 
                                    onClick={() => handleDelete(rowData.id)} 
                                    disabled={rowData.id < 0}
                                    className={`px-2 py-1 bg-red-500 text-white rounded text-xs ${rowData.id < 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'}`}
                                >
                                    Delete
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </tr>
        );
    };
    
    const renderHeader = (label: string, className = "") => <th className={`p-1 border border-slate-300 font-semibold text-slate-600 sticky top-0 bg-slate-100 ${className}`}>{label}</th>;
    
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">Logistics Management</h1>
            
             <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="p-4 bg-slate-50 rounded-lg border flex flex-wrap gap-4 items-center">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                        <select name="supplierId" value={filters.supplierId} onChange={handleFilterChange} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                            <option value="">All Suppliers</option>
                            {Array.from(suppliersMap.entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Container #</label>
                        <select name="containerNumber" value={filters.containerNumber} onChange={handleFilterChange} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                            <option value="">All Containers</option>
                            {uniqueContainerNumbers.map(cn => <option key={cn} value={cn}>{cn}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Batch #</label>
                        <select name="batchNumber" value={filters.batchNumber} onChange={handleFilterChange} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                            <option value="">All Batches</option>
                            {uniqueBatchNumbers.map(bn => <option key={bn} value={bn}>{bn}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                        <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                            <option value="">All Statuses</option>
                            {Object.values(LogisticsStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <button onClick={resetFilters} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm mt-auto">Reset Filters</button>
                    <div ref={notificationRef} className="relative ml-auto mt-auto">
                        <button
                            onClick={() => setIsNotificationsOpen(prev => !prev)}
                            className="relative p-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
                            aria-label={`View notifications (${notifications.length})`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {notifications.length > 0 && (
                                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                                    {notifications.length}
                                </span>
                            )}
                        </button>
                        {isNotificationsOpen && (
                            <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-md shadow-lg border z-20">
                                <div className="p-3 border-b font-semibold text-slate-700">Notifications</div>
                                {notifications.length > 0 ? (
                                    <ul className="max-h-80 overflow-y-auto">
                                        {notifications.map(notif => (
                                            <li key={notif.id} className="px-3 py-2 border-b text-sm text-slate-600 hover:bg-slate-50">
                                                {notif.message}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="p-4 text-sm text-center text-slate-500">No upcoming events.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-100">
                            {renderHeader('S.No', 'text-center')}
                            {renderHeader('Batch #')}
                            {renderHeader('Loading Date')}
                            {renderHeader('Supplier')}
                            {renderHeader('Division')}
                            {renderHeader('Container #')}
                            {renderHeader('Category')}
                            {renderHeader('Inv. Wt', 'text-right')}
                            {renderHeader('Status')}
                            {renderHeader('ETD')}
                            {renderHeader('ETA')}
                            {renderHeader('Port Storage')}
                            {renderHeader('D/o VLD')}
                            {renderHeader('Ground')}
                            {renderHeader('Unload')}
                            {renderHeader('Rec. Wt', 'text-right')}
                            {renderHeader('Warehouse')}
                            {renderHeader('F.FDR')}
                            {renderHeader('Docs Status')}
                            {renderHeader('C. Agent')}
                            {renderHeader('Clearing Bill / Amt')}
                            {renderHeader('Actions')}
                        </tr>
                    </thead>
                    <tbody>
                        {displayEntries.map(entry => renderRow(entry, editingRowId === entry.id))}
                        {displayEntries.length === 0 && (
                            <tr>
                                <td colSpan={22} className="text-center text-slate-500 py-6">No entries match the current filters.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LogisticsModule;