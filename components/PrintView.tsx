


import React from 'react';
import type { Route, DailySchedule, Driver, Vehicle, User, Facility, Trip } from '../types';

interface PrintViewProps {
    route: Route;
    schedule: DailySchedule;
    drivers: Driver[];
    vehicles: Vehicle[];
    facility: Facility;
    printType: 'morning' | 'afternoon' | 'both';
    morningQrCodeUrls: (string | null)[];
    afternoonQrCodeUrls: (string | null)[];
}

const UserRow: React.FC<{ user: User, index: number }> = ({ user, index }) => (
    <tr className="border-b border-slate-200">
        <td className="p-1 text-center font-bold">{index + 1}</td>
        <td className="p-1 font-medium">{user.name}</td>
        <td className="p-1">{user.phone || '---'}</td>
        <td className="p-1 text-center">{user.desiredTime || '---'}</td>
        <td className="p-1">{user.address}</td>
        <td className="p-1 text-center align-middle">
            <div className="w-5 h-5 border-2 border-slate-400 inline-block"></div>
        </td>
        <td className="p-1 border-l border-slate-300">{user.remarks || ''}</td>
    </tr>
);

const TripSection: React.FC<{ title: string, trip: Trip, qrCodeUrl: string | null }> = ({ title, trip, qrCodeUrl }) => (
    <div className="mb-4 break-inside-avoid">
        <div className="flex justify-between items-start mb-2">
            <div>
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="text-base font-medium text-slate-600">出発: {trip.departureTime}</p>
            </div>
            {qrCodeUrl && (
                <div className="text-center flex-shrink-0 ml-4">
                    <img src={qrCodeUrl} alt="Trip QR Code" className="w-24 h-24" />
                    <p className="text-xs font-bold mt-1">この便のナビ</p>
                </div>
            )}
        </div>
        {trip.users.length > 0 ? (
            <table className="w-full text-xs table-auto border-collapse border border-slate-300">
                <thead>
                    <tr className="border-b-2 border-slate-400 bg-slate-50">
                        <th className="p-1 text-center w-8 font-bold">順</th>
                        <th className="p-1 text-left font-bold">氏名</th>
                        <th className="p-1 text-left w-28 font-bold">電話番号</th>
                        <th className="p-1 text-left w-20 font-bold">希望時間</th>
                        <th className="p-1 text-left font-bold">住所</th>
                        <th className="p-1 text-center w-12 font-bold">確認</th>
                        <th className="p-1 text-left w-32 font-bold border-l border-slate-300">備考</th>
                    </tr>
                </thead>
                <tbody>
                    {trip.users.map((user, index) => <UserRow key={user.id} user={user} index={index} />)}
                </tbody>
            </table>
        ) : <p className="text-slate-500 p-2">対象者なし</p>}
    </div>
);

const PrintView: React.FC<PrintViewProps> = ({ route, schedule, drivers, vehicles, facility, printType, morningQrCodeUrls, afternoonQrCodeUrls }) => {
    const driver = drivers.find(d => d.id === route.driverId);
    const vehicle = vehicles.find(v => v.id === route.vehicleId);
    const date = new Date(schedule.date + 'T12:00:00Z'); // Use noon to avoid timezone day shifts

    const printTitle = "送迎確認票";

    const showMorning = printType === 'morning' || printType === 'both';
    const showAfternoon = printType === 'afternoon' || printType === 'both';
    
    return (
        <div className="bg-white" style={{ width: '210mm', boxSizing: 'border-box' }}>
            <div className="p-4 text-slate-900" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
                <header className="flex justify-between items-start mb-4 border-b-2 border-slate-700 pb-2">
                    <div>
                        <h1 className="text-3xl font-bold tracking-wider">{printTitle}</h1>
                        <p className="text-lg font-bold mt-2">{facility.name}</p>
                    </div>
                    <div className="flex gap-4">
                        {/* QR Codes are now rendered per-trip */}
                    </div>
                </header>

                <section className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 p-2 border border-slate-400 rounded-md text-sm">
                    <div><strong className="font-semibold">日付:</strong> {date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
                    <div><strong className="font-semibold">ルート名:</strong> {route.name}</div>
                    <div><strong className="font-semibold">担当運転手:</strong> {driver?.name || '未定'}</div>
                    <div><strong className="font-semibold">使用車両:</strong> {vehicle ? `${vehicle.model} (${vehicle.licensePlate})` : '未定'}</div>
                </section>
                
                {route.remarks && (
                    <section className="mb-4 p-2 border border-amber-400 bg-amber-50 rounded-lg break-inside-avoid">
                        <h3 className="font-bold text-base text-amber-800 mb-1">備考</h3>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{route.remarks}</p>
                    </section>
                )}

                {showMorning && route.morningTrips.map((trip, index) => 
                    <TripSection key={trip.id} title={`☀️  午前 ${index + 1}便目（お迎え）`} trip={trip} qrCodeUrl={morningQrCodeUrls[index]} />
                )}
                 {showAfternoon && route.afternoonTrips.map((trip, index) => 
                    <TripSection key={trip.id} title={`🌙  午後 ${index + 1}便目（お送り）`} trip={trip} qrCodeUrl={afternoonQrCodeUrls[index]} />
                )}
            </div>
        </div>
    );
};

export default PrintView;