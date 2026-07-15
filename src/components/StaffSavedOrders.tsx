import React, { useState, useEffect } from 'react';
import { Archive, Eye, Calendar, Copy, Search, Import as SortAsc } from 'lucide-react';
import { OrderRecord } from '../types/Product';
import { buildPOSText } from '../lib/posText';

interface StaffSavedOrdersProps {
  orders: OrderRecord[];
  selectedOrderId?: string | null;
}

const StaffSavedOrders: React.FC<StaffSavedOrdersProps> = ({ orders, selectedOrderId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [copyStatusMap, setCopyStatusMap] = useState<Record<string, 'idle' | 'copied' | 'error'>>({});

  useEffect(() => {
    if (selectedOrderId) {
      const order = orders.find(o => o.id === selectedOrderId);
      if (order) {
        setSelectedOrder(order);
      }
    }
  }, [selectedOrderId, orders]);

  const showMessage = (msg: string) => {
    if (!msg) return;
    setCopyMessage(msg);
    setTimeout(() => setCopyMessage(''), 3500);
  };

  const handleCopy = async (order: OrderRecord) => {
    setCopyStatusMap(prev => ({ ...prev, [order.id]: 'idle' }));

    let text: string;
    try {
      text = await buildPOSText(order, 'staff');
    } catch (err) {
      setCopyStatusMap(prev => ({ ...prev, [order.id]: 'error' }));
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showMessage(`Could not generate POS text: ${msg}`);
      setTimeout(() => setCopyStatusMap(prev => ({ ...prev, [order.id]: 'idle' })), 5000);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatusMap(prev => ({ ...prev, [order.id]: 'copied' }));
      showMessage('Copied! Paste into your POS notes field.');
      setTimeout(() => setCopyStatusMap(prev => ({ ...prev, [order.id]: 'idle' })), 3000);
    } catch {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (ok) {
          setCopyStatusMap(prev => ({ ...prev, [order.id]: 'copied' }));
          showMessage('Copied! Paste into your POS notes field.');
          setTimeout(() => setCopyStatusMap(prev => ({ ...prev, [order.id]: 'idle' })), 3000);
        } else {
          throw new Error('execCommand failed');
        }
      } catch {
        setCopyStatusMap(prev => ({ ...prev, [order.id]: 'error' }));
        showMessage('Copy failed — try a different browser or paste manually.');
        setTimeout(() => setCopyStatusMap(prev => ({ ...prev, [order.id]: 'idle' })), 5000);
      }
    }
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Archive className="w-5 h-5 text-teal-600" />
          <h2 className="text-xl font-semibold text-gray-800">My Orders</h2>
        </div>
        <div className="text-center py-8">
          <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No saved orders yet. Create your first order to keep records.</p>
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
        case 'date':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Archive className="w-5 h-5 text-teal-600" />
        <h2 className="text-xl font-semibold text-gray-800">My Orders</h2>
        <span className="text-sm text-gray-500">
          ({filteredAndSortedOrders.length} of {orders.length} orders)
        </span>
      </div>

      {copyMessage && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          copyMessage.includes('failed')
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        }`}>
          {copyMessage}
        </div>
      )}

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
            onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
          >
            <option value="date">Sort by Date (Newest)</option>
            <option value="name">Sort by Name (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedOrders.map((order) => {
          const status = copyStatusMap[order.id] ?? 'idle';
          return (
            <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium text-gray-800 text-sm line-clamp-2">{order.name}</h3>
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="text-gray-400 hover:text-teal-600 transition-colors"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </button>
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

                {order.staffName && (
                  <div className="text-gray-600">
                    Designer: {order.staffName}
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  {order.products.length} items • ${(order.customerPrice ?? order.totalRetail).toFixed(2)} total
                </div>
              </div>

              <button
                onClick={() => handleCopy(order)}
                className={`mt-3 w-full py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  status === 'copied'
                    ? 'bg-emerald-100 text-emerald-700'
                    : status === 'error'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                {status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy failed' : 'Copy for POS'}
              </button>
            </div>
          );
        })}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-800">{selectedOrder.name}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(selectedOrder)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      (copyStatusMap[selectedOrder.id] ?? 'idle') === 'copied'
                        ? 'bg-emerald-100 text-emerald-700'
                        : (copyStatusMap[selectedOrder.id] ?? 'idle') === 'error'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {(copyStatusMap[selectedOrder.id] ?? 'idle') === 'copied' ? 'Copied!' : 'Copy for POS'}
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="text-2xl">×</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{selectedOrder.date.toLocaleDateString()}</span>
                  </div>
                  {selectedOrder.staffName && (
                    <div>
                      Designer: {selectedOrder.staffName}
                      {selectedOrder.staffId && ` (ID: ${selectedOrder.staffId})`}
                    </div>
                  )}
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

                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Items ({selectedOrder.products.length})</h4>
                  <div className="space-y-2">
                    {selectedOrder.products.map((product, index) => (
                      <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-md text-sm">
                        <div>
                          <span className="font-medium">{product.name}</span>
                          <span className="text-gray-500 ml-2">({product.type})</span>
                        </div>
                        <div className="text-right">
                          <div>Qty: {product.quantity}</div>
                          {product.retailPrice != null && (
                            <div className="text-gray-600">${product.retailPrice.toFixed(2)} each</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.laborAmount != null && selectedOrder.laborAmount > 0 && (
                  <div className="flex justify-between items-center py-2 px-3 bg-amber-50 rounded-md text-sm">
                    <span className="text-gray-700">Design & labor</span>
                    <span className="font-medium text-amber-700">${selectedOrder.laborAmount.toFixed(2)}</span>
                  </div>
                )}

                {selectedOrder.customerPrice != null && (
                  <div className="flex justify-between items-center py-2 px-3 bg-gray-100 rounded-md text-sm">
                    <span className="font-medium text-gray-800">Total</span>
                    <span className="font-bold text-gray-900">${selectedOrder.customerPrice.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffSavedOrders;
