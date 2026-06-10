import React, { useState } from 'react';
import { Users, DollarSign, AlertTriangle, CheckCircle, Target } from 'lucide-react';
import { Product, MarkupSettings } from '../types/Product';

interface StaffTrainingModeProps {
  products: Product[];
  markupSettings: MarkupSettings;
  targetBudget?: number;
  userRole?: 'owner' | 'manager' | 'staff';
}

const StaffTrainingMode: React.FC<StaffTrainingModeProps> = ({
  products,
  markupSettings,
  targetBudget = 100,
  userRole = 'staff'
}) => {
  const [currentBudget, setCurrentBudget] = useState(targetBudget);
  const [showProfitDetails, setShowProfitDetails] = useState(false);

  const totalWholesale = products.reduce((sum: number, product: Product) => 
    sum + (product.wholesaleCost * product.quantity), 0
  );

  // For staff mode, we should show the retail total that matches what they see in Order Builder
  const totalRetail = products.reduce((sum: number, product: Product) => {
    const markup = markupSettings[product.type];
    const retailPrice = product.wholesaleCost * markup;
    return sum + (retailPrice * product.quantity);
  }, 0);

  const profit = totalRetail - totalWholesale;
  const budgetRemaining = currentBudget - totalWholesale;
  const isOverBudget = budgetRemaining < 0;
  const profitMargin = totalRetail > 0 ? (profit / totalRetail) * 100 : 0;

  // Update budget calculations to use retail prices for staff view
  const retailBudgetRemaining = currentBudget - totalRetail;
  const retailIsOverBudget = retailBudgetRemaining < 0;

  const getBudgetStatus = () => {
    if (retailIsOverBudget) return { color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle };
    if (retailBudgetRemaining < currentBudget * 0.1) return { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle };
    return { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle };
  };

  const status = getBudgetStatus();
  const StatusIcon = status.icon;

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-800">Staff Training Mode</h2>
        </div>
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Perfect for training seasonal staff! Add products to see real-time budget tracking.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-800">Staff Training Mode</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Target Budget:</label>
            <input
              type="number"
              value={currentBudget}
              onChange={(e) => setCurrentBudget(parseFloat(e.target.value) || 0)}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={() => setShowProfitDetails(!showProfitDetails)}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            {showProfitDetails ? 'Hide' : 'Show'} Profit Details
          </button>
        </div>
      </div>

      {/* Budget Status Alert */}
      <div className={`${status.bg} border border-opacity-20 rounded-lg p-4 mb-6`}>
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-6 h-6 ${status.color}`} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${status.color}`}>
                {retailIsOverBudget ? 'Over Budget!' : retailBudgetRemaining < currentBudget * 0.1 ? 'Budget Warning' : 'Within Budget'}
              </h3>
              <div className={`text-2xl font-bold ${status.color}`}>
                ${Math.abs(retailBudgetRemaining).toFixed(2)} {retailIsOverBudget ? 'over' : 'remaining'}
              </div>
            </div>
            <p className={`text-sm ${status.color} mt-1`}>
              {retailIsOverBudget 
                ? 'Remove items or increase budget to stay profitable'
                : retailBudgetRemaining < currentBudget * 0.1
                ? 'Close to budget limit - be careful with additional items'
                : 'Good! You have room for more items if needed'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Simple Staff View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <div className="text-sm text-blue-600 font-medium">Target Budget</div>
          <div className="text-2xl font-bold text-blue-700">${currentBudget.toFixed(2)}</div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <DollarSign className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <div className="text-sm text-gray-600 font-medium">Current Order Cost</div>
          <div className="text-2xl font-bold text-gray-700">${totalRetail.toFixed(2)}</div>
        </div>

        <div className={`${status.bg} rounded-lg p-4 text-center`}>
          <StatusIcon className={`w-8 h-8 ${status.color} mx-auto mb-2`} />
          <div className={`text-sm ${status.color} font-medium`}>Status</div>
          <div className={`text-2xl font-bold ${status.color}`}>
            {retailIsOverBudget ? 'OVER' : 'OK'}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Budget Usage</span>
          <span>{((totalRetail / currentBudget) * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              isOverBudget 
                ? 'bg-red-500' 
                : totalRetail / currentBudget > 0.9 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min((totalRetail / currentBudget) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Owner/Manager Profit Details (Toggleable) */}
      {showProfitDetails && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Profit Analysis (Manager View)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Wholesale Cost:</span>
              <div className="font-medium">${totalWholesale.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-gray-600">Retail Price:</span>
              <div className="font-medium text-green-600">${totalRetail.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-gray-600">Profit:</span>
              <div className="font-bold text-green-700">${profit.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-gray-600">Margin:</span>
              <div className="font-bold text-blue-600">{profitMargin.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Instructions */}
      <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <h4 className="font-medium text-purple-800 mb-2">
          📋 {userRole === 'staff' ? 'Your Guidelines' : 'Staff Instructions'}
        </h4>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• Keep the "Current Order Cost" under the "Target Budget"</li>
          <li>• Green status = Good to go! You can add more items</li>
          <li>• Yellow status = Getting close, be careful</li>
          <li>• Red status = Over budget! Remove items or ask manager</li>
          <li>• {userRole === 'staff' ? 'Focus on creating beautiful arrangements within budget' : 'Train staff to focus on beautiful arrangements within budget'}</li>
        </ul>
      </div>
    </div>
  );
};

export default StaffTrainingMode;