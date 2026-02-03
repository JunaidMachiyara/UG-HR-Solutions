import React, { useState, useEffect, useRef } from 'react';
import { useData, db } from '../context/DataContext.tsx';
import { UserProfile } from '../types.ts';

// Interface for chat message data structure in Firestore
interface ChatMessageData {
    id: string;
    text: string;
    timestamp: any; // Firestore ServerTimestamp
    senderId: string;
    senderName: string;
    readBy: string[];
}

// Interface for chat message state in the component
interface ChatMessage extends Omit<ChatMessageData, 'timestamp'> {
    timestamp: Date | null;
}

interface UserPresence {
    status: 'online' | 'offline';
    last_seen: any;
}

const ChatModule: React.FC = () => {
    const { userProfile } = useData();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());
    const [activeChat, setActiveChat] = useState<{ id: string; name: string; type: 'meeting' | 'user' }>({ id: 'meeting_room', name: 'Meeting Room', type: 'meeting' });
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Set up user presence (online/offline status)
    useEffect(() => {
        if (!userProfile || !db) return;

        const presenceRef = db.collection('userPresence').doc(userProfile.uid);
        const firestore = (window as any).firebase.firestore;

        presenceRef.set({
            status: 'online',
            last_seen: firestore.FieldValue.serverTimestamp(),
        });

        const handleBeforeUnload = () => {
             presenceRef.set({
                status: 'offline',
                last_seen: firestore.FieldValue.serverTimestamp(),
            });
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            presenceRef.set({
                status: 'offline',
                last_seen: firestore.FieldValue.serverTimestamp(),
            });
        };
    }, [userProfile]);

    // Fetch all users and listen for presence updates
    useEffect(() => {
        if (!db) return;
        
        const usersUnsubscribe = db.collection('users').onSnapshot((snapshot: any) => {
            const userList: UserProfile[] = [];
            snapshot.forEach((doc: any) => {
                userList.push({ ...doc.data(), uid: doc.id });
            });
            setUsers(userList.sort((a, b) => a.name.localeCompare(b.name)));
        });

        const presenceUnsubscribe = db.collection('userPresence').onSnapshot((snapshot: any) => {
            const presenceMap = new Map<string, UserPresence>();
            snapshot.forEach((doc: any) => {
                presenceMap.set(doc.id, doc.data());
            });
            setUserPresence(presenceMap);
        });

        return () => {
            usersUnsubscribe();
            presenceUnsubscribe();
        };
    }, []);

    // Listen for unread message counts in real-time
    useEffect(() => {
        if (!userProfile || !db || users.length === 0) return;

        // Listeners for individual user chats
        const userListeners = users
            .filter(u => u.uid !== userProfile.uid)
            .map(user => {
                const ids = [userProfile.uid, user.uid].sort();
                const chatId = ids.join('_');
                
                // Query for messages from the other user.
                const query = db.collection('chats').doc(chatId).collection('messages')
                    .where('senderId', '==', user.uid);
                
                return query.onSnapshot((snapshot: any) => {
                    // Filter client-side for unread messages.
                    const unreadCount = snapshot.docs.filter((doc: any) => !doc.data().readBy.includes(userProfile.uid)).length;

                    setUnreadCounts(prev => {
                        const newCounts = new Map(prev);
                        if (unreadCount > 0) {
                            newCounts.set(user.uid, unreadCount);
                        } else {
                            newCounts.delete(user.uid);
                        }
                        return newCounts;
                    });
                });
            });

        // Listener for the meeting room
        // Here we can't filter by senderId in the query, so we fetch all and filter.
        // This could be inefficient for a very active room. Limiting the query is a good idea.
        const meetingRoomQuery = db.collection('meetingRoomMessages').orderBy('timestamp', 'desc').limit(200);

        const meetingRoomListener = meetingRoomQuery.onSnapshot((snapshot: any) => {
            const unreadCount = snapshot.docs.filter((doc: any) => {
                const data = doc.data();
                return data.senderId !== userProfile.uid && !data.readBy.includes(userProfile.uid);
            }).length;
            
            setUnreadCounts(prev => {
                const newCounts = new Map(prev);
                if (unreadCount > 0) {
                    newCounts.set('meeting_room', unreadCount);
                } else {
                    newCounts.delete('meeting_room');
                }
                return newCounts;
            });
        });
        
        const allListeners = [...userListeners, meetingRoomListener];

        return () => {
            allListeners.forEach(unsubscribe => unsubscribe());
        };
    }, [users, userProfile]);

    // Fetch messages for the currently active chat
    useEffect(() => {
        if (!db || !activeChat.id) return;

        setIsLoading(true);
        let query;

        if (activeChat.type === 'meeting') {
            query = db.collection('meetingRoomMessages').orderBy('timestamp', 'asc').limitToLast(100);
        } else {
            query = db.collection('chats').doc(activeChat.id).collection('messages').orderBy('timestamp', 'asc').limitToLast(100);
        }

        const unsubscribe = query.onSnapshot(
            (querySnapshot: any) => {
                const fetchedMessages: ChatMessage[] = [];
                querySnapshot.forEach((doc: any) => {
                    const data = doc.data() as ChatMessageData;
                    fetchedMessages.push({
                        ...data,
                        id: doc.id,
                        timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
                    });
                });
                setMessages(fetchedMessages);
                setIsLoading(false);
            },
            (error: any) => {
                console.error("Error fetching messages: ", error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [activeChat.id]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSelectChat = (selectedUser: UserProfile | null) => {
        if (!userProfile || !db) return;

        let newActiveChat: { id: string; name: string; type: 'meeting' | 'user' };
        let collectionRef;
        let otherUserId: string | null = null;

        if (selectedUser === null) {
            newActiveChat = { id: 'meeting_room', name: 'Meeting Room', type: 'meeting' };
            collectionRef = db.collection('meetingRoomMessages');
        } else {
            if(selectedUser.uid === userProfile.uid) return;
            otherUserId = selectedUser.uid;
            const ids = [userProfile.uid, selectedUser.uid].sort();
            const chatId = ids.join('_');
            newActiveChat = { id: chatId, name: selectedUser.name, type: 'user' };
            collectionRef = db.collection('chats').doc(chatId).collection('messages');
        }
        
        setActiveChat(newActiveChat);
        setMessages([]);

        // Mark messages as read
        // Firestore does not support compound queries with 'not-array-contains' and '!=' on different fields.
        // So, we query for messages from others and filter/update client-side.
        collectionRef
            .where('senderId', '!=', userProfile.uid)
            .get()
            .then((querySnapshot: any) => {
                if (querySnapshot.empty) return;
                
                const batch = db.batch();
                let hasUnread = false;

                querySnapshot.forEach((doc: any) => {
                    const data = doc.data();
                    // Check if the current user is NOT in the readBy array
                    if (data.readBy && !data.readBy.includes(userProfile.uid)) {
                        batch.update(doc.ref, {
                            readBy: (window as any).firebase.firestore.FieldValue.arrayUnion(userProfile.uid)
                        });
                        hasUnread = true;
                    }
                });

                if (hasUnread) {
                    batch.commit().catch((error: any) => {
                        console.error("Error marking messages as read: ", error);
                    });
                }
            });
    };
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !userProfile || !db) return;

        const messageData: Omit<ChatMessageData, 'id'> = {
            text: newMessage.trim(),
            timestamp: (window as any).firebase.firestore.FieldValue.serverTimestamp(),
            senderId: userProfile.uid,
            senderName: userProfile.name,
            readBy: [userProfile.uid],
        };

        try {
            if (activeChat.type === 'meeting') {
                await db.collection('meetingRoomMessages').add(messageData);
            } else {
                const chatDocRef = db.collection('chats').doc(activeChat.id);
                await chatDocRef.set({ 
                    participants: activeChat.id.split('_'),
                    lastUpdated: (window as any).firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                await chatDocRef.collection('messages').add(messageData);
            }
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message: ", error);
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-lg shadow-md border overflow-hidden">
            {/* Left Panel: User List */}
            <aside className="w-80 border-r flex flex-col bg-slate-50">
                <div className="p-4 border-b font-semibold text-slate-700">Contacts</div>
                <ul className="overflow-y-auto flex-grow">
                    {/* Meeting Room */}
                    <li key="meeting-room">
                        <button
                            onClick={() => handleSelectChat(null)}
                            className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${activeChat.id === 'meeting_room' ? 'bg-blue-100' : 'hover:bg-slate-100'}`}
                        >
                            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">#</div>
                            <div className="flex-grow">
                                <p className="font-semibold text-slate-800">Meeting Room</p>
                                <p className="text-xs text-slate-500">General discussion group</p>
                            </div>
                             {unreadCounts.has('meeting_room') && (
                                <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                    {unreadCounts.get('meeting_room')}
                                </span>
                            )}
                        </button>
                    </li>
                    {/* User List */}
                    {users.filter(u => u.uid !== userProfile?.uid).map(user => {
                        const presence = userPresence.get(user.uid);
                        const isOnline = presence?.status === 'online';
                        const unreadCount = unreadCounts.get(user.uid);
                        return (
                            <li key={user.uid}>
                                <button
                                    onClick={() => handleSelectChat(user)}
                                    className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${activeChat.id.includes(user.uid) ? 'bg-blue-100' : 'hover:bg-slate-100'}`}
                                >
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        {isOnline && (
                                            <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
                                        )}
                                    </div>
                                    <p className="font-semibold text-slate-800 flex-grow">{user.name}</p>
                                    {unreadCount && (
                                        <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </aside>

            {/* Right Panel: Chat Window */}
            <div className="flex-grow flex flex-col">
                <header className="p-4 border-b bg-white flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${activeChat.type === 'meeting' ? 'bg-indigo-500' : 'bg-slate-500'}`}>
                        {activeChat.name.charAt(0).toUpperCase()}
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">{activeChat.name}</h1>
                </header>
                
                <main className="flex-grow p-4 overflow-y-auto space-y-4 bg-slate-100">
                    {isLoading && <p className="text-center text-slate-500">Loading messages...</p>}
                    {!isLoading && messages.length === 0 && (
                        <p className="text-center text-slate-500 pt-8">No messages yet. Start the conversation!</p>
                    )}
                    {messages.map(msg => {
                        const isOwnMessage = msg.senderId === userProfile?.uid;
                        return (
                            <div key={msg.id} className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                                {!isOwnMessage && (
                                    <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center font-bold text-slate-600 text-sm flex-shrink-0">
                                        {msg.senderName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className={`p-3 rounded-lg max-w-lg ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-white text-slate-800 shadow-sm'}`}>
                                    <p className="text-base break-words">{msg.text}</p>
                                    <p className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-200' : 'text-slate-400'} text-right`}>
                                        {formatDate(msg.timestamp)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </main>

                <footer className="p-4 border-t bg-white">
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={`Message ${activeChat.name}...`}
                            className="flex-grow p-3 rounded-lg"
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
                            aria-label="Send message"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
};

export default ChatModule;
