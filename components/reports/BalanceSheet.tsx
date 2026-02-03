
import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { OriginalPurchased, PackingType, Currency } from '../../types.ts';
// FIX: Correctly import the exported ReportKey type.
import { ReportKey } from '../ReportsModule.tsx';

interface BalanceSheetProps {
    onNavigate: (key: ReportKey, filters?: any) => void;
}

const BalanceSheet: React.FC<BalanceSheetProps> = ({ onNavigate }) => {
    const { state } = useData();
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

    const { assets, liabilities, equity } = useMemo(() => {
        const entries = state.journalEntries.filter(je => je.date <= asOfDate);
        
        const getAccountBalance = (accountId: string) => entries
            .filter(je => je.account === accountId)
            .reduce((sum, je) => sum + je.debit - je.credit, 0);
        
        const calculateTotalBalance = (accounts: { id: string }[]) => {
            return accounts.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);
        };

        // --- 1. Calculate Raw Material Inventory Value ---
        const avgCostPerKg: { [originalTypeId: string]: number } = {};
        const costMap: { [originalTypeId: string]: { totalKg: number; totalCost: number } } = {};
        
        state.originalPurchases.filter(p => p.date <= asOfDate).forEach((p: OriginalPurchased) => {
            const originalType = state.originalTypes.find(ot => ot.id === p.originalTypeId);
            if (!originalType) return;

            const purchaseKg = originalType.packingType === PackingType.Kg 
                ? p.quantityPurchased 
                : p.quantityPurchased * originalType.packingSize;

            const itemValueUSD = (p.quantityPurchased * p.rate) * (p.conversionRate || 1);
            const freightUSD = (p.freightAmount || 0) * (p.freightConversionRate || 1);
            const clearingUSD = (p.clearingAmount || 0) * (p.clearingConversionRate || 1);
            const commissionUSD = (p.commissionAmount || 0) * (p.commissionConversionRate || 1);
            const discountSurchargeUSD = p.discountSurcharge || 0;

            const purchaseCostUSD = itemValueUSD + freightUSD + clearingUSD + commissionUSD + discountSurchargeUSD;
            
            if (!costMap[p.originalTypeId]) {
                costMap[p.originalTypeId] = { totalKg: 0, totalCost: 0 };
            }
            if (purchaseKg > 0) {
              costMap[p.originalTypeId].totalKg += purchaseKg;
              costMap[p.originalTypeId].totalCost += purchaseCostUSD;
            }
        });
        for (const typeId in costMap) {
            if (costMap[typeId].totalKg > 0) {
                avgCostPerKg[typeId] = costMap[typeId].totalCost / costMap[typeId].totalKg;
            }
        }

        const purchasedKgMap = new Map<string, number>();
        state.originalPurchases.filter(p => p.date <= asOfDate).forEach(p => {
            const originalType = state.originalTypes.find(ot => ot.id === p.originalTypeId);
            if (!originalType) return;
            const kg = originalType.packingType === PackingType.Kg ? p.quantityPurchased : p.quantityPurchased * originalType.packingSize;
            purchasedKgMap.set(p.originalTypeId, (purchasedKgMap.get(p.originalTypeId) || 0) + kg);
        });

        const openedKgMap = new Map<string, number>();
        state.originalOpenings.filter(o => o.date <= asOfDate).forEach(o => {
            openedKgMap.set(o.originalTypeId, (openedKgMap.get(o.originalTypeId) || 0) + o.totalKg);
        });
        
        let rawMaterialInventoryValue = 0;
        for(const [typeId, totalPurchasedKg] of purchasedKgMap.entries()) {
            const totalOpenedKg = openedKgMap.get(typeId) || 0;
            const inHandKg = totalPurchasedKg - totalOpenedKg;
            const cost = avgCostPerKg[typeId] || 0;
            rawMaterialInventoryValue += inHandKg * cost;
        }

        // --- 2. Calculate Finished Goods Inventory Value ---
        let finishedGoodsInventoryValue = 0;
        state.items.forEach(item => {
            const openingStock = item.openingStock || 0;
            const production = state.productions.filter(p => p.itemId === item.id && p.date <= asOfDate).reduce((sum, p) => sum + p.quantityProduced, 0);
            const sales = state.salesInvoices.filter(inv => inv.status !== 'Unposted' && inv.date <= asOfDate).flatMap(inv => inv.items).filter(i => i.itemId === item.id).reduce((sum, i) => sum + i.quantity, 0);
            const currentStockUnits = openingStock + production - sales;
            
            if (currentStockUnits > 0) {
                const unitWeight = item.packingType !== PackingType.Kg ? (item.baleSize || 0) : 1;
                const stockKg = currentStockUnits * unitWeight;
                finishedGoodsInventoryValue += stockKg * item.avgProductionPrice;
            }
        });

        // P&L Calculation for Retained Earnings
        const revenueAccounts = state.revenueAccounts.map(a => a.id);
        const expenseAccounts = state.expenseAccounts.map(a => a.id);
        const revenue = entries.filter(je => revenueAccounts.includes(je.account)).reduce((sum, je) => sum + je.credit - je.debit, 0);
        const expenses = entries.filter(je => expenseAccounts.includes(je.account)).reduce((sum, je) => sum + je.debit - je.credit, 0);
        const netIncome = revenue - expenses;

        // ASSETS (Debit balances, usually positive)
        const cash = state.cashAccounts.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);
        const bank = state.banks.reduce((sum, b) => sum + getAccountBalance(b.id), 0);
        const receivables = getAccountBalance(state.receivableAccounts[0]?.id);
        const investments = calculateTotalBalance(state.investmentAccounts);
        const fixedAssets = getAccountBalance(state.fixedAssetAccounts[0]?.id);
        const accumulatedDepreciation = getAccountBalance(state.accumulatedDepreciationAccounts[0]?.id);
        const packingMaterialInventory = getAccountBalance(state.packingMaterialInventoryAccounts[0]?.id);
        
        const totalCurrentAssets = cash + bank + receivables + finishedGoodsInventoryValue + rawMaterialInventoryValue + packingMaterialInventory;
        const totalNonCurrentAssets = investments + fixedAssets + accumulatedDepreciation; // accumulatedDepreciation is negative here, which is correct for Net Book Value
        const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

        // LIABILITIES (Credit balances, flip sign to be positive for display)
        const payablesRaw = getAccountBalance(state.payableAccounts.find(acc => acc.name === 'Accounts Payable')?.id || '') + getAccountBalance(state.payableAccounts.find(acc => acc.name === 'Customs Charges Payable')?.id || '');
        const payables = -payablesRaw; // Flip sign to show positive Liability
        
        const loansRaw = calculateTotalBalance(state.loanAccounts);
        const loans = -loansRaw; // Flip sign
        
        const totalCurrentLiabilities = payables;
        const totalLongTermLiabilities = loans;
        const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

        // EQUITY (Credit balances, flip sign to be positive for display)
        const capitalRaw = getAccountBalance(state.capitalAccounts.find(c => c.id === 'CAP-001')?.id || '');
        const capital = -capitalRaw; // Flip sign
        
        const openingBalanceEquityRaw = getAccountBalance(state.capitalAccounts.find(c => c.id === 'CAP-002')?.id || '');
        const openingBalanceEquity = -openingBalanceEquityRaw; // Flip sign
        
        const inventoryValueNotOnBooks = (rawMaterialInventoryValue + finishedGoodsInventoryValue) - getAccountBalance(state.inventoryAccounts[0]?.id);
        const totalEquity = capital + openingBalanceEquity + netIncome + inventoryValueNotOnBooks;
        
        return {
            assets: {
                cash, bank, receivables, 
                finishedGoodsInventory: finishedGoodsInventoryValue,
                rawMaterialInventory: rawMaterialInventoryValue,
                packingMaterialInventory,
                investments,
                fixedAssets,
                accumulatedDepreciation,
                totalCurrentAssets, 
                totalNonCurrentAssets,
                totalAssets
            },
            liabilities: {
                payables, loans,
                totalCurrentLiabilities, totalLongTermLiabilities, totalLiabilities
            },
            equity: {
                capital, openingBalanceEquity,
                retainedEarnings: netIncome,
                inventoryAdjustment: inventoryValueNotOnBooks,
                totalEquity
            }
        };
    }, [asOfDate, state]);

    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const AccountRow: React.FC<{ label: string, value: number, isSubtotal?: boolean, isTotal?: boolean, onClick?: () => void }> = ({ label, value, isSubtotal, isTotal, onClick }) => (
        <div className={`flex justify-between py-1.5 text-slate-800 ${isSubtotal ? 'border-t mt-1 pt-1.5 font-semibold' : ''} ${isTotal ? 'border-t-2 border-slate-400 mt-2 pt-2 font-bold text-lg' : ''}`}>
            {onClick ? (
                <button onClick={onClick} className={`${isSubtotal || isTotal ? '' : 'pl-4'} text-left text-blue-600 hover:underline focus:outline-none`}>
                    {label}
                </button>
            ) : (
                <span className={isSubtotal || isTotal ? '' : 'pl-4'}>{label}</span>
            )}
            <span>{formatCurrency(value)}</span>
        </div>
    );

    return (
        <div className="report-print-area">
            <ReportToolbar title="Balance Sheet" exportData={[]} exportHeaders={[]} exportFilename={`BalanceSheet_${asOfDate}`} />
            <div className="p-4 bg-slate-50 rounded-lg border mb-6 flex items-end no-print">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">As of Date</label>
                    <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="p-2 border border-slate-300 rounded-md text-sm"/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Assets */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 border-b-2 pb-1">Assets (What You Have)</h3>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-lg">Current Assets</h4>
                        <AccountRow label="Cash" value={assets.cash} onClick={() => onNavigate('cash-bank/cash-book', { endDate: asOfDate })} />
                        <AccountRow label="Bank" value={assets.bank} onClick={() => onNavigate('cash-bank/bank-book', { endDate: asOfDate })} />
                        <AccountRow label="Accounts Receivable (Money Owed to You)" value={assets.receivables} onClick={() => onNavigate('ledger/main', { accountType: 'Customer', endDate: asOfDate })} />
                        <AccountRow label="Finished Goods Inventory" value={assets.finishedGoodsInventory} onClick={() => onNavigate('item-performance/stock-worth', { endDate: asOfDate })} />
                        <AccountRow label="Raw Material Inventory" value={assets.rawMaterialInventory} onClick={() => onNavigate('original-stock-v1/main')} />
                        <AccountRow label="Packing Material Inventory" value={assets.packingMaterialInventory} onClick={() => onNavigate('ledger/main', { accountType: 'Inventory', accountId: 'INV-PM-001', endDate: asOfDate })}/>
                        <AccountRow label="Total Current Assets" value={assets.totalCurrentAssets} isSubtotal />
                    </div>
                     <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-lg">Non-Current Assets</h4>
                        <AccountRow label="Investments" value={assets.investments} onClick={() => onNavigate('ledger/main', { accountType: 'Investment', endDate: asOfDate })} />
                        <AccountRow label="Fixed Assets" value={assets.fixedAssets} onClick={() => onNavigate('ledger/main', { accountType: 'Fixed Asset', accountId: 'FA-001', endDate: asOfDate })} />
                        <AccountRow label="Accumulated Depreciation" value={assets.accumulatedDepreciation} onClick={() => onNavigate('ledger/main', { accountType: 'Accumulated Depreciation', accountId: 'AD-001', endDate: asOfDate })} />
                        <AccountRow label="Total Non-Current Assets" value={assets.totalNonCurrentAssets} isSubtotal />
                    </div>
                    <AccountRow label="Total Assets" value={assets.totalAssets} isTotal />
                </div>
                {/* Liabilities & Equity */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 border-b-2 pb-1">Liabilities & Equity (Who Owns It)</h3>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-lg">Current Liabilities</h4>
                        <AccountRow label="Accounts Payable (Money You Owe)" value={liabilities.payables} onClick={() => onNavigate('ledger/main', { accountType: 'Payable', accountId: 'AP-001', endDate: asOfDate })} />
                        <AccountRow label="Total Current Liabilities" value={liabilities.totalCurrentLiabilities} isSubtotal />
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-lg">Long-Term Liabilities</h4>
                        <AccountRow label="Loans" value={liabilities.loans} onClick={() => onNavigate('ledger/main', { accountType: 'Loan', endDate: asOfDate })} />
                        <AccountRow label="Total Long-Term Liabilities" value={liabilities.totalLongTermLiabilities} isSubtotal />
                    </div>
                    <AccountRow label="Total Liabilities" value={liabilities.totalLiabilities} isSubtotal />
                    
                    <div className="space-y-2 pt-4">
                        <h4 className="font-semibold text-slate-700 text-lg">Equity</h4>
                        <AccountRow label="Owner's Capital" value={equity.capital} onClick={() => onNavigate('ledger/main', { accountType: 'Capital', accountId: 'CAP-001', endDate: asOfDate })}/>
                        <AccountRow label="Opening Balance Equity" value={equity.openingBalanceEquity} onClick={() => onNavigate('ledger/main', { accountType: 'Capital', accountId: 'CAP-002', endDate: asOfDate })}/>
                        <AccountRow label="Retained Earnings (Net Income)" value={equity.retainedEarnings} onClick={() => onNavigate('financial/profit-loss', { endDate: asOfDate })}/>
                        <AccountRow label="Inventory Adjustment" value={equity.inventoryAdjustment} />
                        <AccountRow label="Total Equity" value={equity.totalEquity} isSubtotal />
                    </div>
                    <AccountRow label="Total Liabilities & Equity" value={liabilities.totalLiabilities + equity.totalEquity} isTotal />
                </div>
            </div>
        </div>
    );
};

export default BalanceSheet;
