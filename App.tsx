

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import pako from 'pako';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { USERS, DRIVERS, VEHICLES, ROUTE_TEMPLATES, TEMPLATE_SETS, DAY_SERVICE_CENTER } from './constants';
import type { User, RouteType, Driver, Vehicle, DailySchedule, Route, RouteTemplate, Facility, TemplateSet, Trip } from './types';
import Header from './components/Header';
import DataManager from './components/DataManager';
import CalendarView from './components/CalendarView';
import RoutePlanner from './components/RoutePlanner';
import DriverView from './components/DriverView';
import { optimizeRoute } from './services/geminiService';
import UserList from './components/UserList';
import { PlusCircleIcon } from './components/icons/PlusCircleIcon';
import PrintView from './components/PrintView';
import DailySummaryPrintView from './components/DailySummaryPrintView';
import { CollectionIcon } from './components/icons/CollectionIcon';
import { ViewGridIcon } from './components/icons/ViewGridIcon';
import { PrintIcon } from './components/icons/PrintIcon';


const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const savedItem = localStorage.getItem(key);
    return savedItem ? JSON.parse(savedItem) : defaultValue;
  } catch (error) {
    console.error(`Failed to parse ${key} from localStorage`, error);
    return defaultValue;
  }
};

const generateQrCodeDataUrl = async (
    trip: Trip,
    date: string,
    facility: Facility,
    routeType: 'morning' | 'afternoon',
    routeName: string,
): Promise<string | null> => {
    if (trip.users.length === 0) return null;

    // Encode a minimal, self-contained representation of the trip.
    const minimalUsers = trip.users.map(u => ({
        id: u.id,
        name: u.name,
        address: u.address,
        phone: u.phone,
        desiredTime: u.desiredTime,
    }));
    
    const dataToEncode = {
        users: minimalUsers,
        tripId: trip.id,
        departureTime: trip.departureTime,
        routeType: routeType,
        date: date,
        facility: facility,
        routeName: routeName,
    };

    try {
        const json = JSON.stringify(dataToEncode);
        const compressed = pako.deflate(json);
        const binaryString = String.fromCharCode.apply(null, compressed as any);
        const base64 = btoa(binaryString);
        
        const url = new URL(window.location.href);
        url.hash = `#data=${base64}`;

        return await QRCode.toDataURL(url.toString(), { 
            width: 256,
            margin: 2,
            errorCorrectionLevel: 'M' // M is a good balance for density vs. reliability
        });
    } catch (e) {
        console.error("Failed to generate QR code data URL", e);
        return null;
    }
};


export default function App() {
  const [users, setUsers] = useState<User[]>(() => loadFromLocalStorage('app_users', USERS));
  const [drivers, setDrivers] = useState<Driver[]>(() => loadFromLocalStorage('app_drivers', DRIVERS));
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => loadFromLocalStorage('app_vehicles', VEHICLES));
  const [routeTemplates, setRouteTemplates] = useState<RouteTemplate[]>(() => loadFromLocalStorage('app_route_templates', ROUTE_TEMPLATES));
  const [templateSets, setTemplateSets] = useState<TemplateSet[]>(() => loadFromLocalStorage('app_template_sets', TEMPLATE_SETS));
  const [facility, setFacility] = useState<Facility>(() => loadFromLocalStorage('app_facility', DAY_SERVICE_CENTER));
  const [schedules, setSchedules] = useState<Record<string, DailySchedule>>(() => loadFromLocalStorage('app_schedules', {}));

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'planner' | 'driver'>('planner');
  const [activeDriverInfo, setActiveDriverInfo] = useState<{trip: Trip, type: RouteType, routeId: number, routeName: string} | null>(null);
  
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [isSummaryPrintMenuOpen, setSummaryPrintMenuOpen] = useState(false);
  const summaryPrintMenuRef = useRef<HTMLDivElement>(null);


  const [sharedRouteInfo, setSharedRouteInfo] = useState<{
    trip: Trip;
    routeType: RouteType;
    facility: Facility;
    date: string;
    routeName: string;
  } | null>(null);
  
  const [summaryPrintRequest, setSummaryPrintRequest] = useState<{
      schedule: DailySchedule,
      method: 'pdf' | 'print',
      printType: 'morning' | 'afternoon' | 'both',
  } | null>(null);

  useEffect(() => { localStorage.setItem('app_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('app_drivers', JSON.stringify(drivers)); }, [drivers]);
  useEffect(() => { localStorage.setItem('app_vehicles', JSON.stringify(vehicles)); }, [vehicles]);
  useEffect(() => { localStorage.setItem('app_route_templates', JSON.stringify(routeTemplates)); }, [routeTemplates]);
  useEffect(() => { localStorage.setItem('app_template_sets', JSON.stringify(templateSets)); }, [templateSets]);
  useEffect(() => { localStorage.setItem('app_facility', JSON.stringify(facility)); }, [facility]);
  useEffect(() => { localStorage.setItem('app_schedules', JSON.stringify(schedules)); }, [schedules]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (summaryPrintMenuRef.current && !summaryPrintMenuRef.current.contains(event.target as Node)) {
            setSummaryPrintMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedSchedule = useMemo(() => {
    if (!selectedDate) return null;
    const key = formatDateKey(selectedDate);
    return schedules[key] || null;
  }, [selectedDate, schedules]);

  useEffect(() => {
    const handleHashChange = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#data=')) {
            try {
                const base64 = hash.substring(6);
                
                const binaryString = atob(base64);
                const compressed = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    compressed[i] = binaryString.charCodeAt(i);
                }
                const json = pako.inflate(compressed, { to: 'string' });
                const data = JSON.parse(json);

                // Check for the new data structure with embedded user objects.
                if (data.users && Array.isArray(data.users) && data.routeType && data.facility && data.date && data.routeName) {
                    
                    // The user data is self-contained in the payload. We just add fields needed for the driver view state.
                    const tripUsers: User[] = data.users.map((u: any) => ({
                        // Data from payload
                        id: u.id,
                        name: u.name,
                        address: u.address,
                        phone: u.phone,
                        desiredTime: u.desiredTime,
                        // Default fields for driver view state
                        photoUrl: `https://picsum.photos/seed/user${u.id}/100/100`,
                        pickupStatus: 'pending' as const,
                        attendanceDays: undefined, // Not needed in driver view
                    }));

                    const hydratedTrip: Trip = {
                        id: data.tripId,
                        departureTime: data.departureTime,
                        users: tripUsers,
                    };
                    
                    setSharedRouteInfo({
                        trip: hydratedTrip,
                        routeType: data.routeType,
                        facility: data.facility,
                        date: data.date,
                        routeName: data.routeName
                    });
                    setView('driver');
                     // Clear the hash to prevent re-triggering if the user refreshes.
                    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
                } else {
                    throw new Error("Invalid or outdated QR code data.");
                }
            } catch (e) {
                console.error("Error parsing shared data:", e);
                alert("共有データの読み込みに失敗しました。QRコードを再スキャンしてください。");
                // Clear the hash to prevent re-triggering on a bad link.
                window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
            }
        }
    };

    window.addEventListener('hashchange', handleHashChange, false);
    handleHashChange(); // Check hash on initial load

    return () => {
        window.removeEventListener('hashchange', handleHashChange, false);
    };
  }, []); // This effect should only run once on mount and not depend on changing state like `users`
  
  useEffect(() => {
    if (!summaryPrintRequest) return;

    const dateKey = summaryPrintRequest.schedule.date;
    setIsLoading(prev => ({ ...prev, [dateKey]: true }));

    const generateDocument = async () => {
        const printElement = document.getElementById('print-mount-point');
        if (!printElement) {
            console.error("Print mount point not found");
            setError("印刷の準備に失敗しました。");
            setIsLoading(prev => ({ ...prev, [dateKey]: false }));
            setSummaryPrintRequest(null);
            return;
        }

        const root = createRoot(printElement);
        try {
            flushSync(() => {
                root.render(
                    <DailySummaryPrintView
                        schedule={summaryPrintRequest.schedule}
                        drivers={drivers}
                        vehicles={vehicles}
                        printType={summaryPrintRequest.printType}
                    />
                );
            });
            
            // Add a small delay to ensure the browser has painted the new content.
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const typeSuffix = { morning: '午前', afternoon: '午後', both: '両方' }[summaryPrintRequest.printType];

            if (summaryPrintRequest.method === 'pdf') {
                const canvas = await html2canvas(printElement.firstChild as HTMLElement, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4'
                });
                
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                const dateStr = summaryPrintRequest.schedule.date.replace(/-/g, '');
                pdf.save(`送迎業務一覧_${dateStr}_${typeSuffix}.pdf`);
            } else { // Direct Print
                const printContentHTML = printElement.innerHTML;
                const printWindow = window.open('', '_blank', 'height=800,width=1200');
                if (!printWindow) throw new Error('ポップアップがブロックされました。');
                
                printWindow.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/><title>送迎業務一覧 (${typeSuffix})</title><script src="https://cdn.tailwindcss.com"></script><style>body { font-family: 'Noto Sans JP', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; } @media print { @page { size: A4 landscape; margin: 15mm; } }</style></head><body>${printContentHTML}</body></html>`);
                printWindow.document.close();
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.focus();
                        printWindow.print();
                        printWindow.close();
                    }, 250);
                };
            }
        } catch (e: any) {
            console.error("Document generation failed:", e);
            setError(e.message || "印刷またはPDFの生成に失敗しました。");
        } finally {
            root.unmount();
            setIsLoading(prev => ({ ...prev, [dateKey]: false }));
            setSummaryPrintRequest(null);
        }
    };
    
    generateDocument();
  }, [summaryPrintRequest, drivers, vehicles]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const key = formatDateKey(date);
    if (!schedules[key]) {
      setSchedules(prev => ({
        ...prev,
        [key]: {
          date: key,
          routes: [],
        },
      }));
    }
  };
  
  const updateScheduleForDate = (dateKey: string, updatedSchedule: Partial<DailySchedule>) => {
    setSchedules(prev => {
        const existingSchedule = prev[dateKey] || { date: dateKey, routes: [] };
        return {
            ...prev,
            [dateKey]: {
                ...existingSchedule,
                ...updatedSchedule
            }
        };
    });
  };

  const handleApplyTemplates = (templateIds: number[]) => {
    if (!selectedDate) return;
    const dateKey = formatDateKey(selectedDate);
    const schedule = schedules[dateKey];
    if (!schedule) return;

    const usersAlreadyInRoutes = new Set(
        schedule.routes.flatMap(r => [...r.morningTrips, ...r.afternoonTrips]).flatMap(t => t.users).map(u => u.id)
    );

    const newRoutes: Route[] = [];
    const skippedUsers: string[] = [];

    templateIds.forEach(templateId => {
        const template = routeTemplates.find(t => t.id === templateId);
        if (!template) return;

        const usersForThisRoute = template.userIds
            .map(id => users.find(u => u.id === id))
            .filter((u): u is User => u !== undefined)
            .filter(u => {
                if (usersAlreadyInRoutes.has(u.id)) {
                    if (!skippedUsers.includes(u.name)) {
                        skippedUsers.push(u.name);
                    }
                    return false;
                }
                usersAlreadyInRoutes.add(u.id);
                return true;
            })
            .map(u => ({ ...u, pickupStatus: 'pending' as const, desiredTime: '', remarks: '' }));

        if (usersForThisRoute.length > 0 || template.userIds.length === 0) {
            const newTrip: Trip = {
                id: Date.now() + Math.random(),
                departureTime: "08:30",
                users: usersForThisRoute,
            };
            const newAfternoonTrip: Trip = {
                ...newTrip,
                id: Date.now() + Math.random(),
                departureTime: "16:00",
            };

            const newRoute: Route = {
                id: Date.now() + newRoutes.length,
                name: template.routeName || `ルート ${schedule.routes.length + newRoutes.length + 1}`,
                driverId: template.driverId,
                vehicleId: template.vehicleId,
                morningTrips: [newTrip],
                afternoonTrips: [newAfternoonTrip],
                remarks: '',
            };
            newRoutes.push(newRoute);
        }
    });

    if (newRoutes.length > 0) {
        updateScheduleForDate(dateKey, { routes: [...schedule.routes, ...newRoutes] });
    }
    
    if (skippedUsers.length > 0) {
        setError(`以下の利用者は既に他のルートに追加されていたため、スキップされました: ${skippedUsers.join(', ')}`);
        setTimeout(() => setError(null), 5000);
    }

    setTemplateModalOpen(false);
  };
  
  const handleDeleteRoute = (routeId: number) => {
      if(!selectedDate) return;
      const dateKey = formatDateKey(selectedDate);
      const schedule = schedules[dateKey];
      updateScheduleForDate(dateKey, { routes: schedule.routes.filter(r => r.id !== routeId) });
  };
  
  const handleUpdateRoute = (updatedRoute: Route) => {
      if (!selectedDate) return;
      const dateKey = formatDateKey(selectedDate);
      const schedule = schedules[dateKey];
      const newRoutes = schedule.routes.map(r => r.id === updatedRoute.id ? updatedRoute : r);
      updateScheduleForDate(dateKey, { routes: newRoutes });
  };

  const handleDropInTrip = useCallback((userId: number, routeType: RouteType, routeId: number, tripId: number) => {
    if (!selectedDate) return;

    const userToAdd = users.find(u => u.id === userId);
    if (!userToAdd) return;
    
    const dateKey = formatDateKey(selectedDate);
    const schedule = schedules[dateKey];
    if(!schedule) return;

    const isAlreadyInAnyRoute = schedule.routes.flatMap(r => [...r.morningTrips, ...r.afternoonTrips]).flatMap(t => t.users).some(u => u.id === userId);
    
    if(isAlreadyInAnyRoute) {
        setError('この利用者はすでに追加されています。');
        setTimeout(() => setError(null), 3000);
        return;
    }

    const route = schedule.routes.find(r => r.id === routeId);
    if(!route) return;
    
    const trips = routeType === 'morning' ? route.morningTrips : route.afternoonTrips;
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    const userWithStatus = { ...userToAdd, pickupStatus: 'pending' as const, desiredTime: '', remarks: '' };
    const updatedTrip = { ...trip, users: [...trip.users, userWithStatus] };
    
    const updatedTrips = trips.map(t => t.id === tripId ? updatedTrip : t);
    
    const updatedRoute = { ...route };
    if (routeType === 'morning') {
      updatedRoute.morningTrips = updatedTrips;
    } else {
      updatedRoute.afternoonTrips = updatedTrips;
    }
    handleUpdateRoute(updatedRoute);

  }, [selectedDate, schedules, users]);

  const handleRemoveFromTrip = (userId: number, routeType: RouteType, routeId: number, tripId: number) => {
    if (!selectedDate) return;
    const dateKey = formatDateKey(selectedDate);
    const schedule = schedules[dateKey];
    if (!schedule) return;
    
    const route = schedule.routes.find(r => r.id === routeId);
    if (!route) return;

    const trips = routeType === 'morning' ? route.morningTrips : route.afternoonTrips;
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    
    const updatedTrip = { ...trip, users: trip.users.filter(u => u.id !== userId) };
    const updatedTrips = trips.map(t => t.id === tripId ? updatedTrip : t);
    
    const updatedRoute = { ...route };
    if (routeType === 'morning') {
        updatedRoute.morningTrips = updatedTrips;
    } else {
        updatedRoute.afternoonTrips = updatedTrips;
    }
    handleUpdateRoute(updatedRoute);
  };
  
  const handleOptimizeTrip = async (routeType: RouteType, routeId: number, tripId: number) => {
    if (!selectedDate) return;
    setError(null);
    const loadingKey = `${routeId}-${tripId}`;
    setIsLoading(prev => ({...prev, [loadingKey]: true}));

    const dateKey = formatDateKey(selectedDate);
    const schedule = schedules[dateKey];
    const route = schedule?.routes.find(r => r.id === routeId);

    if (!route) {
      setIsLoading(prev => ({...prev, [loadingKey]: false}));
      return;
    }

    const trips = routeType === 'morning' ? route.morningTrips : route.afternoonTrips;
    const trip = trips.find(t => t.id === tripId);

    if (!trip || trip.users.length < 2) {
      setError('最適化するには少なくとも2人の利用者が必要です。');
      setIsLoading(prev => ({...prev, [loadingKey]: false}));
      return;
    }

    try {
      const optimizedOrder = await optimizeRoute(trip.users, facility, routeType);
      
      const userMap = new Map(trip.users.map(u => [u.name, u]));
      const reorderedUsers = optimizedOrder
        .map(name => userMap.get(name))
        .filter((u): u is User => u !== undefined);
      
      const updatedTrip = { ...trip, users: reorderedUsers };
      const updatedTrips = trips.map(t => t.id === tripId ? updatedTrip : t);
      
      const updatedRoute = { ...route };
      if (routeType === 'morning') {
        updatedRoute.morningTrips = updatedTrips;
      } else {
        updatedRoute.afternoonTrips = updatedTrips;
      }
      handleUpdateRoute(updatedRoute);

    } catch (e) {
      console.error(e);
      setError('ルートの最適化中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(prev => ({...prev, [loadingKey]: false}));
    }
  };

  const startDriverModeForTrip = (routeType: RouteType, routeId: number, tripId: number) => {
    if (!selectedSchedule) return;
    const route = selectedSchedule.routes.find(r => r.id === routeId);
    if (!route) return;

    const trips = routeType === 'morning' ? route.morningTrips : route.afternoonTrips;
    const trip = trips.find(t => t.id === tripId);
    
    if (trip && trip.users.length > 0) {
      setActiveDriverInfo({ trip, type: routeType, routeId, routeName: route.name });
      setView('driver');
    } else {
      setError(`${routeType === 'morning' ? 'この午前' : 'この午後'}の便に利用者がいません。`);
    }
  };
  
  const handleDriverRouteUpdate = (updatedTrip: Trip) => {
      if(!selectedDate || !activeDriverInfo) return;
      
      const { routeId, type } = activeDriverInfo;
      const dateKey = formatDateKey(selectedDate);
      const schedule = schedules[dateKey];
      const route = schedule.routes.find(r => r.id === routeId);
      if(!route) return;
      
      const trips = type === 'morning' ? route.morningTrips : route.afternoonTrips;
      const updatedTrips = trips.map(t => t.id === updatedTrip.id ? updatedTrip : t);

      const updatedRoute = {...route};
      if (type === 'morning') {
          updatedRoute.morningTrips = updatedTrips;
      } else {
          updatedRoute.afternoonTrips = updatedTrips;
      }
      handleUpdateRoute(updatedRoute);
      setActiveDriverInfo(prev => prev ? {...prev, trip: updatedTrip} : null);
  };

  const handleUpdateFacility = (updatedFacility: Facility) => {
    setFacility(updatedFacility);
  };
  
  const handleAddDriver = (name: string, email: string) => {
    setDrivers(prev => [...prev, { id: Date.now(), name, email }]);
  };

  const handleUpdateDriver = (updatedDriver: Driver) => {
    setDrivers(prev => prev.map(d => d.id === updatedDriver.id ? updatedDriver : d));
  };
  
  const handleDeleteDriver = (driverId: number) => {
      if (window.confirm('この運転手を削除しますか？関連する送迎計画から割り当てが解除されます。')) {
          setDrivers(prev => prev.filter(d => d.id !== driverId));
          const newSchedules = { ...schedules };
          Object.keys(newSchedules).forEach(dateKey => {
              const schedule = newSchedules[dateKey];
              schedule.routes = schedule.routes.map(route => {
                  if (route.driverId === driverId) {
                      return { ...route, driverId: undefined };
                  }
                  return route;
              });
          });
          setSchedules(newSchedules);
      }
  };

  const handleAddVehicle = (model: string, licensePlate: string) => {
    setVehicles(prev => [...prev, { id: Date.now(), model, licensePlate }]);
  };

  const handleUpdateVehicle = (updatedVehicle: Vehicle) => {
      setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
  };

  const handleDeleteVehicle = (vehicleId: number) => {
      if (window.confirm('この車両を削除しますか？関連する送迎計画から割り当てが解除されます。')) {
          setVehicles(prev => prev.filter(v => v.id !== vehicleId));
          const newSchedules = { ...schedules };
          Object.keys(newSchedules).forEach(dateKey => {
              const schedule = newSchedules[dateKey];
              schedule.routes = schedule.routes.map(route => {
                  if (route.vehicleId === vehicleId) {
                      return { ...route, vehicleId: undefined };
                  }
                  return route;
              });
          });
          setSchedules(newSchedules);
      }
  };

  const handleAddTemplate = (template: Omit<RouteTemplate, 'id'>) => {
    const newTemplate: RouteTemplate = { ...template, id: Date.now() };
    setRouteTemplates(prev => [...prev, newTemplate]);
  };

  const handleUpdateTemplate = (updatedTemplate: RouteTemplate) => {
    setRouteTemplates(prev => prev.map(p => p.id === updatedTemplate.id ? updatedTemplate : p));
  };
  
  const handleDeleteTemplate = (templateId: number) => {
    setRouteTemplates(prev => prev.filter(p => p.id !== templateId));
    setTemplateSets(prev => prev.map(ts => ({
        ...ts,
        templateIds: ts.templateIds.filter(id => id !== templateId)
    })));
  };

  const handleAddTemplateSet = (templateSet: Omit<TemplateSet, 'id'>) => {
    const newSet: TemplateSet = { ...templateSet, id: Date.now() };
    setTemplateSets(prev => [...prev, newSet]);
  };

  const handleUpdateTemplateSet = (updatedSet: TemplateSet) => {
    setTemplateSets(prev => prev.map(ts => ts.id === updatedSet.id ? updatedSet : ts));
  };

  const handleDeleteTemplateSet = (templateSetId: number) => {
    setTemplateSets(prev => prev.filter(ts => ts.id !== templateSetId));
  };
  
  const handleAddUser = (name: string, address: string, photoUrl: string, phone: string, attendanceDays: User['attendanceDays']) => {
    const newUser: User = { 
      id: Date.now(), 
      name, 
      address, 
      phone,
      photoUrl: photoUrl || `https://picsum.photos/seed/user${Date.now()}/100/100`,
      attendanceDays,
    };
    setUsers(prev => [...prev, newUser]);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    
    const newSchedules = { ...schedules };
    Object.keys(newSchedules).forEach(dateKey => {
      const schedule = newSchedules[dateKey];
      schedule.routes = schedule.routes.map(route => ({
        ...route,
        morningTrips: route.morningTrips.map(trip => ({
            ...trip,
            users: trip.users.map(u => u.id === updatedUser.id ? {...updatedUser, pickupStatus: u.pickupStatus, desiredTime: u.desiredTime, remarks: u.remarks } : u)
        })),
        afternoonTrips: route.afternoonTrips.map(trip => ({
            ...trip,
            users: trip.users.map(u => u.id === updatedUser.id ? {...updatedUser, pickupStatus: u.pickupStatus, desiredTime: u.desiredTime, remarks: u.remarks } : u)
        })),
      }));
    });
    setSchedules(newSchedules);
  };
  
  const handleDeleteUser = (userId: number) => {
    if (window.confirm('この利用者を削除しますか？関連する全ての送迎計画からも削除されます。')) {
      const newSchedules = { ...schedules };
      Object.keys(newSchedules).forEach(dateKey => {
        const schedule = newSchedules[dateKey];
        schedule.routes = schedule.routes.map(route => ({
          ...route,
          morningTrips: route.morningTrips.map(trip => ({ ...trip, users: trip.users.filter(u => u.id !== userId) })),
          afternoonTrips: route.afternoonTrips.map(trip => ({ ...trip, users: trip.users.filter(u => u.id !== userId) })),
        }));
      });
      setSchedules(newSchedules);
      
      setUsers(prev => prev.filter(u => u.id !== userId));

      setRouteTemplates(prev => prev.map(p => ({
        ...p,
        userIds: p.userIds.filter(id => id !== userId)
      })));
    }
  };

  const handleUserDoubleClick = (userId: number) => {
    if (!selectedDate || !selectedSchedule) {
      setError("初めにカレンダーから日付を選択してください。");
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (selectedSchedule.routes.length === 0 || selectedSchedule.routes.every(r => r.morningTrips.length === 0 && r.afternoonTrips.length === 0)) {
      setError("利用者を追加するには、まず「テンプレートからルートを追加」ボタンで送迎ルートと便を作成してください。");
      setTimeout(() => setError(null), 5000);
      return;
    }

    const userToAdd = users.find(u => u.id === userId);
    if (!userToAdd) return;

    const isAlreadyInAnyRoute = selectedSchedule.routes.flatMap(r => [...r.morningTrips, ...r.afternoonTrips]).flatMap(t => t.users).some(u => u.id === userId);
    
    if(isAlreadyInAnyRoute) {
        setError('この利用者はすでに追加されています。');
        setTimeout(() => setError(null), 3000);
        return;
    }
    
    const firstRoute = selectedSchedule.routes[0];
    if (!firstRoute) return;

    const userWithStatus = { ...userToAdd, pickupStatus: 'pending' as const, desiredTime: '', remarks: '' };
    const updatedRoute = { ...firstRoute };
    let added = false;
    
    if (firstRoute.morningTrips.length > 0) {
      const firstTrip = firstRoute.morningTrips[0];
      const updatedUsers = [...firstTrip.users, userWithStatus];
      updatedRoute.morningTrips = [ { ...firstTrip, users: updatedUsers }, ...firstRoute.morningTrips.slice(1) ];
      added = true;
    }
    if (firstRoute.afternoonTrips.length > 0) {
        const firstTrip = firstRoute.afternoonTrips[0];
        const updatedUsers = [...firstTrip.users, userWithStatus];
        updatedRoute.afternoonTrips = [ { ...firstTrip, users: updatedUsers }, ...firstRoute.afternoonTrips.slice(1) ];
        added = true;
    }

    if (added) {
      handleUpdateRoute(updatedRoute);
    } else {
      setError("追加先の便がありません。ルートに便を追加してください。");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handlePrintRoute = async (routeToPrint: Route, printType: 'morning' | 'afternoon' | 'both', method: 'pdf' | 'print') => {
    if (!selectedSchedule) return;
    setIsLoading(prev => ({ ...prev, [routeToPrint.id]: true }));

    const printElement = document.getElementById('print-mount-point');
    if (!printElement) {
        setError("印刷の準備に失敗しました。");
        setIsLoading(prev => ({ ...prev, [routeToPrint.id]: false }));
        return;
    }
    
    const root = createRoot(printElement);

    try {
        const generateQrsForTrips = (trips: Trip[], routeType: RouteType): Promise<(string | null)[]> => {
            return Promise.all(
                trips.map(trip => generateQrCodeDataUrl(trip, selectedSchedule.date, facility, routeType, routeToPrint.name))
            );
        };

        const morningQrCodeUrls = (printType === 'morning' || printType === 'both') && routeToPrint.morningTrips.length > 0
            ? await generateQrsForTrips(routeToPrint.morningTrips, 'morning')
            : [];
        
        const afternoonQrCodeUrls = (printType === 'afternoon' || printType === 'both') && routeToPrint.afternoonTrips.length > 0
            ? await generateQrsForTrips(routeToPrint.afternoonTrips, 'afternoon')
            : [];

        // Render the component synchronously
        flushSync(() => {
            root.render(
                <PrintView
                    route={routeToPrint}
                    schedule={selectedSchedule}
                    drivers={drivers}
                    vehicles={vehicles}
                    facility={facility}
                    printType={printType}
                    morningQrCodeUrls={morningQrCodeUrls}
                    afternoonQrCodeUrls={afternoonQrCodeUrls}
                />
            );
        });
        
        // Add a small delay to ensure the browser has painted the new content.
        await new Promise(resolve => setTimeout(resolve, 100));

        if (method === 'pdf') {
            const canvas = await html2canvas(printElement.firstChild as HTMLElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

            const dateStr = selectedSchedule.date.replace(/-/g, '');
            const fileName = `送迎確認票_${dateStr}_${routeToPrint.name.replace(/\s/g, '')}_${printType}.pdf`;
            pdf.save(fileName);
        } else { // Direct Print
            const printContentHTML = printElement.innerHTML;
            const printWindow = window.open('', '_blank', 'height=800,width=1200');
            if (!printWindow) throw new Error('ポップアップがブロックされました。');
            
            printWindow.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/><title>印刷 - ${routeToPrint.name}</title><script src="https://cdn.tailwindcss.com"></script><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet"><style>body { font-family: 'Noto Sans JP', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; } @media print { @page { size: A4 portrait; margin: 15mm; } }</style></head><body>${printContentHTML}</body></html>`);
            printWindow.document.close();
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                }, 250);
            };
        }
    } catch(e: any) {
        console.error("Printing failed:", e);
        setError(e.message || '印刷の準備中にエラーが発生しました。');
    } finally {
        root.unmount();
        setIsLoading(prev => ({ ...prev, [routeToPrint.id]: false }));
    }
  };
  
    const handlePrintDailySummary = (method: 'pdf' | 'print', printType: 'morning' | 'afternoon' | 'both') => {
        if (selectedSchedule) {
            setSummaryPrintRequest({ schedule: selectedSchedule, method, printType });
        }
    };

  const handleImportUsers = (importedUsers: { name: string; address: string; phone: string; photoUrl: string }[]) => {
    const newUsers: User[] = importedUsers.map((iu, index) => ({
        id: Date.now() + index,
        name: iu.name,
        address: iu.address,
        phone: iu.phone,
        photoUrl: iu.photoUrl || `https://picsum.photos/seed/user${Date.now() + index}/100/100`,
        attendanceDays: { sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false },
    }));

    setUsers(prev => [...prev, ...newUsers]);
    alert(`${newUsers.length}人の利用者をインポートしました。`);
  };
  
  const handleRestoreAllData = (data: any) => {
    if (!data.users || !data.drivers || !data.vehicles || !data.routeTemplates || !data.templateSets || !data.schedules || !data.facility) {
      alert('無効なバックアップファイルです。ファイルの形式が正しくありません。');
      return;
    }

    if (window.confirm('現在のすべてのデータを上書きして、バックアップから復元します。よろしいですか？この操作は元に戻せません。')) {
      try {
        setUsers(data.users);
        setDrivers(data.drivers);
        setVehicles(data.vehicles);
        setRouteTemplates(data.routeTemplates);
        setTemplateSets(data.templateSets);
        setSchedules(data.schedules);
        setFacility(data.facility);
        setSelectedDate(null);
        alert('データの復元が完了しました。');
      } catch (e) {
        console.error("Failed to restore data:", e);
        alert('データの復元中にエラーが発生しました。コンソールを確認してください。');
      }
    }
  };

  const renderDriverView = () => {
    if (sharedRouteInfo) {
      return (
        <DriverView
          trip={sharedRouteInfo.trip}
          routeType={sharedRouteInfo.routeType}
          facility={sharedRouteInfo.facility}
          date={sharedRouteInfo.date}
          routeName={sharedRouteInfo.routeName}
          onExit={() => { setSharedRouteInfo(null); setView('planner'); }}
          onRouteUpdate={(updatedTrip) => {
            setSharedRouteInfo(prev => prev ? { ...prev, trip: updatedTrip } : null);
          }}
        />
      );
    }
    if (activeDriverInfo) {
      const schedule = selectedDate ? schedules[formatDateKey(selectedDate)] : null;
      return (
        <DriverView
          trip={activeDriverInfo.trip}
          routeType={activeDriverInfo.type}
          facility={facility}
          date={schedule?.date}
          routeName={activeDriverInfo.routeName}
          onExit={() => setView('planner')}
          onRouteUpdate={handleDriverRouteUpdate}
        />
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <TemplateSelectionModal
        isOpen={isTemplateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onApply={handleApplyTemplates}
        templates={routeTemplates}
        templateSets={templateSets}
        drivers={drivers}
        vehicles={vehicles}
        selectedDate={selectedDate}
      />
      <Header />
      <main className="p-4 md:p-8">
        {view === 'planner' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 xl:col-span-3">
              <div className="sticky top-8 flex flex-col gap-8">
                <UserList users={users} onUserDoubleClick={handleUserDoubleClick} />
                <DataManager
                  drivers={drivers}
                  vehicles={vehicles}
                  routeTemplates={routeTemplates}
                  templateSets={templateSets}
                  users={users}
                  facility={facility}
                  schedules={schedules}
                  onUpdateFacility={handleUpdateFacility}
                  onAddDriver={handleAddDriver}
                  onUpdateDriver={handleUpdateDriver}
                  onDeleteDriver={handleDeleteDriver}
                  onAddVehicle={handleAddVehicle}
                  onUpdateVehicle={handleUpdateVehicle}
                  onDeleteVehicle={handleDeleteVehicle}
                  onAddTemplate={handleAddTemplate}
                  onUpdateTemplate={handleUpdateTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  onAddTemplateSet={handleAddTemplateSet}
                  onUpdateTemplateSet={handleUpdateTemplateSet}
                  onDeleteTemplateSet={handleDeleteTemplateSet}
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onImportUsers={handleImportUsers}
                  onRestoreAllData={handleRestoreAllData}
                />
              </div>
            </div>
            <div className="lg:col-span-8 xl:col-span-9">
              <CalendarView
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                onDateSelect={handleDateSelect}
                selectedDate={selectedDate}
                schedules={schedules}
              />
              {selectedDate && selectedSchedule ? (
                <div className="mt-8 animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-700">
                        {selectedDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} の送迎計画
                    </h3>
                    <div className="flex items-center gap-2">
                         <div className="relative" ref={summaryPrintMenuRef}>
                            <button
                                onClick={() => setSummaryPrintMenuOpen(p => !p)}
                                disabled={isLoading[formatDateKey(selectedDate)] || selectedSchedule.routes.length === 0}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition-colors shadow-sm border border-slate-300 disabled:opacity-50"
                                title="この日の全ルート概要を印刷します"
                            >
                                <PrintIcon className="w-5 h-5"/>
                                {isLoading[formatDateKey(selectedDate)] ? '準備中...' : '本日の全ルートを印刷'}
                            </button>
                            {isSummaryPrintMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 animate-fade-in-up ring-1 ring-black ring-opacity-5">
                                    <div className="py-1">
                                        <div className="px-4 pt-2 pb-1 text-xs text-slate-500">午前のお迎え</div>
                                        <a href="#" onClick={(e) => { e.preventDefault(); handlePrintDailySummary('pdf', 'morning'); setSummaryPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">PDFで保存</a>
                                        <a href="#" onClick={(e) => { e.preventDefault(); handlePrintDailySummary('print', 'morning'); setSummaryPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">印刷する</a>
                                        <div className="border-t my-1"></div>
                                        <div className="px-4 pt-1 pb-1 text-xs text-slate-500">午後のお送り</div>
                                        <a href="#" onClick={(e) => { e.preventDefault(); handlePrintDailySummary('pdf', 'afternoon'); setSummaryPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">PDFで保存</a>
                                        <a href="#" onClick={(e) => { e.preventDefault(); handlePrintDailySummary('print', 'afternoon'); setSummaryPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">印刷する</a>
                                        <div className="border-t my-1"></div>
                                        <div className="px-4 pt-1 pb-1 text-xs text-slate-500">両方</div>
                                        <a href="#" onClick={(e) => { e.preventDefault(); handlePrintDailySummary('pdf', 'both'); setSummaryPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">PDFで保存</a>
                                        <a href="#" onClick={(e) => { e.preventDefault(); handlePrintDailySummary('print', 'both'); setSummaryPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">印刷する</a>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => setTemplateModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            title="保存済みのテンプレートから、この曜日の送迎ルートを一括で作成します。"
                        >
                          <PlusCircleIcon className="w-5 h-5"/>
                          テンプレートからルートを追加
                        </button>
                    </div>
                  </div>
                  
                  {selectedSchedule.routes.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl shadow-lg border-2 border-dashed border-slate-300">
                            <p className="text-slate-500">送迎ルートがありません。</p>
                            <p className="text-slate-500 mt-1">上のボタンから、テンプレートを使ってルートを追加してください。</p>
                        </div>
                  )}
                  <div className="space-y-8">
                    {selectedSchedule.routes.map(route => (
                      <RoutePlanner
                        key={route.id}
                        route={route}
                        drivers={drivers}
                        vehicles={vehicles}
                        selectedDate={selectedDate}
                        facility={facility}
                        onUpdate={handleUpdateRoute}
                        onDelete={handleDeleteRoute}
                        onDropInTrip={handleDropInTrip}
                        onRemoveFromTrip={handleRemoveFromTrip}
                        onOptimizeTrip={handleOptimizeTrip}
                        onStartDriverModeForTrip={startDriverModeForTrip}
                        onPrint={handlePrintRoute}
                        isLoading={isLoading}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-8 animate-fade-in">
                    <div className="text-center py-12 px-6 bg-white rounded-xl shadow-lg border-2 border-dashed border-blue-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className="mt-4 text-xl font-semibold text-slate-700">ようこそ、開聞クリニック通所送迎システムへ</h3>
                        <p className="mt-2 text-slate-500">まずは、カレンダーから日付を選択して送迎計画をはじめましょう。</p>
                        <div className="mt-8 text-left inline-block bg-slate-50 p-4 rounded-lg">
                            <h4 className="font-bold text-slate-600 text-center mb-2">基本的な使い方</h4>
                            <ol className="list-decimal list-inside space-y-2 text-slate-600">
                                <li>
                                    <span className="font-semibold">日付を選択:</span>
                                    <span className="ml-2">カレンダーで計画したい日付をクリックします。</span>
                                </li>
                                <li>
                                    <span className="font-semibold">ルートを作成:</span>
                                    <span className="ml-2">「テンプレートからルートを追加」で決まったコースを一度に作成します。</span>
                                </li>
                                <li>
                                    <span className="font-semibold">利用者を追加:</span>
                                    <span className="ml-2">臨時利用者は、左の一覧から各便へドラッグ＆ドロップで追加できます。</span>
                                </li>
                                <li>
                                    <span className="font-semibold">ルートを最適化:</span>
                                    <span className="ml-2">各便の「最適化」ボタンで、AIが効率の良い巡回順を計算します。</span>
                                </li>
                            </ol>
                        </div>
                    </div>
                </div>
              )}
              {error && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg animate-fade-in" onClick={() => setError(null)}>{error}</div>}
            </div>
          </div>
        ) : (
          renderDriverView()
        )}
      </main>
    </div>
  );
}

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (templateIds: number[]) => void;
  templates: RouteTemplate[];
  templateSets: TemplateSet[];
  drivers: Driver[];
  vehicles: Vehicle[];
  selectedDate: Date | null;
}

const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({ isOpen, onClose, onApply, templates, templateSets, drivers, vehicles, selectedDate }) => {
    const [selectedIndividualTemplateIds, setSelectedIndividualTemplateIds] = useState<Set<number>>(new Set());
    const [selectedTemplateSetId, setSelectedTemplateSetId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'set' | 'individual'>('set');
    const modalRef = useRef<HTMLDivElement>(null);

    const applicableTemplates = useMemo(() => {
        if (!selectedDate) return [];
        const dayOfWeek = selectedDate.getDay();
        const dayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[dayOfWeek];
        return templates.filter(t => t.applicableDays[dayKey]);
    }, [templates, selectedDate]);
    
    const selectedDayKey = useMemo(() => {
        if (!selectedDate) return null;
        const dayOfWeek = selectedDate.getDay();
        return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[dayOfWeek];
    }, [selectedDate]);

    useEffect(() => {
        if (isOpen) {
            setSelectedIndividualTemplateIds(new Set());
            setSelectedTemplateSetId(null);
            setActiveTab(templateSets.length > 0 ? 'set' : 'individual');
        }
    }, [isOpen, templateSets.length]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!isOpen) return null;

    const handleToggleIndividual = (templateId: number) => {
        setSelectedIndividualTemplateIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(templateId)) {
                newSet.delete(templateId);
            } else {
                newSet.add(templateId);
            }
            return newSet;
        });
    };

    const handleApplyClick = () => {
        let finalTemplateIds: number[] = [];
        if (activeTab === 'set' && selectedTemplateSetId) {
            const selectedSet = templateSets.find(ts => ts.id === selectedTemplateSetId);
            if (selectedSet) {
                finalTemplateIds = selectedSet.templateIds;
            }
        } else if (activeTab === 'individual') {
            finalTemplateIds = Array.from(selectedIndividualTemplateIds);
        }
        onApply(finalTemplateIds);
    };
    
    const getDriverName = (driverId?: number) => drivers.find(d => d.id === driverId)?.name || '未設定';
    const getVehicleName = (vehicleId?: number) => vehicles.find(v => v.id === vehicleId)?.model || '未設定';

    const renderSetTab = () => (
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
            {templateSets.length > 0 ? templateSets.map(set => {
                const isApplicable = selectedDayKey ? set.applicableDays[selectedDayKey] : false;
                const isSelected = selectedTemplateSetId === set.id;

                return (
                    <label 
                        key={set.id} 
                        className={`flex items-start p-4 border rounded-lg transition-all ${
                            isSelected && isApplicable ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300' : 'bg-white border-slate-200'
                        } ${
                            isApplicable ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60 bg-slate-50 cursor-not-allowed'
                        }`}
                    >
                        <input
                            type="radio"
                            name="template-set-selection"
                            checked={isSelected}
                            disabled={!isApplicable}
                            onChange={() => {
                                if (isApplicable) {
                                    setSelectedTemplateSetId(set.id);
                                }
                            }}
                            className="h-5 w-5 border-slate-300 text-blue-600 focus:ring-blue-500 mt-1 disabled:bg-slate-200 disabled:cursor-not-allowed"
                        />
                        <div className="ml-4 flex-grow">
                            <p className="font-bold text-slate-700">{set.name}</p>
                            <p className="text-sm text-slate-500 mt-1">
                                含まれる個別ルート: <span className="font-medium text-slate-600">{set.templateIds.length}件</span>
                                {!isApplicable && <span className="ml-2 text-xs font-semibold text-orange-600">(選択中の曜日には適用できません)</span>}
                            </p>
                        </div>
                    </label>
                )
            }) : (
                 <p className="text-slate-500 text-center py-8">テンプレートセットがありません。「データ管理」から作成できます。</p>
            )}
        </div>
    );


    const renderIndividualTab = () => (
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
            {applicableTemplates.map(template => (
                <label key={template.id} className={`flex items-start p-4 border rounded-lg cursor-pointer transition-all ${selectedIndividualTemplateIds.has(template.id) ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input
                        type="checkbox"
                        checked={selectedIndividualTemplateIds.has(template.id)}
                        onChange={() => handleToggleIndividual(template.id)}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-1"
                    />
                    <div className="ml-4 flex-grow">
                        <p className="font-bold text-slate-700">{template.templateName}</p>
                        <p className="text-sm text-slate-500">ルート名: <span className="font-medium text-slate-600">{template.routeName}</span></p>
                        <div className="text-xs text-slate-500 mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                            <span>運転手: <span className="font-medium text-slate-600">{getDriverName(template.driverId)}</span></span>
                            <span>車両: <span className="font-medium text-slate-600">{getVehicleName(template.vehicleId)}</span></span>
                            <span col-span-2>利用者: <span className="font-medium text-slate-600">{template.userIds.length}人</span></span>
                        </div>
                    </div>
                </label>
            ))}
        </div>
    );

    const isApplyDisabled = (activeTab === 'set' && !selectedTemplateSetId) || (activeTab === 'individual' && selectedIndividualTemplateIds.size === 0);
    const buttonText = () => {
        if(isApplyDisabled) return '作成';
        if (activeTab === 'set' && selectedTemplateSetId) {
            const selectedSet = templateSets.find(ts => ts.id === selectedTemplateSetId);
            return `${selectedSet?.templateIds.length || 0}件のルートを作成`;
        }
        if (activeTab === 'individual') {
            return `${selectedIndividualTemplateIds.size}件のルートを作成`;
        }
        return '作成';
    };

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div ref={modalRef} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">テンプレートからルートを追加</h3>
                     <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full leading-none">&times;</button>
                </div>
                
                <div className="border-b border-gray-200 mb-4">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('set')} disabled={templateSets.length === 0} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'set' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                            <CollectionIcon className="w-5 h-5"/>
                            セットで選択
                        </button>
                        <button onClick={() => setActiveTab('individual')} disabled={applicableTemplates.length === 0 && templates.length === 0} className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'individual' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                             <ViewGridIcon className="w-5 h-5"/>
                            個別に選択
                        </button>
                    </nav>
                </div>

                <div className="flex-grow">
                    {activeTab === 'set' && renderSetTab()}
                    {activeTab === 'individual' && (applicableTemplates.length > 0 ? renderIndividualTab() : <p className="text-slate-500 text-center py-8">この曜日に適用できる個別ルートはありません。</p>)}
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 font-semibold rounded-md hover:bg-slate-300">
                        キャンセル
                    </button>
                    <button onClick={handleApplyClick} disabled={isApplyDisabled} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed">
                        {buttonText()}
                    </button>
                </div>
            </div>
        </div>,
        document.getElementById('modal-root')!
    );
};