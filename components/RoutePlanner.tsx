
import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import pako from 'pako';
import type { User, RouteType, Route, Driver, Vehicle, Facility, Trip } from '../types';
import { MapPinIcon } from './icons/MapPinIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PrintIcon } from './icons/PrintIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ShareIcon } from './icons/ShareIcon';
import { EmailIcon } from './icons/EmailIcon';
import { PlusCircleIcon } from './icons/PlusCircleIcon';

interface TripLaneProps {
  trip: Trip;
  routeId: number;
  routeType: RouteType;
  tripIndex: number;
  onDropInTrip: (userId: number, routeType: RouteType, routeId: number, tripId: number) => void;
  onRemoveFromTrip: (userId: number, routeType: RouteType, routeId: number, tripId: number) => void;
  onUpdateTrip: (updatedTrip: Trip) => void;
  onDeleteTrip: () => void;
  onOptimizeTrip: () => void;
  onStartDriverModeForTrip: () => void;
  onShareTrip: () => void;
  isPlanningDisabled: boolean;
  isLoading: boolean;
}

const TripLane: React.FC<TripLaneProps> = ({ trip, tripIndex, onDropInTrip, onRemoveFromTrip, onUpdateTrip, onDeleteTrip, onOptimizeTrip, onStartDriverModeForTrip, onShareTrip, isPlanningDisabled, isLoading, routeId, routeType }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if(isPlanningDisabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if(isPlanningDisabled) return;
    setIsDragOver(false);
    const userId = parseInt(e.dataTransfer.getData('userId'), 10);
    if (userId) onDropInTrip(userId, routeType, routeId, trip.id);
  };
  
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdateTrip({ ...trip, departureTime: e.target.value });
  };
  
  const handleUserTimeChange = (userId: number, time: string) => {
      const updatedUsers = trip.users.map(u => u.id === userId ? { ...u, desiredTime: time } : u);
      onUpdateTrip({ ...trip, users: updatedUsers });
  };

  const handleUserRemarksChange = (userId: number, remarks: string) => {
      const updatedUsers = trip.users.map(u => u.id === userId ? { ...u, remarks: remarks } : u);
      onUpdateTrip({ ...trip, users: updatedUsers });
  };


  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-4">
      <div className="flex justify-between items-center">
         <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">{tripIndex + 1}便目</span>
            <input 
                type="time" 
                value={trip.departureTime}
                onChange={handleTimeChange}
                disabled={isPlanningDisabled}
                className="p-1 rounded-md border-slate-300 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
         </div>
         <div className="flex items-center">
            <button onClick={onShareTrip} title="この便をQRコードで共有" className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-200"><ShareIcon className="w-4 h-4" /></button>
            <button onClick={onDeleteTrip} title="この便を削除" className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-200"><TrashIcon className="w-4 h-4" /></button>
         </div>
      </div>
      <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-grow space-y-2 min-h-[150px] overflow-y-auto pr-1 rounded-lg p-2 transition-all ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${isPlanningDisabled ? 'opacity-60' : ''}`}
        >
        {trip.users.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 border-2 border-dashed border-slate-300 rounded-lg py-10">
            <p>ここに利用者をドロップ</p>
          </div>
        ) : (
          trip.users.map((user, index) => (
            <div key={user.id} className="bg-white p-2 rounded-md flex items-start justify-between animate-fade-in shadow-sm">
              <div className="flex items-start flex-grow overflow-hidden">
                <span className="text-blue-600 font-bold w-6 text-center mr-2 pt-1 flex-shrink-0">{index + 1}</span>
                <img src={user.photoUrl} alt={user.name} className="w-8 h-8 rounded-full mr-3 flex-shrink-0" />
                <div className="flex-grow overflow-hidden">
                    <span className="text-sm font-medium text-slate-600 truncate block">{user.name}</span>
                    <div className="flex items-center mt-1">
                        <ClockIcon className="w-3 h-3 text-slate-400 mr-1"/>
                         <input 
                            type="time"
                            value={user.desiredTime || ''}
                            onChange={(e) => handleUserTimeChange(user.id, e.target.value)}
                            disabled={isPlanningDisabled}
                            className="w-24 text-xs p-0.5 border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                    </div>
                     <input 
                        type="text"
                        placeholder="利用者ごとの備考"
                        value={user.remarks || ''}
                        onChange={(e) => handleUserRemarksChange(user.id, e.target.value)}
                        disabled={isPlanningDisabled}
                        className="w-full text-xs p-1 mt-1 border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                </div>
              </div>
              <button onClick={() => onRemoveFromTrip(user.id, routeType, routeId, trip.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full disabled:opacity-50 flex-shrink-0 ml-2" disabled={isPlanningDisabled}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))
        )}
      </div>
       <div className="flex flex-col sm:flex-row gap-2">
           <button onClick={onOptimizeTrip} disabled={isLoading || trip.users.length < 2 || isPlanningDisabled} className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300">
             <SparklesIcon className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
             {isLoading ? '最適化中' : '最適化'}
           </button>
           <button onClick={onStartDriverModeForTrip} disabled={isLoading || trip.users.length === 0 || isPlanningDisabled} className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300">
             <MapPinIcon className="w-4 h-4 mr-2" />
             送迎開始
           </button>
       </div>
    </div>
  );
};


interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    trip: Trip | null;
    routeType: RouteType;
    routeName: string;
    selectedDate: Date;
    facility: Facility;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, trip, routeType, routeName, selectedDate, facility }) => {
    const [baseUrl, setBaseUrl] = useState('');
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            const url = new URL(window.location.href);
            url.hash = '';
            setBaseUrl(url.toString());
        }
    }, [isOpen]);

    const dataHash = useMemo(() => {
        if (!trip) return null;
        
        // Encode a minimal, self-contained representation of the trip.
        // This MUST match the logic in `generateQrCodeDataUrl` in App.tsx
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
            routeType,
            date: selectedDate.toISOString().split('T')[0],
            facility,
            routeName,
        };

        try {
            const json = JSON.stringify(dataToEncode);
            const compressed = pako.deflate(json);
            const binaryString = String.fromCharCode.apply(null, compressed as any);
            const base64 = btoa(binaryString);
            return `#data=${base64}`;
        } catch (e) {
            console.error("Failed to encode share data", e);
            alert("共有データの生成に失敗しました。");
            return null;
        }
    }, [trip, routeType, routeName, selectedDate, facility]);

    const shareUrl = dataHash ? baseUrl.replace(/#$/, '') + dataHash : null;
    const isLocalhost = useMemo(() => baseUrl.includes('//localhost') || baseUrl.includes('//127.0.0.1'), [baseUrl]);

    useEffect(() => {
        if (shareUrl && canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, shareUrl, { width: 256, margin: 2, errorCorrectionLevel: 'M' }, (error) => {
                if (error) console.error("QR code generation failed:", error);
            });
        }
    }, [shareUrl]);

    if (!isOpen || !trip) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg animate-fade-in-up" onClick={e => e.stopPropagation()}>
                 <h3 className="text-xl font-bold mb-4 text-center">
                    {routeName} ({routeType === 'morning' ? '午前' : '午後'}の便) を共有
                 </h3>
                 <div className="text-center">
                     <p className="text-slate-700 mb-4 font-semibold">ドライバーのスマートフォンで<br/>下のQRコードをスキャンしてください</p>
                    {shareUrl ? (
                         <div className="p-4 bg-slate-100 rounded-lg inline-block"><canvas ref={canvasRef} /></div>
                    ) : (
                       <div className="p-4 h-[288px] flex items-center justify-center text-red-500 bg-red-50 rounded-lg">QRコード生成エラー。</div>
                    )}
                    {isLocalhost && (
                        <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded-md border border-orange-200">
                            <strong>ヒント:</strong> このURLはローカルアドレスです。他のデバイスからアクセスするには、PCのIPアドレス（例: <code>http://192.168.1.5:8080/</code>）に置き換えてください。
                        </div>
                    )}
                </div>
                 <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-2 rounded-full leading-none">&times;</button>
            </div>
        </div>
    );
};


interface RoutePlannerProps {
  route: Route;
  drivers: Driver[];
  vehicles: Vehicle[];
  selectedDate: Date;
  facility: Facility;
  onUpdate: (updatedRoute: Route) => void;
  onDelete: (routeId: number) => void;
  onDropInTrip: (userId: number, routeType: RouteType, routeId: number, tripId: number) => void;
  onRemoveFromTrip: (userId: number, routeType: RouteType, routeId: number, tripId: number) => void;
  onOptimizeTrip: (routeType: RouteType, routeId: number, tripId: number) => void;
  onStartDriverModeForTrip: (routeType: RouteType, routeId: number, tripId: number) => void;
  onPrint: (route: Route, printType: 'morning' | 'afternoon' | 'both', method: 'pdf' | 'print') => void;
  isLoading: Record<string, boolean>;
}

const RoutePlanner: React.FC<RoutePlannerProps> = ({ route, drivers, vehicles, selectedDate, facility, onUpdate, onDelete, onDropInTrip, onRemoveFromTrip, onOptimizeTrip, onStartDriverModeForTrip, onPrint, isLoading }) => {
  
  const [sharingTripInfo, setSharingTripInfo] = useState<{trip: Trip, routeType: RouteType} | null>(null);
  const [isPrintMenuOpen, setPrintMenuOpen] = useState(false);
  const [isEmailMenuOpen, setEmailMenuOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);
  const emailMenuRef = useRef<HTMLDivElement>(null);

  const isPlanningDisabled = !route.driverId || !route.vehicleId;
  const driver = useMemo(() => drivers.find(d => d.id === route.driverId), [drivers, route.driverId]);
  const isEmailDisabled = !driver || !driver.email;
  const emailTooltip = isEmailDisabled ? '担当運転手とメールアドレスの登録が必要です。' : 'ルートをメールで送信します。';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (printMenuRef.current && !printMenuRef.current.contains(event.target as Node)) setPrintMenuOpen(false);
        if (emailMenuRef.current && !emailMenuRef.current.contains(event.target as Node)) setEmailMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAssignment = (type: 'driver' | 'vehicle' | 'name', value: string | number) => {
    onUpdate({ ...route, [type === 'driver' ? 'driverId' : type === 'vehicle' ? 'vehicleId' : 'name']: value });
  };
  
  const handleUpdateTrip = (updatedTrip: Trip, routeType: RouteType) => {
      const trips = routeType === 'morning' ? route.morningTrips : route.afternoonTrips;
      const newTrips = trips.map(t => t.id === updatedTrip.id ? updatedTrip : t);
      const newRoute = { ...route, [routeType === 'morning' ? 'morningTrips' : 'afternoonTrips']: newTrips };
      onUpdate(newRoute);
  };
  
  const handleAddTrip = (routeType: RouteType) => {
      const newTrip: Trip = { id: Date.now(), departureTime: routeType === 'morning' ? "09:00" : "16:00", users: [] };
      const trips = routeType === 'morning' ? route.morningTrips : route.afternoonTrips;
      const newRoute = { ...route, [routeType === 'morning' ? 'morningTrips' : 'afternoonTrips']: [...trips, newTrip] };
      onUpdate(newRoute);
  };
  
  const handleDeleteTrip = (tripId: number, routeType: RouteType) => {
      if (!window.confirm("この便を削除しますか？")) return;
      const trips = routeType === 'morning' ? route.morningTrips : route.afternoonTrips;
      const newTrips = trips.filter(t => t.id !== tripId);
      const newRoute = { ...route, [routeType === 'morning' ? 'morningTrips' : 'afternoonTrips']: newTrips };
      onUpdate(newRoute);
  };

  const handleEmailRoute = (emailType: 'morning' | 'afternoon' | 'both') => {
    if (!driver || !driver.email) {
        alert('このルートの担当運転手にメールアドレスが登録されていません。');
        return;
    }

    const vehicle = vehicles.find(v => v.id === route.vehicleId);
    const dateStr = selectedDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    const formatUserListPlainText = (users: User[]): string => users.map((u, i) => `${i + 1}. ${u.name}様\n   住所: ${u.address}\n   電話: ${u.phone || '---'}\n   希望時間: ${u.desiredTime || '---'}`).join('\n\n');
    const formatTripsPlainText = (trips: Trip[]): string => {
        if (trips.length === 0) return '対象の便なし';
        return trips.map((trip, i) => `▼ ${i+1}便目 (出発 ${trip.departureTime})\n${formatUserListPlainText(trip.users)}`).join('\n\n');
    }

    let subject: string;
    const bodyParts = [`${driver.name}様`,`\n${dateStr}の送迎業務についてお知らせします。`,`====================`,`■ 基本情報`,`--------------------`,`ルート名: ${route.name}`,`車両: ${vehicle ? `${vehicle.model} (${vehicle.licensePlate})` : '未設定'}`, ...(route.remarks ? [`\n■ 備考:\n${route.remarks}\n`] : [])];

    if (emailType === 'morning' || emailType === 'both') bodyParts.push(`====================`,`☀️ 午前の送迎（お迎え）`,`--------------------`, formatTripsPlainText(route.morningTrips), ``);
    if (emailType === 'afternoon' || emailType === 'both') bodyParts.push(`====================`,`🌙 午後の送迎（お送り）`,`--------------------`, formatTripsPlainText(route.afternoonTrips), ``);
    
    subject = `【送迎連絡${emailType === 'both' ? '' : emailType === 'morning' ? '・午前' : '・午後'}】${dateStr} ${route.name}`;
    bodyParts.push(`\n====================\n`,`【ナビ機能について】`,`ルートのナビゲーション機能は、アプリ本体の各便の「共有」(QRコード)ボタンからお使いのスマートフォンの地図アプリを起動できます。`,`\n`,`このメールは「開聞クリニック通所送迎システム」から自動送信されました。`);
    const body = bodyParts.join('\n');
    const mailtoLink = `mailto:?to=${encodeURIComponent(driver.email)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    if (mailtoLink.length < 2000) { window.location.href = mailtoLink; }
    else { alert('メール内容が長すぎるため、代わりにメールファイル(.eml)をダウンロードします。'); }
  };

  return (
    <>
    <div className={`bg-white p-4 rounded-xl shadow-lg transition-all border ${isPlanningDisabled ? 'border-orange-200' : 'border-transparent'}`}>
       <div className="flex justify-between items-start mb-4">
            <div className="flex-grow">
                <input type="text" value={route.name} onChange={(e) => handleAssignment('name', e.target.value)} className="text-lg font-bold text-slate-700 bg-transparent rounded-md -ml-2 px-2 py-1 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full"/>
                {isPlanningDisabled && <div className="text-xs text-orange-600 bg-orange-100 p-2 rounded-md mt-2">運転手と車両を選択して計画を開始してください</div>}
            </div>
            <div className="flex items-center ml-4">
                 <div className="relative" ref={emailMenuRef}>
                    <button onClick={() => setEmailMenuOpen(p => !p)} title={emailTooltip} disabled={isEmailDisabled} className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 disabled:opacity-50"><EmailIcon className="w-5 h-5"/></button>
                    {isEmailMenuOpen && <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 animate-fade-in-up ring-1 ring-black ring-opacity-5"><div className="py-1"><a href="#" onClick={(e) => { e.preventDefault(); handleEmailRoute('morning'); setEmailMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">☀️ 午前ルートをメール</a><a href="#" onClick={(e) => { e.preventDefault(); handleEmailRoute('afternoon'); setEmailMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">🌙 午後ルートをメール</a><div className="border-t my-1"></div><a href="#" onClick={(e) => { e.preventDefault(); handleEmailRoute('both'); setEmailMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">両方をメール</a></div></div>}
                </div>
                <div className="relative" ref={printMenuRef}>
                    <button onClick={() => setPrintMenuOpen(p => !p)} title="送迎確認票を印刷" className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50"><PrintIcon className="w-5 h-5"/></button>
                    {isPrintMenuOpen && <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 animate-fade-in-up ring-1 ring-black ring-opacity-5"><div className="py-1"><div className="px-4 pt-2 pb-1 text-xs text-slate-500">午前のお迎え</div><a href="#" onClick={(e) => { e.preventDefault(); onPrint(route, 'morning', 'pdf'); setPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">PDFで保存</a><a href="#" onClick={(e) => { e.preventDefault(); onPrint(route, 'morning', 'print'); setPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">印刷する</a><div className="border-t my-1"></div><div className="px-4 pt-1 pb-1 text-xs text-slate-500">午後のお送り</div><a href="#" onClick={(e) => { e.preventDefault(); onPrint(route, 'afternoon', 'pdf'); setPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">PDFで保存</a><a href="#" onClick={(e) => { e.preventDefault(); onPrint(route, 'afternoon', 'print'); setPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">印刷する</a><div className="border-t my-1"></div><div className="px-4 pt-1 pb-1 text-xs text-slate-500">両方</div><a href="#" onClick={(e) => { e.preventDefault(); onPrint(route, 'both', 'pdf'); setPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">PDFで保存</a><a href="#" onClick={(e) => { e.preventDefault(); onPrint(route, 'both', 'print'); setPrintMenuOpen(false); }} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">印刷する</a></div></div>}
                </div>
                <button onClick={() => onDelete(route.id)} title="この送迎ルートを削除" className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50"><TrashIcon className="w-5 h-5"/></button>
            </div>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
               <label htmlFor={`driver-select-${route.id}`} className="block text-sm font-medium text-slate-600">運転手</label>
               <select id={`driver-select-${route.id}`} value={route.driverId || ''} onChange={(e) => handleAssignment('driver', Number(e.target.value))} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"><option value="" disabled>選択してください</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            </div>
             <div>
               <label htmlFor={`vehicle-select-${route.id}`} className="block text-sm font-medium text-slate-600">車両</label>
               <select id={`vehicle-select-${route.id}`} value={route.vehicleId || ''} onChange={(e) => handleAssignment('vehicle', Number(e.target.value))} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"><option value="" disabled>選択してください</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.model} ({v.licensePlate})</option>)}</select>
            </div>
        </div>
        
      <div className="mb-4">
        <label htmlFor={`route-remarks-${route.id}`} className="block text-sm font-medium text-slate-600">このルートの備考</label>
        <textarea id={`route-remarks-${route.id}`} rows={2} className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="このルートに関する特記事項 (例: ○○さん、玄関ではなく裏口から...)" value={route.remarks || ''} onChange={(e) => onUpdate({ ...route, remarks: e.target.value })}/>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4 bg-orange-50/50 p-3 rounded-lg">
            <h4 className="text-md font-bold text-orange-800">☀️ 午前の送迎（お迎え）</h4>
            <div className="space-y-4">
                {route.morningTrips.map((trip, index) => (
                    <TripLane key={trip.id} trip={trip} routeId={route.id} routeType="morning" tripIndex={index} onDropInTrip={onDropInTrip} onRemoveFromTrip={onRemoveFromTrip} onUpdateTrip={(ut) => handleUpdateTrip(ut, 'morning')} onDeleteTrip={() => handleDeleteTrip(trip.id, 'morning')} onOptimizeTrip={() => onOptimizeTrip('morning', route.id, trip.id)} onStartDriverModeForTrip={() => onStartDriverModeForTrip('morning', route.id, trip.id)} onShareTrip={() => setSharingTripInfo({ trip, routeType: 'morning'})} isPlanningDisabled={isPlanningDisabled} isLoading={isLoading[`${route.id}-${trip.id}`] || false}/>
                ))}
            </div>
            <button onClick={() => handleAddTrip('morning')} disabled={isPlanningDisabled} className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-400 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">
                <PlusCircleIcon className="w-5 h-5"/>午前の便を追加
            </button>
        </div>
        <div className="flex flex-col gap-4 bg-indigo-50/50 p-3 rounded-lg">
             <h4 className="text-md font-bold text-indigo-800">🌙 午後の送迎（お送り）</h4>
             <div className="space-y-4">
                {route.afternoonTrips.map((trip, index) => (
                    <TripLane key={trip.id} trip={trip} routeId={route.id} routeType="afternoon" tripIndex={index} onDropInTrip={onDropInTrip} onRemoveFromTrip={onRemoveFromTrip} onUpdateTrip={(ut) => handleUpdateTrip(ut, 'afternoon')} onDeleteTrip={() => handleDeleteTrip(trip.id, 'afternoon')} onOptimizeTrip={() => onOptimizeTrip('afternoon', route.id, trip.id)} onStartDriverModeForTrip={() => onStartDriverModeForTrip('afternoon', route.id, trip.id)} onShareTrip={() => setSharingTripInfo({ trip, routeType: 'afternoon'})} isPlanningDisabled={isPlanningDisabled} isLoading={isLoading[`${route.id}-${trip.id}`] || false}/>
                ))}
             </div>
             <button onClick={() => handleAddTrip('afternoon')} disabled={isPlanningDisabled} className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-400 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">
                <PlusCircleIcon className="w-5 h-5"/>午後の便を追加
            </button>
        </div>
      </div>
    </div>
    <ShareModal 
        isOpen={!!sharingTripInfo}
        onClose={() => setSharingTripInfo(null)}
        trip={sharingTripInfo?.trip || null}
        routeType={sharingTripInfo?.routeType || 'morning'}
        routeName={route.name}
        selectedDate={selectedDate}
        facility={facility}
    />
    </>
  );
};

export default RoutePlanner;