import React, { useMemo } from 'react';
import { TrendingUp, DollarSign, Package, Calendar, Award, AlertTriangle } from 'lucide-react';
import { OrderRecord } from '../types/Product';

interface ProfitAnalyticsProps {
  orders: OrderRecord[];
}

const ProfitAnalytics: React.FC<ProfitAnalyticsProps> = ({ orders }) => {
  const analytics = useMemo(() => {
    if (orders.length === 0) return null;

    // Overall metrics
    const totalRevenue = orders.reduce((sum: number, order: OrderRecord) => sum + order.totalRetail, 0);
    const totalCosts = orders.reduce((sum: number, order: OrderRecord) => sum + order.totalWholesale, 0);
    const totalProfit = totalRevenue - totalCosts;
    const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgOrderValue = totalRevenue / orders.length;

    // Product performance analysis
    const productStats = new Map<string, {
      name: string;
      type: string;
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
      totalProfit: number;
      orderCount: number;
    }>();

    orders.forEach((order: OrderRecord) => {
      order.products.forEach((product: any) => {
        const key = `${product.name}-${product.type}`;
        const existing = productStats.get(key) || {
          name: product.name,
          type: product.type,
          totalQuantity: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          orderCount: 0
        };

        const productCost = product.wholesaleCost * product.quantity;
        // Estimate retail price based on average markup (this is approximate)
        const estimatedRetail = productCost * 2.5; // Default multiplier for estimation

        existing.totalQuantity += product.quantity;
        existing.totalCost += productCost;
        existing.totalRevenue += estimatedRetail;
        existing.totalProfit += (estimatedRetail - productCost);
        existing.orderCount += 1;

        productStats.set(key, existing);
      });
    });

    // Convert to array and sort
    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 10);

    const topByQuantity = Array.from(productStats.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);

    // Monthly trends (last 6 months)
    const monthlyData = new Map<string, {
      month: string;
      revenue: number;
      profit: number;
      orderCount: number;
    }>();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    orders
      .filter((order: OrderRecord) => order.date >= sixMonthsAgo)
      .forEach((order: OrderRecord) => {
        const monthKey = order.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        const existing = monthlyData.get(monthKey) || {
          month: monthKey,
          revenue: 0,
          profit: 0,
          orderCount: 0
        };

        existing.revenue += order.totalRetail;
        existing.profit += order.profit;
        existing.orderCount += 1;

        monthlyData.set(monthKey, existing);
      });

    const monthlyTrends = Array.from(monthlyData.values())
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    // Best and worst performing orders
    const bestOrder = orders.reduce((best: OrderRecord, order: OrderRecord) => 
      order.profit > best.profit ? order : best
    );

    const worstOrder = orders.reduce((worst: OrderRecord, order: OrderRecord) => 
      order.profit < worst.profit ? order : worst
    );

    return {
      totalRevenue,
      totalCosts,
      totalProfit,
      avgProfitMargin,
      avgOrderValue,
      topProducts,
      topByQuantity,
      monthlyTrends,
      bestOrder,
      worstOrder,
      totalOrders: orders.length
    };
  }, [orders]);

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-800">Profit Analytics</h2>
        </div>
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No orders yet. Save some orders to see profit analytics.</p>
        </div>
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'stem': return 'bg-green-100 text-green-800';
      case 'vase': return 'bg-blue-100 text-blue-800';
      case 'accessory': return 'bg-purple-100 text-purple-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-green-600" />
        <h2 className="text-xl font-semibold text-gray-800">Profit Analytics</h2>
        <span className="text-sm text-gray-500">({analytics.totalOrders} orders analyzed)</span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-green-600 font-medium">Total Revenue</div>
              <div className="text-2xl font-bold text-green-700">${analytics.totalRevenue.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-blue-600 font-medium">Total Profit</div>
              <div className="text-2xl font-bold text-blue-700">${analytics.totalProfit.toFixed(2)}</div>
              <div className="text-xs text-blue-600">{analytics.avgProfitMargin.toFixed(1)}% margin</div>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-full">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-purple-600 font-medium">Avg Order Value</div>
              <div className="text-2xl font-bold text-purple-700">${analytics.avgOrderValue.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-orange-600 font-medium">Total Orders</div>
              <div className="text-2xl font-bold text-orange-700">{analytics.totalOrders}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-600" />
            Top Profit Makers
          </h3>
          <div className="space-y-3">
            {analytics.topProducts.slice(0, 5).map((product: any, index: number) => (
              <div key={`${product.name}-${product.type}`} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-yellow-700">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{product.name}</div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(product.type)}`}>
                        {product.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {product.totalQuantity} sold in {product.orderCount} orders
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">${product.totalProfit.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">${product.totalRevenue.toFixed(2)} revenue</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Most Popular Items
          </h3>
          <div className="space-y-3">
            {analytics.topByQuantity.map((product: any, index: number) => (
              <div key={`${product.name}-${product.type}`} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-blue-700">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{product.name}</div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(product.type)}`}>
                      {product.type}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600">{product.totalQuantity}</div>
                  <div className="text-xs text-gray-500">{product.orderCount} orders</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      {analytics.monthlyTrends.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Monthly Trends (Last 6 Months)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {analytics.monthlyTrends.map((month: any) => (
              <div key={month.month} className="bg-white rounded-lg p-4 text-center">
                <div className="text-sm font-medium text-gray-600 mb-2">{month.month}</div>
                <div className="text-lg font-bold text-green-600">${month.profit.toFixed(0)}</div>
                <div className="text-xs text-gray-500">{month.orderCount} orders</div>
                <div className="text-xs text-gray-500">${month.revenue.toFixed(0)} revenue</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best and Worst Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-green-600" />
            Most Profitable Order
          </h3>
          <div className="space-y-2">
            <div className="font-medium text-gray-800">{analytics.bestOrder.name}</div>
            <div className="text-sm text-gray-600">
              {analytics.bestOrder.date.toLocaleDateString()}
            </div>
            <div className="text-2xl font-bold text-green-600">
              ${analytics.bestOrder.profit.toFixed(2)} profit
            </div>
            <div className="text-sm text-gray-500">
              ${analytics.bestOrder.totalRetail.toFixed(2)} revenue • {analytics.bestOrder.products.length} items
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Lowest Profit Order
          </h3>
          <div className="space-y-2">
            <div className="font-medium text-gray-800">{analytics.worstOrder.name}</div>
            <div className="text-sm text-gray-600">
              {analytics.worstOrder.date.toLocaleDateString()}
            </div>
            <div className="text-2xl font-bold text-red-600">
              ${analytics.worstOrder.profit.toFixed(2)} profit
            </div>
            <div className="text-sm text-gray-500">
              ${analytics.worstOrder.totalRetail.toFixed(2)} revenue • {analytics.worstOrder.products.length} items
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitAnalytics;