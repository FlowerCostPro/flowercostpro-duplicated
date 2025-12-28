import React, { useState } from 'react';
import { Archive, Eye, Trash2, Calendar, DollarSign, Search, SortAsc } from 'lucide-react';
import { OrderRecord } from '../types/Product';

interface SavedOrdersProps {
  orders: OrderRecord[];
  onDeleteOrder: (orderId: string) => void;
}

const SavedOrders: React.FC<SavedOrdersProps> = ({ orders, onDeleteOrder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'profit'>('date');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Archive className="w-5 h-5 text-teal-600" />
          <h2 className="text-xl font-semibold text-gray-800">Saved Orders</h2>
        </div>
        <div className="text-center py-8">
          <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No saved orders yet. Save your first order to keep records.</p>
        </div>
      </div>
    );
  }

  const filteredAndSortedOrders = [...orders]
    .filter(order => 
      order.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        case 'profit':
          return b.profit - a.profit;
        case 'date':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Archive className="w-5 h-5 text-teal-600" />
        <h2 className="text-xl font-semibold text-gray-800">Saved Orders</h2>
        <span className="text-sm text-gray-500">
          ({filteredAndSortedOrders.length} of {orders.length} orders)
        </span>
      </div>

      {/* Search and Sort */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Search orders..."
          />
        </div>
        
        <div className="relative">
          <SortAsc className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'profit')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
          >
            <option value="date">Sort by Date (Newest)</option>
            <option value="name">Sort by Name (A-Z)</option>
            <option value="profit">Sort by Profit (Highest)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedOrders.map((order) => (
          <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-medium text-gray-800 text-sm line-clamp-2">{order.name}</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="text-gray-400 hover:text-teal-600 transition-colors"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteOrder(order.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete order"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {order.photo && (
              <div className="mb-3">
                <img
                  src={order.photo}
                  alt={order.name}
                  className="w-full h-24 object-cover rounded-md"
                />
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-3 h-3" />
                <span>{order.date.toLocaleDateString()}</span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-600">
                <DollarSign className="w-3 h-3" />
                <span>Profit: ${order.profit.toFixed(2)}</span>
              </div>

              <div className="text-xs text-gray-500">
                {order.products.length} items • ${order.totalRetail.toFixed(2)} retail
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-800">{selectedOrder.name}</h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{selectedOrder.date.toLocaleDateString()}</span>
                  </div>
                </div>

                {selectedOrder.photo && (
                  <div>
                    <img
                      src={selectedOrder.photo}
                      alt={selectedOrder.name}
                      className="w-full max-w-md mx-auto rounded-lg"
                    />
                  </div>
                )}

                {selectedOrder.notes && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Notes</h4>
                    <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded-md">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}

                {selectedOrder.staffName && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Staff Information</h4>
                    <div className="text-gray-600 text-sm bg-gray-50 p-3 rounded-md">
                      <div><strong>Name:</strong> {selectedOrder.staffName}</div>
                      {selectedOrder.staffId && (
                        <div><strong>Employee ID:</strong> {selectedOrder.staffId}</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3">Financial Summary</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Wholesale:</span>
                      <div className="font-medium">${selectedOrder.totalWholesale.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Retail:</span>
                      <div className="font-medium text-green-600">${selectedOrder.totalRetail.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Profit:</span>
                      <div className="font-bold text-green-700">${selectedOrder.profit.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Products ({selectedOrder.products.length} items)</h4>
                  <div className="space-y-2">
                    {selectedOrder.products.map((product: any, index: number) => (
                      <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-md text-sm">
                        <div>
                          <span className="font-medium">{product.name}</span>
                          <span className="text-gray-500 ml-2">({product.type})</span>
                        </div>
                        <div className="text-right">
                          <div>Qty: {product.quantity}</div>
                          <div className="text-gray-600">${product.wholesaleCost.toFixed(2)} each</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedOrders;