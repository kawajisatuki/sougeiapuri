
import React, { useState, useEffect } from 'react';
import type { User, RouteType, Facility, Trip } from '../types';
import { MapPinIcon } from './icons/MapPinIcon';
import { NavigationArrowIcon } from './icons/NavigationArrowIcon';
import { HomeIcon } from './icons/HomeIcon';
import { ClockIcon } from './icons/ClockIcon';
import { PhoneIcon } from './icons/PhoneIcon';

interface DriverViewProps {
  trip: Trip;
  routeType: RouteType;
  facility: Facility;
  date?: string;
  routeName?: string;
  onExit: () => void;
  onRouteUpdate: (updatedTrip: Trip) => void;
}

const DriverView: React.FC<DriverViewProps> = ({ trip: initialTrip, routeType, facility, date, routeName, onExit, onRouteUpdate }) => {
  const [trip, setTrip] = useState(initialTrip);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);

  useEffect(() => {
    setTrip(initialTrip);
  }, [initialTrip]);

  useEffect(() => {
    const firstPendingIndex = trip.users.findIndex(u => u.pickupStatus === 'pending');
    setCurrentStopIndex(firstPendingIndex >= 0 ? firstPendingIndex : trip.users.length);
  }, [trip]);

  const handleStatusUpdate = (status: 'completed' | 'skipped' | 'absent') => {
    const updatedUsers = trip.users.map((user, index) =>
      index === currentStopIndex ? { ...user, pickupStatus: status } : user
    );
    const updatedTrip = { ...trip, users: updatedUsers };
    setTrip(updatedTrip);
    onRouteUpdate(updatedTrip);
  };

  const handleNavigate = (stopIndex: number) => {
    const isFinished = stopIndex >= trip.users.length;

    let origin: string;
    let destination: string;
    let waypoints: string[] = [];
    const userList = trip.users;

    if (isFinished) {
      origin = userList.length > 0 ? userList[userList.length - 1].address : facility.address;
      destination = facility.address;
    } else {
      origin = stopIndex === 0 ? facility.address : userList[stopIndex - 1].address;
      destination = facility.address;
      waypoints = userList.slice(stopIndex).map(u => u.address);
    }
    
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination);
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&travelmode=driving`;
    if (waypoints.length > 0) {
        url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isRouteFinished = currentStopIndex >= trip.users.length;
  const currentStop = isRouteFinished ? null : trip.users[currentStopIndex];

  const getStatusColor = (status?: 'pending' | 'completed' | 'skipped' | 'absent', isCurrent?: boolean) => {
    if (isCurrent) return 'bg-blue-100 ring-2 ring-blue-500';
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 opacity-70';
      case 'skipped': return 'bg-yellow-100 text-yellow-800 opacity-70';
      case 'absent': return 'bg-red-100 text-red-800 opacity-70';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const progressPercentage = trip.users.length > 0 ? (trip.users.filter(u => u.pickupStatus !== 'pending').length / trip.users.length) * 100 : 0;
  const displayDate = date ? new Date(date + 'T12:00:00') : null;

  return (
    <div className="max-w-6xl mx-auto bg-slate-50 p-4 md:p-6 rounded-2xl shadow-xl animate-fade-in">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-blue-700">
            {routeName || (routeType === 'morning' ? '送迎ルート' : '送迎ルート')}
          </h2>
           <p className="text-slate-500 font-semibold">{displayDate?.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric'})} - {trip.departureTime}発 {routeType === 'morning' ? 'お迎え' : 'お送り'}</p>
           <p className="text-sm text-slate-500">ドライバーモード</p>
        </div>
        <button onClick={onExit} className="px-4 py-2 bg-white text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors shadow-sm border">
          計画に戻る
        </button>
      </div>

      <div className="mb-6">
        <div className="relative pt-1">
          <div className="overflow-hidden h-4 text-xs flex rounded-full bg-blue-200">
            <div style={{ width: `${progressPercentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500 transition-all duration-500"></div>
          </div>
        </div>
        <p className="text-right text-sm text-slate-500 mt-1">{trip.users.filter(u => u.pickupStatus !== 'pending').length} / {trip.users.length} 完了</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-lg">
          <h4 className="font-bold text-lg mb-4 text-slate-700 border-b pb-2">全ルート</h4>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            <div className={`p-3 rounded-md flex items-center transition-all duration-300 ${!isRouteFinished && currentStopIndex === 0 ? 'bg-blue-100' : 'bg-slate-50'}`}>
              <span className="w-8 text-center mr-2 text-slate-500"><HomeIcon className="w-6 h-6 mx-auto"/></span>
              <span className="font-semibold text-slate-700">{facility.name}</span>
            </div>
            {trip.users.map((user, index) => (
              <div key={user.id} className={`p-3 rounded-md flex items-center justify-between transition-all duration-300 ${getStatusColor(user.pickupStatus, index === currentStopIndex)}`}>
                <div className="flex items-center truncate">
                  <span className={`font-bold w-8 text-center mr-2 ${index === currentStopIndex ? 'text-blue-700' : 'text-slate-500'}`}>{index + 1}</span>
                  <div className="truncate">
                    <p className={`font-medium truncate ${user.pickupStatus === 'absent' ? 'line-through' : ''}`}>{user.name}</p>
                    {user.desiredTime && (
                         <p className="text-xs text-slate-500 flex items-center">
                            <ClockIcon className="w-3 h-3 mr-1"/>
                            {user.desiredTime}
                        </p>
                    )}
                  </div>
                </div>
                {user.pickupStatus !== 'pending' && <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">{
                    user.pickupStatus === 'completed' ? '完了' :
                    user.pickupStatus === 'skipped' ? 'ｽｷｯﾌﾟ' :
                    '欠席'
                }</span>}
              </div>
            ))}
            <div className={`p-3 rounded-md flex items-center transition-all duration-300 ${isRouteFinished ? 'bg-blue-100' : 'bg-slate-50'}`}>
              <span className="w-8 text-center mr-2 text-slate-500"><HomeIcon className="w-6 h-6 mx-auto"/></span>
              <span className="font-semibold text-slate-700">{facility.name}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {isRouteFinished ? (
            <div className="text-center bg-white p-8 rounded-xl shadow-lg h-full flex flex-col justify-center items-center">
              <h3 className="text-3xl font-bold text-green-600">🎉 この便の送迎が完了しました！</h3>
              <p className="text-slate-600 mt-2">お疲れ様でした。事業所へお戻りください。</p>
              <button
                onClick={() => handleNavigate(trip.users.length)}
                className="mt-8 inline-flex items-center gap-3 py-3 px-8 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <NavigationArrowIcon className="w-6 h-6" />
                事業所へのナビを開始
              </button>
            </div>
          ) : (
            currentStop && (
              <div className="bg-white p-6 rounded-xl shadow-lg sticky top-6">
                <p className="text-lg font-semibold text-blue-800">次の目的地 ({currentStopIndex + 1}/{trip.users.length})</p>
                <h3 className="text-4xl font-bold my-2 text-slate-800">{currentStop.name}様</h3>
                
                {currentStop.phone && (
                    <div className="flex items-center text-lg text-slate-700 font-semibold my-4">
                        <PhoneIcon className="w-5 h-5 mr-3 text-slate-500 flex-shrink-0" />
                        <a href={`tel:${currentStop.phone}`} className="hover:underline">{currentStop.phone}</a>
                    </div>
                )}
                
                {currentStop.desiredTime && (
                    <div className="flex items-center text-xl text-yellow-600 font-bold mb-4 bg-yellow-100 rounded-lg px-3 py-1 w-fit">
                        <ClockIcon className="w-5 h-5 mr-2" />
                        希望時間: {currentStop.desiredTime}
                    </div>
                )}
                <div className="flex items-start text-slate-600 mb-6">
                  <MapPinIcon className="w-5 h-5 mr-2 mt-1 flex-shrink-0"/>
                  <span>{currentStop.address}</span>
                </div>

                <button
                  onClick={() => handleNavigate(currentStopIndex)}
                  className="w-full inline-flex items-center justify-center gap-3 py-4 mb-4 bg-blue-600 text-white text-lg font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <NavigationArrowIcon className="w-6 h-6" />
                  ナビゲーション開始
                </button>

                <div className="grid grid-cols-3 gap-4">
                  <button onClick={() => handleStatusUpdate('completed')} className="py-3 px-6 bg-green-500 text-white font-bold rounded-lg shadow-md hover:bg-green-600 transition-transform transform hover:scale-105">
                    {routeType === 'morning' ? '乗車完了' : '降車完了'}
                  </button>
                  <button onClick={() => handleStatusUpdate('skipped')} className="py-3 px-6 bg-yellow-500 text-white font-bold rounded-lg shadow-md hover:bg-yellow-600 transition-transform transform hover:scale-105">
                    スキップ
                  </button>
                   <button onClick={() => handleStatusUpdate('absent')} className="py-3 px-6 bg-red-500 text-white font-bold rounded-lg shadow-md hover:bg-red-600 transition-transform transform hover:scale-105">
                    欠席
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverView;
