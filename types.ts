
export interface Facility {
  name: string;
  address: string;
}

export interface User {
  id: number;
  name: string;
  address: string;
  phone?: string;
  photoUrl: string;
  pickupStatus?: 'pending' | 'completed' | 'skipped' | 'absent';
  desiredTime?: string; // HH:MM format for pickup/dropoff
  attendanceDays?: {
    sun: boolean;
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
    sat: boolean;
  };
  remarks?: string;
}

export interface Driver {
  id: number;
  name:string;
  email?: string;
}

export interface Vehicle {
  id: number;
  model: string;
  licensePlate: string;
}

export interface Trip {
  id: number;
  departureTime: string; // HH:MM
  users: User[];
}

export interface Route {
  id: number;
  name: string;
  driverId?: number;
  vehicleId?: number;
  morningTrips: Trip[];
  afternoonTrips: Trip[];
  remarks?: string;
}

export interface DailySchedule {
  date: string; // YYYY-MM-DD
  routes: Route[];
}

export type RouteType = 'morning' | 'afternoon';

export interface RouteTemplate {
  id: number;
  templateName: string; // e.g., "月曜午前Aコース"
  routeName: string; // e.g., "送迎ルート1"
  userIds: number[];
  driverId?: number;
  vehicleId?: number;
  applicableDays: {
    sun: boolean;
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
    sat: boolean;
  };
}

export interface TemplateSet {
  id: number;
  name: string; // 例: "月曜フルコース"
  templateIds: number[]; // このセットに含まれるRouteTemplateのIDの配列
  applicableDays: {
    sun: boolean;
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
    sat: boolean;
  };
}