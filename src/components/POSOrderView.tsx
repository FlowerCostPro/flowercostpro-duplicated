import React, { useState } from 'react';
import { Receipt, Upload, X, DollarSign, Package, TrendingUp, Copy, FileText } from 'lucide-react';
import { OrderRecord } from '../types/Product';

interface POSOrderViewProps {
  orders: OrderRecord[];
}

const POSOrderView: React.FC<POSOrderViewProps> = ({ orders }) => {
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOrderSelector, setShowOrderSelector] = useState(false);

  const filteredOrders = orders.filter((order: OrderRecord) =>
    order.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUploadOrder = (order: OrderRecord) => {
    setSelectedOrder(order);
    setShowOrderSelector(false);
    setSearchTerm('');
  };

  const clearPOSOrder = () => {
    setSelectedOrder(null);
  };

  const generatePOSText = (order: OrderRecord) => {
    const lines = [];
    lines.push('='.repeat(50));
    lines.push(`ORDER: ${order.name}`);
    lines.push(`DATE: ${order.date.toLocaleDateString()} ${order.date.toLocaleTimeString()}`);
    lines.push(`ORDER ID: #${order.id}`);
    if (order.staffName) {
      lines.push(`STAFF: ${order.staffName}${order.staffId ? ` (ID: ${order.staffId})` : ''}`);
    }
    lines.push('='.repeat(50));
    lines.push('');
    
    if (order.notes) {
      lines.push('NOTES:');
      lines.push(order.notes);
      lines.push('');
    }
    
    lines.push('ITEMS:');
    lines.push('-'.repeat(50));
    
    order.products.forEach((product, index) => {
      const estimatedRetailPrice = product.wholesaleCost * 2.5;
      const totalWholesale = product.wholesaleCost * product.quantity;
      const totalRetail = estimatedRetailPrice * product.quantity;
      const itemProfit = totalRetail - totalWholesale;
      
      lines.push(`${index + 1}. ${product.name} (${product.type})`);
      lines.push(`   Qty: ${product.quantity} | Wholesale: $${product.wholesaleCost.toFixed(2)} each`);
      lines.push(`   Retail: $${estimatedRetailPrice.toFixed(2)} each | Total: $${totalRetail.toFixed(2)}`);
      lines.push(`   Item Profit: $${itemProfit.toFixed(2)}`);
      lines.push('');
    });
    
    lines.push('-'.repeat(50));
    lines.push('FINANCIAL SUMMARY:');
    lines.push(`Total Items: ${order.products.reduce((sum, p) => sum + p.quantity, 0)}`);
    lines.push(`Total Wholesale Cost: $${order.totalWholesale.toFixed(2)}`);
    lines.push(`Total Retail Price: $${order.totalRetail.toFixed(2)}`);
    lines.push(`Total Profit: $${order.profit.toFixed(2)}`);
    lines.push(`Profit Margin: ${((order.profit / order.totalRetail) * 100).toFixed(1)}%`);
    lines.push('='.repeat(50));
    
    return lines.join('\n');
  };

  const copyPOSText = async () => {
    if (!selectedOrder) return;
    
    const posText = generatePOSText(selectedOrder);
    
    try {
      await navigator.clipboard.writeText(posText);
      alert('Order details copied to clipboard! You can now paste this into your POS system.');
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = posText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Order details copied to clipboard! You can now paste this into your POS system.');
    }
  };

  const downloadPOSText = () => {
    if (!selectedOrder) return;
    
    const posText = generatePOSText(selectedOrder);
    const blob = new Blob([posText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedOrder.name.replace(/[^a-z0-9]/gi, '_')}_order_record.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">POS Order View</h2>
        </div>
        {selectedOrder && (
          <button
            onClick={clearPOSOrder}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {!selectedOrder ? (
        <div className="space-y-4">
          <div className="text-center py-8">
            <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">Upload Saved Order</h3>
            <p className="text-gray-400 mb-4">Select a saved order to view in POS format</p>
            
            <button
              onClick={() => setShowOrderSelector(true)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <Upload className="w-4 h-4" />
              Select Order
            </button>
          </div>

          {/* Order Selector Modal */}
          {showOrderSelector && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Select Order to Upload</h3>
                    <button
                      onClick={() => setShowOrderSelector(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search orders..."
                  />
                </div>
                
                <div className="p-6 overflow-y-auto max-h-96">
                  {filteredOrders.length > 0 ? (
                    <div className="space-y-3">
                      {filteredOrders.map((order: OrderRecord) => (
                        <div
                          key={order.id}
                          onClick={() => handleUploadOrder(order)}
                          className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-800">{order.name}</h4>
                              <div className="text-sm text-gray-500 mt-1">
                                {order.date.toLocaleDateString()} • {order.products.length} items
                              </div>
                              <div className="text-sm text-green-600 font-medium">
                                ${order.totalRetail.toFixed(2)} • Profit: ${order.profit.toFixed(2)}
                              </div>
                            </div>
                            {order.photo && (
                              <img
                                src={order.photo}
                                alt={order.name}
                                className="w-12 h-12 object-cover rounded-md ml-3"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No orders found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* POS Order Display */
        <div className="space-y-6">
          {/* Order Header */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{selectedOrder.name}</h3>
                <div className="text-sm text-gray-600">
                  Order Date: {selectedOrder.date.toLocaleDateString()} at {selectedOrder.date.toLocaleTimeString()}
                </div>
                <div className="text-sm text-gray-600">
                  Order ID: #{selectedOrder.id}
                </div>
                {selectedOrder.staffName && (
                  <div className="text-sm text-gray-600">
                    Staff: {selectedOrder.staffName}
                    {selectedOrder.staffId && ` (ID: ${selectedOrder.staffId})`}
                  </div>
                )}
              </div>
              {selectedOrder.photo && (
                <div className="ml-6">
                  <img
                    src={selectedOrder.photo}
                    alt={selectedOrder.name}
                    className="w-32 h-32 object-cover rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>

            {selectedOrder.notes && (
              <div className="bg-white rounded-md p-3 mt-4">
                <h4 className="font-medium text-gray-800 mb-1">Order Notes</h4>
                <p className="text-gray-600 text-sm">{selectedOrder.notes}</p>
              </div>
            )}
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-full">
                  <DollarSign className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <div className="text-sm text-red-600 font-medium">Total Wholesale Cost</div>
                  <div className="text-2xl font-bold text-red-700">${selectedOrder.totalWholesale.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full">
                  <Package className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-green-600 font-medium">Total Retail Price</div>
                  <div className="text-2xl font-bold text-green-700">${selectedOrder.totalRetail.toFixed(2)}</div>
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
                  <div className="text-2xl font-bold text-blue-700">${selectedOrder.profit.toFixed(2)}</div>
                  <div className="text-xs text-blue-600">
                    {((selectedOrder.profit / selectedOrder.totalRetail) * 100).toFixed(1)}% margin
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Order Items ({selectedOrder.products.length} items)
            </h4>
            
            <div className="space-y-3">
              {selectedOrder.products.map((product: any, index: number) => {
                // Calculate retail price based on current markup (this is an approximation)
                const estimatedRetailPrice = product.wholesaleCost * 2.5; // Default multiplier
                const totalWholesale = product.wholesaleCost * product.quantity;
                const totalRetail = estimatedRetailPrice * product.quantity;
                const itemProfit = totalRetail - totalWholesale;

                return (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium text-gray-600">
                          {product.quantity}
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-800">{product.name}</h5>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(product.type)}`}>
                            {product.type}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">${totalRetail.toFixed(2)}</div>
                        <div className="text-sm text-gray-500">
                          ${estimatedRetailPrice.toFixed(2)} each
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm bg-gray-50 rounded-md p-3">
                      <div>
                        <span className="text-gray-600">Wholesale:</span>
                        <div className="font-medium">${totalWholesale.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Retail:</span>
                        <div className="font-medium text-green-600">${totalRetail.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Profit:</span>
                        <div className="font-medium text-blue-600">${itemProfit.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 border-t">
            <button
              onClick={copyPOSText}
              className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy for POS
            </button>
            <button
              onClick={downloadPOSText}
              className="bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Download Text
            </button>
            <button
              onClick={() => window.print()}
              className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              Print Receipt
            </button>
            <button
              onClick={() => setShowOrderSelector(true)}
              className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Load Different Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSOrderView;