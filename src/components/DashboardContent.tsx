import React from 'react';
import { TrendingUp, Package, ShoppingCart, Users, DollarSign, Award } from 'lucide-react';
import { OrderRecord, ProductTemplate } from '../types/Product';

interface DashboardContentProps {
  activeSection: string;
  userRole: 'owner' | 'manager' | 'staff';
  orders: OrderRecord[];
  templates: ProductTemplate[];
  children: React.ReactNode;
}

const DashboardContent: React.FC<DashboardContentProps> = ({
  activeSection,
  userRole,
  orders,
  templates,
  children
}) => {
  if (activeSection !== 'overview') {
    return <>{children}</>;
  }

  // Calculate overview stats
  const totalRevenue = orders.reduce((sum: number, order: OrderRecord) => sum + order.totalRetail, 0);
  const totalProfit = orders.reduce((sum: number, order: OrderRecord) => sum + order.profit, 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Recent orders (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentOrders = orders.filter((order: OrderRecord) => order.date >= sevenDaysAgo);

  // Staff performance (if orders have staff info)
  const staffPerformance = new Map<string, { orders: number, revenue: number }>();
  orders.forEach((order: OrderRecord) => {
    if (order.staffName) {
      const existing = staffPerformance.get(order.staffName) || { orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += order.totalRetail;
      staffPerformance.set(order.staffName, existing);
    }
  });

  const topStaff = Array.from(staffPerformance.entries())
    .sort(([,a], [,b]) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Welcome back{userRole === 'staff' ? '' : ' to your dashboard'}!
        </h3>
        <p className="text-gray-600">
          {userRole === 'staff' 
            ? 'Ready to create beautiful arrangements? Use the "Create Order" section to build arrangements within customer budgets.'
            : userRole === 'manager'
            ? 'Monitor your shop\'s performance and manage your product library.'
            : 'Here\'s an overview of your flower shop\'s performance and key metrics.'
          }
        </p>
      </div>

      {/* Key Metrics - Owner/Manager Only */}
      {(userRole === 'owner' || userRole === 'manager') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600">Total Revenue</div>
                <div className="text-xl font-bold text-green-700 truncate">${totalRevenue.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600">Total Profit</div>
                <div className="text-xl font-bold text-blue-700 truncate">${totalProfit.toFixed(2)}</div>
                <div className="text-xs text-blue-600">{profitMargin.toFixed(1)}% margin</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="bg-purple-100 p-3 rounded-full">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600">Avg Order Value</div>
                <div className="text-xl font-bold text-purple-700 truncate">${avgOrderValue.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="bg-orange-100 p-3 rounded-full">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600">Products</div>
                <div className="text-xl font-bold text-orange-700">{templates.length}</div>
                <div className="text-xs text-orange-600">{orders.length} orders</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Quick Stats */}
      {userRole === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="bg-green-100 p-3 rounded-full">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600">Total Orders</div>
                <div className="text-xl font-bold text-green-700">{orders.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-3 rounded-full">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600">Products Available</div>
                <div className="text-xl font-bold text-blue-700">{templates.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="bg-purple-100 p-3 rounded-full">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600">Recent Orders</div>
                <div className="text-xl font-bold text-purple-700">{recentOrders.length}</div>
                <div className="text-xs text-purple-600">Last 7 days</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Recent Orders
          </h4>
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.slice(0, 5).map((order: OrderRecord) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-800">{order.name}</div>
                    <div className="text-sm text-gray-500">
                      {order.date.toLocaleDateString()} • {order.products.length} items
                      {order.staffName && ` • by ${order.staffName}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">${order.totalRetail.toFixed(2)}</div>
                    {(userRole === 'owner' || userRole === 'manager') && (
                      <div className="text-sm text-gray-500">${order.profit.toFixed(2)} profit</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No recent orders</p>
            </div>
          )}
        </div>

        {/* Staff Performance - Owner/Manager Only */}
        {(userRole === 'owner' || userRole === 'manager') && topStaff.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-600" />
              Top Performing Staff
            </h4>
            <div className="space-y-3">
              {topStaff.map(([staffName, performance], index) => (
                <div key={staffName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-100 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold text-yellow-700">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{staffName}</div>
                      <div className="text-sm text-gray-500">{performance.orders} orders</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">${performance.revenue.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">revenue</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions for Staff */}
        {userRole === 'staff' && (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Quick Actions
            </h4>
            <div className="space-y-3">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h5 className="font-medium text-purple-800 mb-2">💡 Staff Tips</h5>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Always check customer budget before starting</li>
                  <li>• Use "Create Order" to build arrangements</li>
                  <li>• Copy order details to your POS when ready</li>
                  <li>• Your name will be tracked with each order</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Start Guide */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">
          {userRole === 'staff' ? 'How to Create Orders' : 'Quick Start Guide'}
        </h4>
        <div className={`grid grid-cols-1 ${userRole === 'staff' ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'} gap-4`}>
          {userRole === 'staff' ? (
            <>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="font-medium text-green-800 mb-2">1. Create Order</div>
                <p className="text-sm text-green-700">Use "Create Order" to build arrangements with real-time cost tracking</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="font-medium text-blue-800 mb-2">2. Stay in Budget</div>
                <p className="text-sm text-blue-700">Watch the budget tracker to keep arrangements profitable</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="font-medium text-purple-800 mb-2">3. Send to POS</div>
                <p className="text-sm text-purple-700">Copy order details and paste into your POS system</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="font-medium text-green-800 mb-2">1. Configure Settings</div>
                <p className="text-sm text-green-700">Start here: Set your markup percentages and store information</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="font-medium text-blue-800 mb-2">2. Build Product Library</div>
                <p className="text-sm text-blue-700">Add your flowers, vases, and accessories with costs and inventory</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="font-medium text-purple-800 mb-2">3. Create Recipes</div>
                <p className="text-sm text-purple-700">Optional: Save your best arrangements as reusable recipes</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="font-medium text-yellow-800 mb-2">4. Start Creating Orders</div>
                <p className="text-sm text-yellow-700">Begin making arrangements with automatic profit tracking</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardContent;