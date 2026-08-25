'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
      {/* Fixed Sidebar */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      {/* Main Content Area */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-200 ${
          collapsed ? 'pl-16' : 'pl-64'
        }`}
      >
        <TopNavbar />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;
