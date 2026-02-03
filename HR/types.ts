export enum Currency {
    Dollar = '$',
    AED = 'AED',
    Euro = '€',
    Pound = '£',
    AustralianDollar = 'AU$',
    SaudiRiyal = 'SRL',
}

export enum PackingType {
    Bales = 'Bales',
    Sacks = 'Sacks',
    Kg = 'Kg',
    Box = 'Box',
    Bags = 'Bags',
}

export interface Customer {
    id: string;
    name: string;
    contact: string;
    address: string;
    status: number;
    startingBalance?: number;
    divisionId?: string;
    subDivisionId?: string;
    defaultCurrency?: Currency;
}

export interface Supplier {
    id: string;
    name: string;
    contact: string;
    address: string;
    originalTypeIds: string[];
    lastRate?: number;
    defaultCurrency?: Currency;
    startingBalance?: number;
    divisionId?: string;
    subDivisionId?: string;
}

export interface Vendor {
    id: string;
    name: string;
    contact: string;
    address: string;
    defaultCurrency?: Currency;
    startingBalance?: number;
}


export interface SubSupplier {
    id: string;
    name: string;
    supplierId: string;
    contact?: string;
    address?: string;
}

export interface CommissionAgent {
    id: string;
    name: string;
    contact: string;
    address: string;
    startingBalance?: number;
    defaultCurrency?: Currency;
}

export interface Category {
    id: string;
    name: string;
}

export interface Item {
    id: string;
    name: string;
    packingType: PackingType;
    baleSize: number;
    categoryId: string;
    packingColor: string;
    avgSalesPrice: number;
    avgProductionPrice: number;
    demandFactor: number;
    openingStock?: number;
    sectionId?: string;
    nextBaleNumber?: number;
}

export interface OriginalType {
    id: string;
    name: string;
    packingType: PackingType;
    packingSize: number;
}

export interface OriginalProduct {
    id: string;
    name: string;
    originalTypeId: string;
    description?: string;
}

export interface Section {
    id: string;
    name: string;
}

export interface Division {
    id: string;
    name: string;
}

export interface SubDivision {
    id: string;
    name: string;
    divisionId: string;
}

export interface Warehouse {
    id: string;
    name: string;
}

export interface FreightForwarder {
    id: string;
    name: string;
    contact: string;
    address: string;
    startingBalance?: number;
    defaultCurrency?: Currency;
}

export interface ClearingAgent {
    id: string;
    name: string;
    contact: string;
    address: string;
    startingBalance?: number;
    defaultCurrency?: Currency;
}

export interface Bank {
    id: string;
    accountNumber: string;
    accountTitle: string;
    startingBalance?: number;
    currency?: Currency;
}

export interface Account {
    id: string;
    name: string;
}

export interface CashAccount extends Account {
    startingBalance?: number;
    currency?: Currency;
}
export interface LoanAccount extends Account {
    startingBalance?: number;
}
export interface CapitalAccount extends Account {
    startingBalance?: number;
}
export interface InvestmentAccount extends Account {
    startingBalance?: number;
}
export interface ExpenseAccount extends Account {
    startingBalance?: number;
}

export interface Employee {
    id: string;
    fullName: string;
    dateOfBirth: string;
    joiningDate: string;
    designation: string;
    status: 'Active' | 'Inactive'; // Employment status
    onDuty: boolean;
    offDutyStatus?: 'Holidays' | 'Fired';
    holidayStartDate?: string;
    holidayEndDate?: string;
    companyVisa: boolean;
    nationality: string;
    passportNumber?: string;
    visaStatus?: string;
    passportExpiryDate?: string;
    visaExpiryDate?: string;
    biennialLeaveDueDate?: string;
    biennialLeaveStatus: 'Consumed' | 'Pending';
    address: string;
    phone: string;
    email: string;
    bankName: string;
    accountNumber: string;
    iban?: string;
    taxId?: string;
    insuranceId?: string;
    basicSalary: number;
    salaryIncrementDate?: string;
    advances?: number;
    complaintsOrIssues?: string;
    startingBalance?: number;
}

export interface HRTask {
    id: string;
    description: string;
    isDone: boolean;
    comments: string;
    creationDate: string;
    completionDate?: string;
    isAcknowledged?: boolean;
}

export interface HREnquiry {
    id: string;
    description: string;
    isApproved: boolean;
    comments: string;
    creationDate: string;
    approvalDate?: string;
    isAcknowledged?: boolean;
}

export enum VehicleStatus {
    Active = 'Active',
    Maintenance = 'Maintenance',
    Sold = 'Sold',
}

export interface Vehicle {
    id: string;
    plateNumber: string;
    model: string;
    registrationExpiry: string;
    insuranceExpiry: string;
    assignedTo?: string; // Employee ID
    status: VehicleStatus;
    remarks?: string;
}


export interface OriginalOpening {
    id: string;
    date: string;
    supplierId: string;
    subSupplierId?: string;
    originalTypeId: string;
    originalProductId?: string;
    batchNumber?: string;
    opened: number;
    totalKg: number;
    isPosted?: boolean;
    transactionId?: string;
}

export interface OriginalPurchased {
    id: string;
    date: string;
    supplierId: string;
    subSupplierId?: string;
    originalTypeId: string;
    originalProductId?: string;
    quantityPurchased: number;
    rate: number; // In selected currency
    currency: Currency;
    conversionRate: number;
    divisionId: string;
    subDivisionId?: string;
    batchNumber: string;
    containerNumber?: string;
    containerInvoicedWeight?: number;
    freightForwarderId?: string;
    freightAmount?: number; // Foreign currency amount
    freightCurrency?: Currency;
    freightConversionRate?: number;
    clearingAgentId?: string;
    clearingAmount?: number; // Foreign currency amount
    clearingCurrency?: Currency;
    clearingConversionRate?: number;
    commissionAgentId?: string;
    commissionAmount?: number; // Foreign currency amount
    commissionCurrency?: Currency;
    commissionConversionRate?: number;
    discountSurcharge?: number; // In USD
}

export interface Production {
    id: string;
    date: string;
    itemId: string;
    quantityProduced: number;
    startBaleNumber?: number;
    endBaleNumber?: number;
}

export interface InvoiceItem {
    itemId: string;
    quantity: number;
    rate?: number; // In selected currency
    currency?: Currency;
    conversionRate?: number;
}

export enum InvoiceStatus {
    Unposted = 'Unposted',
    Posted = 'Posted',
    Shipped = 'Shipped',
}

export interface SalesInvoice {
    id: string;
    date: string;
    customerId: string;
    items: InvoiceItem[];
    status: InvoiceStatus;
    totalBales: number;
    totalKg: number;
    divisionId?: string;
    subDivisionId?: string;
    discountSurcharge?: number; // In USD
    sourceOrderId?: string; // Link back to the OngoingOrder
    containerNumber?: string;
    logoId?: string;
    packingColor?: string;
    
    // Freight
    freightForwarderId?: string;
    freightAmount?: number;
    freightCurrency?: Currency;
    freightConversionRate?: number;
    
    // Clearing
    clearingAgentId?: string;
    customCharges?: number;
    customChargesCurrency?: Currency;
    customChargesConversionRate?: number;

    // Commission
    commissionAgentId?: string;
    commissionAmount?: number;
    commissionCurrency?: Currency;
    commissionConversionRate?: number;

    directSalesDetails?: {
        originalPurchaseId: string;
        originalPurchaseCost: number;
    }
}

export interface OngoingOrderItem {
    itemId: string;
    quantity: number;
    shippedQuantity: number;
}

export enum OngoingOrderStatus {
    Active = 'Active',
    PartiallyShipped = 'PartiallyShipped',
    Completed = 'Completed',
    Cancelled = 'Cancelled',
}

export interface OngoingOrder {
    id: string;
    date: string;
    customerId: string;
    items: OngoingOrderItem[];
    status: OngoingOrderStatus;
    totalBales: number;
    totalKg: number;
}

export enum JournalEntryType {
    Receipt = 'Receipt',
    Payment = 'Payment',
    Expense = 'Expense',
    Journal = 'Journal',
}

export interface JournalEntry {
    id: string;
    voucherId: string;
    date: string;
    entryType: JournalEntryType;
    account: string;
    debit: number; // ALWAYS in Dollar
    credit: number; // ALWAYS in Dollar
    description: string;
    entityId?: string;
    entityType?: 'customer' | 'supplier' | 'commissionAgent' | 'employee' | 'freightForwarder' | 'clearingAgent' | 'vendor' | 'fixedAsset';
    originalAmount?: { // Optional for traceability of foreign currency transactions
        amount: number;
        currency: Currency;
    };
    createdBy?: string;
}

// FIX: Define FinishedGoodsPurchaseItem interface
export interface FinishedGoodsPurchaseItem {
    itemId: string;
    quantity: number;
    rate: number;
}

export interface FinishedGoodsPurchase {
    id: string;
    date: string;
    supplierId: string;
    items: FinishedGoodsPurchaseItem[];
    currency: Currency;
    conversionRate: number;
    divisionId?: string;
    subDivisionId?: string;
    batchNumber?: string;
    containerNumber?: string;
    containerInvoicedWeight?: number;
    freightForwarderId?: string;
    freightAmount?: number; // Foreign currency amount
    freightCurrency?: Currency;
    freightConversionRate?: number;
    clearingAgentId?: string;
    clearingAmount?: number; // Foreign currency amount
    clearingCurrency?: Currency;
    clearingConversionRate?: number;
    commissionAgentId?: string;
    commissionAmount?: number; // Foreign currency amount
    commissionCurrency?: Currency;
    commissionConversionRate?: number;
    discountSurcharge?: number; // In USD
    totalAmount: number; // Total value in foreign currency
    totalAmountInDollar: number; // Total value in dollars
}

export const LogisticsStatus = {
    InTransit: 'In Transit',
    Arrived: 'Arrived',
    Cleared: 'Cleared',
} as const;


export enum DocumentStatus {
    Pending = 'Pending',
    Submitted = 'Submitted',
    Received = 'Received',
}

export interface LogisticsEntry {
    id: number; // S.No
    purchaseId: string; // From OriginalPurchased or FinishedGoodsPurchase
    batchNumber?: string;
    dateOfLoading?: string;
    status: string;
    etd?: string; // Estimated Time of Departure
    eta?: string; // Estimated Time of Arrival
    portStorage?: string;
    doVld?: string; // D/o VLD
    ground?: string;
    unload?: string;
    receiveWeight?: number;
    freightForwarderId?: string;
    documentStatus: DocumentStatus;
    clearingBill?: string;
    warehouseId?: string;
}

export type Role = 'admin' | 'manager' | 'data_entry' | 'viewer';

export interface UserProfile {
    uid: string;
    name: string;
    email: string;
    permissions: string[];
    isAdmin: boolean;
}

export interface FavoriteCombination {
    date: string;
    // note?: string; // Can be added later
}

export interface PlannerPeriodData {
    currentPlan: number;
    lastPlan: number;
    lastActual: number;
}

export interface PlannerData {
    [entityId: string]: { // customerId or supplierId
        weekly: PlannerPeriodData;
        monthly: PlannerPeriodData;
    };
}

export enum AttendanceStatus {
    Present = 'P',
    Absent = 'A',
    HalfDay = 'HD',
    PaidLeave = 'PL',
    SickLeave = 'SL',
    Holiday = 'H',
}

export interface AttendanceRecord {
    id: string; // e.g., 'ATT-EMP001-2024-08-05'
    employeeId: string;
    date: string; // YYYY-MM-DD
    status: AttendanceStatus;
    reason?: string;
}

export interface SalaryPayment {
    id: string; // e.g., 'SP-EMP001-2024-08'
    employeeId: string;
    monthYear: string; // YYYY-MM format
    paymentDate: string; // YYYY-MM-DD
    paymentMethod: 'Cash' | 'Bank';
    bankId?: string; // if method is Bank
    amountPaid: number;
    voucherId?: string; // if paid via voucher
}

export interface TestEntry {
    id: string;
    text: string;
}

export interface Logo {
    id: string;
    name: string;
}

export interface PackingMaterialItem {
    id: string;
    name: string;
    unit: 'Roll' | 'Kg' | 'Box' | 'Pcs';
    openingStock?: number;
}

export interface PackingMaterialPurchase {
    id: string;
    date: string;
    vendorId: string;
    itemId: string; // PackingMaterialItem ID
    quantity: number;
    rate: number;
    currency: Currency;
    conversionRate: number;
    totalAmountUSD: number;
}

export interface AssetType {
    id: string;
    name: string;
}

export interface FixedAsset {
    id: string;
    name: string;
    assetTypeId: string;
    purchaseDate: string;
    purchaseValue: number;
    location?: string;
    status: 'Active' | 'Sold' | 'Scrapped';
}

export interface DepreciationEntry {
    id: string;
    assetId: string;
    date: string;
    amount: number;
    description: string;
    voucherId: string;
}

export interface GuaranteeCheque {
    id: number; // S.No
    date: string;
    boeNo: string;
    destination: string;
    shipper: string;
    stock: string;
    weight: number;
    amount: number;
    containerNo: string;
    chequeDate: string;
    chequeNo: string;
    chequeAmount: number;
    status: 'Submitted' | 'Returned' | 'Cashed';
}

export interface CustomsDocument {
    id: string;
    fileName: string;
    fileType: string;
    fileURL: string;
    description: string;
    uploadDate: string;
    uploadedBy: string;
    uploaderId: string;
}

export interface AppState {
    customers: Customer[];
    suppliers: Supplier[];
    vendors: Vendor[];
    subSuppliers: SubSupplier[];
    commissionAgents: CommissionAgent[];
    items: Item[];
    originalTypes: OriginalType[];
    originalProducts: OriginalProduct[];
    divisions: Division[];
    subDivisions: SubDivision[];
    warehouses: Warehouse[];
    sections: Section[];
    categories: Category[];
    logos: Logo[];
    freightForwarders: FreightForwarder[];
    clearingAgents: ClearingAgent[];
    banks: Bank[];
    cashAccounts: CashAccount[];
    loanAccounts: LoanAccount[];
    capitalAccounts: CapitalAccount[];
    investmentAccounts: InvestmentAccount[];
    expenseAccounts: ExpenseAccount[];
    inventoryAccounts: Account[];
    packingMaterialInventoryAccounts: Account[];
    fixedAssetAccounts: Account[];
    accumulatedDepreciationAccounts: Account[];
    receivableAccounts: Account[];
    revenueAccounts: Account[];
    payableAccounts: Account[];
    employees: Employee[];
    attendanceRecords: AttendanceRecord[];
    salaryPayments: SalaryPayment[];
    hrTasks: HRTask[];
    hrEnquiries: HREnquiry[];
    vehicles: Vehicle[];
    assetTypes: AssetType[];
    fixedAssets: FixedAsset[];
    depreciationEntries: DepreciationEntry[];
    originalOpenings: OriginalOpening[];
    originalPurchases: OriginalPurchased[];
    productions: Production[];
    salesInvoices: SalesInvoice[];
    ongoingOrders: OngoingOrder[];
    finishedGoodsPurchases: FinishedGoodsPurchase[];
    packingMaterialItems: PackingMaterialItem[];
    packingMaterialPurchases: PackingMaterialPurchase[];
    logisticsEntries: LogisticsEntry[];
    guaranteeCheques: GuaranteeCheque[];
    customsDocuments: CustomsDocument[];
    favoriteCombinations: FavoriteCombination[];
    nextInvoiceNumber: number;
    nextOngoingOrderNumber: number;
    nextFinishedGoodsPurchaseNumber: number;
    nextPackingMaterialPurchaseNumber: number;
    nextLogisticsSNo: number;
    nextHRTaskId: number;
    nextHREnquiryId: number;
    nextGuaranteeChequeSNo: number;
    journalEntries: JournalEntry[];
    nextReceiptVoucherNumber: number;
    nextPaymentVoucherNumber: number;
    nextExpenseVoucherNumber: number;
    nextJournalVoucherNumber: number;
    testEntries: TestEntry[];
    nextTestEntryNumber: number;
    plannerData: PlannerData;
    plannerLastWeeklyReset: string;
    plannerLastMonthlyReset: string;
    plannerCustomerIds?: string[];
    plannerSupplierIds?: string[];
    plannerExpenseAccountIds?: string[];
}

export type Module = 'setup' | 'hr' | 'test' | 'chat';