import React, { useState, useEffect, useRef } from 'react';
import { FunctionDeclaration, Type, GenerateContentResponse, Content, Part } from "@google/genai";
import { Module, AppState, InvoiceStatus } from '../types.ts';
import { useData } from '../context/DataContext.tsx';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

interface ChatbotProps {
    onNavigate: (module: Module, subView?: string) => void;
}

// --- Gemini Function Declarations & System Instruction ---

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
                description: `Optional. The specific sub-view within the module. For dataEntry: 'opening', 'production', 'purchase', 'finishedGoodsPurchase', 'sales', 'ongoing', 'rebaling', 'directSales', 'offloading'. For setup: 'customers', 'suppliers', 'items', 'divisions', etc. For hr: 'payroll', 'tasks', 'enquiries', 'vehicles'. For accounting: 'new', 'update'. For reports: e.g., 'item-performance/summary', 'ledger/main'.`,
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

// --- End of Gemini Configuration ---


const AnimatedRobotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-10 w-10 text-white">
        <defs>
            <linearGradient id="robot-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a8b5f5" />
                <stop offset="100%" stopColor="#677ff2" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <g className="robot-head">
            {/* Antenna */}
            <line x1="12" y1="5" x2="12" y2="3" stroke="#9ca3af" strokeWidth="1" />
            <circle cx="12" cy="2" r="1.5" fill="#fde047" filter="url(#glow)" />
            
            {/* Head */}
            <path 
                d="M6,8 C4.8954305,8 4,8.8954305 4,10 L4,16 C4,17.1045695 4.8954305,18 6,18 L18,18 C19.1045695,18 20,17.1045695 20,16 L20,10 C20,8.8954305 19.1045695,8 18,8 L6,8 Z" 
                fill="url(#robot-gradient)" 
                stroke="#4355b2" 
                strokeWidth="1.5" 
            />
            {/* Ears */}
            <rect x="2.5" y="11" width="1.5" height="4" rx="0.75" fill="#a8b5f5" stroke="#4355b2" strokeWidth="1"/>
            <rect x="20" y="11" width="1.5" height="4" rx="0.75" fill="#a8b5f5" stroke="#4355b2" strokeWidth="1"/>
        </g>
        {/* Eyes */}
        <circle cx="9.5" cy="12" r="1.5" fill="white" className="robot-eye" />
        <circle cx="14.5" cy="12" r="1.5" fill="white" className="robot-eye" style={{ animationDelay: '0.1s' }} />
        <circle cx="9.5" cy="12" r="0.75" fill="#1e293b" className="robot-eye" />
        <circle cx="14.5" cy="12" r="0.75" fill="#1e293b" className="robot-eye" style={{ animationDelay: '0.1s' }}/>
        {/* Mouth */}
        <line x1="10" y1="15.5" x2="14" y2="15.5" stroke="#4355b2" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);


const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

async function callGeminiProxy(contents: Content[]): Promise<GenerateContentResponse> {
    const proxyResponse = await fetch('/.netlify/functions/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
    });

    if (!proxyResponse.ok) {
        const errorData = await proxyResponse.json();
        throw new Error(errorData.error || `Proxy request failed with status ${proxyResponse.status}`);
    }

    const data = await proxyResponse.json();
    return data as GenerateContentResponse;
}

const Chatbot: React.FC<ChatbotProps> = ({ onNavigate }) => {
    const { state } = useData();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', text: 'Hello! I can help you navigate or answer questions about your data. Try asking "What is the stock of Men\'s Blue Jeans?" or "Go to sales".' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const historyRef = useRef<Content[]>([]);
    const hasBeenOpened = useRef(false);

    useEffect(() => {
        if (isOpen && !hasBeenOpened.current) {
            hasBeenOpened.current = true; // Only run this check once
            
            const unpostedCount = state.salesInvoices.filter(inv => inv.status === InvoiceStatus.Unposted).length;

            if (unpostedCount > 0) {
                const proactiveMessage = `Hello! I see you have ${unpostedCount} unposted invoice${unpostedCount > 1 ? 's' : ''}. You can say "go to posting" to handle them. How else can I help?`;
                setMessages([{ role: 'model', text: proactiveMessage }]);
            }
        }
    }, [isOpen, state.salesInvoices]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation(); // Prevent App's global listener
                setIsOpen(false);
            }
        };

        // Use capture phase to intercept the event early
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [isOpen]);
    
    // --- Data Retrieval & Analysis Functions ---
    const getItemStock = ({ itemName, itemId }: { itemName?: string, itemId?: string }): { stock: number } | { error: string } => {
        let item;
        if (itemId) {
            item = state.items.find(i => i.id.toLowerCase() === itemId.toLowerCase());
        }
        if (!item && itemName) {
            item = state.items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
        }
    
        if (!item) {
            const identifier = itemId || itemName;
            return { error: `I couldn't find an item with the name or ID "${identifier}". Please check and try again.` };
        }
        
        const production = state.productions.filter(p => p.itemId === item.id).reduce((sum, p) => sum + p.quantityProduced, 0);
        const sales = state.salesInvoices.filter(inv => inv.status !== InvoiceStatus.Unposted).flatMap(inv => inv.items).filter(i => i.itemId === item.id).reduce((sum, i) => sum + i.quantity, 0);
        return { stock: production - sales };
    };
    
    const getEntityBalance = ({ entityName, entityType }: { entityName: string, entityType: 'customer' | 'supplier' }): { balance: number } | { error: string } => {
        let entity;
        let accountId;
        if (entityType === 'customer') {
            entity = state.customers.find(e => e.name.toLowerCase() === entityName.toLowerCase());
            accountId = state.receivableAccounts[0]?.id;
        } else {
            entity = state.suppliers.find(e => e.name.toLowerCase() === entityName.toLowerCase());
            accountId = state.payableAccounts[0]?.id;
        }

        if (!entity) return { error: `${entityType} "${entityName}" not found.` };
        if (!accountId) return { error: `Core ${entityType === 'customer' ? 'Receivable' : 'Payable'} account not configured.` };

        const balance = state.journalEntries
            .filter(je => je.account === accountId && je.entityId === entity!.id)
            .reduce((bal, je) => bal + (entityType === 'customer' ? (je.debit - je.credit) : (je.credit - je.debit)), 0);

        return { balance };
    };

    const getLastSalesInvoices = ({ count }: { count: number }) => {
        const invoices = [...state.salesInvoices]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, count)
            .map(inv => ({
                id: inv.id, date: inv.date,
                customer: state.customers.find(c => c.id === inv.customerId)?.name || 'N/A',
                totalItems: inv.items.length,
            }));
        return { invoices };
    };

    const summarizeProductionByDate = ({ date }: { date?: string }) => {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const productions = state.productions.filter(p => p.date === targetDate);

        if (productions.length === 0) {
            return { summary: `There was no production on ${targetDate}.` };
        }

        const summary = productions.reduce((acc, prod) => {
            const item = state.items.find(i => i.id === prod.itemId);
            if (item) {
                const kg = item.packingType === 'Bales' ? prod.quantityProduced * item.baleSize : prod.quantityProduced;
                acc.totalKg += kg;
                if (item.packingType === 'Bales') {
                    acc.totalBales += prod.quantityProduced;
                }
                acc.uniqueItemIds.add(item.id);
            }
            return acc;
        }, { totalKg: 0, totalBales: 0, uniqueItemIds: new Set<string>() });

        return {
            summary: `On ${targetDate}, there was a total production of ${summary.totalKg.toFixed(2)} kg across ${summary.uniqueItemIds.size} unique items, including ${summary.totalBales} bales.`
        };
    };

    const getCustomersByBalance = ({ threshold }: { threshold: number }) => {
        const receivableAccountId = state.receivableAccounts[0]?.id;
        if (!receivableAccountId) {
            return { error: "Receivable account not found." };
        }
        
        const customersOverThreshold = state.customers.map(customer => {
            const balance = state.journalEntries
                .filter(je => je.account === receivableAccountId && je.entityId === customer.id)
                .reduce((bal, je) => bal + je.debit - je.credit, 0);
            return { name: customer.name, balance };
        }).filter(c => c.balance > threshold);

        return { customers: customersOverThreshold };
    };

    const getUnpostedInvoiceCount = () => {
        const count = state.salesInvoices.filter(inv => inv.status === InvoiceStatus.Unposted).length;
        return { count };
    };

    // --- End of Data Retrieval & Analysis Functions ---

    const handleStop = () => {
        setIsLoading(false);
        const abortMessage: ChatMessage = { role: 'model', text: "I've stopped my current task. What would you like to do next?" };
        setMessages(prev => [...prev, abortMessage]);
    };

    const handleClearChat = () => {
        setMessages([
            { role: 'model', text: 'Chat history cleared. How can I help you now?' }
        ]);
        historyRef.current = [];
        setInput('');
        setIsLoading(false);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
    
        const userMessageText = input;
        const userMessage: ChatMessage = { role: 'user', text: userMessageText };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        
        historyRef.current.push({ role: 'user', parts: [{ text: userMessageText }] });
    
        try {
            const response = await callGeminiProxy(historyRef.current);
    
            // Manually parse the plain JSON response from the proxy
            const candidate = response.candidates?.[0];
            const content = candidate?.content;
            
            if (!content || !content.parts || content.parts.length === 0) {
                const blockReason = candidate?.finishReason;
                let errorMessage = "Sorry, I received an empty response. Can you try rephrasing?";
                if (blockReason === 'SAFETY') {
                    errorMessage = `My response was blocked for safety reasons.`;
                } else if (blockReason) {
                    errorMessage = `My response was blocked. Reason: ${blockReason}.`;
                }
                throw new Error(errorMessage);
            }
            
            historyRef.current.push(content);
            const firstPart = content.parts[0];
            const functionCall = firstPart.functionCall;
    
            if (functionCall) {
                let functionResult: any;
                switch (functionCall.name) {
                    case 'navigateTo':
                        const { module, subView } = functionCall.args;
                        const moduleName = (module as string).charAt(0).toUpperCase() + (module as string).slice(1);
                        let botMessageText = `Sure, navigating to the ${moduleName} screen.`;
                        if (subView) botMessageText = `Sure, navigating to ${subView} in ${moduleName}.`;
                        
                        setMessages(prev => [...prev, { role: 'model', text: botMessageText }]);
                        setTimeout(() => { onNavigate(module as Module, subView as string); setIsOpen(false); }, 1500);
                        setIsLoading(false); // End loading early for navigation
                        return;
    
                    case 'getItemStock':
                        functionResult = getItemStock(functionCall.args as { itemName?: string, itemId?: string });
                        break;
                    case 'getEntityBalance':
                        functionResult = getEntityBalance(functionCall.args as { entityName: string, entityType: 'customer' | 'supplier' });
                        break;
                    case 'getLastSalesInvoices':
                        functionResult = getLastSalesInvoices(functionCall.args as { count: number });
                        break;
                    case 'summarizeProductionByDate':
                        functionResult = summarizeProductionByDate(functionCall.args as { date?: string });
                        break;
                    case 'getCustomersByBalance':
                        functionResult = getCustomersByBalance(functionCall.args as { threshold: number });
                        break;
                    case 'getUnpostedInvoiceCount':
                        functionResult = getUnpostedInvoiceCount();
                        break;
                    default:
                        functionResult = { error: `Unknown function call: ${functionCall.name}` };
                }
                
                historyRef.current.push({
                    role: 'user',
                    parts: [{ functionResponse: { name: functionCall.name, response: functionResult } }]
                });
    
                const finalResponse = await callGeminiProxy(historyRef.current);
    
                const finalCandidate = finalResponse.candidates?.[0];
                const finalContent = finalCandidate?.content;
                const finalFirstPart = finalContent?.parts?.[0];
    
                if (!finalContent || !finalFirstPart?.text) {
                     throw new Error("I was able to call the function, but I couldn't generate a final summary.");
                }
    
                const finalBotMessageText = finalFirstPart.text;
                setMessages(prev => [...prev, { role: 'model', text: finalBotMessageText }]);
                historyRef.current.push(finalContent);
    
            } else {
                const botMessageText = firstPart.text;
                if (!botMessageText) {
                    throw new Error("I received a response, but it didn't contain any text. Please try again.");
                }
                setMessages(prev => [...prev, { role: 'model', text: botMessageText }]);
            }
    
        } catch (error: any) {
            console.error("Chatbot error:", error);
            const errorMessage: ChatMessage = { role: 'model', text: `Sorry, there was an error. ${error instanceof Error ? error.message : 'Please try again.'}` };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <>
            {/* Chat Window */}
            <div
                className={`fixed bottom-24 left-4 w-96 bg-white rounded-xl shadow-2xl transition-all duration-300 ease-in-out flex flex-col ${
                    isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none'
                }`}
                style={{ zIndex: 1000 }}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex justify-between items-center p-4 bg-blue-600 text-white rounded-t-xl">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <AnimatedRobotIcon />
                        StockBot Assistant
                    </h3>
                    <div className="flex items-center gap-2">
                        <button onClick={handleClearChat} className="hover:bg-blue-700 p-1 rounded-full" title="Clear Chat History">
                            <TrashIcon />
                        </button>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-blue-700 p-1 rounded-full" title="Close">
                            <CloseIcon />
                        </button>
                    </div>
                </div>
                
                {/* Messages */}
                <div className="flex-grow p-4 h-80 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg max-w-xs ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-800'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                     {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 text-slate-800 p-3 rounded-lg max-w-xs flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                                <button
                                    onClick={handleStop}
                                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold border border-slate-300 rounded-md px-2 py-1 bg-white hover:bg-slate-200"
                                    aria-label="Stop generating response"
                                >
                                    Stop
                                </button>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="flex-shrink-0 p-4 border-t border-slate-200">
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            placeholder="Ask a question..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="flex-grow p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                            disabled={isLoading}
                        />
                        <button 
                            type="submit" 
                            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed" 
                            disabled={isLoading || !input.trim()}
                            aria-label="Send message"
                        >
                            <SendIcon />
                        </button>
                    </div>
                </form>
            </div>

            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-4 left-4 h-16 w-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-in-out hover:scale-110 chatbot-fab ${
                    isOpen ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                }`}
                aria-label="Open Chatbot"
                style={{ zIndex: 1001 }}
            >
                <AnimatedRobotIcon />
            </button>
        </>
    );
};

export default Chatbot;