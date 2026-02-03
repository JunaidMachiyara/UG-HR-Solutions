import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { GuaranteeCheque, UserProfile } from '../types.ts';

const GuaranteeCheques: React.FC<{ userProfile: UserProfile | null }> = ({ userProfile }) => {
    const { state, dispatch } = useData();
    const [editingRowId, setEditingRowId] = useState<number | 'new' | null>(null);
    const [editedData, setEditedData] = useState<Partial<GuaranteeCheque> | null>(null);
    const [filters, setFilters] = useState({ destination: '', shipper: '', status: '' });

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ destination: '', shipper: '', status: '' });
    };

    const displayData = useMemo(() => {
        return state.guaranteeCheques
            .filter(cheque => 
                (!filters.destination || cheque.destination.toLowerCase().includes(filters.destination.toLowerCase())) &&
                (!filters.shipper || cheque.shipper.toLowerCase().includes(filters.shipper.toLowerCase())) &&
                (!filters.status || cheque.status === filters.status)
            )
            .sort((a, b) => b.id - a.id);
    }, [state.guaranteeCheques, filters]);

    const handleStartNew = () => {
        setEditedData({
            date: new Date().toISOString().split('T')[0],
            status: 'Submitted',
            chequeDate: new Date().toISOString().split('T')[0],
        });
        setEditingRowId('new');
    };
    
    const handleStartEdit = (cheque: GuaranteeCheque) => {
        setEditingRowId(cheque.id);
        setEditedData({ ...cheque });
    };

    const handleCancelEdit = () => {
        setEditingRowId(null);
        setEditedData(null);
    };

    const handleSave = () => {
        if (!editedData) return;

        if (editingRowId === 'new') {
            const newCheque: GuaranteeCheque = {
                id: state.nextGuaranteeChequeSNo,
                date: editedData.date || '',
                boeNo: editedData.boeNo || '',
                destination: editedData.destination || '',
                shipper: editedData.shipper || '',
                stock: editedData.stock || '',
                weight: Number(editedData.weight) || 0,
                amount: Number(editedData.amount) || 0,
                containerNo: editedData.containerNo || '',
                chequeDate: editedData.chequeDate || '',
                chequeNo: editedData.chequeNo || '',
                chequeAmount: Number(editedData.chequeAmount) || 0,
                status: editedData.status || 'Submitted',
            };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'guaranteeCheques', data: newCheque } });
        } else {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'guaranteeCheques', data: { ...editedData, id: editingRowId } } });
        }
        
        handleCancelEdit();
    };
    
    const handleEditedDataChange = (field: keyof Omit<GuaranteeCheque, 'id'>, value: any) => {
        if (!editedData) return;
        setEditedData(prev => prev ? ({ ...prev, [field]: value }) : null);
    };

    const handleDelete = (id: number) => {
        if (window.confirm('Are you sure you want to delete this cheque entry?')) {
            dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'guaranteeCheques', id } });
        }
    };

    const renderHeader = (label: string, className = "") => <th className={`p-1 border border-slate-300 font-semibold text-slate-600 sticky top-0 bg-slate-100 ${className}`}>{label}</th>;
    const renderCell = (value: React.ReactNode, className = "") => <td className={`p-1 border border-slate-300 whitespace-nowrap text-slate-800 ${className}`}>{value}</td>;
    const renderInput = (value: string | number | undefined, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type = "text") => (
        <input type={type} value={value || ''} onChange={onChange} className="w-full p-1 bg-transparent border-blue-400 border rounded-sm text-slate-800" />
    );
    const renderDateInput = (value: string | undefined, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void) => (
        <input type="date" value={value || ''} onChange={onChange} className="w-full p-1 bg-transparent border-blue-400 border rounded-sm text-slate-800" />
    );
    const renderSelect = (value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: {value: string, label: string}[]) => (
         <select value={value} onChange={onChange} className="w-full p-1 bg-transparent border-blue-400 border rounded-sm text-slate-800">
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    );

    const renderRow = (rowData: GuaranteeCheque | Partial<GuaranteeCheque>, isEditing: boolean, isNew: boolean) => {
        const data = isEditing ? editedData : rowData;
        if (!data) return null;

        const handleChange = (field: keyof Omit<GuaranteeCheque, 'id'>, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => handleEditedDataChange(field, e.target.value);

        return (
            <tr key={isNew ? 'new' : (rowData as GuaranteeCheque).id} className={isEditing ? 'bg-yellow-100' : 'bg-white'}>
                {renderCell(isNew ? state.nextGuaranteeChequeSNo : (rowData as GuaranteeCheque).id, "text-center font-medium")}
                {isEditing ? renderCell(renderDateInput(data.date, e => handleChange('date', e))) : renderCell(data.date)}
                {isEditing ? renderCell(renderInput(data.boeNo, e => handleChange('boeNo', e))) : renderCell(data.boeNo)}
                {isEditing ? renderCell(renderInput(data.destination, e => handleChange('destination', e))) : renderCell(data.destination)}
                {isEditing ? renderCell(renderInput(data.shipper, e => handleChange('shipper', e))) : renderCell(data.shipper)}
                {isEditing ? renderCell(renderInput(data.stock, e => handleChange('stock', e))) : renderCell(data.stock)}
                {isEditing ? renderCell(renderInput(data.weight, e => handleChange('weight', e), "number"), "text-right") : renderCell(data.weight, "text-right")}
                {isEditing ? renderCell(renderInput(data.amount, e => handleChange('amount', e), "number"), "text-right") : renderCell(data.amount, "text-right")}
                {isEditing ? renderCell(renderInput(data.containerNo, e => handleChange('containerNo', e))) : renderCell(data.containerNo)}
                {isEditing ? renderCell(renderDateInput(data.chequeDate, e => handleChange('chequeDate', e))) : renderCell(data.chequeDate)}
                {isEditing ? renderCell(renderInput(data.chequeNo, e => handleChange('chequeNo', e))) : renderCell(data.chequeNo)}
                {isEditing ? renderCell(renderInput(data.chequeAmount, e => handleChange('chequeAmount', e), "number"), "text-right") : renderCell(data.chequeAmount, "text-right")}
                {isEditing ? renderCell(renderSelect(data.status!, e => handleChange('status', e), [{value: 'Submitted', label: 'Submitted'}, {value: 'Returned', label: 'Returned'}, {value: 'Cashed', label: 'Cashed'}])) : renderCell(data.status)}
                {renderCell(isEditing ? (
                    <div className="flex gap-1">
                        <button onClick={handleSave} className="px-2 py-1 bg-green-500 text-white rounded text-xs">Save</button>
                        <button onClick={handleCancelEdit} className="px-2 py-1 bg-gray-500 text-white rounded text-xs">Cancel</button>
                    </div>
                ) : (
                    <div className="flex gap-1">
                        <button onClick={() => handleStartEdit(rowData as GuaranteeCheque)} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">Edit</button>
                        <button onClick={() => handleDelete((rowData as GuaranteeCheque).id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Delete</button>
                    </div>
                ))}
            </tr>
        );
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Guarantee Cheques Management</h2>
            <div className="p-4 bg-slate-50 rounded-lg border flex flex-wrap gap-4 items-center">
                <input type="text" name="destination" placeholder="Filter by Destination..." value={filters.destination} onChange={handleFilterChange} className="p-2 border rounded-md" />
                <input type="text" name="shipper" placeholder="Filter by Shipper..." value={filters.shipper} onChange={handleFilterChange} className="p-2 border rounded-md" />
                <select name="status" value={filters.status} onChange={handleFilterChange} className="p-2 border rounded-md"><option value="">All Statuses</option><option value="Submitted">Submitted</option><option value="Returned">Returned</option><option value="Cashed">Cashed</option></select>
                <button onClick={resetFilters} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm">Reset</button>
                <button onClick={handleStartNew} className="ml-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">Add New Cheque</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr>
                            {renderHeader('S.No', 'text-center')}
                            {renderHeader('Date')}
                            {renderHeader('BOE No.')}
                            {renderHeader('Destination')}
                            {renderHeader('Shipper')}
                            {renderHeader('Stock')}
                            {renderHeader('Weight', 'text-right')}
                            {renderHeader('Amount', 'text-right')}
                            {renderHeader('Container No.')}
                            {renderHeader('Cheque Date')}
                            {renderHeader('Cheque No')}
                            {renderHeader('Cheque Amount', 'text-right')}
                            {renderHeader('Status')}
                            {renderHeader('Actions')}
                        </tr>
                    </thead>
                    <tbody>
                        {editingRowId === 'new' && renderRow(editedData!, true, true)}
                        {displayData.map(cheque => renderRow(cheque, editingRowId === cheque.id, false))}
                        {displayData.length === 0 && editingRowId !== 'new' && (
                            <tr><td colSpan={14} className="text-center text-slate-500 py-6">No entries match the current filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const DocumentsManagement: React.FC<{ userProfile: UserProfile | null }> = ({ userProfile }) => {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-slate-50 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h2 className="text-2xl font-bold text-slate-700">Under Construction</h2>
            <p className="text-slate-500 mt-2">This feature is currently being developed and will be available soon.</p>
        </div>
    );
};


const CustomsModule: React.FC<{ userProfile: UserProfile | null }> = ({ userProfile }) => {
    const [view, setView] = useState<'cheques' | 'documents'>('cheques');
    
    const getButtonClass = (v: 'cheques' | 'documents') => 
        `px-4 py-2 rounded-md transition-colors text-sm font-medium ${view === v ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`;

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-md flex items-center space-x-2">
                <button onClick={() => setView('cheques')} className={getButtonClass('cheques')}>Guarantee Cheques</button>
                <button onClick={() => setView('documents')} className={getButtonClass('documents')}>Documents</button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                {view === 'cheques' && <GuaranteeCheques userProfile={userProfile} />}
                {view === 'documents' && <DocumentsManagement userProfile={userProfile} />}
            </div>
        </div>
    );
};

export default CustomsModule;