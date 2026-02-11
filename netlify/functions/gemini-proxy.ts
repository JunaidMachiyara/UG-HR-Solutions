
import { GoogleGenAI, FunctionDeclaration, Type, Content } from "@google/genai";

const navigateToFunctionDeclaration: FunctionDeclaration = {
    name: 'navigateTo',
    parameters: {
        type: Type.OBJECT,
        description: 'Navigates the user to a specific module or sub-view within the application.',
        properties: {
            module: {
                type: Type.STRING,
                description: `The main module. Must be one of: 'dashboard', 'setup', 'dataEntry', 'accounting', 'reports', 'posting', 'admin', 'logistics', 'hr'.`,
            },
            subView: {
                type: Type.STRING,
                description: `Optional. The specific sub-view within the module. For dataEntry: 'opening', 'production', 'purchase', 'finishedGoodsPurchase', 'sales', 'ongoing', 'rebaling', 'directSales', 'offloading'. For setup: 'customers', 'suppliers', 'items', 'divisions', etc. For hr: 'payroll', 'tasks', 'enquiries', 'vehicles', 'attendance'. For accounting: 'new', 'update'. For reports: e.g., 'item-performance/summary', 'ledger/main'.`,
            },
        },
        required: ['module'],
    },
};

const getItemStockFunctionDeclaration: FunctionDeclaration = {
    name: 'getItemStock',
    parameters: {
        type: Type.OBJECT,
        description: "Gets the current stock quantity for a specific item. Use `itemName` for full names like 'Men\\'s Blue Jeans' and `itemId` for codes like '1001'. You must provide at least one of these.",
        properties: {
            itemName: {
                type: Type.STRING,
                description: "The full name of the item. e.g., `Men's Blue Jeans`.",
            },
            itemId: {
                type: Type.STRING,
                description: "The ID or code of the item. e.g., `1001`.",
            },
        },
    },
};

const getEntityBalanceFunctionDeclaration: FunctionDeclaration = {
    name: 'getEntityBalance',
    parameters: {
        type: Type.OBJECT,
        description: 'Gets the current account balance for a customer, supplier, or other entity.',
        properties: {
            entityName: {
                type: Type.STRING,
                description: 'The name of the entity, e.g., "Global Textiles Inc." or "Charity Donations USA".',
            },
            entityType: {
                type: Type.STRING,
                description: "The type of entity. Must be one of: 'customer', 'supplier'.",
            },
        },
        required: ['entityName', 'entityType'],
    },
};

const getLastSalesInvoicesFunctionDeclaration: FunctionDeclaration = {
    name: 'getLastSalesInvoices',
    parameters: {
        type: Type.OBJECT,
        description: 'Retrieves the most recent sales invoices.',
        properties: {
            count: {
                type: Type.NUMBER,
                description: 'The number of recent invoices to retrieve.',
            },
        },
        required: ['count'],
    },
};

const summarizeProductionByDateFunctionDeclaration: FunctionDeclaration = {
    name: 'summarizeProductionByDate',
    parameters: {
        type: Type.OBJECT,
        description: "Summarizes production for a given date, including total kilograms, total bales, and the number of unique items produced. Defaults to today's date if none is provided.",
        properties: {
            date: {
                type: Type.STRING,
                description: "The date to summarize in 'YYYY-MM-DD' format. Optional.",
            },
        },
    },
};

const getCustomersByBalanceFunctionDeclaration: FunctionDeclaration = {
    name: 'getCustomersByBalance',
    parameters: {
        type: Type.OBJECT,
        description: 'Finds customers whose account balance is above a specified threshold.',
        properties: {
            threshold: {
                type: Type.NUMBER,
                description: 'The balance threshold to check against.',
            },
        },
        required: ['threshold'],
    },
};

const getUnpostedInvoiceCountFunctionDeclaration: FunctionDeclaration = {
    name: 'getUnpostedInvoiceCount',
    parameters: {
        type: Type.OBJECT,
        description: 'Gets the number of sales invoices that are currently unposted.',
        properties: {},
    },
};

const systemInstruction = `You are an intelligent assistant for an accounting and stock management application. Your primary roles are to help users navigate the app and answer questions about their data.

ROLE 1: NAVIGATION
If the user asks to go to a page, use the 'navigateTo' function.
- The main modules are 'dashboard', 'setup', 'dataEntry', 'accounting', 'reports', 'posting', 'admin', 'logistics', 'hr'.
- Infer the correct module and sub-view based on the user's request.
- Examples:
  - "Go to original opening" -> navigateTo(module: 'dataEntry', subView: 'opening')
  - "Show me the customers list" -> navigateTo(module: 'setup', subView: 'customers')
  - "I want to create a new voucher" -> navigateTo(module: 'accounting', subView: 'new')
  - "Open the HR tasks" -> navigateTo(module: 'hr', subView: 'tasks')
  - "Go to sales" -> navigateTo(module: 'dataEntry', subView: 'sales')
  - "Open expense planner" -> navigateTo(module: 'reports', subView: 'financial/expense-planner')
  - "Open payment planner" -> navigateTo(module: 'reports', subView: 'financial/payment-planner')

ROLE 2: DATA RETRIEVAL & Q&A
If the user asks a question about their data, use one of the available data retrieval functions.
- To check inventory: Use the 'getItemStock' function. You can use either the item's name OR its code/ID.
  - "What is the stock of Men's Blue Jeans?" -> getItemStock(itemName: "Men's Blue Jeans")
  - "How many Cotton T-Shirts do we have?" -> getItemStock(itemName: "Cotton T-Shirts (Mixed)")
  - "Stock detail of 1001" -> getItemStock(itemId: "1001")
  - "What's the inventory for item 2001?" -> getItemStock(itemId: "2001")
- To check financial balances: Use the 'getEntityBalance' function.
  - "How much does Global Textiles Inc. owe us?" -> getEntityBalance(entityName: "Global Textiles Inc.", entityType: "customer")
  - "What's our balance with Charity Donations USA?" -> getEntityBalance(entityName: "Charity Donations USA", entityType: "supplier")
- To retrieve recent sales: Use the 'getLastSalesInvoices' function.
  - "Show me the last 3 sales invoices." -> getLastSalesInvoices(count: 3)
  - "Can I see the 5 most recent sales?" -> getLastSalesInvoices(count: 5)

ROLE 3: ANALYSIS & SUMMARIZATION
If the user asks for summaries or analysis, use the appropriate function.
- To summarize production: Use 'summarizeProductionByDate'.
  - "Summarize today's production." -> summarizeProductionByDate()
  - "What was the production on 2024-07-23?" -> summarizeProductionByDate(date: "2024-07-23")
- To find customers by balance: Use 'getCustomersByBalance'.
  - "Are there any customers with a balance over $10,000?" -> getCustomersByBalance(threshold: 10000)
  - "Which customers owe us more than 5000 dollars?" -> getCustomersByBalance(threshold: 5000)
- To check for pending tasks: Use 'getUnpostedInvoiceCount'.
  - "How many unposted invoices are there?" -> getUnpostedInvoiceCount()
  - "Are there any invoices that need posting?" -> getUnpostedInvoiceCount()

IMPORTANT:
- First, decide if the user wants to navigate or ask a question. Then, call the appropriate function.
- Do not answer data questions from memory. Always use a function call to get live data.
- If the user's request is ambiguous, ask for clarification. Do not guess the function parameters.
- If you receive a function response with data, your only job is to summarize it back to the user in a clear, natural, and helpful sentence. Do not add any extra information not present in the function response.`;

const functionDeclarations = [
    navigateToFunctionDeclaration,
    getItemStockFunctionDeclaration,
    getEntityBalanceFunctionDeclaration,
    getLastSalesInvoicesFunctionDeclaration,
    summarizeProductionByDateFunctionDeclaration,
    getCustomersByBalanceFunctionDeclaration,
    getUnpostedInvoiceCountFunctionDeclaration,
];

interface RequestBody {
    contents: Content[];
}

export async function handler(event: { httpMethod: string; body: string | null }) {
    if (event.httpMethod !== 'POST' || !event.body) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { contents } = JSON.parse(event.body) as RequestBody;

        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set.");
        }

        // Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY}); as per guidelines.
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

        // Use 'gemini-3-pro-preview' for complex reasoning tasks.
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents,
            config: {
                systemInstruction,
                tools: [{ functionDeclarations }],
            },
        });
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
        };

    } catch (error) {
        console.error('Error in gemini-proxy:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred.' }),
        };
    }
}
