import React, { useState, useMemo, useEffect } from 'react';
import ItemPerformanceReport from './ItemPerformanceReport.tsx';
import LedgerReport from './LedgerReport.tsx';
import CashAndBankReport from './CashAndBankReport.tsx';
import NonMovingItemsReport from './NonMovingItemsReport.tsx';
import StockAlertsReport from './StockAlertsReport.tsx';
import ProductionAnalysisReport from './ProductionAnalysisReport.tsx';
import ItemSummaryReport from './ItemSummaryReport.tsx';
import SalesInvoiceReport from './SalesInvoiceReport.tsx';
import PurchaseInvoiceReport from './PurchaseInvoiceReport.tsx';
import DetailedSalesReport from './DetailedSalesReport.tsx';
import DetailedPurchaseReport from './DetailedPurchaseReport.tsx';
import OriginalCombinationReport from './OriginalCombinationReport.tsx';
import DailyProductionReport from './DailyProductionReport.tsx';
import BalanceSheet from './BalanceSheet.tsx';
import ProfitAndLossReport from './ProfitAndLossReport.tsx';
import OriginalStockReport from './OriginalStockReport.tsx';
import { UserProfile } from '../../types.ts';
import OrderFulfillmentDashboard from "./OrderFulfillmentDashboard.tsx";
import SectionProductionReport from './SectionProductionReport.tsx';
import FeasibilityReport from "./FeasibilityReport.tsx";
import RebalingReport from "./RebalingReport.tsx";
import PaymentPlannerReport from './PaymentPlannerReport.tsx';
import StockWorthReport from './StockWorthReport.tsx';
import ExpensePlannerReport from './ExpensePlannerReport.tsx';

type ReportCategoryKey = 'item-performance' | 'original-stock-v1' | 'ledger' | 'cash-bank' | 'invoices' | 'detailed-reports' | 'production' | 'financial' | 'fulfillment';
// FIX: Export the ReportKey type so it can be imported by other components.
export type ReportKey = 
    | 'item-performance/summary'
    | 'item-performance/stock-worth'
    | 'item-performance/non-moving'
    | 'item-performance/alerts'
    | 'item-performance/production-analysis'
    | 'item-performance/item-summary'
    | 'original-stock-v1/main'
    | 'ledger/main'
    | 'cash-bank/ledger'
    | 'cash-bank/cash-book'
    | 'cash-bank/bank-book'
    | 'invoices/sales'
    | 'invoices/purchase'
    | 'detailed-reports/sales'
    | 'detailed-reports/purchases'
    | 'production/original-combination'
    | 'production/section-production'
    | 'production/daily-production'
    | 'production/rebaling-report'
    | 'production/feasibility'
    | 'financial/balance-sheet'
    | 'financial/profit-loss'
    | 'financial/payment-planner'
    | 'financial/expense-planner'
    | 'fulfillment/dashboard';


interface ReportSubItem {
    key: ReportKey;
    label: string;
}

interface ReportCategory {
    key: ReportCategoryKey;
    label: string;
    subReports?: ReportSubItem[];
}

export const reportStructure: ReportCategory[] = [
    {
        key: 'item-performance',
        label: 'Item Performance',
        subReports: [
            { key: 'item-performance/summary', label: 'Performance Summary' },
            { key: 'item-performance/stock-worth', label: 'Stock Worth' },
            { key: 'item-performance/item-summary', label: 'Item Sales Summary' },
            { key: 'item-performance/non-moving', label: 'Non-Moving Items' },
            { key: 'item-performance/alerts', label: 'Stock Alerts' },
            { key: 'item-performance/production-analysis', label: 'Production Analysis' },
        ],
    },
    {
        key: 'original-stock-v1',
        label: 'Original Stock',
    },
    {
        key: 'fulfillment',
        label: 'Fulfillment',
        subReports: [
            { key: 'fulfillment/dashboard', label: 'Order Fulfillment Dashboard' },
        ]
    },
    {
        key: 'ledger',
        label: 'Ledger Reports',
    },
    {
        key: 'cash-bank',
        label: 'Cash & Bank',
        subReports: [
            { key: 'cash-bank/ledger', label: 'Ledger' },
            { key: 'cash-bank/cash-book', label: 'Cash Book' },
            { key: 'cash-bank/bank-book', label: 'Bank Book' },
        ],
    },
    {
        key: 'invoices',
        label: 'Invoices',
        subReports: [
            { key: 'invoices/sales', label: 'Sales Invoices' },
            { key: 'invoices/purchase', label: 'Purchase Invoices' },
        ],
    },
    {
        key: 'detailed-reports',
        label: 'Detailed Reports',
        subReports: [
            { key: 'detailed-reports/sales', label: 'Sales' },
            { key: 'detailed-reports/purchases', label: 'Purchases' },
        ],
    },
    {
        key: 'production',
        label: 'Production',
        subReports: [
            { key: 'production/original-combination', label: 'Original Combination' },
            { key: 'production/daily-production', label: 'Daily Production' },
            { key: 'production/rebaling-report', label: 'Rebaling' },
            { key: 'production/section-production', label: 'Section Production' },
            { key: 'production/feasibility', label: 'Feasibility' },
        ],
    },
    {
        key: 'financial',
        label: 'Financial',
        subReports: [
            { key: 'financial/balance-sheet', label: 'Balance Sheet' },
            { key: 'financial/profit-loss', label: 'Profit & Loss Report' },
            { key: 'financial/payment-planner', label: 'Receipts & Payments Planner' },
            { key: 'financial/expense-planner', label: 'Expense Paid & Payable Planner' },
        ],
    },
];

const ReportsModule: React.FC<{ userProfile: UserProfile | null, initialReport?: string | null }> = ({ userProfile, initialReport }) => {
    const [activeReportKey, setActiveReportKey] = useState<ReportKey | null>(null);
    const [initialFilters, setInitialFilters] = useState<any>(null);

    const navigateToReport = (key: ReportKey, filters: any = null) => {
        setActiveReportKey(key);
        setInitialFilters(filters);
    };

    const accessibleReportStructure = useMemo((): ReportCategory[] => {
        if (!userProfile) return [];
        if (userProfile.isAdmin) return reportStructure;

        const userPermissions = new Set(userProfile.permissions);

        return reportStructure.map(category => {
            const categoryPermission = `reports/${category.key}`;

            if (category.subReports) {
                // If user has the parent category permission, include all sub-reports
                if (userPermissions.has(categoryPermission)) {
                    return category;
                }
                // Otherwise, filter sub-reports based on individual permissions
                const accessibleSubReports = category.subReports.filter(sub =>
                    userPermissions.has(sub.key)
                );
                if (accessibleSubReports.length > 0) {
                    return { ...category, subReports: accessibleSubReports };
                }
            } else {
                // For direct reports like Ledger
                const directReportKey = `${category.key}/main` as ReportKey;
                if (userPermissions.has(directReportKey) || userPermissions.has(`reports/${category.key}`)) {
                    return category;
                }
            }
            return null;
        }).filter((c): c is ReportCategory => c !== null);

    }, [userProfile]);
    
    useEffect(() => {
        // 1. Prioritize the initialReport prop (from chatbot/dashboard)
        if (initialReport) {
            const isAccessible = accessibleReportStructure.some(cat =>
                cat.subReports
                    ? cat.subReports.some(sub => sub.key === initialReport)
                    : `${cat.key}/main` === initialReport
            );
            if (isAccessible) {
                navigateToReport(initialReport as ReportKey);
                return;
            }
        }

        // 2. Check if current active report is still valid
        const isCurrentActiveReportAccessible = activeReportKey && accessibleReportStructure.some(cat =>
            cat.subReports
                ? cat.subReports.some(sub => sub.key === activeReportKey)
                : `${cat.key}/main` === activeReportKey
        );

        if (isCurrentActiveReportAccessible) {
            return; // Current report is fine, do nothing
        }
        
        // 3. If no deep link and current is invalid, set to first available report
        const firstAccessibleCategory = accessibleReportStructure[0];
        if (firstAccessibleCategory) {
            const firstReportKey = firstAccessibleCategory.subReports
                ? firstAccessibleCategory.subReports[0].key
                : `${firstAccessibleCategory.key}/main` as ReportKey;
            navigateToReport(firstReportKey);
        } else {
            // 4. If no reports are accessible at all
            navigateToReport(null as any);
        }

    }, [accessibleReportStructure, initialReport]);


    const handleSelectCategory = (category: ReportCategory) => {
        if (category.subReports && category.subReports.length > 0) {
            if (!activeReportKey || !activeReportKey.startsWith(category.key)) {
                navigateToReport(category.subReports[0].key);
            }
        } else {
            navigateToReport(`${category.key}/main` as ReportKey);
        }
    };
    
    const renderReport = () => {
        if (!activeReportKey) return <p>You do not have permission to view any reports.</p>;
        
        switch (activeReportKey) {
            case 'item-performance/summary':
                return <ItemPerformanceReport />;
            case 'item-performance/stock-worth':
                return <StockWorthReport initialFilters={initialFilters} />;
            case 'item-performance/item-summary':
                return <ItemSummaryReport />;
            case 'item-performance/non-moving':
                return <NonMovingItemsReport />;
            case 'item-performance/alerts':
                return <StockAlertsReport />;
            case 'item-performance/production-analysis':
                return <ProductionAnalysisReport />;
            case 'original-stock-v1/main':
                return <OriginalStockReport />;
            case 'fulfillment/dashboard':
                return <OrderFulfillmentDashboard />;
            case 'ledger/main':
                return <LedgerReport initialFilters={initialFilters} />;
            case 'cash-bank/ledger':
                return <CashAndBankReport mode="combined" initialFilters={initialFilters} />;
            case 'cash-bank/cash-book':
                return <CashAndBankReport mode="cash" initialFilters={initialFilters} />;
            case 'cash-bank/bank-book':
                return <CashAndBankReport mode="bank" initialFilters={initialFilters} />;
            case 'invoices/sales':
                return <SalesInvoiceReport />;
            case 'invoices/purchase':
                return <PurchaseInvoiceReport />;
            case 'detailed-reports/sales':
                return <DetailedSalesReport />;
            case 'detailed-reports/purchases':
                return <DetailedPurchaseReport />;
            case 'production/original-combination':
                return <OriginalCombinationReport />;
            case 'production/daily-production':
                return <DailyProductionReport />;
            case 'production/rebaling-report':
                return <RebalingReport />;
            case 'financial/balance-sheet':
                return <BalanceSheet onNavigate={navigateToReport} />;
            case 'financial/profit-loss':
                return <ProfitAndLossReport initialFilters={initialFilters} />;
            case 'financial/payment-planner':
                return <PaymentPlannerReport />;
            case 'financial/expense-planner':
                return <ExpensePlannerReport />;
            case 'production/section-production':
                return <SectionProductionReport />;
            case 'production/feasibility':
                return <FeasibilityReport />;
            default:
                return <p>Select a report to view.</p>;
        }
    };
    
    const activeCategory = accessibleReportStructure.find(cat => activeReportKey && activeReportKey.startsWith(cat.key));

    return (
        <div className="space-y-6">
            <nav className="bg-white p-4 rounded-lg shadow-md no-print space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 pb-3">
                    <h2 className="text-xl font-bold text-slate-800">Reports:</h2>
                    {accessibleReportStructure.map(category => {
                         const isActive = activeCategory?.key === category.key;
                         return (
                            <button
                                key={category.key}
                                onClick={() => handleSelectCategory(category)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                                }`}
                            >
                                {category.label}
                            </button>
                         )
                    })}
                </div>
                 {activeCategory?.subReports && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                         <h3 className="text-sm font-semibold text-slate-600 mr-2">{activeCategory.label}:</h3>
                         {activeCategory.subReports.map(report => {
                             const isActive = activeReportKey === report.key;
                             return (
                                <button
                                    key={report.key}
                                    onClick={() => navigateToReport(report.key)}
                                    className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                                        isActive
                                            ? 'bg-blue-100 text-blue-800 font-semibold ring-1 ring-blue-300'
                                            : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {report.label}
                                </button>
                             )
                         })}
                    </div>
                 )}
            </nav>
            
            <main className="w-full">
                <div className="bg-white p-6 rounded-lg shadow-md min-h-[300px]">
                    {renderReport()}
                </div>
            </main>
        </div>
    );
};

export default ReportsModule;
