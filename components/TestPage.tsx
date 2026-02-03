import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { TestEntry } from '../types.ts';

// FIX: Added a Notification component to handle its own timeout via useEffect, preventing memory leaks.
const Notification: React.FC<{ message: string; onTimeout: () => void }> = ({ message, onTimeout }) => {
    useEffect(() => {
        const timer = setTimeout(onTimeout, 2000);
        return () => clearTimeout(timer);
    }, [onTimeout]);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-blue-500 text-white py-2 px-4 rounded-lg shadow-lg z-50">
            {message}
        </div>
    );
};

const TestPage: React.FC = () => {
    const { state, dispatch } = useData();
    const [text, setText] = useState('');
    const [notification, setNotification] = useState<string | null>(null);

    const showNotification = (message: string) => {
        setNotification(message);
    };

    const handleSave = () => {
        if (!text.trim()) {
            alert('Please enter some text.');
            return;
        }

        const newEntry: TestEntry = {
            id: `TEST-${state.nextTestEntryNumber}`,
            text: text.trim(),
        };

        try {
            dispatch({
                type: 'ADD_ENTITY',
                payload: {
                    entity: 'testEntries',
                    data: newEntry,
                },
            });
            showNotification(`Attempted to save: ${newEntry.id}`);
            setText('');
        } catch (error) {
            console.error("Dispatch error:", error);
            showNotification(`Error during dispatch: ${error}`);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
            <h1 className="text-3xl font-bold text-slate-800">Test Page</h1>
            <p className="text-slate-600">This is a minimal page to test the core save functionality. Enter text below and click save. The entry should appear in the list below and persist after a page refresh.</p>
            
            <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-slate-700">Serial Number</label>
                        <input
                            type="text"
                            readOnly
                            value={`TEST-${state.nextTestEntryNumber}`}
                            className="mt-1 w-full p-2 rounded-md bg-slate-200 text-slate-500"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Enter Text</label>
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Some test data..."
                            className="mt-1 w-full p-2 rounded-md"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <button
                            onClick={handleSave}
                            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-slate-700 mb-4">Saved Test Entries</h2>
                {state.testEntries.length > 0 ? (
                    <ul className="space-y-2">
                        {state.testEntries.map(entry => (
                            <li key={entry.id} className="flex justify-between items-center p-2 border rounded-md">
                                <span className="font-mono text-slate-500">{entry.id}</span>
                                <span className="text-slate-800">{entry.text}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-slate-500 py-4">No test entries saved yet.</p>
                )}
            </div>
        </div>
    );
};

export default TestPage;