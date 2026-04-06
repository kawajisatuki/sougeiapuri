
import { User, Driver, Vehicle, RouteTemplate, TemplateSet } from './types';

const defaultAttendance = { sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false };

export const USERS: User[] = [
  {
    id: 1,
    name: '田中 太郎',
    address: '鹿児島県指宿市山川岡児ケ水1234-5',
    phone: '090-1111-2222',
    photoUrl: 'https://picsum.photos/seed/user1/100/100',
    attendanceDays: { ...defaultAttendance, mon: true, wed: true, fri: true },
  },
  {
    id: 2,
    name: '鈴木 花子',
    address: '鹿児島県南九州市知覧町郡5678-9',
    phone: '090-3333-4444',
    photoUrl: 'https://picsum.photos/seed/user2/100/100',
    attendanceDays: { ...defaultAttendance, tue: true, thu: true },
  },
  {
    id: 3,
    name: '佐藤 次郎',
    address: '鹿児島県指宿市十二町987-6',
    phone: '090-5555-6666',
    photoUrl: 'https://picsum.photos/seed/user3/100/100',
    attendanceDays: { ...defaultAttendance, mon: true, tue: true, wed: true, thu: true, fri: true },
  },
  {
    id: 4,
    name: '高橋 良子',
    address: '鹿児島県南九州市川辺町平山11-22',
    phone: '090-7777-8888',
    photoUrl: 'https://picsum.photos/seed/user4/100/100',
    attendanceDays: { ...defaultAttendance, tue: true, thu: true, mon: true },
  },
  {
    id: 5,
    name: '渡辺 健一',
    address: '鹿児島県指宿市開聞十町33-44',
    phone: '090-9999-0000',
    photoUrl: 'https://picsum.photos/seed/user5/100/100',
    attendanceDays: { ...defaultAttendance, mon: true, wed: true, sat: true },
  },
  {
    id: 6,
    name: '伊藤 さゆり',
    address: '鹿児島県南九州市頴娃町牧之内55-66',
    phone: '080-1234-5678',
    photoUrl: 'https://picsum.photos/seed/user6/100/100',
    attendanceDays: { ...defaultAttendance, mon: true, fri: true },
  },
  {
    id: 7,
    name: '山田 正男',
    address: '鹿児島県指宿市東方77-88',
    phone: '080-8765-4321',
    photoUrl: 'https://picsum.photos/seed/user7/100/100',
    attendanceDays: { ...defaultAttendance, tue: true, thu: true },
  },
  { id: 8, name: '中村 修平', address: '鹿児島県指宿市山川福元1-1', photoUrl: 'https://picsum.photos/seed/user8/100/100', attendanceDays: { ...defaultAttendance, mon: true } },
  { id: 9, name: '小林 恵美', address: '鹿児島県指宿市東方2-2', photoUrl: 'https://picsum.photos/seed/user9/100/100', attendanceDays: { ...defaultAttendance, mon: true, fri: true } },
  { id: 10, name: '斎藤 雄大', address: '鹿児島県南九州市知覧町塩屋3-3', photoUrl: 'https://picsum.photos/seed/user10/100/100', attendanceDays: { ...defaultAttendance, mon: true, wed: true } },

];

export const DRIVERS: Driver[] = [
  { id: 1, name: '鈴木 一郎', email: 'driver1@example.com' },
  { id: 2, name: '加藤 恵子', email: 'driver2@example.com' },
  { id: 3, name: '木村 拓也', email: 'driver3@example.com' },
  { id: 4, name: '吉田 沙保里' },
  { id: 5, name: '清水 健太', email: 'driver5@example.com' },
];

export const VEHICLES: Vehicle[] = [
  { id: 1, model: 'トヨタ ハイエース', licensePlate: '鹿児島 300 あ 12-34' },
  { id: 2, model: '日産 キャラバン', licensePlate: '鹿児島 300 い 56-78' },
  { id: 3, model: 'トヨタ シエンタ', licensePlate: '鹿児島 500 う 11-22' },
  { id: 4, model: 'ホンダ ステップワゴン', licensePlate: '鹿児島 500 え 33-44' },
  { id: 5, model: '三菱 デリカ', licensePlate: '鹿児島 300 お 99-88' },
];

export const ROUTE_TEMPLATES: RouteTemplate[] = [
    { 
        id: 1, 
        templateName: '月曜Aコース(山川方面)', 
        routeName: 'ルートA',
        userIds: [1, 5],
        driverId: 1,
        vehicleId: 1,
        applicableDays: { ...defaultAttendance, mon: true }
    },
    { 
        id: 2, 
        templateName: '月曜Bコース(知覧方面)', 
        routeName: 'ルートB',
        userIds: [2, 10],
        driverId: 2,
        vehicleId: 2,
        applicableDays: { ...defaultAttendance, mon: true }
    },
    { 
        id: 3, 
        templateName: '月曜Cコース(指宿市街)', 
        routeName: 'ルートC',
        userIds: [3, 9],
        driverId: 3,
        vehicleId: 3,
        applicableDays: { ...defaultAttendance, mon: true }
    },
    {
        id: 4,
        templateName: '月曜Dコース(川辺・頴娃)',
        routeName: 'ルートD',
        userIds: [4, 6],
        driverId: 4,
        vehicleId: 4,
        applicableDays: { ...defaultAttendance, mon: true }
    },
    {
        id: 5,
        templateName: '月曜Eコース(東方・福元)',
        routeName: 'ルートE',
        userIds: [7, 8],
        driverId: 5,
        vehicleId: 5,
        applicableDays: { ...defaultAttendance, mon: true }
    },
    { 
        id: 10, 
        templateName: '火・木コース', 
        routeName: '火木送迎',
        userIds: [2, 3, 4, 7],
        driverId: 1,
        vehicleId: 1,
        applicableDays: { ...defaultAttendance, tue: true, thu: true }
    },
    { 
        id: 11, 
        templateName: '水・金コース', 
        routeName: '水金送迎',
        userIds: [1, 3, 5, 6, 9, 10],
        driverId: 2,
        vehicleId: 2,
        applicableDays: { ...defaultAttendance, wed: true, fri: true }
    },
];

export const TEMPLATE_SETS: TemplateSet[] = [
    {
        id: 1,
        name: '月曜フルコース',
        templateIds: [1, 2, 3, 4, 5], // Corresponds to the 5 Monday routes above
        applicableDays: { ...defaultAttendance, mon: true }
    }
];


export const DAY_SERVICE_CENTER = {
  name: '開聞クリニック',
  address: '鹿児島県指宿市開聞十町1294-2'
};