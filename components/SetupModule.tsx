import React, { useState, useEffect, useMemo } from 'react';
import { useData, db, auth, allPermissions } from '../context/DataContext.tsx';
import { 
    UserProfile, Module, Employee, AttendanceStatus, 
    HRTask, HREnquiry, Vehicle, VehicleStatus, JournalEntry, JournalEntryType, Currency
} from '../types.ts';
import { generateEmployeeId, generateVehicleId } from '../utils/idGenerator.ts';
import Modal from './ui/Modal.tsx';
import AttendanceRegister from './AttendanceRegister.tsx';
import SalaryCalculator from './SalaryCalculator.tsx';
import EntitySelector from './ui/EntitySelector.tsx';

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
        setEditingEmployee(emp ? { ...emp } : { 
            employeeType: 'Labour',
            fullName: '',
            dateOfBirth: '',
            nationality: '',
            address: '',
            phone: '',
            email: '',
            joiningDate: new Date().toISOString().split('T')[0],
            designation: '',
            status: 'Active', 
            onDuty: true,
            companyVisa: true,
            passportNumber: '',
            passportExpiryDate: '',
            visaStatus: '',
            visaExpiryDate: '',
            biennialLeaveDueDate: '',
            biennialLeaveStatus: 'Pending',
            bankName: '',
            accountNumber: '',
            iban: '',
            basicSalary: 0,
            salaryIncrementDate: '',
            advances: 0,
            startingBalance: 0,
            complaintsOrIssues: ''
        });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!editingEmployee?.fullName) {
            alert("Full Name is required.");
            return;
        }
        if (!editingEmployee?.employeeType) {
            alert("Employee Type is required.");
            return;
        }
        if (editingEmployee.id) {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'employees', data: editingEmployee as Employee } });
        } else {
            const type = editingEmployee.employeeType as 'Office' | 'Labour';
            const newEmp = { ...editingEmployee, id: generateEmployeeId(state.employees, type) } as Employee;
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'employees', data: newEmp } });
        }
        setIsModalOpen(false);
    };

    const inputClasses = "w-full p-2 border rounded-md";
    const labelClasses = "block text-sm font-semibold text-slate-700 mb-1";
    const sectionTitleClasses = "text-md font-bold text-blue-700 border-b pb-1 mt-6 mb-4 col-span-full";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Employee Register</h3>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700 transition-colors shadow-sm">Add Employee</button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
                <table className="w-full text-left table-auto">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-3 font-semibold text-slate-600">ID</th>
                            <th className="p-3 font-semibold text-slate-600">Name</th>
                            <th className="p-3 font-semibold text-slate-600">Type</th>
                            <th className="p-3 font-semibold text-slate-600">Designation</th>
                            <th className="p-3 font-semibold text-slate-600 text-right">Salary</th>
                            <th className="p-3 font-semibold text-slate-600">Status</th>
                            <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {state.employees.map(emp => (
                            <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 text-slate-500 font-mono text-xs">{emp.id}</td>
                                <td className="p-3 font-medium text-slate-800">{emp.fullName}</td>
                                <td className="p-3 text-slate-600">{emp.employeeType}</td>
                                <td className="p-3 text-slate-600">{emp.designation}</td>
                                <td className="p-3 text-slate-800 text-right">${emp.basicSalary}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span>
                                </td>
                                <td className="p-3 text-right">
                                    <button onClick={() => handleOpenModal(emp)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingEmployee && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmployee.id ? `Edit Employee: ${editingEmployee.fullName}` : "Add Employee"} size="4xl" isForm>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {/* Section: Basic Info */}
                        <div className={sectionTitleClasses}>Personal Information</div>
                        <div className="md:col-span-2">
                            <label className={labelClasses}>Employee Type <span className="text-red-500">*</span></label>
                            <select 
                                value={editingEmployee.employeeType || ''} 
                                onChange={e => setEditingEmployee({ ...editingEmployee, employeeType: e.target.value as any })} 
                                className={inputClasses}
                                disabled={!!editingEmployee.id}
                            >
                                <option value="Office">Office (OFF)</option>
                                <option value="Labour">Labour (LBR)</option>
                            </select>
                            {!editingEmployee.id && <p className="text-xs text-slate-500 mt-1">ID will be generated automatically based on selection.</p>}
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClasses}>Full Name <span className="text-red-500">*</span></label>
                            <input type="text" value={editingEmployee.fullName || ''} onChange={e => setEditingEmployee({ ...editingEmployee, fullName: e.target.value })} className={inputClasses} placeholder="As per Passport/ID" />
                        </div>
                        <div>
                            <label className={labelClasses}>Date of Birth <span className="text-red-500">*</span></label>
                            <input type="date" value={editingEmployee.dateOfBirth || ''} onChange={e => setEditingEmployee({ ...editingEmployee, dateOfBirth: e.target.value })} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Nationality <span className="text-red-500">*</span></label>
                            <input type="text" value={editingEmployee.nationality || ''} onChange={e => setEditingEmployee({ ...editingEmployee, nationality: e.target.value })} className={inputClasses} placeholder="e.g., Pakistan" />
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClasses}>Address</label>
                            <textarea rows={2} value={editingEmployee.address || ''} onChange={e => setEditingEmployee({ ...editingEmployee, address: e.target.value })} className={inputClasses} placeholder="Current residence address" />
                        </div>
                        <div>
                            <label className={labelClasses}>Phone</label>
                            <input type="text" value={editingEmployee.phone || ''} onChange={e => setEditingEmployee({ ...editingEmployee, phone: e.target.value })} className={inputClasses} placeholder="+971..." />
                        </div>
                        <div>
                            <label className={labelClasses}>Email</label>
                            <input type="email" value={editingEmployee.email || ''} onChange={e => setEditingEmployee({ ...editingEmployee, email: e.target.value })} className={inputClasses} placeholder="email@example.com" />
                        </div>

                        {/* Section: Employment */}
                        <div className={sectionTitleClasses}>Employment Details</div>
                        <div>
                            <label className={labelClasses}>Joining Date <span className="text-red-500">*</span></label>
                            <input type="date" value={editingEmployee.joiningDate || ''} onChange={e => setEditingEmployee({ ...editingEmployee, joiningDate: e.target.value })} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Designation <span className="text-red-500">*</span></label>
                            <input type="text" value={editingEmployee.designation || ''} onChange={e => setEditingEmployee({ ...editingEmployee, designation: e.target.value })} className={inputClasses} placeholder="Job title" />
                        </div>
                        <div>
                            <label className={labelClasses}>Status <span className="text-red-500">*</span></label>
                            <select value={editingEmployee.status} onChange={e => setEditingEmployee({ ...editingEmployee, status: e.target.value as any })} className={inputClasses}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>On Duty <span className="text-red-500">*</span></label>
                            <select value={editingEmployee.onDuty ? 'Yes' : 'No'} onChange={e => setEditingEmployee({ ...editingEmployee, onDuty: e.target.value === 'Yes' })} className={inputClasses}>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </select>
                        </div>

                        {/* Section: Visa/Passport */}
                        <div className={sectionTitleClasses}>Visa & Passport</div>
                        <div>
                            <label className={labelClasses}>Company Visa</label>
                            <select value={editingEmployee.companyVisa ? 'Yes' : 'No'} onChange={e => setEditingEmployee({ ...editingEmployee, companyVisa: e.target.value === 'Yes' })} className={inputClasses}>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Passport Number</label>
                            <input type="text" value={editingEmployee.passportNumber || ''} onChange={e => setEditingEmployee({ ...editingEmployee, passportNumber: e.target.value })} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Passport Expiry</label>
                            <input type="date" value={editingEmployee.passportExpiryDate || ''} onChange={e => setEditingEmployee({ ...editingEmployee, passportExpiryDate: e.target.value })} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Visa Status</label>
                            <input type="text" value={editingEmployee.visaStatus || ''} onChange={e => setEditingEmployee({ ...editingEmployee, visaStatus: e.target.value })} className={inputClasses} placeholder="e.g. Partner, Residence" />
                        </div>
                        <div>
                            <label className={labelClasses}>Visa Expiry</label>
                            <input type="date" value={editingEmployee.visaExpiryDate || ''} onChange={e => setEditingEmployee({ ...editingEmployee, visaExpiryDate: e.target.value })} className={inputClasses} />
                        </div>

                        {/* Section: Leave */}
                        <div className={sectionTitleClasses}>Leave Details</div>
                        <div>
                            <label className={labelClasses}>Biennial Leave Due</label>
                            <input type="date" value={editingEmployee.biennialLeaveDueDate || ''} onChange={e => setEditingEmployee({ ...editingEmployee, biennialLeaveDueDate: e.target.value })} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Biennial Leave Status <span className="text-red-500">*</span></label>
                            <select value={editingEmployee.biennialLeaveStatus} onChange={e => setEditingEmployee({ ...editingEmployee, biennialLeaveStatus: e.target.value as any })} className={inputClasses}>
                                <option value="Pending">Pending</option>
                                <option value="Consumed">Consumed</option>
                            </select>
                        </div>

                        {/* Section: Financial */}
                        <div className={sectionTitleClasses}>Financial Information</div>
                        <div>
                            <label className={labelClasses}>Bank Name</label>
                            <input type="text" value={editingEmployee.bankName || ''} onChange={e => setEditingEmployee({ ...editingEmployee, bankName: e.target.value })} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Account Number</label>
                            <input type="text" value={editingEmployee.accountNumber || ''} onChange={e => setEditingEmployee({ ...editingEmployee, accountNumber: e.target.value })} className={inputClasses} />
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClasses}>IBAN</label>
                            <input type="text" value={editingEmployee.iban || ''} onChange={e => setEditingEmployee({ ...editingEmployee, iban: e.target.value })} className={inputClasses} placeholder="AE..." />
                        </div>
                        <div>
                            <label className={labelClasses}>Basic Salary <span className="text-red-500">*</span></label>
                            <input type="number" value={editingEmployee.basicSalary || 0} onChange={e => setEditingEmployee({ ...editingEmployee, basicSalary: Number(e.target.value) })} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Next Increment Date</label>
                            <input type="date" value={editingEmployee.salaryIncrementDate || ''} onChange={e => setEditingEmployee({ ...editingEmployee, salaryIncrementDate: e.target.value })} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Advances Balance</label>
                            <input type="number" value={editingEmployee.advances || 0} onChange={e => setEditingEmployee({ ...editingEmployee, advances: Number(e.target.value) })} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Opening Balance (Payable/Receivable)</label>
                            <input type="number" value={editingEmployee.startingBalance || 0} onChange={e => setEditingEmployee({ ...editingEmployee, startingBalance: Number(e.target.value) })} className={inputClasses} />
                        </div>

                        {/* Section: Other */}
                        <div className={sectionTitleClasses}>Other</div>
                        <div className="md:col-span-2">
                            <label className={labelClasses}>Complaints or Issues</label>
                            <textarea rows={3} value={editingEmployee.complaintsOrIssues || ''} onChange={e => setEditingEmployee({ ...editingEmployee, complaintsOrIssues: e.target.value })} className={inputClasses} placeholder="Note any employee issues or performance complaints here..." />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-8 border-t mt-6">
                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-md font-bold hover:bg-slate-300 transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-8 py-2.5 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 transition-colors shadow-md">Save Employee</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const TasksManagement: React.FC = () => {
    const { state, dispatch } = useData();
    const [description, setDescription] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [users, setUsers] = useState<UserProfile[]>([]);

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

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;
        
        const assignee = users.find(u => u.uid === assigneeId);
        
        const newTask: HRTask = {
            id: `TASK-${Date.now()}`,
            description,
            isDone: false,
            comments: '',
            creationDate: new Date().toISOString().split('T')[0],
            assignedToId: assigneeId || undefined,
            assignedToName: assignee?.name || undefined,
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'hrTasks', data: newTask } });
        setDescription('');
        setAssigneeId('');
    };

    const toggleDone = (task: HRTask) => {
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'hrTasks', data: { ...task, isDone: !task.isDone, completionDate: !task.isDone ? new Date().toISOString().split('T')[0] : undefined } } });
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800">HR Task Tracker</h3>
            <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <input 
                    type="text" 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Enter new task description..." 
                    className="flex-grow p-2 border rounded-md" 
                />
                <select 
                    value={assigneeId} 
                    onChange={e => setAssigneeId(e.target.value)} 
                    className="w-full md:w-64 p-2 border rounded-md"
                >
                    <option value="">Select Assignee (Optional)</option>
                    {users.map(u => (
                        <option key={u.uid} value={u.uid}>{u.name}</option>
                    ))}
                </select>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 transition-colors">Add Task</button>
            </form>
            <div className="space-y-3">
                {state.hrTasks.map(task => (
                    <div key={task.id} className="p-4 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <input type="checkbox" checked={task.isDone} onChange={() => toggleDone(task)} className="h-5 w-5 rounded text-indigo-600" />
                            <div>
                                <p className={`font-medium ${task.isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.description}</p>
                                <div className="flex gap-4 mt-1">
                                    <p className="text-xs text-slate-500">Created: {task.creationDate}</p>
                                    {task.assignedToName && (
                                        <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Assigned to: {task.assignedToName}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        {task.isDone && task.completionDate && (
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Done on {task.completionDate}</span>
                        )}
                    </div>
                ))}
                {state.hrTasks.length === 0 && (
                    <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
                        <p className="text-slate-400">No tasks tracked yet.</p>
                    </div>
                )}
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
    const { state, dispatch, userProfile } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);
    
    // Auxiliary state for the optional charge record
    const [chargeData, setChargeData] = useState({
        description: '',
        type: '',
        amount: '',
        employeeId: ''
    });

    const handleOpenModal = (veh: Vehicle | null = null) => {
        setEditingVehicle(veh ? { ...veh } : { 
            plateNumber: '', 
            model: '', 
            registrationExpiry: '', 
            insuranceExpiry: '', 
            status: VehicleStatus.Active,
            assignedTo: '',
            remarks: ''
        });
        setChargeData({ description: '', type: '', amount: '', employeeId: '' });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!editingVehicle?.plateNumber || !editingVehicle?.model) {
            alert("Plate Number and Model are required.");
            return;
        }

        let vehicleId = editingVehicle.id;
        if (vehicleId) {
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'vehicles', data: editingVehicle as Vehicle } });
        } else {
            vehicleId = generateVehicleId(state.vehicles);
            const newVeh = { ...editingVehicle, id: vehicleId } as Vehicle;
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'vehicles', data: newVeh } });
        }

        // Process optional charge
        if (chargeData.amount && chargeData.employeeId) {
            const amountNum = Number(chargeData.amount);
            const employee = state.employees.find(e => e.id === chargeData.employeeId);
            const voucherId = `VEH-CHG-${Date.now()}`;
            const description = `${chargeData.type}: ${chargeData.description} (Vehicle: ${editingVehicle.plateNumber})`;

            // Create Journal Entry
            // Debit: AP-001 (Employee Payable/Receivable)
            // Credit: Cash/Bank? For simplicity let's use a generic 'Vehicle Expense' account if available, 
            // but the prompt implies charging the employee.
            // Let's record it as a Journal Entry affecting the employee.
            const debitEntry: JournalEntry = {
                id: `je-d-${voucherId}`,
                voucherId,
                date: new Date().toISOString().split('T')[0],
                entryType: JournalEntryType.Journal,
                account: 'AP-001', // Accounts Payable (Employee)
                debit: amountNum,
                credit: 0,
                description,
                entityId: chargeData.employeeId,
                entityType: 'employee',
                createdBy: userProfile?.uid
            };

            const creditEntry: JournalEntry = {
                id: `je-c-${voucherId}`,
                voucherId,
                date: new Date().toISOString().split('T')[0],
                entryType: JournalEntryType.Journal,
                account: 'EXP-010', // Vehicle / General Expense placeholder
                debit: 0,
                credit: amountNum,
                description,
                createdBy: userProfile?.uid
            };

            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
        }

        setIsModalOpen(false);
    };

    const labelClasses = "block text-sm font-semibold text-slate-700 mb-1";
    const inputClasses = "w-full p-2 border rounded-md";
    const sectionTitleClasses = "text-md font-bold text-blue-700 border-b pb-1 mt-6 mb-4 col-span-full";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Vehicle Fleet</h3>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold shadow-sm">Add Vehicle</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.vehicles.map(v => (
                    <div key={v.id} className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                            <span className="bg-slate-900 text-white font-mono text-lg font-bold px-3 py-1 rounded shadow-inner">{v.plateNumber}</span>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${v.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.status}</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-slate-800 font-bold">{v.model}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Reg. Expiry: {v.registrationExpiry || 'N/A'}
                            </p>
                        </div>
                        <button onClick={() => handleOpenModal(v)} className="w-full mt-5 py-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition-colors text-sm font-bold">Edit / Add Charge</button>
                    </div>
                ))}
            </div>

            {isModalOpen && editingVehicle && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingVehicle.id ? "Edit Vehicle" : "Add Vehicle"} size="2xl" isForm>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className={labelClasses}>Plate Number <span className="text-red-500">*</span></label>
                                <input type="text" value={editingVehicle.plateNumber || ''} onChange={e => setEditingVehicle({ ...editingVehicle, plateNumber: e.target.value })} className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>Model <span className="text-red-500">*</span></label>
                                <input type="text" value={editingVehicle.model || ''} onChange={e => setEditingVehicle({ ...editingVehicle, model: e.target.value })} className={inputClasses} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Registration Expiry <span className="text-red-500">*</span></label>
                                    <input type="date" value={editingVehicle.registrationExpiry || ''} onChange={e => setEditingVehicle({ ...editingVehicle, registrationExpiry: e.target.value })} className={inputClasses} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Insurance Expiry <span className="text-red-500">*</span></label>
                                    <input type="date" value={editingVehicle.insuranceExpiry || ''} onChange={e => setEditingVehicle({ ...editingVehicle, insuranceExpiry: e.target.value })} className={inputClasses} />
                                </div>
                            </div>
                            <div>
                                <label className={labelClasses}>Assigned To</label>
                                <select value={editingVehicle.assignedTo || ''} onChange={e => setEditingVehicle({ ...editingVehicle, assignedTo: e.target.value })} className={inputClasses}>
                                    <option value="">Select Assigned To</option>
                                    {state.employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClasses}>Status <span className="text-red-500">*</span></label>
                                <select value={editingVehicle.status} onChange={e => setEditingVehicle({ ...editingVehicle, status: e.target.value as any })} className={inputClasses}>
                                    {Object.values(VehicleStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClasses}>Remarks</label>
                                <textarea rows={3} value={editingVehicle.remarks || ''} onChange={e => setEditingVehicle({ ...editingVehicle, remarks: e.target.value })} className={inputClasses} />
                            </div>
                        </div>

                        {/* Automated Charge Section */}
                        <div className={sectionTitleClasses}>Add a Charge to Responsible Employee</div>
                        <div className="space-y-4">
                            <div>
                                <input type="text" placeholder="Charge Description (e.g. Fine, Repair)" value={chargeData.description} onChange={e => setChargeData({...chargeData, description: e.target.value})} className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>Charge Type</label>
                                <input type="text" placeholder="e.g. Traffic Violation" value={chargeData.type} onChange={e => setChargeData({...chargeData, type: e.target.value})} className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>Amount ($)</label>
                                <input type="number" placeholder="0.00" value={chargeData.amount} onChange={e => setChargeData({...chargeData, amount: e.target.value})} className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>Responsible Employee</label>
                                <select value={chargeData.employeeId} onChange={e => setChargeData({...chargeData, employeeId: e.target.value})} className={inputClasses}>
                                    <option value="">Select Responsible Employee</option>
                                    {state.employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-8 border-t mt-6">
                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-md font-bold hover:bg-slate-300">Cancel</button>
                        <button onClick={handleSave} className="px-8 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow-md">Save</button>
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