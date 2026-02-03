import React, { useState } from 'react';
import SalesInvoiceModule from './SalesInvoiceModule.tsx';
import { Module, UserProfile } from '../types.ts';
import StockLotPurchaseForm from './StockLotPurchaseForm.tsx';

interface StockLotModuleProps {
    setModule: (module: Module) => void;
    showNotification: (msg: string) => void;
    userProfile: UserProfile | null;
}

const StockLotModule: React.FC<StockLotModuleProps> = ({ setModule, showNotification, userProfile }) => {
    const [activeView, setActiveView] = useState<'purchase' | 'sales'>('purchase');
    
    const getButtonClass = (view: 'purchase' | 'sales') => 
        `px-4 py-2 rounded-md transition-colors text-sm font-medium ${activeView === view ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`;

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2 p-2 bg-slate-100 rounded-lg max-w-sm">
                <button onClick={() => setActiveView('purchase')} className={getButtonClass('purchase')}>Bundle Purchase</button>
                <button onClick={() => setActiveView('sales')} className={getButtonClass('sales')} disabled>Stock-Lot Sales</button>
            </div>
            
            <div className="mt-4">
                {activeView === 'purchase' && <StockLotPurchaseForm showNotification={showNotification} userProfile={userProfile} />}
                {activeView === 'sales' && <SalesInvoiceModule setModule={setModule} userProfile={userProfile} />}
            </div>
        </div>
    );
};

export default StockLotModule;