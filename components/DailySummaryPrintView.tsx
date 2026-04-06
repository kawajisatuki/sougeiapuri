import React from 'react';
import type { DailySchedule, Driver, Vehicle, Trip } from '../types';

interface DailySummaryPrintViewProps {
    schedule: DailySchedule;
    drivers: Driver[];
    vehicles: Vehicle[];
    printType: 'morning' | 'afternoon' | 'both';
}

const DailySummaryPrintView: React.FC<DailySummaryPrintViewProps> = ({ schedule, drivers, vehicles, printType }) => {
    const date = new Date(schedule.date + 'T12:00:00Z');

    const getDriverName = (driverId?: number) => drivers.find(d => d.id === driverId)?.name || '未設定';
    const getVehicleInfo = (vehicleId?: number) => {
        const v = vehicles.find(v => v.id === vehicleId);
        return v ? `${v.model} (${v.licensePlate})` : '未設定';
    };

    const TripUsersList = ({ trip }: { trip: Trip }) => (
        <ol className="list-decimal list-inside text-xs pl-2 space-y-0.5">
            {trip.users.map(user => (
                <li key={user.id}>{user.name}</li>
            ))}
        </ol>
    );

    const titleSuffix = {
        morning: '（午前のお迎え）',
        afternoon: '（午後のお送り）',
        both: ''
    }[printType];

    const showMorning = printType === 'morning' || printType === 'both';
    const showAfternoon = printType === 'afternoon' || printType === 'both';


    return (
        <div className="bg-white" style={{ width: '297mm', boxSizing: 'border-box' }}>
            {/* Overall padding reduced, font sizes and margins tightened to ensure content fits on one A4 landscape page. */}
            <div className="p-3 text-slate-900" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
                <header className="text-center mb-2 border-b-2 border-slate-600 pb-1">
                    <h1 className="text-xl font-bold">送迎業務一覧{titleSuffix}</h1>
                    <p className="text-base font-semibold">
                        {date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                    </p>
                </header>

                {/* Changed to 4 columns to better utilize horizontal space and reduce vertical height. */}
                <div className="grid grid-cols-4 gap-2">
                    {schedule.routes.map(route => (
                        <div key={route.id} className="p-2 border border-slate-300 rounded-lg break-inside-avoid">
                            <h2 className="text-sm font-bold text-slate-800 border-b pb-0.5 mb-1">{route.name}</h2>
                            <div className="text-[11px] space-y-0.5 mb-1.5">
                                <p><strong>運転手:</strong> {getDriverName(route.driverId)}</p>
                                <p><strong>車両:</strong> {getVehicleInfo(route.vehicleId)}</p>
                            </div>
                            
                            {showMorning && (
                                <div>
                                    <h3 className="text-xs font-semibold text-orange-800 mb-0.5">☀️ 午前（お迎え）</h3>
                                    {route.morningTrips.map((trip, index) => (
                                        <div key={trip.id} className="mb-1">
                                            <p className="text-[11px] font-bold">{index + 1}便目 ({trip.departureTime})</p>
                                            {trip.users.length > 0 ? (
                                                <TripUsersList trip={trip} />
                                            ) : (
                                                <p className="text-xs text-slate-500 pl-2">利用者なし</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {showAfternoon && (
                                <div className={showMorning ? "mt-1.5 pt-1.5 border-t border-slate-200" : ""}>
                                    <h3 className="text-xs font-semibold text-indigo-800 mb-0.5">🌙 午後（お送り）</h3>
                                    {route.afternoonTrips.map((trip, index) => (
                                        <div key={trip.id} className="mb-1">
                                            <p className="text-[11px] font-bold">{index + 1}便目 ({trip.departureTime})</p>
                                            {trip.users.length > 0 ? (
                                                <TripUsersList trip={trip} />
                                            ) : (
                                                <p className="text-xs text-slate-500 pl-2">利用者なし</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DailySummaryPrintView;