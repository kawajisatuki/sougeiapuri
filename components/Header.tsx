
import React from 'react';
import { CarIcon } from './icons/CarIcon';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 md:px-8 py-4 flex items-center">
        <CarIcon className="w-8 h-8 text-blue-600 mr-3" />
        <h1 className="text-2xl font-bold text-slate-800">
          開聞クリニック通所送迎システム
        </h1>
      </div>
    </header>
  );
};

export default Header;