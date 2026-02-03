import React, { useState, useEffect, useMemo } from 'react';
import { useData, db, auth, allPermissions } from '../context/DataContext.tsx';
import { 
    UserProfile, Module, Employee, AttendanceStatus, 
    HRTask, HREnquiry, Vehicle, VehicleStatus 
} from '../types.ts';
import { generateEmployeeId, generateVehicleId } from '../utils/idGenerator.ts';
import Modal from './ui/Modal.tsx';
import AttendanceRegister from './AttendanceRegister.tsx';
import SalaryCalculator from './SalaryCalculator.tsx';

// --- Shared Notification Component ---
const Notification: React.FC<{ message: string; onTimeout: () => void }> = ({ message, onTimeout }) => {
    useEffect(() => {
        const timer = setTimeout(onTimeout, 3000);
        return () => clearTimeout(timer);
    }, [onTimeout]);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out">
            {message}
        </div>
    );
};

// --- START USER MANAGEMENT (FOR SETUP) ---
const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<UserProfile> & { password?: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!db) return;
        const unsubscribe = db.collection('users').onSnapshot((snapshot: any) => {
            const userList: UserProfile[] = [];
            snapshot.forEach((doc: any) => {
                userList.push({ ...doc.data(), uid: doc.id });
            });
            setUsers(userList.sort((a, b) => a.name.localeCompare(b.name)));
        });
        return () => unsubscribe();
    }, []);

    const handleOpenModal = (user: UserProfile | null = null) => {
        setError(null);
        if (user) {
            setEditingUser({ ...user });
        } else {
            setEditingUser({ name: '', email: '', password: '', isAdmin: false, permissions: [] });
        }
        setIsModalOpen(true);
    };

    const handlePermissionToggle = (permission: string) => {
        if (!editingUser) return;
        const currentPermissions = editingUser.permissions || [];
        const newPermissions = currentPermissions.includes(permission)
            ? currentPermissions.filter(p => p !== permission)
            : [...currentPermissions, permission];
        setEditingUser({ ...editingUser, permissions: newPermissions });
    };

    const handleSaveUser = async () => {
        if (!editingUser?.name || !editingUser?.email) {
            setError("Name and Email are required.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            if (editingUser.uid) {
                await db.collection('users').doc(editingUser.uid).update({
                    name: editingUser.name,
                    isAdmin: editingUser.isAdmin,
                    permissions: editingUser.isAdmin ? allPermissions : editingUser.permissions,
                });
            } else {
                if (!editingUser.password || editingUser.password.length < 6) {
                    throw new Error("Password must be at least 6 characters.");
                }
                const userCredential = await auth.createUserWithEmailAndPassword(editingUser.email, editingUser.password);
                const newUser = userCredential.user;
                if (newUser) {
                    await db.collection('users').doc(newUser.uid).set({
                        name: editingUser.name,
                        email: editingUser.email,
                        isAdmin: editingUser.isAdmin,
                        permissions: editingUser.isAdmin ? allPermissions : editingUser.permissions,
                    });
                }
            }
            setIsModalOpen(false);
            setEditingUser(null);
        } catch (err: any) {
            setError(err.message || "Failed to save user.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">App Users</h3>
                    <p className="text-sm text-slate-500">Manage who can access the system and their permissions.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    Create New User
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left table-auto">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 font-semibold text-slate-600">User Name</th>
                            <th className="p-4 font-semibold text-slate-600">Email Address</th>
                            <th className="p-4 font-semibold text-slate-600">Role</th>
                            <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => (
                            <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-slate-800 font-medium">{user.name}</td>
                                <td className="p-4 text-slate-600 font-mono text-sm">{user.email}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {user.isAdmin ? 'ADMIN' : 'USER'}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => handleOpenModal(user)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingUser && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser.uid ? `Edit User: ${editingUser.name}` : "Create New User"} size="3xl">
                    <div className="space-y-6">
                        {error && <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input type="text" value={editingUser.name || ''} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full p-2 border rounded-md" />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <input type="email" value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full p-2 border rounded-md disabled:bg-slate-100" disabled={!!editingUser.uid} />
                            </div>
                            {!editingUser.uid && (
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                    <input type="password" value={editingUser.password || ''} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} className="w-full p-2 border rounded-md" />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-md border border-slate-200">
                            <input type="checkbox" id="isAdmin" checked={editingUser.isAdmin || false} onChange={e => setEditingUser({ ...editingUser, isAdmin: e.target.checked })} className="h-4 w-4 text-blue-600 rounded" />
                            <label htmlFor="isAdmin" className="text-sm font-bold text-slate-700">Grant Administrative Privileges</label>
                        </div>
                        {!editingUser.isAdmin && (
                            <div className="space-y-3">
                                <h4 className="font-semibold text-slate-700 border-b pb-1">Module Permissions</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 max-h-60 overflow-y-auto">
                                    {allPermissions.map(p => (
                                        <label key={p} className="flex items-center gap-2 text-sm text-slate-600">
                                            <input type="checkbox" checked={editingUser.permissions?.includes(p)} onChange={() => handlePermissionToggle(p)} className="h-3 w-3" />
                                            <span>{p}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                            <button onClick={handleSaveUser} className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold disabled:bg-blue-300" disabled={isLoading}>{isLoading ? "Saving..." : (editingUser.uid ? "Update" : "Create")}</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- MAIN SETUP MODULE ---
// FIX: Added missing SetupModuleProps interface to resolve compilation error.
interface SetupModuleProps {
    initialSection?: string | null;
    setModule?: (module: Module) => void;
    userProfile?: UserProfile | null;
    isModalMode?: boolean;
    modalTarget?: string;
    onModalClose?: () => void;
    onModalSave?: () => void;
}

const SetupModule: React.FC<SetupModuleProps> = ({ initialSection }) => {
    const [activeSection, setActiveSection] = useState<'users' | 'placeholder'>(initialSection === 'users' ? 'users' : 'users');

    return (
        <div className="flex flex-col md:flex-row gap-6">
            <aside className="w-full md:w-64 flex-shrink-0">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Setup Modules</h2>
                    </div>
                    <nav className="p-2 space-y-1">
                        <button
                            onClick={() => setActiveSection('users')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 ${
                                activeSection === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            User Management
                        </button>
                        {/* More setup modules can be added here by the user later */}
                    </nav>
                </div>
            </aside>
            <main className="flex-grow bg-white rounded-lg shadow-sm border border-slate-200 p-6 min-h-[600px]">
                {activeSection === 'users' ? <UserManagement /> : <div className="text-center py-20 text-slate-400">Ready to build your custom setup.</div>}
            </main>
        </div>
    );
};

// --- START RESTORED HR MODULE COMPONENTS ---

const EmployeeManagement: React.FC = () => {
    const { state, dispatch } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);

    const handleOpenModal = (emp: Employee | null = null) => {
        setEditingEmployee(emp ? { ...emp } : { status: 'Active', onDuty: true, biennialLeaveStatus: 'Pending', basicSalary: 0 });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!editingEmployee?.fullName) return;
        if (editingEmployee.id) {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'employees', data: editingEmployee as Employee } });
        } else {
            const newEmp = { ...editingEmployee, id: generateEmployeeId(state.employees) } as Employee;
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'employees', data: newEmp } });
        }
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Employee Register</h3>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold">Add Employee</button>
            </div>
            <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="w-full text-left table-auto">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-3">ID</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Designation</th>
                            <th className="p-3">Salary</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.employees.map(emp => (
                            <tr key={emp.id} className="border-t">
                                <td className="p-3 text-slate-600 font-mono text-xs">{emp.id}</td>
                                <td className="p-3 font-medium">{emp.fullName}</td>
                                <td className="p-3 text-slate-600">{emp.designation}</td>
                                <td className="p-3 text-slate-800">${emp.basicSalary}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span>
                                </td>
                                <td className="p-3 text-right">
                                    <button onClick={() => handleOpenModal(emp)} className="text-blue-600 hover:underline">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingEmployee && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmployee.id ? "Edit Employee" : "Add Employee"} size="4xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-slate-700">Full Name</label><input type="text" value={editingEmployee.fullName || ''} onChange={e => setEditingEmployee({ ...editingEmployee, fullName: e.target.value })} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium text-slate-700">Designation</label><input type="text" value={editingEmployee.designation || ''} onChange={e => setEditingEmployee({ ...editingEmployee, designation: e.target.value })} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium text-slate-700">Basic Salary</label><input type="number" value={editingEmployee.basicSalary || ''} onChange={e => setEditingEmployee({ ...editingEmployee, basicSalary: Number(e.target.value) })} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium text-slate-700">Status</label><select value={editingEmployee.status} onChange={e => setEditingEmployee({ ...editingEmployee, status: e.target.value as any })} className="w-full p-2 border rounded-md"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
                    </div>
                    <div className="flex justify-end gap-2 pt-6">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-md font-bold">Save Employee</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const TasksManagement: React.FC = () => {
    const { state, dispatch } = useData();
    const [description, setDescription] = useState('');

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;
        const newTask: HRTask = {
            id: `TASK-${Date.now()}`,
            description,
            isDone: false,
            comments: '',
            creationDate: new Date().toISOString().split('T')[0],
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'hrTasks', data: newTask } });
        setDescription('');
    };

    const toggleDone = (task: HRTask) => {
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'hrTasks', data: { ...task, isDone: !task.isDone, completionDate: !task.isDone ? new Date().toISOString().split('T')[0] : undefined } } });
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800">HR Task Tracker</h3>
            <form onSubmit={handleAddTask} className="flex gap-2">
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter new task..." className="flex-grow p-2 border rounded-md" />
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md font-bold">Add Task</button>
            </form>
            <div className="space-y-3">
                {state.hrTasks.map(task => (
                    <div key={task.id} className="p-4 bg-slate-50 border rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <input type="checkbox" checked={task.isDone} onChange={() => toggleDone(task)} className="h-5 w-5 rounded text-indigo-600" />
                            <div>
                                <p className={`font-medium ${task.isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.description}</p>
                                <p className="text-xs text-slate-500">Created: {task.creationDate}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const EnquiryManagement: React.FC = () => {
    const { state, dispatch } = useData();
    const [description, setDescription] = useState('');

    const handleAddEnquiry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;
        const newEnq: HREnquiry = {
            id: `ENQ-${Date.now()}`,
            description,
            isApproved: false,
            comments: '',
            creationDate: new Date().toISOString().split('T')[0],
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'hrEnquiries', data: newEnq } });
        setDescription('');
    };

    const toggleApprove = (enq: HREnquiry) => {
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'hrEnquiries', data: { ...enq, isApproved: !enq.isApproved, approvalDate: !enq.isApproved ? new Date().toISOString().split('T')[0] : undefined } } });
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800">Enquiries & Requests</h3>
            <form onSubmit={handleAddEnquiry} className="flex gap-2">
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter new enquiry..." className="flex-grow p-2 border rounded-md" />
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md font-bold">Submit Enquiry</button>
            </form>
            <div className="space-y-3">
                {state.hrEnquiries.map(enq => (
                    <div key={enq.id} className="p-4 bg-slate-50 border rounded-lg flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">{enq.description}</p>
                            <p className="text-xs text-slate-500">Created: {enq.creationDate}</p>
                        </div>
                        <button 
                            onClick={() => toggleApprove(enq)}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold ${enq.isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                        >
                            {enq.isApproved ? 'Approved' : 'Pending Approval'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const VehicleManagement: React.FC = () => {
    const { state, dispatch } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);

    const handleOpenModal = (veh: Vehicle | null = null) => {
        setEditingVehicle(veh ? { ...veh } : { status: VehicleStatus.Active });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!editingVehicle?.plateNumber) return;
        if (editingVehicle.id) {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'vehicles', data: editingVehicle as Vehicle } });
        } else {
            const newVeh = { ...editingVehicle, id: generateVehicleId(state.vehicles) } as Vehicle;
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'vehicles', data: newVeh } });
        }
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Vehicle Fleet</h3>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold">Add Vehicle</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.vehicles.map(v => (
                    <div key={v.id} className="bg-white border rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-slate-100 text-slate-800 font-mono text-lg font-bold px-2 py-1 rounded">{v.plateNumber}</span>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${v.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.status}</span>
                        </div>
                        <p className="text-slate-600 font-medium">{v.model}</p>
                        <button onClick={() => handleOpenModal(v)} className="w-full mt-4 py-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition-colors text-sm font-semibold">Edit Details</button>
                    </div>
                ))}
            </div>

            {isModalOpen && editingVehicle && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingVehicle.id ? "Edit Vehicle" : "Add Vehicle"}>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-slate-700">Plate Number</label><input type="text" value={editingVehicle.plateNumber || ''} onChange={e => setEditingVehicle({ ...editingVehicle, plateNumber: e.target.value })} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium text-slate-700">Model</label><input type="text" value={editingVehicle.model || ''} onChange={e => setEditingVehicle({ ...editingVehicle, model: e.target.value })} className="w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium text-slate-700">Status</label><select value={editingVehicle.status} onChange={e => setEditingVehicle({ ...editingVehicle, status: e.target.value as any })} className="w-full p-2 border rounded-md">{Object.values(VehicleStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    </div>
                    <div className="flex justify-end gap-2 pt-6">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-md">Save Vehicle</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export const HRModule: React.FC<{ userProfile: UserProfile | null; initialView?: string | null }> = ({ userProfile, initialView }) => {
    const [activeTab, setActiveTab] = useState(initialView || 'employees');

    const tabs = [
        { id: 'employees', label: 'Employees', icon: '👤' },
        { id: 'attendance', label: 'Attendance', icon: '📅' },
        { id: 'payroll', label: 'Payroll', icon: '💰' },
        { id: 'vehicles', label: 'Vehicles', icon: '🚚' },
        { id: 'tasks', label: 'Tasks', icon: '✅' },
        { id: 'enquiries', label: 'Enquiries', icon: '❓' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'employees': return <EmployeeManagement />;
            case 'attendance': return <AttendanceRegister userProfile={userProfile} />;
            case 'payroll': return <SalaryCalculator />;
            case 'vehicles': return <VehicleManagement />;
            case 'tasks': return <TasksManagement />;
            case 'enquiries': return <EnquiryManagement />;
            default: return <EmployeeManagement />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden no-print">
                <div className="flex overflow-x-auto scrollbar-hide">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                                activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 min-h-[600px]">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default SetupModule;