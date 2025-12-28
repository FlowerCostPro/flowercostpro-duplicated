import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Settings, 
  TrendingUp, 
  BookOpen, 
  ShoppingCart,
  User,
  Crown,
  Shield,
  LogOut,
  MessageSquare
} from 'lucide-react';

interface DashboardProps {
  userRole: 'owner' | 'manager' | 'staff';
  userName: string;
  storeName: string;
  onRoleChange: (role: 'owner' | 'manager' | 'staff') => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  onShowFeedback: () => void;
  children: React.ReactNode;
}

const Dashboard: React.FC<DashboardProps> = ({
  userRole,
  userName,
  storeName,
  onRoleChange,
  activeSection,
  onSectionChange,
  onLogout,
  onShowFeedback,
  children
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'manager': return <Shield className="w-4 h-4 text-blue-600" />;
      case 'staff': return <User className="w-4 h-4 text-green-600" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staff': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const menuItems = [
    // All roles
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'manager', 'staff'] },
    
    // Setup flow - Owner & Manager only (in logical order)
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['owner'] },
    { id: 'products', label: 'Product Library', icon: Package, roles: ['owner', 'manager'] },
    { id: 'recipes', label: 'Arrangement Recipes', icon: BookOpen, roles: ['owner', 'manager'] },
    
    // Daily operations - All roles
    { id: 'create-order', label: 'Create Order', icon: ShoppingCart, roles: ['owner', 'manager', 'staff'] },
    { id: 'orders', label: 'Order History', icon: ShoppingCart, roles: ['owner', 'manager'] },
    
    // Analysis - Owner & Manager only
    { id: 'analytics', label: 'Profit Analytics', icon: TrendingUp, roles: ['owner', 'manager'] },
    { id: 'insights', label: 'Business Insights', icon: TrendingUp, roles: ['owner', 'manager'] },
    
    // Training - Owner only
    { id: 'staff-training', label: 'Staff Training', icon: Users, roles: ['owner'] },
  ];

  const visibleMenuItems = menuItems.filter(item => item.roles.includes(userRole));

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
              {getRoleIcon(userRole)}
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <div className="font-medium text-gray-800">{userName || 'User'}</div>
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(userRole)}`}>
                  {getRoleIcon(userRole)}
                  {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
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
                    <IconComponent className="w-5 h-5" />
                    {sidebarOpen && <span className="font-medium">{item.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Demo Role Switcher */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                {userName === 'Demo User' ? 'Demo Mode - Switch Role:' : 'Switch Role:'}
              </label>
              <select
                value={userRole}
                onChange={(e) => onRoleChange(e.target.value as 'owner' | 'manager' | 'staff')}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>
        )}

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
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {visibleMenuItems.find(item => item.id === activeSection)?.label || 'Dashboard'}
              </h2>
              <p className="text-gray-600">
                {userRole === 'staff' 
                  ? 'Create beautiful arrangements within budget'
                  : userRole === 'manager'
                  ? 'Manage products and monitor performance'
                  : 'Full business control and analytics'
                }
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleColor(userRole)}`}>
                {getRoleIcon(userRole)}
                <span className="ml-1">{userRole.charAt(0).toUpperCase() + userRole.slice(1)} Access</span>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Dashboard feedback button clicked');
                  onShowFeedback();
                }}
                className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                title="Give feedback"
              >
                <MessageSquare className="w-4 h-4" />
                Feedback
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Sign out"
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