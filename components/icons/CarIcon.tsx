
import React from 'react';

export const CarIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-5-4-5H3v10h14zM3 16V6m18 10l-4-5m0 0l-4 5m4-5v10" />
    <path d="M5 11h2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11h2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
