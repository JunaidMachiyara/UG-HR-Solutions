import { Customer, Supplier, Bank, OriginalType, Division, Account, LoanAccount, CapitalAccount, InvestmentAccount, CashAccount, ExpenseAccount, SubDivision, FreightForwarder, ClearingAgent, CommissionAgent, Employee, Section, Category, Vehicle, Warehouse, Item, OriginalProduct, SubSupplier, Logo, PackingMaterialItem, Vendor, AssetType, FixedAsset, CustomsDocument } from '../types.ts';

const generateId = (prefix: string, items: { id: string }[]): string => {
  const lastId = items.reduce((maxId, item) => {
    if (item.id.startsWith(prefix)) {
      const num = parseInt(item.id.split('-')[1], 10);
      if (!isNaN(num)) {
        return Math.max(maxId, num);
      }
    }
    return maxId;
  }, 0);
  return `${prefix}-${String(lastId + 1).padStart(3, '0')}`;
};

export const generateCustomerId = (customers: Customer[]): string => generateId('CUS', customers);
export const generateSupplierId = (suppliers: Supplier[]): string => generateId('SUP', suppliers);
export const generateVendorId = (vendors: Vendor[]): string => generateId('VND', vendors);
export const generateCommissionAgentId = (items: CommissionAgent[]): string => generateId('CA', items);
export const generateBankId = (banks: Bank[]): string => generateId('BANK', banks);
export const generateCashAccountId = (accounts: CashAccount[]): string => generateId('CASH', accounts);
export const generateOriginalTypeId = (items: OriginalType[]): string => generateId('OT', items);
export const generateDivisionId = (items: Division[]): string => generateId('DIV', items);
export const generateSubDivisionId = (items: SubDivision[]): string => generateId('SUB', items);
export const generateSectionId = (items: Section[]): string => generateId('SEC', items);
export const generateCategoryId = (items: Category[]): string => generateId('CAT', items);
export const generateFreightForwarderId = (items: FreightForwarder[]): string => generateId('FFW', items);
export const generateClearingAgentId = (items: ClearingAgent[]): string => generateId('CLA', items);
export const generateAccountId = (accounts: Account[]): string => generateId('ACC', accounts);
export const generateLoanAccountId = (accounts: LoanAccount[]): string => generateId('LOAN', accounts);
export const generateCapitalAccountId = (accounts: CapitalAccount[]): string => generateId('CAP', accounts);
export const generateInvestmentAccountId = (accounts: InvestmentAccount[]): string => generateId('INV', accounts);
export const generateExpenseAccountId = (accounts: ExpenseAccount[]): string => generateId('EXP', accounts);
export const generateEmployeeId = (items: Employee[]): string => generateId('EMP', items);
export const generateVehicleId = (items: Vehicle[]): string => generateId('VEH', items);
export const generateWarehouseId = (items: Warehouse[]): string => generateId('WH', items);
export const generateOriginalProductId = (items: OriginalProduct[]): string => generateId('OP', items);
export const generateSubSupplierId = (items: SubSupplier[]): string => generateId('SSUP', items);
export const generateLogoId = (items: Logo[]): string => generateId('LOGO', items);
export const generateItemId = (items: Item[]): string => generateId('ITM', items);
export const generatePackingMaterialItemId = (items: PackingMaterialItem[]): string => generateId('PMI', items);
export const generateAssetTypeId = (items: AssetType[]): string => generateId('AT', items);
export const generateFixedAssetId = (items: FixedAsset[]): string => generateId('FA', items);
export const generateCustomsDocumentId = (items: CustomsDocument[]): string => generateId('DOC', items);


export const generateInvoiceId = (sequentialNumber: number): string => {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  
  return `SI${sequentialNumber}_${dd}_${mm}_${yy}`;
};

export const generateOngoingOrderId = (sequentialNumber: number): string => {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  
  return `OO${sequentialNumber}_${dd}_${mm}_${yy}`;
};

export const generateFinishedGoodsPurchaseId = (sequentialNumber: number): string => {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  
  return `FGP${sequentialNumber}_${dd}_${mm}_${yy}`;
};

export const generatePackingMaterialPurchaseId = (sequentialNumber: number): string => {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  
  return `PMP${sequentialNumber}_${dd}_${mm}_${yy}`;
};