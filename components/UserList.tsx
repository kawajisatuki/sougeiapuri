
import React from 'react';
import type { User } from '../types';
import { UserIcon } from './icons/UserIcon';
import { PhoneIcon } from './icons/PhoneIcon';

interface UserListProps {
  users: User[];
  onUserDoubleClick: (userId: number) => void;
}

interface DraggableUserCardProps {
  user: User;
  onDoubleClick: (userId: number) => void;
}

const DraggableUserCard: React.FC<DraggableUserCardProps> = ({ user, onDoubleClick }) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('userId', user.id.toString());
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={() => onDoubleClick(user.id)}
      className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md"
      title="ダブルクリックで最初のルートに自動追加"
    >
      <img src={user.photoUrl} alt={user.name} className="w-12 h-12 rounded-full mr-4" />
      <div className="flex-1 overflow-hidden">
        <p className="font-semibold text-slate-700 truncate">{user.name}</p>
        <p className="text-xs text-slate-500 truncate">{user.address}</p>
        {user.phone && (
            <div className="flex items-center mt-1 text-xs text-slate-500">
                <PhoneIcon className="w-3 h-3 mr-1.5 flex-shrink-0" />
                <span className="truncate">{user.phone}</span>
            </div>
        )}
      </div>
    </div>
  );
};

const UserList: React.FC<UserListProps> = ({ users, onUserDoubleClick }) => {
  return (
    <div className="bg-white p-4 rounded-xl shadow-lg">
      <div className="flex items-center mb-4">
        <UserIcon className="w-6 h-6 text-slate-500 mr-2" />
        <h2 className="text-xl font-bold text-slate-700">利用者一覧</h2>
      </div>
      <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2">
        {users.map(user => (
          <DraggableUserCard key={user.id} user={user} onDoubleClick={onUserDoubleClick} />
        ))}
      </div>
    </div>
  );
};

export default UserList;
