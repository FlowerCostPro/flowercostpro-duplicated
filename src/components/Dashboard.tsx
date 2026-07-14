import React, { useState } from 'react';
import { LayoutDashboard, Users, Package, Settings, TrendingUp, BookOpen, ShoppingCart, User, Crown, LogOut, MessageSquare, TriangleAlert as AlertTriangle } from 'lucide-react';
import { ProductTemplate } from '../types/Product';

interface DashboardProps {
  accountRole: 'owner' | 'staff';
  userName: string;
  storeName: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  onShowFeedback: () => void;
  templates: ProductTemplate[];
  children: React.ReactNode;
}

const Dashboard: React.FC<DashboardProps> = ({
  accountRole,
  userName,
  storeName,
  activeSection,
  onSectionChange,
  onLogout,
  onShowFeedback,
  templates,
  children
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const lowStockCount = templates.filter(t => {
    if (t.inventoryCount === undefined) return false;
    if (t.inventoryCount === 0) return true;
    if (t.lowStockThreshold !== undefined && t.inventoryCount <= t.lowStockThreshold) return true;
    return false;
  }).length;

  // Owner-only sections. Staff never sees them and cannot navigate to them.
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, ownerOnly: false },
    { id: 'create-order', label: 'Create Order', icon: ShoppingCart, ownerOnly: false },
    { id: 'recipes', label: 'Arrangement Recipes', icon: BookOpen, ownerOnly: false },
    { id: 'orders', label: 'Order History', icon: ShoppingCart, ownerOnly: true },
    { id: 'products', label: 'Product Library', icon: Package, ownerOnly: true },
    { id: 'low-stock', label: 'Low Stock Alert', icon: AlertTriangle, ownerOnly: true },
    { id: 'analytics', label: 'Profit Analytics', icon: TrendingUp, ownerOnly: true },
    { id: 'insights', label: 'Business Insights', icon: TrendingUp, ownerOnly: true },
    { id: 'staff-training', label: 'Staff Training', icon: Users, ownerOnly: true },
    { id: 'team', label: 'Team', icon: Users, ownerOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, ownerOnly: true },
  ];

  const visibleMenuItems = menuItems.filter(item =>
    accountRole === 'owner' ? true : !item.ownerOnly
  );

  const roleLabel = accountRole === 'owner' ? 'Owner' : 'Designer';
  const RoleIcon = accountRole === 'owner' ? Crown : User;
  const roleBadgeClass = accountRole === 'owner'
    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
    : 'bg-green-100 text-green-800 border-green-200';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="FlowerCost Pro"
              className={sidebarOpen ? "h-16 w-auto" : "h-10 w-10"}
            />
            {sidebarOpen && (
              <div>
                <p className="text-xs text-gray-500 mt-1">{storeName || 'Your Flower Shop'}</p>
              </div>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 p-2 rounded-full">
              <RoleIcon className={`w-4 h-4 ${accountRole === 'owner' ? 'text-yellow-600' : 'text-green-600'}`} />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">{userName || 'User'}</div>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadgeClass}`}>
                  <RoleIcon className="w-3 h-3" />
                  {roleLabel}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {visibleMenuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeSection === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => onSectionChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="font-medium flex-1 text-left">{item.label}</span>
                    )}
                    {item.id === 'low-stock' && lowStockCount > 0 && (
                      <span className="min-w-[1.25rem] h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
                        {lowStockCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Toggle */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {visibleMenuItems.find(item => item.id === activeSection)?.label || 'Dashboard'}
              </h2>
              <p className="text-gray-600 text-sm">
                {accountRole === 'staff'
                  ? 'Create beautiful arrangements within budget'
                  : 'Full business control and analytics'
                }
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-1 ${roleBadgeClass}`}>
                <RoleIcon className="w-3.5 h-3.5" />
                {roleLabel}
              </div>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShowFeedback(); }}
                className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Feedback
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div data-section={activeSection}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
