import React, { createContext, useContext, useReducer, ReactNode, useEffect, useState, useRef } from 'react';
import { 
    AppState, PackingType, JournalEntry, JournalEntryType,
    InvoiceStatus, Currency, LogisticsEntry, Production,
    LogisticsStatus, DocumentStatus, PlannerData, UserProfile, Role, Module, Item, Division, Vendor
} from '../types.ts';

// --- START: Firebase Setup ---
const FB_API_KEY_PART_1 = "AIzaSyATRfTy5XIvuFxxSLM4Qx";
const FB_API_KEY_PART_2 = "_kKOv4IdNlP0Q";

const firebaseConfig = {
    apiKey: FB_API_KEY_PART_1 + FB_API_KEY_PART_2,
    authDomain: "ug-m-a7126.firebaseapp.com",
    projectId: "ug-m-a7126",
    storageBucket: "ug-m-a7126.firebasestorage.app",
    messagingSenderId: "177936238315",
    appId: "1:177936238315:web:38c9193647bf7fcce9e0ae",
    measurementId: "G-9DHDY8LN14"
};

let auth: any, db: any, storage: any;
try {
    const firebase = (window as any).firebase;
    if (firebase) {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();
        storage = firebase.storage();
    } else {
        console.error("Firebase is not available. Check script tags in index.html.");
    }
} catch (e) {
    console.error("Firebase initialization failed:", e);
}
export { auth, db, storage };
// --- END: Firebase Setup ---


// --- START: PERMISSIONS SETUP ---
export const mainModules: Module[] = ['setup', 'hr', 'chat'];

export const dataEntrySubModules = [
    { key: 'opening', label: 'Original Opening', shortcut: 'Alt + O' },
    { key: 'production', label: 'Production', shortcut: 'Alt + P' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'sales', label: 'Sales Invoice', shortcut: 'Alt + S' },
    { key: 'stockLot', label: 'Bundle Purchase' },
    { key: 'ongoing', label: 'Ongoing Orders', shortcut: 'Alt + U' },
    { key: 'rebaling', label: 'Re-baling' },
    { key: 'directSales', label: 'Direct Sales' },
    { key: 'offloading', label: 'Container Off-loading' }
];

// Cleaned up permissions list for the simplified app
export const allPermissions = [
    ...mainModules,
    'hr/payroll', 'hr/tasks', 'hr/enquiries', 'hr/vehicles', 'hr/attendance',
    'setup/customers', 'setup/suppliers', 'setup/items', 'setup/divisions'
];
// --- END: PERMISSIONS SETUP ---

// --- START: DEVELOPMENT LOGIN BYPASS ---
const IS_DEV_MODE = false;

const mockAdminProfile: UserProfile = {
  uid: 'mock_admin_asif_uid',
  name: 'Dev Admin',
  email: 'junaidmachiyara@gmail.com',
  isAdmin: true,
  permissions: allPermissions,
};
// --- END: DEVELOPMENT LOGIN BYPASS ---

const convertUndefinedToNull = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => convertUndefinedToNull(item));
    }

    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (value === undefined) {
                newObj[key] = null;
            } else {
                newObj[key] = convertUndefinedToNull(value);
            }
        }
    }
    return newObj;
};

const processState = (state: AppState): AppState => {
    const productionsByItem: { [itemId: string]: number } = {};
    state.productions.forEach(p => {
        productionsByItem[p.itemId] = (productionsByItem[p.itemId] || 0) + p.quantityProduced;
    });

    const items = state.items.map(item => {
        const totalProduced = productionsByItem[item.id] || 0;
        return {
            ...item,
            nextBaleNumber: (item.openingStock || 0) + totalProduced + 1
        };
    });

    return { ...state, items };
};


const getInitialState = (): AppState => {
    const baseState: AppState = {
        customers: [],
        suppliers: [],
        vendors: [],
        subSuppliers: [],
        employees: [],
        banks: [],
        cashAccounts: [],
        originalTypes: [],
        originalProducts: [],
        divisions: [],
        subDivisions: [],
        warehouses: [],
        sections: [],
        categories: [],
        items: [],
        logos: [],
        assetTypes: [],
        
        commissionAgents: [],
        freightForwarders: [],
        clearingAgents: [],

        loanAccounts: [],
        capitalAccounts: [],
        investmentAccounts: [],
        expenseAccounts: [
            { id: 'EXP-012', name: 'Depreciation Expense' },
        ],

        inventoryAccounts: [
            { id: 'INV-FG-001', name: 'Finished Goods Inventory' },
        ],
        packingMaterialInventoryAccounts: [
            { id: 'INV-PM-001', name: 'Packing Material Inventory' },
        ],
        fixedAssetAccounts: [
            { id: 'FA-001', name: 'Fixed Assets at Cost' },
        ],
        accumulatedDepreciationAccounts: [
            { id: 'AD-001', name: 'Accumulated Depreciation' },
        ],
        receivableAccounts: [
            { id: 'AR-001', name: 'Accounts Receivable' },
        ],
        revenueAccounts: [
            { id: 'REV-001', name: 'Sales Revenue' },
        ],
        payableAccounts: [
            { id: 'AP-001', name: 'Accounts Payable' },
            { id: 'AP-002', name: 'Customs Charges Payable' },
        ],

        attendanceRecords: [],
        salaryPayments: [],
        hrTasks: [],
        hrEnquiries: [],
        vehicles: [],
        fixedAssets: [],
        depreciationEntries: [],
        originalOpenings: [],
        originalPurchases: [],
        productions: [],
        salesInvoices: [],
        ongoingOrders: [],
        finishedGoodsPurchases: [],
        packingMaterialItems: [],
        packingMaterialPurchases: [],
        logisticsEntries: [],
        guaranteeCheques: [],
        customsDocuments: [],
        favoriteCombinations: [],
        journalEntries: [],
        testEntries: [],

        nextInvoiceNumber: 1,
        nextOngoingOrderNumber: 1,
        nextFinishedGoodsPurchaseNumber: 1,
        nextPackingMaterialPurchaseNumber: 1,
        nextLogisticsSNo: 1,
        nextHRTaskId: 1,
        nextHREnquiryId: 1,
        nextGuaranteeChequeSNo: 1,
        nextReceiptVoucherNumber: 1,
        nextPaymentVoucherNumber: 1,
        nextExpenseVoucherNumber: 1,
        nextJournalVoucherNumber: 1,
        nextTestEntryNumber: 1,

        plannerData: {},
        plannerLastWeeklyReset: '',
        plannerLastMonthlyReset: '',
        plannerCustomerIds: [],
        plannerSupplierIds: [],
        plannerExpenseAccountIds: [],
    };
    return baseState;
};

const initialState = processState(getInitialState());

type EntityName = keyof Omit<AppState, 'nextInvoiceNumber' | 'nextOngoingOrderNumber' | 'nextFinishedGoodsPurchaseNumber' | 'nextReceiptVoucherNumber' | 'nextPaymentVoucherNumber' | 'nextExpenseVoucherNumber' | 'nextJournalVoucherNumber' | 'nextLogisticsSNo' | 'favoriteCombinations' | 'nextHRTaskId' | 'nextHREnquiryId' | 'plannerData' | 'plannerLastWeeklyReset' | 'plannerLastMonthlyReset' | 'nextTestEntryNumber' | 'plannerCustomerIds' | 'plannerSupplierIds' | 'plannerExpenseAccountIds' | 'nextPackingMaterialPurchaseNumber' | 'nextGuaranteeChequeSNo'>;
type Entity = AppState[EntityName][0];

type AddAction = { type: 'ADD_ENTITY'; payload: { entity: EntityName; data: Entity }; };
type UpdateAction = { type: 'UPDATE_ENTITY'; payload: { entity: EntityName; data: { id: string | number } & Partial<Entity> }; };
type DeleteAction = { type: 'DELETE_ENTITY'; payload: { entity: EntityName; id: string | number }; };
type RestoreAction = { type: 'RESTORE_STATE'; payload: AppState; };
type ToggleFavoriteAction = { type: 'TOGGLE_FAVORITE_COMBINATION'; payload: { date: string }; };
type SetPlannerDataAction = { type: 'SET_PLANNER_DATA'; payload: Partial<{ plannerData: PlannerData; plannerLastWeeklyReset: string; plannerLastMonthlyReset: string; }>; };
type AddPlannerEntityAction = { type: 'ADD_PLANNER_ENTITY'; payload: { entityType: 'customer' | 'supplier' | 'expenseAccount'; entityId: string }; };
type RemovePlannerEntityAction = { type: 'REMOVE_PLANNER_ENTITY'; payload: { entityType: 'customer' | 'supplier' | 'expenseAccount'; entityId: string }; };


type BatchActionPayload = AddAction | UpdateAction | DeleteAction;
type BatchUpdateAction = { type: 'BATCH_UPDATE'; payload: BatchActionPayload[] };
type HardResetTransactionsAction = { type: 'HARD_RESET_TRANSACTIONS' };


type Action = AddAction | UpdateAction | DeleteAction | RestoreAction | ToggleFavoriteAction | SetPlannerDataAction | BatchUpdateAction | HardResetTransactionsAction | AddPlannerEntityAction | RemovePlannerEntityAction;

const dataReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'ADD_PLANNER_ENTITY': {
            const { entityType, entityId } = action.payload;
            const key: 'plannerCustomerIds' | 'plannerSupplierIds' | 'plannerExpenseAccountIds' = entityType === 'customer' ? 'plannerCustomerIds' : entityType === 'supplier' ? 'plannerSupplierIds' : 'plannerExpenseAccountIds';
            const currentIds = state[key] || [];
            if (currentIds.includes(entityId)) return state;
            return { ...state, [key]: [...currentIds, entityId] };
        }
        case 'REMOVE_PLANNER_ENTITY': {
            const { entityType, entityId } = action.payload;
            const key: 'plannerCustomerIds' | 'plannerSupplierIds' | 'plannerExpenseAccountIds' = entityType === 'customer' ? 'plannerCustomerIds' : entityType === 'supplier' ? 'plannerSupplierIds' : 'plannerExpenseAccountIds';
            const currentIds = state[key] || [];
            return { ...state, [key]: currentIds.filter(id => id !== entityId) };
        }
        case 'HARD_RESET_TRANSACTIONS': {
            return {
                ...state,
                salesInvoices: [],
                originalPurchases: [],
                finishedGoodsPurchases: [],
                packingMaterialPurchases: [],
                journalEntries: [],
                productions: [],
                originalOpenings: [],
                ongoingOrders: [],
                logisticsEntries: [],
                attendanceRecords: [],
                salaryPayments: [],
                hrTasks: [],
                hrEnquiries: [],
                favoriteCombinations: [],
                testEntries: [],
                depreciationEntries: [],
                
                nextInvoiceNumber: 1,
                nextOngoingOrderNumber: 1,
                nextFinishedGoodsPurchaseNumber: 1,
                nextPackingMaterialPurchaseNumber: 1,
                nextLogisticsSNo: 1,
                nextReceiptVoucherNumber: 1,
                nextPaymentVoucherNumber: 1,
                nextExpenseVoucherNumber: 1,
                nextJournalVoucherNumber: 1,
                nextTestEntryNumber: 1,
                nextHRTaskId: 1,
                nextHREnquiryId: 1,
        
                plannerData: {},
                plannerLastWeeklyReset: '',
                plannerLastMonthlyReset: '',
            };
        }
        case 'BATCH_UPDATE':
            return action.payload.reduce(
                (currentState, currentAction) => dataReducer(currentState, currentAction),
                state
            );
        case 'ADD_ENTITY': {
            const { entity, data } = action.payload;
            const entityArray = state[entity] as Entity[];
            const newState = { ...state, [entity]: [...entityArray, data] };
            if (entity === 'salesInvoices') newState.nextInvoiceNumber = state.nextInvoiceNumber + 1;
            if (entity === 'ongoingOrders') newState.nextOngoingOrderNumber = state.nextOngoingOrderNumber + 1;
            if (entity === 'finishedGoodsPurchases') newState.nextFinishedGoodsPurchaseNumber = state.nextFinishedGoodsPurchaseNumber + 1;
            if (entity === 'packingMaterialPurchases') newState.nextPackingMaterialPurchaseNumber = state.nextPackingMaterialPurchaseNumber + 1;
            if (entity === 'logisticsEntries') newState.nextLogisticsSNo = state.nextLogisticsSNo + 1;
            if (entity === 'guaranteeCheques') newState.nextGuaranteeChequeSNo = state.nextGuaranteeChequeSNo + 1;
            if (entity === 'hrTasks') newState.nextHRTaskId = state.nextHRTaskId + 1;
            if (entity === 'hrEnquiries') newState.nextHREnquiryId = state.nextHREnquiryId + 1;
            if (entity === 'testEntries') newState.nextTestEntryNumber = state.nextTestEntryNumber + 1;
            if (entity === 'journalEntries') {
                const entry = data as JournalEntry;
                const isFirstEntryForVoucher = !state.journalEntries.some(je => je.voucherId === entry.voucherId);
                if (isFirstEntryForVoucher) {
                    if (entry.entryType === JournalEntryType.Receipt && entry.voucherId.startsWith('RV-')) newState.nextReceiptVoucherNumber = state.nextReceiptVoucherNumber + 1;
                    else if (entry.entryType === JournalEntryType.Payment && entry.voucherId.startsWith('PV-')) newState.nextPaymentVoucherNumber = state.nextPaymentVoucherNumber + 1;
                    else if (entry.entryType === JournalEntryType.Expense && entry.voucherId.startsWith('EV-')) newState.nextExpenseVoucherNumber = state.nextExpenseVoucherNumber + 1;
                    else if (entry.entryType === JournalEntryType.Journal && entry.voucherId.startsWith('JV-')) newState.nextJournalVoucherNumber = state.nextJournalVoucherNumber + 1;
                }
            }
            return newState;
        }
        case 'UPDATE_ENTITY': {
            const { entity, data } = action.payload;
            const entityArray = state[entity] as ({id: string | number})[];
            return { ...state, [entity]: entityArray.map((item) => item.id === data.id ? {...item, ...data} : item), };
        }
        case 'DELETE_ENTITY': {
            const { entity, id } = action.payload;
            const entityArray = state[entity] as ({id: string | number})[];
            return { ...state, [entity]: entityArray.filter((item) => item.id !== id), };
        }
        case 'TOGGLE_FAVORITE_COMBINATION': {
            const { date } = action.payload;
            const isFavorite = state.favoriteCombinations.some(fav => fav.date === date);
            if (isFavorite) return { ...state, favoriteCombinations: state.favoriteCombinations.filter(fav => fav.date !== date), };
            else {
                const newFavorites = [...state.favoriteCombinations, { date }];
                newFavorites.sort((a, b) => b.date.localeCompare(a.date));
                return { ...state, favoriteCombinations: newFavorites, };
            }
        }
        case 'SET_PLANNER_DATA': return { ...state, ...action.payload, };
        case 'RESTORE_STATE': {
            const firestoreState = action.payload;
            if (firestoreState && typeof firestoreState === 'object' && 'customers' in firestoreState) {
                const defaultState = getInitialState();
                
                const newState: AppState = {
                    customers: firestoreState.customers || defaultState.customers,
                    suppliers: firestoreState.suppliers || defaultState.suppliers,
                    vendors: firestoreState.vendors || defaultState.vendors,
                    subSuppliers: firestoreState.subSuppliers || defaultState.subSuppliers,
                    commissionAgents: firestoreState.commissionAgents || defaultState.commissionAgents,
                    items: firestoreState.items || defaultState.items,
                    originalTypes: firestoreState.originalTypes || defaultState.originalTypes,
                    originalProducts: firestoreState.originalProducts || defaultState.originalProducts,
                    divisions: firestoreState.divisions || defaultState.divisions,
                    subDivisions: firestoreState.subDivisions || defaultState.subDivisions,
                    warehouses: firestoreState.warehouses || defaultState.warehouses,
                    sections: firestoreState.sections || defaultState.sections,
                    categories: firestoreState.categories || defaultState.categories,
                    logos: firestoreState.logos || defaultState.logos,
                    assetTypes: firestoreState.assetTypes || defaultState.assetTypes,
                    freightForwarders: firestoreState.freightForwarders || defaultState.freightForwarders,
                    clearingAgents: firestoreState.clearingAgents || defaultState.clearingAgents,
                    banks: firestoreState.banks || defaultState.banks,
                    cashAccounts: firestoreState.cashAccounts || defaultState.cashAccounts,
                    loanAccounts: firestoreState.loanAccounts || defaultState.loanAccounts,
                    capitalAccounts: firestoreState.capitalAccounts || defaultState.capitalAccounts,
                    investmentAccounts: firestoreState.investmentAccounts || defaultState.investmentAccounts,
                    expenseAccounts: firestoreState.expenseAccounts || defaultState.expenseAccounts,
                    inventoryAccounts: firestoreState.inventoryAccounts || defaultState.inventoryAccounts,
                    packingMaterialInventoryAccounts: firestoreState.packingMaterialInventoryAccounts || defaultState.packingMaterialInventoryAccounts,
                    fixedAssetAccounts: firestoreState.fixedAssetAccounts || defaultState.fixedAssetAccounts,
                    accumulatedDepreciationAccounts: firestoreState.accumulatedDepreciationAccounts || defaultState.accumulatedDepreciationAccounts,
                    receivableAccounts: firestoreState.receivableAccounts || defaultState.receivableAccounts,
                    revenueAccounts: firestoreState.revenueAccounts || defaultState.revenueAccounts,
                    payableAccounts: firestoreState.payableAccounts || defaultState.payableAccounts,
                    employees: firestoreState.employees || defaultState.employees,
                    attendanceRecords: firestoreState.attendanceRecords || defaultState.attendanceRecords,
                    salaryPayments: firestoreState.salaryPayments || defaultState.salaryPayments,
                    hrTasks: firestoreState.hrTasks || defaultState.hrTasks,
                    hrEnquiries: firestoreState.hrEnquiries || defaultState.hrEnquiries,
                    vehicles: firestoreState.vehicles || defaultState.vehicles,
                    fixedAssets: firestoreState.fixedAssets || defaultState.fixedAssets,
                    depreciationEntries: firestoreState.depreciationEntries || defaultState.depreciationEntries,
                    originalOpenings: firestoreState.originalOpenings || defaultState.originalOpenings,
                    originalPurchases: firestoreState.originalPurchases || defaultState.originalPurchases,
                    productions: firestoreState.productions || defaultState.productions,
                    salesInvoices: firestoreState.salesInvoices || defaultState.salesInvoices,
                    ongoingOrders: firestoreState.ongoingOrders || defaultState.ongoingOrders,
                    finishedGoodsPurchases: firestoreState.finishedGoodsPurchases || defaultState.finishedGoodsPurchases,
                    packingMaterialItems: firestoreState.packingMaterialItems || defaultState.packingMaterialItems,
                    packingMaterialPurchases: firestoreState.packingMaterialPurchases || defaultState.packingMaterialPurchases,
                    logisticsEntries: firestoreState.logisticsEntries || defaultState.logisticsEntries,
                    guaranteeCheques: firestoreState.guaranteeCheques || defaultState.guaranteeCheques,
                    customsDocuments: firestoreState.customsDocuments || defaultState.customsDocuments,
                    favoriteCombinations: firestoreState.favoriteCombinations || defaultState.favoriteCombinations,
                    journalEntries: firestoreState.journalEntries || defaultState.journalEntries,
                    testEntries: firestoreState.testEntries || defaultState.testEntries,
                    
                    nextInvoiceNumber: firestoreState.nextInvoiceNumber ?? defaultState.nextInvoiceNumber,
                    nextOngoingOrderNumber: firestoreState.nextOngoingOrderNumber ?? defaultState.nextOngoingOrderNumber,
                    nextFinishedGoodsPurchaseNumber: firestoreState.nextFinishedGoodsPurchaseNumber ?? defaultState.nextFinishedGoodsPurchaseNumber,
                    nextPackingMaterialPurchaseNumber: firestoreState.nextPackingMaterialPurchaseNumber ?? defaultState.nextPackingMaterialPurchaseNumber,
                    nextLogisticsSNo: firestoreState.nextLogisticsSNo ?? defaultState.nextLogisticsSNo,
                    nextHRTaskId: firestoreState.nextHRTaskId ?? defaultState.nextHRTaskId,
                    nextHREnquiryId: firestoreState.nextHREnquiryId ?? defaultState.nextHREnquiryId,
                    nextGuaranteeChequeSNo: firestoreState.nextGuaranteeChequeSNo ?? defaultState.nextGuaranteeChequeSNo,
                    nextReceiptVoucherNumber: firestoreState.nextReceiptVoucherNumber ?? defaultState.nextReceiptVoucherNumber,
                    nextPaymentVoucherNumber: firestoreState.nextPaymentVoucherNumber ?? defaultState.nextPaymentVoucherNumber,
                    nextExpenseVoucherNumber: firestoreState.nextExpenseVoucherNumber ?? defaultState.nextExpenseVoucherNumber,
                    nextJournalVoucherNumber: firestoreState.nextJournalVoucherNumber ?? defaultState.nextJournalVoucherNumber,
                    nextTestEntryNumber: firestoreState.nextTestEntryNumber ?? defaultState.nextTestEntryNumber,
                    
                    plannerData: firestoreState.plannerData || defaultState.plannerData,
                    plannerLastWeeklyReset: firestoreState.plannerLastWeeklyReset || defaultState.plannerLastWeeklyReset,
                    plannerLastMonthlyReset: firestoreState.plannerLastMonthlyReset || defaultState.plannerLastMonthlyReset,
                    plannerCustomerIds: firestoreState.plannerCustomerIds || defaultState.plannerCustomerIds,
                    plannerSupplierIds: firestoreState.plannerSupplierIds || defaultState.plannerSupplierIds,
                    plannerExpenseAccountIds: firestoreState.plannerExpenseAccountIds || defaultState.plannerExpenseAccountIds,
                };
                
                return processState(newState);
            }
            return state;
        }
        default: return state;
    }
};

type SaveStatus = 'synced' | 'saving' | 'error';

interface DataContextProps {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    userProfile: UserProfile | null;
    authLoading: boolean;
    saveStatus: SaveStatus;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

const FIRESTORE_DOC_PATH = 'appState/mainState-v11';

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialState);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isFirestoreLoaded, setIsFirestoreLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('synced');
    const isUpdatingFromFirestore = useRef(false);
    const firestoreUnsubscribe = useRef<(() => void) | null>(null);
    const isLocalChange = useRef(false);

    const wrappedDispatch: React.Dispatch<Action> = (action) => {
        isLocalChange.current = true;
        dispatch(action);
    };
    
    useEffect(() => {
        if (IS_DEV_MODE && db) {
            setUserProfile(mockAdminProfile);
            setAuthLoading(false);
            
            if (firestoreUnsubscribe.current) firestoreUnsubscribe.current();

            firestoreUnsubscribe.current = db.doc(FIRESTORE_DOC_PATH).onSnapshot(
                (doc: any) => {
                    if (isLocalChange.current) {
                        isLocalChange.current = false;
                        return;
                    }
                    if (doc.exists) {
                        isUpdatingFromFirestore.current = true;
                        
                        const firestoreData = doc.data();
                        if (firestoreData.divisions && Array.isArray(firestoreData.divisions)) {
                            const uniqueDivisions: Division[] = [];
                            const seenIds = new Set<string>();
                            let duplicatesFound = false;
                            for (const division of firestoreData.divisions) {
                                if (!seenIds.has(division.id)) {
                                    uniqueDivisions.push(division);
                                    seenIds.add(division.id);
                                } else {
                                    duplicatesFound = true;
                                }
                            }
                            if (duplicatesFound) {
                                firestoreData.divisions = uniqueDivisions;
                            }
                        }

                        dispatch({ type: 'RESTORE_STATE', payload: firestoreData });
                        setSaveStatus('synced');
                    } else {
                        db.doc(FIRESTORE_DOC_PATH).set(initialState);
                    }
                    setIsFirestoreLoaded(true);
                },
                (error: any) => {
                    console.error("Error listening to Firestore in Dev Mode:", error);
                    setIsFirestoreLoaded(true);
                }
            );
            return;
        }

        if (!auth || !db) {
            setAuthLoading(false);
            return;
        }

        const unsubscribeAuth = auth.onAuthStateChanged(async (user: any) => {
            if (user) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    let profile: UserProfile | null = null;

                    if (userDoc.exists) {
                        const profileData = userDoc.data() as Omit<UserProfile, 'uid' | 'email'>;
                        profile = {
                            uid: user.uid,
                            email: user.email,
                            name: profileData.name,
                            isAdmin: profileData.isAdmin,
                            permissions: profileData.permissions || [],
                        };
                    } else if (user.email === 'junaidmachiyara@gmail.com') {
                        const adminProfileData = { name: 'Junaid Machiyara', email: user.email, isAdmin: true, permissions: allPermissions };
                        await db.collection('users').doc(user.uid).set(adminProfileData);
                        profile = { uid: user.uid, ...adminProfileData };
                    }
                    
                    if (profile) {
                        setUserProfile(profile);

                        if (firestoreUnsubscribe.current) firestoreUnsubscribe.current();

                        firestoreUnsubscribe.current = db.doc(FIRESTORE_DOC_PATH).onSnapshot(
                            (doc: any) => {
                                 if (isLocalChange.current) {
                                    isLocalChange.current = false;
                                    return;
                                }
                                if (doc.exists) {
                                    isUpdatingFromFirestore.current = true;

                                    const firestoreData = doc.data();
                                    if (firestoreData.divisions && Array.isArray(firestoreData.divisions)) {
                                        const uniqueDivisions: Division[] = [];
                                        const seenIds = new Set<string>();
                                        let duplicatesFound = false;
                                        for (const division of firestoreData.divisions) {
                                            if (!seenIds.has(division.id)) {
                                                uniqueDivisions.push(division);
                                                seenIds.add(division.id);
                                            } else {
                                                duplicatesFound = true;
                                            }
                                        }
                                        if (duplicatesFound) {
                                            firestoreData.divisions = uniqueDivisions;
                                        }
                                    }

                                    dispatch({ type: 'RESTORE_STATE', payload: firestoreData });
                                    setSaveStatus('synced');
                                } else {
                                    db.doc(FIRESTORE_DOC_PATH).set(initialState);
                                }
                                setIsFirestoreLoaded(true);
                                setAuthLoading(false);
                            },
                            (error: any) => {
                                console.error("Error listening to Firestore:", error);
                                setIsFirestoreLoaded(true);
                                setAuthLoading(false);
                            }
                        );
                    } else {
                        auth.signOut();
                        setAuthLoading(false);
                    }
                } catch (error) {
                    console.error("Error with user profile:", error);
                    auth.signOut();
                    setAuthLoading(false);
                }
            } else {
                if (firestoreUnsubscribe.current) {
                    firestoreUnsubscribe.current();
                    firestoreUnsubscribe.current = null;
                }
                setUserProfile(null);
                setIsFirestoreLoaded(false); 
                setAuthLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (isUpdatingFromFirestore.current) {
            isUpdatingFromFirestore.current = false;
            return;
        }
        
        if (!isFirestoreLoaded || !userProfile || !db) {
            return;
        }
        
        const saveData = async () => {
            setSaveStatus('saving');
            try {
                const sanitizedState = convertUndefinedToNull(state);
                await db.doc(FIRESTORE_DOC_PATH).set(sanitizedState);
                setSaveStatus('synced');
            } catch (error) {
                console.error("Error writing to Firestore:", error);
                setSaveStatus('error');
            }
        };

        saveData();

    }, [state, userProfile, isFirestoreLoaded]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (saveStatus === 'saving') {
                e.preventDefault();
                e.returnValue = 'Changes you made may not be saved. Are you sure you want to leave?';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [saveStatus]);

    return (
        <DataContext.Provider value={{ state, dispatch: wrappedDispatch, userProfile, authLoading, saveStatus }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};