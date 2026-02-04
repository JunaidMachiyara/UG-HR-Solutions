import React, { useState, useRef, useEffect, useMemo } from 'react';
import SetupModule, { HRModule } from './components/SetupModule.tsx';
import { useData, auth, db, allPermissions, mainModules } from './context/DataContext.tsx';
import { Module, UserProfile, OriginalOpening, Production } from './types.ts';
import Modal from './components/ui/Modal.tsx';
import TestPage from './components/TestPage.tsx';
import ChatModule from './components/ChatModule.tsx';
// Standardized import path and casing
// Fix: Standardized import casing to 'Chatbot.tsx' to resolve conflict with already included file name.
import Chatbot from './components/Chatbot.tsx';

// --- START: Unread Message Hooks ---
function useUnreadMessages(userProfile: UserProfile | null = null) {
    const [unreadSenderNames, setUnreadSenderNames] = useState<string[]>([]);

    useEffect(() => {
        if (!userProfile || !db) {
            setUnreadSenderNames([]);
            return;
        }

        const checkForUnread = async () => {
            if (!userProfile) return;
            const allUnreadSenders = new Map<string, string>();

            const chatsQuery = db.collection('chats').where('participants', 'array-contains', userProfile.uid);
            const chatsSnapshot = await chatsQuery.get();

            const messageChecks = chatsSnapshot.docs.map(async (chatDoc: any) => {
                const chatData = chatDoc.data();
                const otherParticipantId = chatData.participants.find((p: string) => p !== userProfile.uid);
                
                if (!otherParticipantId) return;

                const messagesSnapshot = await chatDoc.ref.collection('messages')
                    .where('senderId', '==', otherParticipantId)
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();
                
                if (!messagesSnapshot.empty) {
                    const lastMessage = messagesSnapshot.docs[0].data();
                    if (lastMessage && lastMessage.readBy && !lastMessage.readBy.includes(userProfile.uid)) {
                        if (!allUnreadSenders.has(lastMessage.senderId)) {
                            allUnreadSenders.set(lastMessage.senderId, lastMessage.senderName);
                        }
                    }
                }
            });

            const meetingRoomQuery = db.collection('meetingRoomMessages')
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            messageChecks.push(meetingRoomQuery.then((snapshot: any) => {
                if (!snapshot.empty) {
                    const lastMessage = snapshot.docs[0].data();
                    if (lastMessage && lastMessage.readBy && lastMessage.senderId !== userProfile.uid && !lastMessage.readBy.includes(userProfile.uid)) {
                        allUnreadSenders.set('meeting_room', 'Meeting Room');
                    }
                }
            }));
            
            await Promise.all(messageChecks);
            setUnreadSenderNames(Array.from(allUnreadSenders.values()));
        };

        checkForUnread();
    }, [userProfile]);

    return unreadSenderNames;
}

function useUnreadMessageCount(userProfile: UserProfile | null = null) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [users, setUsers] = useState<UserProfile[]>([]);

    useEffect(() => {
        if (!db || !userProfile) return;
        const unsub = db.collection('users').onSnapshot((snapshot: any) => {
            const userList: UserProfile[] = [];
            snapshot.forEach((doc: any) => {
                if (doc.id !== userProfile.uid) {
                    userList.push({ ...doc.data(), uid: doc.id });
                }
            });
            setUsers(userList);
        });
        return () => unsub();
    }, [userProfile]);

    useEffect(() => {
        if (!userProfile || users.length === 0) {
            setUnreadCount(0);
            return;
        }

        const unreadSources = new Set<string>();
        const updateCount = () => setUnreadCount(unreadSources.size);

        const userListeners = users.map(user => {
            const ids = [userProfile.uid, user.uid].sort();
            const chatId = ids.join('_');
            
            const query = db.collection('chats').doc(chatId).collection('messages')
                .where('senderId', '==', user.uid);
            
            return query.onSnapshot((snapshot: any) => {
                const hasUnread = snapshot.docs.some((doc: any) => 
                    !doc.data().readBy.includes(userProfile.uid)
                );

                if (hasUnread) {
                    unreadSources.add(user.uid);
                } else {
                    unreadSources.delete(user.uid);
                }
                updateCount();
            });
        });

        const meetingRoomQuery = db.collection('meetingRoomMessages').orderBy('timestamp', 'desc').limit(50);

        const meetingRoomListener = meetingRoomQuery.onSnapshot((snapshot: any) => {
            const hasUnreadFromOthers = snapshot.docs.some((doc: any) => {
                const data = doc.data();
                return data.senderId !== userProfile.uid && !data.readBy.includes(userProfile.uid);
            });
            
            if (hasUnreadFromOthers) {
                unreadSources.add('meeting_room');
            } else {
                unreadSources.delete('meeting_room');
            }
            updateCount();
        });
        
        const allListeners = [...userListeners, meetingRoomListener];

        return () => {
            allListeners.forEach(unsubscribe => unsubscribe());
        };
    }, [users, userProfile]);

    return unreadCount;
}
// --- END: Unread Message Hooks ---


const Notification: React.FC<{ message: string; type: 'success' | 'error'; onDismiss: () => void }> = ({ message, type, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    return (<div className={`fixed top-5 left-1/2 -translate-x-1/2 ${bgColor} text-white py-3 px-5 rounded-lg shadow-lg z-50 flex items-center`}><span>{message}</span><button onClick={onDismiss} className="ml-4 font-bold text-white/70 hover:text-white">✕</button></div>);
};

const LoginScreen: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
            setEmail('junaidmachiyara@gmail.com');
            setPassword('123456');
        }
    }, []);

    const performLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            if (!auth) {
                throw new Error("Authentication services are unavailable.");
            }
            await auth.signInWithEmailAndPassword(email, password);
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to login. Please check your credentials.';
            setError(errorMessage);
            setNotification({ msg: errorMessage, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await performLogin();
    };
    
    const handleFastLogin = async () => {
        await performLogin();
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center login-screen p-4">
            <div className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 space-y-6">
                <div className="text-center">
                    <img src="https://uxwing.com/wp-content/themes/uxwing/download/location-travel-map/globe-icon.png" alt="Usman Global Logo" className="h-20 w-20 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-slate-800">Usman Global Maaz Division</h1>
                    <p className="text-slate-600 mt-2">HR & Setup Management System</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 w-full p-3 rounded-lg"/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 w-full p-3 rounded-lg"/></div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" disabled={isLoading} className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-400 transition-colors">{isLoading ? 'Signing In...' : 'Sign In'}</button>
                     <div className="text-center">
                        <button
                            type="button"
                            onClick={handleFastLogin}
                            disabled={isLoading}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Fast Login (Dev)
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [activeModule, setActiveModule] = useState<Module>('setup');
    const [activeSubView, setActiveSubView] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const { userProfile, authLoading, saveStatus } = useData();
    const [unreadNotification, setUnreadNotification] = useState<string | null>(null);
    const unreadSenderNames = useUnreadMessages(userProfile);
    const unreadMessageCount = useUnreadMessageCount(userProfile);


    const [isNewItemModalOpen, setIsNewItemModalOpen] = useState<boolean>(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [navigationHistory, setNavigationHistory] = useState<Array<{ module: Module; subView: string | null }>>([]);
    const prevModuleRef = useRef<Module>(activeModule);
    const prevSubViewRef = useRef<string | null>(activeSubView);
    const isNavigatingBackRef = useRef(false);
    const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);
    const escapeConfirmTimeoutRef = useRef<number | null>(null);

     useEffect(() => {
        if (unreadSenderNames.length > 0) {
            const names = unreadSenderNames.join(', ');
            setUnreadNotification(`You have unread messages from ${names}.`);
        } else {
            setUnreadNotification(null);
        }
    }, [unreadSenderNames]);

    useEffect(() => {
        if (isNavigatingBackRef.current) {
            isNavigatingBackRef.current = false;
        } else if (prevModuleRef.current) {
            const prevState = { module: prevModuleRef.current, subView: prevSubViewRef.current };
            setNavigationHistory(prev => [...prev, prevState]);
        }
        prevModuleRef.current = activeModule;
        prevSubViewRef.current = activeSubView;
    }, [activeModule, activeSubView]);


    const handleNavigation = (module: Module, subView?: string) => {
        if (activeModule !== module) {
            setActiveModule(module);
        }
        setActiveSubView(subView || null);
        setIsMobileMenuOpen(false);
    };
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                return;
            }

            const functionKeyMap: { [key: string]: Module } = {
                'F3': 'setup',
                'F9': 'hr',
                'F12': 'chat'
            };

            if (functionKeyMap[event.key]) {
                event.preventDefault();
                handleNavigation(functionKeyMap[event.key]);
                return;
            }
            
            if (event.key === 'Escape') {
                if (event.defaultPrevented) { return; }

                if (showEscapeConfirm) {
                    if (navigationHistory.length > 0) {
                        event.preventDefault();
                        const newHistory = [...navigationHistory];
                        const lastState = newHistory.pop();
                        
                        if (lastState) {
                            isNavigatingBackRef.current = true;
                            setNavigationHistory(newHistory);
                            setActiveModule(lastState.module);
                            setActiveSubView(lastState.subView);
                        }
                    }
                    setShowEscapeConfirm(false);
                    if (escapeConfirmTimeoutRef.current !== null) {
                        clearTimeout(escapeConfirmTimeoutRef.current);
                    }
                    return;
                }
    
                if (navigationHistory.length > 0) {
                    event.preventDefault();
                    setShowEscapeConfirm(true);
                    if (escapeConfirmTimeoutRef.current !== null) {
                        clearTimeout(escapeConfirmTimeoutRef.current);
                    }
                    escapeConfirmTimeoutRef.current = window.setTimeout(() => {
                        setShowEscapeConfirm(false);
                    }, 3000);
                }
                return; 
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (escapeConfirmTimeoutRef.current !== null) {
                clearTimeout(escapeConfirmTimeoutRef.current);
            }
        };
    }, [navigationHistory, showEscapeConfirm]);

    const handleNewItemSaved = () => {
        setNotification({ msg: "Item created successfully!", type: 'success' });
        setIsNewItemModalOpen(false);
    };
    
    useEffect(() => {
        if (userProfile && !userProfile.isAdmin && !userProfile.permissions.includes(activeModule)) {
            const firstPermission = userProfile.permissions[0] || 'setup';
            const firstModule = firstPermission.split('/')[0] as Module;
            if (mainModules.includes(firstModule)) {
                handleNavigation(firstModule);
            } else {
                handleNavigation('setup');
            }
        }
    }, [activeModule, userProfile]);
    
    const handleLogout = async () => {
        if (auth) {
            try {
                await (auth as any).signOut();
            } catch (error) {
                console.error("Error signing out: ", error);
            }
        }
    };
    
    const hasAccess = (module: Module): boolean => {
        if (!userProfile) return false;
        if (userProfile.isAdmin) return true;
        if (userProfile.permissions.includes(module)) return true;
        return false;
    }


    const renderModule = () => {
        if(!userProfile || !hasAccess(activeModule)) {
             return null;
        }

        switch (activeModule) {
            case 'setup': return <SetupModule setModule={(m) => handleNavigation(m)} userProfile={userProfile} initialSection={activeSubView} />;
            case 'hr': return <HRModule userProfile={userProfile} initialView={activeSubView} />;
            case 'chat': return <ChatModule />;
            case 'test': return <TestPage />;
            default: return <SetupModule setModule={(m) => handleNavigation(m)} userProfile={userProfile} initialSection={activeSubView} />;
        }
    };

    const NavButton: React.FC<{ module: Module; label: string; shortcut: string; unreadCount?: number }> = ({ module, label, shortcut, unreadCount = 0 }) => {
        if (!hasAccess(module)) return null;
        return (
            <button
                onClick={() => handleNavigation(module)}
                className={`relative px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeModule === module ? 'bg-white text-blue-600 shadow' : 'text-white hover:bg-blue-700'}`}
                title={`Shortcut: ${shortcut}`}
            >
                {label}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                )}
            </button>
        );
    };

    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center"><p>Loading Application...</p></div>;
    }
    
    if (!userProfile) {
        return <LoginScreen setNotification={setNotification} />;
    }

    return (
        <div className="min-h-screen bg-slate-100 no-print">
            {notification && <Notification message={notification.msg} type={notification.type} onDismiss={() => setNotification(null)} />}
            {unreadNotification && (
                <div className="fixed top-20 right-5 bg-blue-600 text-white py-3 px-5 rounded-lg shadow-lg z-50 flex items-center gap-4 animate-fade-in-out-short">
                    <span>{unreadNotification}</span>
                    <button
                        onClick={() => { handleNavigation('chat'); setUnreadNotification(null); }}
                        className="font-bold bg-white/20 hover:bg-white/40 px-3 py-1 rounded"
                    >
                        View
                    </button>
                    <button onClick={() => setUnreadNotification(null)} className="font-bold text-white/70 hover:text-white">✕</button>
                </div>
            )}
            <header className="bg-blue-600 text-white shadow-md sticky top-0 z-40 no-print">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <button 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="lg:hidden text-white focus:outline-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <img src="https://uxwing.com/wp-content/themes/uxwing/download/location-travel-map/globe-icon.png" alt="Usman Global Logo" className="h-10 w-10" />
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate max-w-[200px] md:max-w-none">Usman Global HR</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <nav className="hidden lg:flex space-x-1 bg-blue-800 p-1 rounded-lg overflow-x-auto">
                            <NavButton module="setup" label="Setup" shortcut="F3" />
                            <NavButton module="hr" label="HR" shortcut="F9" />
                            <NavButton module="chat" label="Chat" shortcut="F12" unreadCount={unreadMessageCount} />
                        </nav>
                        <div className="flex items-center space-x-3 border-l border-blue-500 pl-4">
                            <div className="w-36 text-right hidden md:block">
                                {saveStatus === 'saving' && <span className="text-xs text-yellow-300 animate-pulse flex items-center justify-end">Saving...</span>}
                                {saveStatus === 'synced' && (
                                    <span className="text-xs text-green-300 flex items-center justify-end">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Saved
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setIsHelpModalOpen(true)} title="Shortcuts" className="p-2 text-white hover:bg-blue-700 rounded-full hidden md:block">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1 1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </button>
                            <div className="text-right hidden md:block">
                                <p className="font-semibold text-sm">{userProfile?.name}</p>
                                <p className="text-xs text-blue-200 capitalize">{userProfile?.isAdmin ? 'Admin' : 'User'}</p>
                            </div>
                            <button onClick={handleLogout} title="Logout" className="px-3 py-2 text-white bg-red-500 hover:bg-red-600 rounded-md text-sm font-semibold">Logout</button>
                        </div>
                    </div>
                </div>

                {isMobileMenuOpen && (
                    <div className="lg:hidden absolute top-full left-0 w-full bg-blue-700 shadow-lg z-50 border-t border-blue-500">
                        <div className="flex flex-col p-4 space-y-2">
                            <NavButton module="setup" label="Setup" shortcut="F3" />
                            <NavButton module="hr" label="HR" shortcut="F9" />
                            <NavButton module="chat" label="Chat" shortcut="F12" unreadCount={unreadMessageCount} />
                        </div>
                    </div>
                )}
            </header>
            <main className="container mx-auto p-2 md:p-8">
                {renderModule()}
            </main>
            {isNewItemModalOpen && (
                <SetupModule
                    isModalMode={true}
                    modalTarget="items"
                    onModalClose={() => setIsNewItemModalOpen(false)}
                    onModalSave={handleNewItemSaved}
                    userProfile={userProfile}
                />
            )}
            <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Keyboard Shortcuts" size="2xl">
                <div className="space-y-6 text-slate-700">
                    <div>
                        <h3 className="text-lg font-semibold mb-2 text-slate-800">Main Navigation</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F3</kbd> &rarr; Setup</p>
                             <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F9</kbd> &rarr; HR</p>
                             <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F12</kbd> &rarr; Chat</p>
                        </div>
                    </div>
                </div>
            </Modal>
            {showEscapeConfirm && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out-short font-semibold">
                    Press Escape again to go back
                </div>
            )}
            <Chatbot onNavigate={handleNavigation} />
        </div>
    );
};

export default App;