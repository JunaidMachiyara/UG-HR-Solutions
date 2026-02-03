import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { FixedAsset, AssetType, DepreciationEntry, UserProfile, JournalEntryType, JournalEntry } from '../types.ts';
import { generateFixedAssetId } from '../utils/idGenerator.ts';
import Modal from './ui/Modal.tsx';

interface FixedAssetsModuleProps {
    userProfile: UserProfile | null;
    showNotification: (msg: string) => void;
}

const FixedAssetsModule: React.FC<FixedAssetsModuleProps> = ({ userProfile, showNotification }) => {
    const { state } = useData();
    const [activeModal, setActiveModal] = useState<'new' | 'edit' | 'periodicDepreciation' | 'history' | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

    const handleOpenModal = (modal: 'new' | 'edit' | 'periodicDepreciation' | 'history', asset?: FixedAsset) => {
        setSelectedAsset(asset || null);
        setActiveModal(modal);
    };

    const handleCloseModal = () => {
        setActiveModal(null);
        setSelectedAsset(null);
    };

    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    const assetsWithValues = useMemo(() => {
        return state.fixedAssets.map(asset => {
            const accumulatedDepreciation = state.depreciationEntries
                .filter(d => d.assetId === asset.id)
                .reduce((sum, d) => sum + d.amount, 0);
            const currentValue = asset.purchaseValue - accumulatedDepreciation;
            return {
                ...asset,
                accumulatedDepreciation,
                currentValue
            };
        });
    }, [state.fixedAssets, state.depreciationEntries]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-700">Fixed Asset Register</h2>
                 <div className="flex space-x-2">
                    <button onClick={() => handleOpenModal('new')} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold">
                        Add New Asset
                    </button>
                    <button onClick={() => handleOpenModal('periodicDepreciation')} className="px-4 py-2 bg-green-600 text-white rounded-md font-semibold">
                        Record Depreciation
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Asset Name</th>
                            <th className="p-2 font-semibold text-slate-600">Type</th>
                            <th className="p-2 font-semibold text-slate-600">Purchase Date</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Purchase Value</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Accumulated Depreciation</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Current Book Value</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assetsWithValues.map(asset => (
                            <tr key={asset.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-800 font-medium">{asset.name}</td>
                                <td className="p-2 text-slate-700">{state.assetTypes.find(at => at.id === asset.assetTypeId)?.name || 'N/A'}</td>
                                <td className="p-2 text-slate-700">{asset.purchaseDate}</td>
                                <td className="p-2 text-slate-700 text-right">{formatCurrency(asset.purchaseValue)}</td>
                                <td className="p-2 text-slate-700 text-right">{formatCurrency(asset.accumulatedDepreciation)}</td>
                                <td className="p-2 text-slate-800 font-bold text-right">{formatCurrency(asset.currentValue)}</td>
                                <td className="p-2 text-center space-x-2">
                                    <button onClick={() => handleOpenModal('history', asset)} className="text-indigo-600 hover:underline">History</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {(activeModal === 'new' || activeModal === 'edit') && (
                <AssetFormModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    asset={selectedAsset}
                    showNotification={showNotification}
                />
            )}
            {activeModal === 'periodicDepreciation' && (
                <PeriodicDepreciationModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    showNotification={showNotification}
                />
            )}
            {activeModal === 'history' && selectedAsset && (
                <HistoryModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    asset={selectedAsset}
                />
            )}
        </div>
    );
};

// --- Modals and Forms ---

const AssetFormModal: React.FC<{ isOpen: boolean, onClose: () => void, asset: FixedAsset | null, showNotification: (msg: string) => void }> = ({ isOpen, onClose, asset, showNotification }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState<Partial<FixedAsset>>({
        name: '',
        assetTypeId: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        purchaseValue: 0,
        status: 'Active',
    });

    useEffect(() => {
        if (asset) {
            setFormData(asset);
        }
    }, [asset]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        const { name, assetTypeId, purchaseDate, purchaseValue } = formData;
        if (!name || !assetTypeId || !purchaseDate || !purchaseValue || purchaseValue <= 0) {
            alert("Please fill all fields with valid data.");
            return;
        }

        const value = Number(purchaseValue);

        if (!asset) { // Creating new asset
            const newAsset: FixedAsset = {
                id: generateFixedAssetId(state.fixedAssets),
                name,
                assetTypeId,
                purchaseDate,
                purchaseValue: value,
                status: 'Active',
            };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'fixedAssets', data: newAsset } });

            // Journal Entry for acquisition
            const voucherId = `JV-FA-${newAsset.id}`;
            const debitEntry: JournalEntry = { id: `je-d-${voucherId}`, voucherId, date: purchaseDate, entryType: JournalEntryType.Journal, account: 'FA-001', debit: value, credit: 0, description: `Acquisition of asset: ${name}` };
            const creditEntry: JournalEntry = { id: `je-c-${voucherId}`, voucherId, date: purchaseDate, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: 0, credit: value, description: `Acquisition of asset: ${name}` };
            
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
            
            showNotification("New asset added successfully.");
        } else {
            // For simplicity, we don't handle editing purchaseValue which would require adjusting JEs.
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'fixedAssets', data: { ...formData, purchaseValue: value, id: asset.id } } });
            showNotification("Asset updated successfully.");
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={asset ? "Edit Fixed Asset" : "Add New Fixed Asset"}>
            <div className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Name</label><input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 rounded-md" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Asset Type</label><select name="assetTypeId" value={formData.assetTypeId} onChange={handleChange} className="w-full p-2 rounded-md"><option value="">Select Type</option>{state.assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label><input type="date" name="purchaseDate" value={formData.purchaseDate} onChange={handleChange} className="w-full p-2 rounded-md" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Purchase Value ($)</label><input type="number" name="purchaseValue" value={formData.purchaseValue} onChange={handleChange} className="w-full p-2 rounded-md" /></div>
                <div className="flex justify-end gap-2 pt-4"><button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button><button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md">Save</button></div>
            </div>
        </Modal>
    );
};

const PeriodicDepreciationModal: React.FC<{ isOpen: boolean, onClose: () => void, showNotification: (msg: string) => void }> = ({ isOpen, onClose, showNotification }) => {
    const { state, dispatch } = useData();
    const [step, setStep] = useState<'form' | 'review'>('form');
    const [formData, setFormData] = useState({
        depreciationDate: new Date().toISOString().split('T')[0],
        startDate: '',
        endDate: '',
        rate: '',
        selectedAssetTypeIds: [] as string[],
    });
    const [reviewData, setReviewData] = useState<{ asset: FixedAsset, depreciationAmount: number }[]>([]);

    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    const handleTypeSelection = (typeId: string) => {
        setFormData(prev => ({
            ...prev,
            selectedAssetTypeIds: prev.selectedAssetTypeIds.includes(typeId)
                ? prev.selectedAssetTypeIds.filter(id => id !== typeId)
                : [...prev.selectedAssetTypeIds, typeId],
        }));
    };
    
    const handleCalculate = () => {
        const { rate, selectedAssetTypeIds } = formData;
        const rateNum = Number(rate);
        if (!rate || rateNum <= 0 || rateNum > 100) {
            alert("Please enter a valid depreciation rate between 1 and 100.");
            return;
        }
        if (selectedAssetTypeIds.length === 0) {
            alert("Please select at least one asset type to depreciate.");
            return;
        }

        const assetsToDepreciate = state.fixedAssets.filter(asset => selectedAssetTypeIds.includes(asset.assetTypeId));
        
        const calculatedData = assetsToDepreciate.map(asset => {
            const depreciationAmount = asset.purchaseValue * (rateNum / 100);
            return { asset, depreciationAmount };
        });

        setReviewData(calculatedData);
        setStep('review');
    };

    const handlePost = () => {
        if (reviewData.length === 0) return;
        
        const batchUpdates: any[] = [];
        const totalDepreciation = reviewData.reduce((sum, item) => sum + item.depreciationAmount, 0);
        
        const voucherId = `JV-DEP-${Date.now()}`;
        const description = `Depreciation for period ${formData.startDate} to ${formData.endDate}`;
        
        // Create individual history entries
        reviewData.forEach(({ asset, depreciationAmount }) => {
            const newEntry: DepreciationEntry = {
                id: `dep-${asset.id}-${Date.now()}`,
                assetId: asset.id,
                date: formData.depreciationDate,
                amount: depreciationAmount,
                description: `Periodic depreciation (${formData.rate}%)`,
                voucherId,
            };
            batchUpdates.push({ type: 'ADD_ENTITY', payload: { entity: 'depreciationEntries', data: newEntry } });
        });

        // Create consolidated journal entries
        const debitEntry: JournalEntry = { id: `je-d-${voucherId}`, voucherId, date: formData.depreciationDate, entryType: JournalEntryType.Journal, account: 'EXP-012', debit: totalDepreciation, credit: 0, description };
        const creditEntry: JournalEntry = { id: `je-c-${voucherId}`, voucherId, date: formData.depreciationDate, entryType: JournalEntryType.Journal, account: 'AD-001', debit: 0, credit: totalDepreciation, description };
        batchUpdates.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
        batchUpdates.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });

        dispatch({ type: 'BATCH_UPDATE', payload: batchUpdates });

        showNotification("Depreciation posted successfully.");
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Periodic Depreciation" size="3xl">
            {step === 'form' ? (
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Depreciation Date (for Journal Entry)</label><input type="date" value={formData.depreciationDate} onChange={e => setFormData({...formData, depreciationDate: e.target.value})} className="w-full p-2 rounded-md" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Period Start Date</label><input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full p-2 rounded-md" /></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Period End Date</label><input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full p-2 rounded-md" /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Depreciation Rate (%)</label><input type="number" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} className="w-full p-2 rounded-md" placeholder="e.g., 10 for 10%"/></div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Asset Types to Depreciate</label>
                        <div className="space-y-2 p-3 border rounded-md max-h-40 overflow-y-auto">
                            {state.assetTypes.map(type => (
                                <label key={type.id} className="flex items-center space-x-2 text-slate-700">
                                    <input type="checkbox" checked={formData.selectedAssetTypeIds.includes(type.id)} onChange={() => handleTypeSelection(type.id)} className="h-4 w-4 rounded text-blue-600" />
                                    <span>{type.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4"><button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button><button onClick={handleCalculate} className="px-4 py-2 bg-blue-600 text-white rounded-md">Calculate & Review</button></div>
                </div>
            ) : (
                 <div className="space-y-4">
                    <h3 className="font-semibold text-slate-800">Review Depreciation Calculation</h3>
                    <p className="text-sm text-slate-600">The following entries will be posted for the period {formData.startDate} to {formData.endDate} with a rate of {formData.rate}%. </p>
                    <div className="max-h-80 overflow-y-auto border rounded-md">
                        <table className="w-full text-left table-auto text-sm">
                            <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 font-semibold">Asset</th><th className="p-2 font-semibold text-right">Purchase Value</th><th className="p-2 font-semibold text-right">Depreciation Amount</th></tr></thead>
                            <tbody>
                                {reviewData.map(({asset, depreciationAmount}) => (
                                    <tr key={asset.id} className="border-b"><td className="p-2">{asset.name}</td><td className="p-2 text-right">{formatCurrency(asset.purchaseValue)}</td><td className="p-2 text-right">{formatCurrency(depreciationAmount)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 bg-slate-100 rounded-md flex justify-between items-center font-bold text-lg">
                        <span>Total Depreciation</span>
                        <span>{formatCurrency(reviewData.reduce((sum, item) => sum + item.depreciationAmount, 0))}</span>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setStep('form')} className="px-4 py-2 bg-slate-200 rounded-md">Back</button>
                        <button onClick={handlePost} className="px-4 py-2 bg-green-600 text-white rounded-md">Post Depreciation</button>
                    </div>
                </div>
            )}
        </Modal>
    );
};


const HistoryModal: React.FC<{ isOpen: boolean, onClose: () => void, asset: FixedAsset }> = ({ isOpen, onClose, asset }) => {
    const { state } = useData();
    const history = useMemo(() => {
        return state.depreciationEntries
            .filter(d => d.assetId === asset.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [asset, state.depreciationEntries]);

    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Depreciation History for ${asset.name}`}>
            <table className="w-full text-left table-auto text-sm">
                <thead><tr className="bg-slate-100"><th className="p-2 font-semibold">Date</th><th className="p-2 font-semibold">Description</th><th className="p-2 font-semibold text-right">Amount</th></tr></thead>
                <tbody>
                    {history.map(entry => (
                        <tr key={entry.id} className="border-b"><td className="p-2">{entry.date}</td><td className="p-2">{entry.description}</td><td className="p-2 text-right">{formatCurrency(entry.amount)}</td></tr>
                    ))}
                    {history.length === 0 && (
                        <tr><td colSpan={3} className="text-center p-4 text-slate-500">No depreciation has been recorded for this asset.</td></tr>
                    )}
                </tbody>
            </table>
        </Modal>
    );
};


export default FixedAssetsModule;