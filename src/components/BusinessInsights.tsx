import React from 'react';
import { TrendingUp, Target, Award, AlertCircle } from 'lucide-react';
import { OrderRecord, ProductTemplate } from '../types/Product';

type InsightType = 'success' | 'warning' | 'info';

interface BusinessInsightsProps {
  orders: OrderRecord[];
  templates: ProductTemplate[];
}

const BusinessInsights: React.FC<BusinessInsightsProps> = ({ orders }) => {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">Business Insights</h2>
        </div>
        <div className="text-center py-8">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Save some orders to unlock powerful business insights and recommendations.</p>
        </div>
      </div>
    );
  }

  // Calculate key metrics
  const totalRevenue = orders.reduce((sum: number, order: OrderRecord) => sum + order.totalRetail, 0);
  const totalCosts = orders.reduce((sum: number, order: OrderRecord) => sum + order.totalWholesale, 0);
  const avgProfitMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
  const avgOrderValue = totalRevenue / orders.length;

  // Identify pricing opportunities
  const lowMarginOrders = orders.filter((order: OrderRecord) => {
    const margin = order.totalRetail > 0 ? (order.profit / order.totalRetail) * 100 : 0;
    return margin < 40; // Less than 40% margin
  });

  // Most profitable products
  const productPerformance = new Map<string, { profit: number, quantity: number, orders: number }>();
  
  orders.forEach((order: OrderRecord) => {
    order.products.forEach((product: any) => {
      const key = `${product.name}-${product.type}`;
      const existing = productPerformance.get(key) || { profit: 0, quantity: 0, orders: 0 };
      
      // Estimate profit per product (this is approximate)
      const estimatedProfit = (product.wholesaleCost * 1.5) * product.quantity; // Rough estimate
      
      existing.profit += estimatedProfit;
      existing.quantity += product.quantity;
      existing.orders += 1;
      
      productPerformance.set(key, existing);
    });
  });

  const topProducts = Array.from(productPerformance.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  // Seasonal insights (basic)
  const recentOrders = orders.filter((order: OrderRecord) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return order.date >= thirtyDaysAgo;
  });

  const insights = [
    {
      type: 'success',
      icon: Award,
      title: 'Strong Performance',
      message: `Your average profit margin of ${avgProfitMargin.toFixed(1)}% is ${avgProfitMargin > 50 ? 'excellent' : avgProfitMargin > 40 ? 'good' : 'needs improvement'}`,
      action: avgProfitMargin < 40 ? 'Consider reviewing your markup settings' : null
    },
    {
      type: lowMarginOrders.length > orders.length * 0.3 ? 'warning' : 'info',
      icon: AlertCircle,
      title: 'Pricing Opportunities',
      message: `${lowMarginOrders.length} of ${orders.length} orders had margins below 40%`,
      action: lowMarginOrders.length > 0 ? 'Review these orders for pricing optimization' : null
    },
    {
      type: 'info',
      icon: TrendingUp,
      title: 'Order Trends',
      message: `${recentOrders.length} orders in the last 30 days, averaging $${avgOrderValue.toFixed(2)} per order`,
      action: recentOrders.length < 10 ? 'Focus on increasing order frequency' : null
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-semibold text-gray-800">Business Insights</h2>
        <span className="text-sm text-gray-500">({orders.length} orders analyzed)</span>
      </div>

      {/* Key Insights */}
      <div className="space-y-4 mb-8">
        {insights.map((insight, index) => {
          const IconComponent = insight.icon;
          const colors: Record<InsightType, string> = {
            success: 'bg-green-50 border-green-200 text-green-800',
            warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
            info: 'bg-blue-50 border-blue-200 text-blue-800'
          };
          
          return (
            <div key={index} className={`border rounded-lg p-4 ${colors[insight.type as InsightType]}`}>
              <div className="flex items-start gap-3">
                <IconComponent className="w-5 h-5 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium mb-1">{insight.title}</h3>
                  <p className="text-sm mb-2">{insight.message}</p>
                  {insight.action && (
                    <p className="text-xs font-medium">💡 {insight.action}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Performing Products */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-600" />
          Top Performing Products
        </h3>
        <div className="space-y-3">
          {topProducts.map((product, index) => (
            <div key={product.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-yellow-700">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-gray-800">{product.name.split('-')[0]}</div>
                  <div className="text-xs text-gray-500">
                    {product.quantity} sold in {product.orders} orders
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-600">${product.profit.toFixed(2)}</div>
                <div className="text-xs text-gray-500">estimated profit</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-indigo-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" />
          Recommendations
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-indigo-600">•</span>
            <span>Use Staff Training Mode during busy seasons to maintain consistent margins</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-600">•</span>
            <span>Focus on promoting your top-performing products for higher profits</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-600">•</span>
            <span>Review low-margin orders to identify pricing improvement opportunities</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-600">•</span>
            <span>Create arrangement recipes for your most profitable combinations</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessInsights;