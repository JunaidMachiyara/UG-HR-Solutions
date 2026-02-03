import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { JournalEntryType, Customer, Supplier, ExpenseAccount } from '../../types.ts';
import Modal from '../ui/Modal.tsx';
import ReportToolbar from './ReportToolbar.tsx';

export interface EntitySelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (entityId: string) => void;
    entityType: 'customer' | 'supplier' | 'expenseAccount';
    allEntities: { id: string; name: string; }[];
    plannedEntityIds: Set<string>;
}

export const EntitySelectorModal: React.FC<EntitySelectorModalProps> = ({ isOpen, onClose, onSelect, entityType, allEntities, plannedEntityIds }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const availableEntities = useMemo(() => {
        return allEntities
            .filter(e => !plannedEntityIds.has(e.id))
            .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allEntities, plannedEntityIds, searchTerm]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const handleSelect = (entityId: string) => {
        onSelect(entityId);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Add ${entityType === 'customer' ? 'Customer' : entityType === 'supplier' ? 'Supplier' : 'Expense Account'} to Plan`}>
            <div className="space-y-4">
                <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 rounded-md"
                    style={{ backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' }}
                />
                <ul className="max-h-80 overflow-y-auto border rounded-md">
                    {availableEntities.map(entity => (
                        <li key={entity.id}>
                            <button
                                onClick={() => handleSelect(entity.id)}
                                className="w-full text-left p-3 hover:bg-blue-50 transition-colors text-slate-800"
                            >
                                {entity.name}
                            </button>
                        </li>
                    ))}
                    {availableEntities.length === 0 && (
                        <li className="p-4 text-center text-slate-500">
                            {searchTerm ? 'No matches found.' : 'All entities have been added.'}
                        </li>
                    )}
                </ul>
            </div>
        </Modal>
    );
};


const PaymentPlannerReport: React.FC = () => {
    const { state, dispatch } = useData();
    const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'customer' | 'supplier' | null>(null);

    const getStartOfWeek = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        return new Date(d.setDate(diff));
    };

    const getStartOfMonth = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return new Date(d.getFullYear(), d.getMonth(), 1);
    };

    useEffect(() => {
        const today = new Date();
        if (period === 'weekly') {
            const currentWeekStart = getStartOfWeek(today).toISOString().split('T')[0];
            if (state.plannerLastWeeklyReset && state.plannerLastWeeklyReset !== currentWeekStart) {
                setIsPromptOpen(true);
            } else if (!state.plannerLastWeeklyReset) {
                dispatch({ type: 'SET_PLANNER_DATA', payload: { plannerLastWeeklyReset: currentWeekStart } });
            }
        } else { // monthly
            const currentMonthStart = getStartOfMonth(today).toISOString().split('T')[0];
            if (state.plannerLastMonthlyReset && state.plannerLastMonthlyReset !== currentMonthStart) {
                setIsPromptOpen(true);
            } else if (!state.plannerLastMonthlyReset) {
                dispatch({ type: 'SET_PLANNER_DATA', payload: { plannerLastMonthlyReset: currentMonthStart } });
            }
        }
    }, [period, state.plannerLastWeeklyReset, state.plannerLastMonthlyReset, dispatch]);


    const { allCustomerData, allSupplierData } = useMemo(() => {
        const receivableAccountId = state.receivableAccounts[0]?.id;
        const payableAccountId = state.payableAccounts[0]?.id;

        const allCustomerData = state.customers.map(customer => {
            const customerEntries = state.journalEntries.filter(je => je.entityType === 'customer' && je.entityId === customer.id);
            const receivable = customerEntries.filter(je => je.account === receivableAccountId).reduce((bal, je) => bal + je.debit - je.credit, 0);

            const lastReceipt = customerEntries
                .filter(je => je.entryType === JournalEntryType.Receipt)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            return { id: customer.id, name: customer.name, receivable, lastReceiptAmount: lastReceipt ? (lastReceipt.credit || 0) : 0, lastReceiptDate: lastReceipt ? lastReceipt.date : 'N/A' };
        });

        const allSupplierData = state.suppliers.map(supplier => {
            const supplierEntries = state.journalEntries.filter(je => je.entityType === 'supplier' && je.entityId === supplier.id);
            const payable = supplierEntries.filter(je => je.account === payableAccountId).reduce((bal, je) => bal + je.credit - je.debit, 0);

            const lastPayment = supplierEntries
                .filter(je => je.entryType === JournalEntryType.Payment)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            return { id: supplier.id, name: supplier.name, payable, lastPaymentAmount: lastPayment ? (lastPayment.debit || 0) : 0, lastPaymentDate: lastPayment ? lastPayment.date : 'N/A' };
        });

        return { allCustomerData, allSupplierData };
    }, [state]);

    const { customerData, supplierData } = useMemo(() => {
        const plannedCustomerIds = new Set(state.plannerCustomerIds || []);
        const plannedSupplierIds = new Set(state.plannerSupplierIds || []);

        return {
            customerData: allCustomerData.filter(c => plannedCustomerIds.has(c.id)),
            supplierData: allSupplierData.filter(s => plannedSupplierIds.has(s.id))
        };
    }, [allCustomerData, allSupplierData, state.plannerCustomerIds, state.plannerSupplierIds]);

    const handlePlanChange = (entityId: string, value: string) => {
        const newPlannerData = JSON.parse(JSON.stringify(state.plannerData || {}));
        if (!newPlannerData[entityId]) {
            newPlannerData[entityId] = {
                weekly: { currentPlan: 0, lastPlan: 0, lastActual: 0 },
                monthly: { currentPlan: 0, lastPlan: 0, lastActual: 0 },
            };
        }
        newPlannerData[entityId][period].currentPlan = value === '' ? 0 : Number(value);
        dispatch({ type: 'SET_PLANNER_DATA', payload: { plannerData: newPlannerData } });
    };

    const handleAddEntity = (entityId: string) => {
        if (modalType) {
            dispatch({ type: 'ADD_PLANNER_ENTITY', payload: { entityType: modalType, entityId } });
        }
    };

    const handleRemoveEntity = (entityType: 'customer' | 'supplier', entityId: string) => {
        dispatch({ type: 'REMOVE_PLANNER_ENTITY', payload: { entityType, entityId } });
    };

    const handleStartNewPlan = () => {
        const today = new Date();
        const allEntities = [...state.customers, ...state.suppliers];
        const newPlannerData = JSON.parse(JSON.stringify(state.plannerData || {}));
        
        let lastPeriodStartDate: Date;
        let lastPeriodEndDate: Date;
        let newResetDate: string;

        if (period === 'weekly') {
            const currentWeekStart = getStartOfWeek(today);
            newResetDate = currentWeekStart.toISOString().split('T')[0];
            lastPeriodEndDate = new Date(currentWeekStart);
            lastPeriodEndDate.setSeconds(lastPeriodEndDate.getSeconds() - 1);
            lastPeriodStartDate = new Date(lastPeriodEndDate);
            lastPeriodStartDate.setDate(lastPeriodStartDate.getDate() - 6);
        } else { // monthly
            const currentMonthStart = getStartOfMonth(today);
            newResetDate = currentMonthStart.toISOString().split('T')[0];
            lastPeriodEndDate = new Date(currentMonthStart);
            lastPeriodEndDate.setSeconds(lastPeriodEndDate.getSeconds() - 1);
            lastPeriodStartDate = new Date(lastPeriodEndDate.getFullYear(), lastPeriodEndDate.getMonth(), 1);
        }

        const lastPeriodStartDateStr = lastPeriodStartDate.toISOString().split('T')[0];
        const lastPeriodEndDateStr = lastPeriodEndDate.toISOString().split('T')[0];

        allEntities.forEach(entity => {
            const isCustomer = 'status' in entity;
            
            const lastPeriodEntries = state.journalEntries.filter(je =>
                je.date >= lastPeriodStartDateStr &&
                je.date <= lastPeriodEndDateStr &&
                je.entityId === entity.id &&
                je.entityType === (isCustomer ? 'customer' : 'supplier') &&
                je.entryType === (isCustomer ? JournalEntryType.Receipt : JournalEntryType.Payment)
            );

            const lastPeriodActual = lastPeriodEntries.reduce((sum, je) => sum + (isCustomer ? je.credit : je.debit), 0);
            
            if (!newPlannerData[entity.id]) {
                newPlannerData[entity.id] = {
                    weekly: { currentPlan: 0, lastPlan: 0, lastActual: 0 },
                    monthly: { currentPlan: 0, lastPlan: 0, lastActual: 0 },
                };
            }
            
            const plannerEntity = newPlannerData[entity.id][period];
            plannerEntity.lastPlan = plannerEntity.currentPlan || 0;
            plannerEntity.lastActual = lastPeriodActual;
            plannerEntity.currentPlan = 0;
        });

        const payload: any = { plannerData: newPlannerData };
        if (period === 'weekly') {
            payload.plannerLastWeeklyReset = newResetDate;
        } else {
            payload.plannerLastMonthlyReset = newResetDate;
        }

        dispatch({ type: 'SET_PLANNER_DATA', payload });
        setIsPromptOpen(false);
    };

    const handleContinuePlan = () => {
        const today = new Date();
        let payload = {};
         if (period === 'weekly') {
            const currentWeekStart = getStartOfWeek(today).toISOString().split('T')[0];
            payload = { plannerLastWeeklyReset: currentWeekStart };
        } else { // monthly
            const currentMonthStart = getStartOfMonth(today).toISOString().split('T')[0];
            payload = { plannerLastMonthlyReset: currentMonthStart };
        }
        dispatch({ type: 'SET_PLANNER_DATA', payload });
        setIsPromptOpen(false);
    };

    const { totalPlannedReceipts, totalPlannedPayments } = useMemo(() => {
        let receipts = 0;
        let payments = 0;

        if (state.plannerData) {
            for (const entityId in state.plannerData) {
                const plan = state.plannerData[entityId]?.[period];
                if (plan && plan.currentPlan > 0) {
                    if (state.customers.some(c => c.id === entityId)) {
                        receipts += plan.currentPlan;
                    } else if (state.suppliers.some(s => s.id === entityId)) {
                        payments += plan.currentPlan;
                    }
                }
            }
        }
        return { totalPlannedReceipts: receipts, totalPlannedPayments: payments };
    }, [state.plannerData, period, state.customers, state.suppliers]);
    
    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const periodName = period === 'weekly' ? 'Week' : 'Month';

    return (
        <div>
            <ReportToolbar title="Receipts & Payments Planner" exportData={[]} exportHeaders={[]} exportFilename="PaymentPlanner" />
            
            <div className="mb-6 flex justify-center items-center space-x-2 bg-slate-100 p-1 rounded-lg max-w-xs mx-auto">
                <button onClick={() => setPeriod('weekly')} className={`w-full px-4 py-2 rounded-md text-sm font-semibold transition-colors ${period === 'weekly' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}>Weekly</button>
                <button onClick={() => setPeriod('monthly')} className={`w-full px-4 py-2 rounded-md text-sm font-semibold transition-colors ${period === 'monthly' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}>Monthly</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Customer Receivables */}
                <div className="bg-white p-4 rounded-lg shadow-md border-t-4 border-blue-500">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center justify-between">
                        Customer Receivables Planner
                        <button
                            onClick={() => { setModalType('customer'); setIsModalOpen(true); }}
                            className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors text-xl"
                            title="Add Customer to Plan"
                        >+</button>
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-auto text-sm">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="p-2 font-semibold text-slate-600">Customer</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Receivable</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Last Received</th>
                                    <th className="p-2 font-semibold text-slate-600">Date</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Last {periodName}'s Plan</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Last {periodName}'s Actual</th>
                                    <th className="p-2 font-semibold text-slate-600">This {periodName}'s Plan</th>
                                    <th className="p-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {customerData.map(c => {
                                    const planData = state.plannerData?.[c.id]?.[period];
                                    const lastPlan = planData?.lastPlan || 0;
                                    const lastActual = planData?.lastActual || 0;
                                    return (
                                    <tr key={c.id} className="border-b hover:bg-blue-50">
                                        <td className="p-2 text-slate-700 font-medium">{c.name}</td>
                                        <td className="p-2 text-slate-700 text-right">{formatCurrency(c.receivable)}</td>
                                        <td className="p-2 text-slate-700 text-right">{c.lastReceiptAmount > 0 ? formatCurrency(c.lastReceiptAmount) : '-'}</td>
                                        <td className="p-2 text-slate-700">{c.lastReceiptDate}</td>
                                        <td className="p-2 text-slate-700 text-right bg-slate-50">{formatCurrency(lastPlan)}</td>
                                        <td className={`p-2 text-right font-medium ${lastActual >= lastPlan ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(lastActual)}</td>
                                        <td className="p-2 w-32">
                                            <input type="number" value={planData?.currentPlan || ''} onChange={e => handlePlanChange(c.id, e.target.value)} className="w-full p-1 border border-slate-300 rounded-md text-right" placeholder="0.00" />
                                        </td>
                                        <td className="p-1 text-center">
                                            <button onClick={() => handleRemoveEntity('customer', c.id)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-200 font-bold">
                                    <td colSpan={6} className="p-2 text-right text-slate-800">Total Planned Receipts</td>
                                    <td className="p-2 text-right text-slate-800">{formatCurrency(totalPlannedReceipts)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Supplier Payables */}
                <div className="bg-white p-4 rounded-lg shadow-md border-t-4 border-orange-500">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center justify-between">
                        Supplier Payables Planner
                         <button
                            onClick={() => { setModalType('supplier'); setIsModalOpen(true); }}
                            className="w-8 h-8 flex items-center justify-center bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors text-xl"
                            title="Add Supplier to Plan"
                        >+</button>
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-auto text-sm">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="p-2 font-semibold text-slate-600">Supplier</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Payable</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Last Paid</th>
                                    <th className="p-2 font-semibold text-slate-600">Date</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Last {periodName}'s Plan</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Last {periodName}'s Actual</th>
                                    <th className="p-2 font-semibold text-slate-600">This {periodName}'s Plan</th>
                                    <th className="p-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {supplierData.map(s => {
                                     const planData = state.plannerData?.[s.id]?.[period];
                                     const lastPlan = planData?.lastPlan || 0;
                                     const lastActual = planData?.lastActual || 0;
                                    return (
                                    <tr key={s.id} className="border-b hover:bg-orange-50">
                                        <td className="p-2 text-slate-700 font-medium">{s.name}</td>
                                        <td className="p-2 text-slate-700 text-right">{formatCurrency(s.payable)}</td>
                                        <td className="p-2 text-slate-700 text-right">{s.lastPaymentAmount > 0 ? formatCurrency(s.lastPaymentAmount) : '-'}</td>
                                        <td className="p-2 text-slate-700">{s.lastPaymentDate}</td>
                                        <td className="p-2 text-slate-700 text-right bg-slate-50">{formatCurrency(lastPlan)}</td>
                                        <td className={`p-2 text-right font-medium ${lastActual <= lastPlan ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(lastActual)}</td>
                                        <td className="p-2 w-32">
                                            <input type="number" value={planData?.currentPlan || ''} onChange={e => handlePlanChange(s.id, e.target.value)} className="w-full p-1 border border-slate-300 rounded-md text-right" placeholder="0.00" />
                                        </td>
                                        <td className="p-1 text-center">
                                            <button onClick={() => handleRemoveEntity('supplier', s.id)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-200 font-bold">
                                    <td colSpan={6} className="p-2 text-right text-slate-800">Total Planned Payments</td>
                                    <td className="p-2 text-right text-slate-800">{formatCurrency(totalPlannedPayments)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <Modal isOpen={isPromptOpen} onClose={handleContinuePlan} title="New Planning Period" size="md">
                <div className="space-y-4">
                    <p className="text-slate-700">A new {periodName.toLowerCase()} has started. Would you like to start a new plan or continue with the previous one?</p>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                        <li><strong>Start New Plan:</strong> Archives your current plan, calculates last {periodName.toLowerCase()}'s actuals, and resets the input fields.</li>
                        <li><strong>Continue with old one:</strong> Keeps your current plan active for this new {periodName.toLowerCase()}.</li>
                    </ul>
                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={handleContinuePlan} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Continue with old one</button>
                        <button onClick={handleStartNewPlan} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Start New Plan</button>
                    </div>
                </div>
            </Modal>
            
            {modalType && (
                <EntitySelectorModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSelect={handleAddEntity}
                    entityType={modalType as 'customer' | 'supplier'}
                    allEntities={modalType === 'customer' ? state.customers : state.suppliers}
                    plannedEntityIds={new Set(modalType === 'customer' ? state.plannerCustomerIds : state.plannerSupplierIds)}
                />
            )}
        </div>
    );
};

export default PaymentPlannerReport;