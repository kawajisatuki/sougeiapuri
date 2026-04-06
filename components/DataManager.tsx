
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import type { Driver, Vehicle, RouteTemplate, User, Facility, TemplateSet, DailySchedule } from '../types';
import { TruckIcon } from './icons/TruckIcon';
import { UsersIcon } from './icons/UsersIcon';
import { CollectionIcon } from './icons/CollectionIcon';
import { TrashIcon } from './icons/TrashIcon';
import { UserIcon as SingleUserIcon } from './icons/UserIcon';
import { HomeIcon } from './icons/HomeIcon';
import { ViewGridIcon } from './icons/ViewGridIcon';
import { DatabaseIcon } from './icons/DatabaseIcon';

interface CsvUser {
  name: string;
  address: string;
  phone: string;
  photoUrl: string;
}

// A more robust CSV parser that handles quoted fields, empty fields, and different header names.
function parseCsv(csvText: string): CsvUser[] {
    // Handle potential BOM (Byte Order Mark) at the start of the file
    const cleanedCsvText = csvText.startsWith('\uFEFF') ? csvText.substring(1) : csvText;
    const rows = cleanedCsvText.trim().split(/\r?\n/);
    if (rows.length < 2) throw new Error("CSVにはヘッダー行と少なくとも1つのデータ行が必要です。");
    
    const headerLine = rows.shift();
    if (!headerLine) throw new Error("CSVファイルが空か、またはヘッダー行がありません。");
    
    // This regex splits by comma, but ignores commas inside double quotes.
    const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    const cleanCsvField = (field: string): string => {
        if (typeof field !== 'string') return '';
        let cleaned = field.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
        }
        // Replace escaped double quotes ("") with a single double quote (")
        return cleaned.replace(/""/g, '"');
    };

    const headers = headerLine.split(csvSplitRegex).map(cleanCsvField);
    
    const headerMapping: { [key: string]: string[] } = {
        name: ['name', '氏名', '名前'],
        address: ['address', '住所'],
        phone: ['phone', 'tel', '電話番号'],
        photoUrl: ['photoUrl', '写真URL', '写真']
    };

    const findIndex = (possibleHeaders: string[]): number => {
        for (const pHeader of possibleHeaders) {
            // Case-insensitive search
            const index = headers.findIndex(header => header.toLowerCase() === pHeader.toLowerCase());
            if (index > -1) return index;
        }
        return -1;
    };
    
    const nameIndex = findIndex(headerMapping.name);
    const addressIndex = findIndex(headerMapping.address);
    const phoneIndex = findIndex(headerMapping.phone);
    const photoUrlIndex = findIndex(headerMapping.photoUrl);

    if (nameIndex === -1 || addressIndex === -1) {
        throw new Error(`CSVヘッダーには "name"(または"氏名") と "address"(または"住所") が必須です。検出されたヘッダー: ${headers.join(', ')}`);
    }
    
    return rows.map(row => {
        if (row.trim() === '') return null;

        const values = row.split(csvSplitRegex).map(cleanCsvField);
        
        const name = values[nameIndex] || '';
        const address = values[addressIndex] || '';
        const phone = phoneIndex > -1 ? (values[phoneIndex] || '') : '';
        const photoUrl = photoUrlIndex > -1 ? (values[photoUrlIndex] || '') : '';
        
        return (name && address) ? { name, address, phone, photoUrl } : null;
    }).filter((user): user is CsvUser => user !== null);
}

interface DataManagerProps {
  drivers: Driver[];
  vehicles: Vehicle[];
  routeTemplates: RouteTemplate[];
  templateSets: TemplateSet[];
  users: User[];
  facility: Facility;
  schedules: Record<string, DailySchedule>;
  onUpdateFacility: (facility: Facility) => void;
  onAddDriver: (name: string, email: string) => void;
  onUpdateDriver: (driver: Driver) => void;
  onDeleteDriver: (driverId: number) => void;
  onAddVehicle: (model: string, licensePlate: string) => void;
  onUpdateVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicleId: number) => void;
  onAddTemplate: (template: Omit<RouteTemplate, 'id'>) => void;
  onUpdateTemplate: (template: RouteTemplate) => void;
  onDeleteTemplate: (templateId: number) => void;
  onAddTemplateSet: (templateSet: Omit<TemplateSet, 'id'>) => void;
  onUpdateTemplateSet: (templateSet: TemplateSet) => void;
  onDeleteTemplateSet: (templateSetId: number) => void;
  onAddUser: (name: string, address: string, photoUrl: string, phone: string, attendanceDays: User['attendanceDays']) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: number) => void;
  onImportUsers: (users: CsvUser[]) => void;
  onRestoreAllData: (data: any) => void;
}

const NewDriverForm: React.FC<{ onAdd: (name: string, email: string) => void }> = ({ onAdd }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onAdd(name.trim(), email.trim());
            setName('');
            setEmail('');
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-2 mt-2">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="運転手名" required className="w-full p-2 border border-slate-300 rounded-md text-sm" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="メールアドレス (任意)" className="w-full p-2 border border-slate-300 rounded-md text-sm" />
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">追加</button>
        </form>
    );
};

const NewVehicleForm: React.FC<{ onAdd: (model: string, licensePlate: string) => void }> = ({ onAdd }) => {
    const [model, setModel] = useState('');
    const [licensePlate, setLicensePlate] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (model.trim() && licensePlate.trim()) {
            onAdd(model.trim(), licensePlate.trim());
            setModel('');
            setLicensePlate('');
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-2 mt-2">
            <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="車両モデル (例: トヨタ ハイエース)" className="w-full p-2 border border-slate-300 rounded-md text-sm" />
            <input type="text" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} placeholder="ナンバープレート (例: 品川 300 あ 12-34)" className="w-full p-2 border border-slate-300 rounded-md text-sm" />
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">追加</button>
        </form>
    );
};

const TemplateFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (template: Omit<RouteTemplate, 'id'>) => void;
    onUpdate: (template: RouteTemplate) => void;
    users: User[];
    drivers: Driver[];
    vehicles: Vehicle[];
    templateToEdit?: RouteTemplate | null;
}> = ({ isOpen, onClose, onSave, onUpdate, users, drivers, vehicles, templateToEdit }) => {
    const [templateName, setTemplateName] = useState('');
    const [routeName, setRouteName] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
    const [driverId, setDriverId] = useState<number | undefined>(undefined);
    const [vehicleId, setVehicleId] = useState<number | undefined>(undefined);
    const [applicableDays, setApplicableDays] = useState({
        sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false
    });
    
    const weekDays = [
        { key: 'mon', label: '月' }, { key: 'tue', label: '火' }, { key: 'wed', label: '水' },
        { key: 'thu', label: '木' }, { key: 'fri', label: '金' }, { key: 'sat', label: '土' },
        { key: 'sun', label: '日' }
    ] as const;

    useEffect(() => {
        if (isOpen) {
            if (templateToEdit) {
                setTemplateName(templateToEdit.templateName);
                setRouteName(templateToEdit.routeName);
                setSelectedUserIds(new Set(templateToEdit.userIds));
                setDriverId(templateToEdit.driverId);
                setVehicleId(templateToEdit.vehicleId);
                setApplicableDays(templateToEdit.applicableDays);
            } else {
                setTemplateName('');
                setRouteName('');
                setSelectedUserIds(new Set());
                setDriverId(undefined);
                setVehicleId(undefined);
                setApplicableDays({ sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false });
            }
        }
    }, [templateToEdit, isOpen]);

    if (!isOpen) return null;

    const handleUserToggle = (userId: number) => {
        setSelectedUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) newSet.delete(userId);
            else newSet.add(userId);
            return newSet;
        });
    };
    
    const handleDayToggle = (day: keyof typeof applicableDays) => {
        setApplicableDays(prev => ({ ...prev, [day]: !prev[day] }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (templateName.trim() && routeName.trim()) {
            const templateData = {
                templateName: templateName.trim(),
                routeName: routeName.trim(),
                userIds: Array.from(selectedUserIds),
                driverId: driverId ? Number(driverId) : undefined,
                vehicleId: vehicleId ? Number(vehicleId) : undefined,
                applicableDays,
            };

            if (templateToEdit) {
                onUpdate({ ...templateData, id: templateToEdit.id });
            } else {
                onSave(templateData);
            }
            onClose();
        }
    };
    
    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">{templateToEdit ? '個別ルートを編集' : '新しい個別ルートを作成'}</h3>
                
                <div className="flex-grow overflow-y-auto pr-3 -mr-3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="template-name" className="block text-sm font-medium text-slate-700">個別ルート名</label>
                            <input id="template-name" type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="例: 月曜午前Aコース" required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div>
                            <label htmlFor="route-name" className="block text-sm font-medium text-slate-700">作成されるルート名</label>
                            <input id="route-name" type="text" value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="例: 送迎ルート1" required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label htmlFor="template-driver" className="block text-sm font-medium text-slate-700">担当運転手 (任意)</label>
                           <select id="template-driver" value={driverId || ''} onChange={e => setDriverId(Number(e.target.value))} className="mt-1 block w-full p-2 border border-slate-300 rounded-md">
                               <option value="">指定なし</option>
                               {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                           </select>
                        </div>
                        <div>
                           <label htmlFor="template-vehicle" className="block text-sm font-medium text-slate-700">担当車両 (任意)</label>
                           <select id="template-vehicle" value={vehicleId || ''} onChange={e => setVehicleId(Number(e.target.value))} className="mt-1 block w-full p-2 border border-slate-300 rounded-md">
                               <option value="">指定なし</option>
                               {vehicles.map(v => <option key={v.id} value={v.id}>{v.model}</option>)}
                           </select>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700">適用する曜日</label>
                        <div className="mt-2 grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {weekDays.map(day => (
                                <button type="button" key={day.key} onClick={() => handleDayToggle(day.key)} className={`flex items-center justify-center p-2 border rounded-md cursor-pointer transition-colors text-sm ${applicableDays[day.key] ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">利用者を選択</label>
                        <div className="mt-1 max-h-48 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-1">
                            {users.map(user => (
                                <label key={user.id} className="flex items-center p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                                    <input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => handleUserToggle(user.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-3 text-sm text-slate-700">{user.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md hover:bg-slate-300">キャンセル</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
                </div>
            </form>
        </div>,
        document.getElementById('modal-root')!
    );
};

const TemplateSetFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (templateSet: Omit<TemplateSet, 'id'>) => void;
    onUpdate: (templateSet: TemplateSet) => void;
    routeTemplates: RouteTemplate[];
    setToEdit?: TemplateSet | null;
}> = ({ isOpen, onClose, onSave, onUpdate, routeTemplates, setToEdit }) => {
    const [name, setName] = useState('');
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());
    const [applicableDays, setApplicableDays] = useState({
        sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false
    });
    
    const weekDays = [
        { key: 'mon', label: '月' }, { key: 'tue', label: '火' }, { key: 'wed', label: '水' },
        { key: 'thu', label: '木' }, { key: 'fri', label: '金' }, { key: 'sat', label: '土' },
        { key: 'sun', label: '日' }
    ] as const;

    useEffect(() => {
        if (isOpen) {
            if (setToEdit) {
                setName(setToEdit.name);
                setSelectedTemplateIds(new Set(setToEdit.templateIds));
                setApplicableDays(setToEdit.applicableDays);
            } else {
                setName('');
                setSelectedTemplateIds(new Set());
                setApplicableDays({ sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false });
            }
        }
    }, [setToEdit, isOpen]);

    if (!isOpen) return null;

    const handleTemplateToggle = (templateId: number) => {
        setSelectedTemplateIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(templateId)) newSet.delete(templateId);
            else newSet.add(templateId);
            return newSet;
        });
    };
    
    const handleDayToggle = (day: keyof typeof applicableDays) => {
        setApplicableDays(prev => ({ ...prev, [day]: !prev[day] }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            const setData = {
                name: name.trim(),
                templateIds: Array.from(selectedTemplateIds),
                applicableDays,
            };

            if (setToEdit) {
                onUpdate({ ...setData, id: setToEdit.id });
            } else {
                onSave(setData);
            }
            onClose();
        }
    };
    
    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">{setToEdit ? 'セットを編集' : '新しいセットを作成'}</h3>
                
                <div className="flex-grow overflow-y-auto pr-3 -mr-3 space-y-4">
                    <div>
                        <label htmlFor="set-name" className="block text-sm font-medium text-slate-700">セット名</label>
                        <input id="set-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例: 月曜フルコース" required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700">適用する曜日</label>
                        <div className="mt-2 grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {weekDays.map(day => (
                                <button type="button" key={day.key} onClick={() => handleDayToggle(day.key)} className={`flex items-center justify-center p-2 border rounded-md cursor-pointer transition-colors text-sm ${applicableDays[day.key] ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">含める個別ルートを選択</label>
                        <div className="mt-1 max-h-60 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-1">
                            {routeTemplates.map(template => (
                                <label key={template.id} className="flex items-center p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                                    <input type="checkbox" checked={selectedTemplateIds.has(template.id)} onChange={() => handleTemplateToggle(template.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    <span className="ml-3 text-sm text-slate-700">{template.templateName}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md hover:bg-slate-300">キャンセル</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
                </div>
            </form>
        </div>,
        document.getElementById('modal-root')!
    );
};

const UserFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: User) => void;
    onAdd: (name: string, address: string, photoUrl: string, phone: string, attendanceDays: User['attendanceDays']) => void;
    userToEdit?: User | null;
}> = ({ isOpen, onClose, onSave, onAdd, userToEdit }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [attendanceDays, setAttendanceDays] = useState({
        sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false
    });

    const weekDays = [
        { key: 'mon', label: '月' }, { key: 'tue', label: '火' }, { key: 'wed', label: '水' },
        { key: 'thu', label: '木' }, { key: 'fri', label: '金' }, { key: 'sat', label: '土' },
        { key: 'sun', label: '日' }
    ] as const;

    useEffect(() => {
        if (userToEdit) {
            setName(userToEdit.name);
            setAddress(userToEdit.address);
            setPhone(userToEdit.phone || '');
            setPhotoUrl(userToEdit.photoUrl);
            setAttendanceDays(userToEdit.attendanceDays || {
                sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false
            });
        } else {
            setName('');
            setAddress('');
            setPhone('');
            setPhotoUrl('');
            setAttendanceDays({
                sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false
            });
        }
    }, [userToEdit, isOpen]);

    if (!isOpen) return null;

    const handleDayToggle = (day: keyof typeof attendanceDays) => {
        setAttendanceDays(prev => ({ ...prev, [day]: !prev[day] }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && address.trim()) {
            if (userToEdit) {
                onSave({ ...userToEdit, name, address, phone, photoUrl, attendanceDays });
            } else {
                onAdd(name, address, photoUrl, phone, attendanceDays);
            }
            onClose();
        }
    };
    
    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">{userToEdit ? '利用者を編集' : '新しい利用者を追加'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="user-name" className="block text-sm font-medium text-slate-700">氏名</label>
                        <input id="user-name" type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                    <div>
                        <label htmlFor="user-address" className="block text-sm font-medium text-slate-700">住所</label>
                        <input id="user-address" type="text" value={address} onChange={e => setAddress(e.target.value)} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                    <div>
                        <label htmlFor="user-phone" className="block text-sm font-medium text-slate-700">電話番号 (任意)</label>
                        <input id="user-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="090-1234-5678" className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                    <div>
                        <label htmlFor="user-photo" className="block text-sm font-medium text-slate-700">写真URL (任意)</label>
                        <input id="user-photo" type="text" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://example.com/photo.jpg" className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">定例利用曜日</label>
                        <div className="mt-2 grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {weekDays.map(day => (
                                <label key={day.key} className={`flex flex-col items-center justify-center p-2 border rounded-md cursor-pointer transition-colors ${attendanceDays[day.key] ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
                                    <input
                                        type="checkbox"
                                        checked={attendanceDays[day.key]}
                                        onChange={() => handleDayToggle(day.key)}
                                        className="sr-only"
                                    />
                                    <span className="font-semibold text-sm">{day.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md hover:bg-slate-300">キャンセル</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
                    </div>
                </form>
            </div>
        </div>,
        document.getElementById('modal-root')!
    );
};

const DriverFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (driver: Driver) => void;
    driverToEdit: Driver | null;
}> = ({ isOpen, onClose, onSave, driverToEdit }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => {
        if (driverToEdit) {
            setName(driverToEdit.name);
            setEmail(driverToEdit.email || '');
        }
    }, [driverToEdit, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && driverToEdit) {
            onSave({ ...driverToEdit, name: name.trim(), email: email.trim() });
            onClose();
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">運転手を編集</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="driver-name-edit" className="block text-sm font-medium text-slate-700">氏名</label>
                        <input id="driver-name-edit" type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                    <div>
                        <label htmlFor="driver-email-edit" className="block text-sm font-medium text-slate-700">メールアドレス</label>
                        <input id="driver-email-edit" type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md hover:bg-slate-300">キャンセル</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
                    </div>
                </form>
            </div>
        </div>,
        document.getElementById('modal-root')!
    );
};

const VehicleFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (vehicle: Vehicle) => void;
    vehicleToEdit: Vehicle | null;
}> = ({ isOpen, onClose, onSave, vehicleToEdit }) => {
    const [model, setModel] = useState('');
    const [licensePlate, setLicensePlate] = useState('');

    useEffect(() => {
        if (vehicleToEdit) {
            setModel(vehicleToEdit.model);
            setLicensePlate(vehicleToEdit.licensePlate);
        }
    }, [vehicleToEdit, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (model.trim() && licensePlate.trim() && vehicleToEdit) {
            onSave({ ...vehicleToEdit, model: model.trim(), licensePlate: licensePlate.trim() });
            onClose();
        }
    };

    return createPortal(
         <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">車両を編集</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="vehicle-model-edit" className="block text-sm font-medium text-slate-700">車両モデル</label>
                        <input id="vehicle-model-edit" type="text" value={model} onChange={e => setModel(e.target.value)} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                    <div>
                        <label htmlFor="vehicle-license-edit" className="block text-sm font-medium text-slate-700">ナンバープレート</label>
                        <input id="vehicle-license-edit" type="text" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md hover:bg-slate-300">キャンセル</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">保存</button>
                    </div>
                </form>
            </div>
        </div>,
        document.getElementById('modal-root')!
    );
};

const DataManager: React.FC<DataManagerProps> = (props) => {
  const { 
      drivers, vehicles, routeTemplates, templateSets, users, facility, schedules, onUpdateFacility, 
      onAddDriver, onUpdateDriver, onDeleteDriver, onAddVehicle, onUpdateVehicle, 
      onDeleteVehicle, onAddTemplate, onUpdateTemplate, onDeleteTemplate, 
      onAddTemplateSet, onUpdateTemplateSet, onDeleteTemplateSet,
      onAddUser, onUpdateUser, onDeleteUser, onImportUsers, onRestoreAllData
  } = props;
  type Tab = 'facility' | 'drivers' | 'vehicles' | 'templates' | 'users' | 'templateSets' | 'backup';
  const [activeTab, setActiveTab] = useState<Tab>('facility');
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<RouteTemplate | null>(null);
  const [isTemplateSetModalOpen, setTemplateSetModalOpen] = useState(false);
  const [templateSetToEdit, setTemplateSetToEdit] = useState<TemplateSet | null>(null);
  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isDriverModalOpen, setDriverModalOpen] = useState(false);
  const [driverToEdit, setDriverToEdit] = useState<Driver | null>(null);
  const [isVehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const [facilityName, setFacilityName] = useState(facility.name);
  const [facilityAddress, setFacilityAddress] = useState(facility.address);
  const [facilitySaveStatus, setFacilitySaveStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    setFacilityName(facility.name);
    setFacilityAddress(facility.address);
  }, [facility]);
  
  const handleFacilitySave = () => {
    onUpdateFacility({ name: facilityName, address: facilityAddress });
    setFacilitySaveStatus('saved');
    setTimeout(() => setFacilitySaveStatus('idle'), 2000);
  };

  const tabs: {id: Tab, name: string, icon: React.FC<any>}[] = [
    { id: 'facility', name: '事業所', icon: HomeIcon },
    { id: 'users', name: '利用者', icon: UsersIcon },
    { id: 'drivers', name: '運転手', icon: SingleUserIcon },
    { id: 'vehicles', name: '車両', icon: TruckIcon },
    { id: 'templates', name: '個別ルート', icon: ViewGridIcon },
    { id: 'templateSets', name: 'セット', icon: CollectionIcon },
    { id: 'backup', name: 'バックアップ', icon: DatabaseIcon },
  ];

  const handleOpenTemplateModal = (template: RouteTemplate | null = null) => {
    setTemplateToEdit(template);
    setTemplateModalOpen(true);
  };

  const handleOpenTemplateSetModal = (templateSet: TemplateSet | null = null) => {
      setTemplateSetToEdit(templateSet);
      setTemplateSetModalOpen(true);
  };
  
  const handleOpenUserModal = (user: User | null = null) => {
    setUserToEdit(user);
    setUserModalOpen(true);
  };

  const handleOpenDriverModal = (driver: Driver) => {
      setDriverToEdit(driver);
      setDriverModalOpen(true);
  };

  const handleOpenVehicleModal = (vehicle: Vehicle) => {
      setVehicleToEdit(vehicle);
      setVehicleModalOpen(true);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
        const result = event.target?.result;
        if (!result) {
            alert("ファイルの読み込みに失敗しました。");
            return;
        }

        try {
            let newUsers: CsvUser[];
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith('.csv')) {
                newUsers = parseCsv(result as string);
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                const workbook = XLSX.read(result, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                if (!sheetName) throw new Error("Excelファイルにシートがありません。");
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length < 2) {
                     throw new Error("ファイルにはヘッダー行と少なくとも1つのデータ行が必要です。");
                }

                const headerRow = jsonData[0].map(h => typeof h === 'string' ? h.trim() : String(h));
                const dataRows = jsonData.slice(1);

                const headerMapping: { [key: string]: string[] } = {
                    name: ['name', '氏名', '名前'],
                    address: ['address', '住所'],
                    phone: ['phone', 'tel', '電話番号'],
                    photoUrl: ['photoUrl', '写真URL', '写真']
                };

                const findIndex = (possibleHeaders: string[]): number => {
                    for (const pHeader of possibleHeaders) {
                        const index = headerRow.findIndex(header => header.toLowerCase() === pHeader.toLowerCase());
                        if (index > -1) return index;
                    }
                    return -1;
                };

                const nameIndex = findIndex(headerMapping.name);
                const addressIndex = findIndex(headerMapping.address);
                const phoneIndex = findIndex(headerMapping.phone);
                const photoUrlIndex = findIndex(headerMapping.photoUrl);

                if (nameIndex === -1 || addressIndex === -1) {
                    throw new Error(`ファイルヘッダーには "name"(または"氏名") と "address"(または"住所") が必須です。検出されたヘッダー: ${headerRow.join(', ')}`);
                }

                newUsers = dataRows.map(row => {
                    const name = row[nameIndex] ? String(row[nameIndex]) : '';
                    const address = row[addressIndex] ? String(row[addressIndex]) : '';
                    const phone = phoneIndex > -1 && row[phoneIndex] ? String(row[phoneIndex]) : '';
                    const photoUrl = photoUrlIndex > -1 && row[photoUrlIndex] ? String(row[photoUrlIndex]) : '';
                    return (name && address) ? { name, address, phone, photoUrl } : null;
                }).filter((user): user is CsvUser => user !== null);

            } else {
                throw new Error("サポートされていないファイル形式です。.csv, .xlsx, .xls ファイルをアップロードしてください。");
            }
            
            if (newUsers.length > 0) {
              onImportUsers(newUsers);
            } else {
              alert("ファイルからインポートできる利用者がいませんでした。ファイルの内容を確認してください。");
            }

        } catch (error: any) {
            console.error("ファイルの解析に失敗しました:", error);
            alert(`ファイルのインポートに失敗しました。\nエラー: ${error.message}`);
        }
    };

    reader.onerror = () => {
        alert("ファイルの読み込みに失敗しました。");
    };

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) {
        reader.readAsText(file, 'UTF-8');
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        reader.readAsArrayBuffer(file);
    } else {
        alert("サポートされていないファイル形式です。.csv, .xlsx, .xls ファイルをアップロードしてください。");
    }

    if(e.target) e.target.value = '';
  };

  const handleExportData = () => {
    const backupData = {
        users,
        drivers,
        vehicles,
        routeTemplates,
        templateSets,
        schedules,
        facility,
        backupVersion: 1,
        createdAt: new Date().toISOString(),
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `sougei-app-backup-${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportDataClick = () => {
    backupFileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const result = event.target?.result;
            if (typeof result !== 'string') {
                throw new Error("ファイル読み込みエラー");
            }
            const data = JSON.parse(result);
            onRestoreAllData(data);
        } catch (error) {
            console.error("Backup import failed:", error);
            alert("バックアップファイルの読み込みに失敗しました。ファイルが正しいJSON形式であることを確認してください。");
        }
    };
    reader.readAsText(file);
    if(e.target) e.target.value = '';
  };


  return (
    <>
      <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col">
        <h3 className="text-xl font-bold text-slate-700 mb-4">データ管理</h3>
        <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-shrink-0 flex items-center justify-center px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === tab.id ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
              title={tab.name}
            >
              <tab.icon className={`w-5 h-5 mr-2`} />
              <span className="hidden sm:inline">{tab.name}</span>
            </button>
          ))}
        </div>
        <div className="flex-grow overflow-y-auto pr-2 min-h-[200px] max-h-[40vh]">
          {activeTab === 'facility' && (
              <div className="space-y-4">
                  <div>
                      <label htmlFor="facility-name" className="block text-sm font-medium text-slate-700">事業所名</label>
                      <input
                          id="facility-name"
                          type="text"
                          value={facilityName}
                          onChange={(e) => setFacilityName(e.target.value)}
                          className="mt-1 block w-full p-2 border border-slate-300 rounded-md"
                      />
                  </div>
                   <div>
                      <label htmlFor="facility-address" className="block text-sm font-medium text-slate-700">事業所住所</label>
                      <input
                          id="facility-address"
                          type="text"
                          value={facilityAddress}
                          onChange={(e) => setFacilityAddress(e.target.value)}
                          className="mt-1 block w-full p-2 border border-slate-300 rounded-md"
                      />
                  </div>
                  <button
                      onClick={handleFacilitySave}
                      className={`w-full px-4 py-2 text-white text-sm font-semibold rounded-md transition-colors ${facilitySaveStatus === 'saved' ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                      {facilitySaveStatus === 'saved' ? '保存しました！' : '保存'}
                  </button>
              </div>
          )}
          {activeTab === 'drivers' && (
              <div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                      {drivers.map(driver => (
                          <div key={driver.id} className="bg-slate-50 p-3 rounded-md text-sm text-slate-700 flex justify-between items-center">
                              <div>
                                <p className="font-semibold">{driver.name}</p>
                                <p className="text-xs text-slate-500">{driver.email || 'メール未登録'}</p>
                              </div>
                              <div className="flex gap-1">
                                  <button onClick={() => handleOpenDriverModal(driver)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-slate-200" title="編集">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                                  </button>
                                  <button onClick={() => onDeleteDriver(driver.id)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-slate-200" title="削除">
                                      <TrashIcon className="h-4 w-4" />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                      <h4 className="font-bold text-slate-600 mb-2">新しい運転手を追加</h4>
                      <NewDriverForm onAdd={onAddDriver} />
                  </div>
              </div>
          )}
          {activeTab === 'vehicles' && (
              <div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                      {vehicles.map(vehicle => (
                           <div key={vehicle.id} className="bg-slate-50 p-3 rounded-md text-sm text-slate-700 flex justify-between items-center">
                             <div>
                                  <p className="font-semibold">{vehicle.model}</p>
                                  <p className="text-xs text-slate-500">{vehicle.licensePlate}</p>
                             </div>
                             <div className="flex gap-1">
                               <button onClick={() => handleOpenVehicleModal(vehicle)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-slate-200" title="編集">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                               </button>
                               <button onClick={() => onDeleteVehicle(vehicle.id)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-slate-200" title="削除">
                                  <TrashIcon className="h-4 w-4" />
                               </button>
                             </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                      <h4 className="font-bold text-slate-600 mb-2">新しい車両を追加</h4>
                      <NewVehicleForm onAdd={onAddVehicle} />
                  </div>
              </div>
          )}
          {activeTab === 'templates' && (
               <div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                      {routeTemplates.map(template => (
                          <div key={template.id} className="bg-slate-50 p-3 rounded-md text-sm text-slate-700 flex justify-between items-center">
                             <div>
                              <p className="font-semibold">{template.templateName}</p>
                              <p className="text-xs text-slate-500">{template.userIds.length}人の利用者</p>
                             </div>
                             <div className="flex gap-1">
                               <button onClick={() => handleOpenTemplateModal(template)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-slate-200" title="編集">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                               </button>
                               <button onClick={() => onDeleteTemplate(template.id)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-slate-200" title="削除">
                                  <TrashIcon className="h-4 w-4" />
                               </button>
                             </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                       <button onClick={() => handleOpenTemplateModal()} className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">
                          新しい個別ルートを追加
                       </button>
                  </div>
              </div>
          )}
          {activeTab === 'templateSets' && (
               <div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                      {templateSets.map(set => (
                          <div key={set.id} className="bg-slate-50 p-3 rounded-md text-sm text-slate-700 flex justify-between items-center">
                             <div>
                              <p className="font-semibold">{set.name}</p>
                              <p className="text-xs text-slate-500">{set.templateIds.length}件の個別ルート</p>
                             </div>
                             <div className="flex gap-1">
                               <button onClick={() => handleOpenTemplateSetModal(set)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-slate-200" title="編集">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                               </button>
                               <button onClick={() => onDeleteTemplateSet(set.id)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-slate-200" title="削除">
                                  <TrashIcon className="h-4 w-4" />
                               </button>
                             </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                       <button onClick={() => handleOpenTemplateSetModal()} className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">
                          新しいセットを追加
                       </button>
                  </div>
              </div>
          )}
          {activeTab === 'users' && (
               <div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                      {users.map(user => (
                          <div key={user.id} className="bg-slate-50 p-3 rounded-md text-sm text-slate-700 flex justify-between items-center">
                             <div className="flex items-center gap-3 overflow-hidden">
                              <img src={user.photoUrl} alt={user.name} className="w-10 h-10 rounded-full flex-shrink-0"/>
                              <div className="flex-grow overflow-hidden">
                                  <p className="font-semibold truncate">{user.name}</p>
                                  <p className="text-xs text-slate-500 truncate">{user.address}</p>
                                  {user.phone && <p className="text-xs text-slate-500 truncate">{user.phone}</p>}
                              </div>
                             </div>
                             <div className="flex gap-1 flex-shrink-0 ml-2">
                               <button onClick={() => handleOpenUserModal(user)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-slate-200" title="編集">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                               </button>
                               <button onClick={() => onDeleteUser(user.id)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-slate-200" title="削除">
                                  <TrashIcon className="h-4 w-4" />
                               </button>
                             </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                       <button onClick={() => handleOpenUserModal()} className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700">
                          新しい利用者を追加
                       </button>
                       <button onClick={handleImportClick} className="w-full px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700">
                          CSV/Excelからインポート
                       </button>
                       <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".csv,.xlsx,.xls" />
                       <p className="text-xs text-slate-500 text-center pt-1">
                          ヘッダー: <code>name</code>, <code>address</code>, <code>phone</code> (任意), <code>photoUrl</code> (任意)
                       </p>
                  </div>
              </div>
          )}
          {activeTab === 'backup' && (
            <div className="space-y-4 text-center">
                <h4 className="font-bold text-slate-600 mb-2">データのバックアップと復元</h4>
                <p className="text-sm text-slate-500 mb-4">
                    アプリケーションの全データ（利用者、送迎計画など）を一つのファイルとして保存したり、ファイルから復元したりできます。PCの買い替え時や、他のPCとのデータ同期にご利用ください。
                </p>
                <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
                    <h5 className="font-bold text-green-800">エクスポート（書き出し）</h5>
                    <p className="text-xs text-green-700 mt-1 mb-3">現在の全データをJSONファイルとしてダウンロードします。</p>
                    <button
                        onClick={handleExportData}
                        className="w-full px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700"
                    >
                        データをエクスポート
                    </button>
                </div>
                <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
                    <h5 className="font-bold text-red-800">インポート（読み込み）</h5>
                    <p className="text-xs text-red-700 mt-1 mb-3">
                        <span className="font-bold">注意：</span>
                        インポートを実行すると、現在のデータはすべて上書きされます。
                    </p>
                    <button
                        onClick={handleImportDataClick}
                        className="w-full px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700"
                    >
                        データをインポート
                    </button>
                    <input
                        type="file"
                        ref={backupFileInputRef}
                        onChange={handleFileImport}
                        style={{ display: 'none' }}
                        accept="application/json,.json"
                    />
                </div>
            </div>
          )}
        </div>
      </div>
      <TemplateFormModal 
        isOpen={isTemplateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSave={onAddTemplate}
        onUpdate={onUpdateTemplate}
        users={users}
        drivers={drivers}
        vehicles={vehicles}
        templateToEdit={templateToEdit}
      />
      <TemplateSetFormModal
        isOpen={isTemplateSetModalOpen}
        onClose={() => setTemplateSetModalOpen(false)}
        onSave={onAddTemplateSet}
        onUpdate={onUpdateTemplateSet}
        routeTemplates={routeTemplates}
        setToEdit={templateSetToEdit}
      />
      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={() => setUserModalOpen(false)}
        onSave={onUpdateUser}
        onAdd={onAddUser}
        userToEdit={userToEdit}
      />
      <DriverFormModal
        isOpen={isDriverModalOpen}
        onClose={() => setDriverModalOpen(false)}
        onSave={onUpdateDriver}
        driverToEdit={driverToEdit}
      />
      <VehicleFormModal
        isOpen={isVehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        onSave={onUpdateVehicle}
        vehicleToEdit={vehicleToEdit}
      />
    </>
  );
};

export default DataManager;