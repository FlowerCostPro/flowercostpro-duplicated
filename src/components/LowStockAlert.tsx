import React, { useState } from 'react';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Package, RefreshCw, X } from 'lucide-react';
import { ProductTemplate } from '../types/Product';

const getTypeColor = (type: string) => {
  switch (type) {
    case 'stem': return 'bg-green-100 text-green-800';
    case 'vase': return 'bg-blue-100 text-blue-800';
    case 'accessory': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

interface ItemCardProps {
  template: ProductTemplate;
  isOutOfStock: boolean;
  restockValue: string;
  onRestockChange: (id: string, value: string) => void;
  onRestock: (template: ProductTemplate) => void;
  onSetStock: (template: ProductTemplate) => void;
  onDismiss: (id: string) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({
  template,
  isOutOfStock,
  restockValue,
  onRestockChange,
  onRestock,
  onSetStock,
  onDismiss
}) => (
  <div className={`border rounded-lg p-4 relative ${isOutOfStock ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
    <button
      onClick={() => onDismiss(template.id)}
      className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
      title="Remove alert (clears low stock threshold)"
    >
      <X className="w-4 h-4" />
    </button>

    <div className="flex items-start gap-3 mb-3 pr-6">
      <div className={`p-2 rounded-full ${isOutOfStock ? 'bg-red-100' : 'bg-amber-100'}`}>
        <Package className={`w-5 h-5 ${isOutOfStock ? 'text-red-600' : 'text-amber-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800 truncate">{template.name}</h3>
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getTypeColor(template.type)}`}>
          {template.type}
        </span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
      <div className="bg-white rounded p-2 text-center border">
        <div className="text-gray-500 text-xs">In Stock</div>
        <div className={`font-bold text-lg ${isOutOfStock ? 'text-red-600' : 'text-amber-600'}`}>
          {template.inventoryCount}
        </div>
      </div>
      <div className="bg-white rounded p-2 text-center border">
        <div className="text-gray-500 text-xs">Alert Threshold</div>
        <div className="font-bold text-lg text-gray-700">
          {template.lowStockThreshold ?? '—'}
        </div>
      </div>
    </div>

    <div className={`text-xs font-semibold mb-3 flex items-center gap-1 ${isOutOfStock ? 'text-red-700' : 'text-amber-700'}`}>
      <AlertTriangle className="w-3 h-3" />
      {isOutOfStock ? 'OUT OF STOCK — needs immediate restocking' : 'LOW STOCK — reorder soon'}
    </div>

    <div className="flex gap-2">
      <input
        type="number"
        min="0"
        value={restockValue}
        onChange={e => onRestockChange(template.id, e.target.value)}
        placeholder={isOutOfStock ? 'New qty' : 'Add qty'}
        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button
        onClick={() => isOutOfStock ? onSetStock(template) : onRestock(template)}
        disabled={restockValue === ''}
        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        {isOutOfStock ? 'Set Stock' : 'Restock'}
      </button>
    </div>
    <p className="text-xs text-gray-500 mt-1">
      {isOutOfStock ? 'Enter the new total quantity on hand' : 'Enter the quantity you are adding to current stock'}
    </p>
  </div>
);

interface LowStockAlertProps {
  templates: ProductTemplate[];
  onUpdateTemplate: (templateId: string, updates: Partial<ProductTemplate>) => void;
}

const LowStockAlert: React.FC<LowStockAlertProps> = ({ templates, onUpdateTemplate }) => {
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>({});

  const lowStockItems = templates.filter(t => {
    if (t.inventoryCount === undefined) return false;
    if (t.inventoryCount === 0) return true;
    if (t.lowStockThreshold !== undefined && t.inventoryCount <= t.lowStockThreshold) return true;
    return false;
  });

  const outOfStock = lowStockItems.filter(t => t.inventoryCount === 0);
  const lowStock = lowStockItems.filter(t => t.inventoryCount !== undefined && t.inventoryCount > 0);

  const handleRestockChange = (id: string, value: string) => {
    setRestockAmounts(prev => ({ ...prev, [id]: value }));
  };

  const handleRestock = (template: ProductTemplate) => {
    const amount = parseInt(restockAmounts[template.id] ?? '');
    if (isNaN(amount) || amount <= 0) return;
    const newCount = (template.inventoryCount ?? 0) + amount;
    onUpdateTemplate(template.id, { inventoryCount: newCount });
    setRestockAmounts(prev => { const n = { ...prev }; delete n[template.id]; return n; });
  };

  const handleSetStock = (template: ProductTemplate) => {
    const amount = parseInt(restockAmounts[template.id] ?? '');
    if (isNaN(amount) || amount < 0) return;
    onUpdateTemplate(template.id, { inventoryCount: amount });
    setRestockAmounts(prev => { const n = { ...prev }; delete n[template.id]; return n; });
  };

  const handleDismiss = (id: string) => {
    // Clear the low stock threshold so this item no longer triggers an alert
    onUpdateTemplate(id, { lowStockThreshold: undefined });
  };

  if (lowStockItems.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center border border-gray-200">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-800 mb-2">All stocked up!</h3>
        <p className="text-gray-500">
          No items are currently low or out of stock. Items with inventory tracking will appear here when they need attention.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-800">Low Stock Alerts</h2>
          <span className="ml-auto text-sm text-gray-500">
            {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need attention
          </span>
        </div>
        <p className="text-gray-600 text-sm">
          Restock items directly from this page. Use the X button to permanently remove an alert (this clears the threshold — you can set a new one in Product Library).
        </p>
        <div className="flex gap-4 mt-4">
          {outOfStock.length > 0 && (
            <div className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              {outOfStock.length} out of stock
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              {lowStock.length} running low
            </div>
          )}
        </div>
      </div>

      {/* Out of stock section */}
      {outOfStock.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-red-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            Out of Stock ({outOfStock.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {outOfStock.map(t => (
              <ItemCard
                key={t.id}
                template={t}
                isOutOfStock={true}
                restockValue={restockAmounts[t.id] ?? ''}
                onRestockChange={handleRestockChange}
                onRestock={handleRestock}
                onSetStock={handleSetStock}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </div>
      )}

      {/* Low stock section */}
      {lowStock.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-amber-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
            Running Low ({lowStock.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStock.map(t => (
              <ItemCard
                key={t.id}
                template={t}
                isOutOfStock={false}
                restockValue={restockAmounts[t.id] ?? ''}
                onRestockChange={handleRestockChange}
                onRestock={handleRestock}
                onSetStock={handleSetStock}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LowStockAlert;
