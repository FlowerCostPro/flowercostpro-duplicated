import React, { useState } from 'react';
import { Library, CreditCard as Edit2, Trash2, Clock, Search, ListFilter as Filter, RefreshCw } from 'lucide-react';
import { ProductTemplate, MarkupSettings } from '../types/Product';
import { useToast } from './Toast';

interface ProductLibraryProps {
  templates: ProductTemplate[];
  markupSettings: MarkupSettings;
  onUpdateTemplate: (templateId: string, updates: Partial<ProductTemplate>) => Promise<void>;
  onDeleteTemplate: (templateId: string) => void;
}

const ProductLibrary: React.FC<ProductLibraryProps> = ({
  templates,
  markupSettings,
  onUpdateTemplate,
  onDeleteTemplate
}) => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    wholesaleCost: string;
    type: 'stem' | 'vase' | 'accessory' | 'other';
    unit: 'stem' | 'bunch';
    inventoryCount: string;
    lowStockThreshold: string;
  }>({ name: '', wholesaleCost: '', type: 'stem', unit: 'stem', inventoryCount: '', lowStockThreshold: '' });
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>({});

  const handleRestock = async (template: ProductTemplate) => {
    const amount = parseFloat(restockAmounts[template.id] ?? '');
    if (isNaN(amount) || amount <= 0) return;
    const newCount = (template.inventoryCount ?? 0) + amount;
    setRestockAmounts(prev => { const n = { ...prev }; delete n[template.id]; return n; });
    try {
      await onUpdateTemplate(template.id, { inventoryCount: newCount });
      showToast(`Restocked ${template.name} — now ${newCount} in stock`, 'success');
    } catch {
      showToast('Failed to update inventory. Please try again.', 'error');
    }
  };

  const filteredAndSortedTemplates = [...templates]
    .filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all'
        ? true
        : filterType === 'bunch'
          ? (template.unit ?? 'stem') === 'bunch'
          : (template.unit ?? 'stem') === 'stem' && template.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const handleEdit = (template: ProductTemplate) => {
    setEditingTemplate(template.id);
    setEditForm({
      name: template.name,
      wholesaleCost: template.wholesaleCost.toString(),
      type: template.type,
      unit: template.unit ?? 'stem',
      inventoryCount: template.inventoryCount !== undefined ? template.inventoryCount.toString() : '',
      lowStockThreshold: template.lowStockThreshold !== undefined ? template.lowStockThreshold.toString() : ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;

    if (!editForm.name.trim() || !editForm.wholesaleCost || parseFloat(editForm.wholesaleCost) <= 0) {
      showToast('Please enter a valid product name and wholesale cost.', 'warning');
      return;
    }

    const updates: Partial<ProductTemplate> = {
      name: editForm.name.trim(),
      wholesaleCost: parseFloat(editForm.wholesaleCost),
      type: editForm.type,
      unit: editForm.unit
    };
    if (editForm.inventoryCount !== '') {
      updates.inventoryCount = parseFloat(editForm.inventoryCount);
    }
    if (editForm.lowStockThreshold !== '') {
      updates.lowStockThreshold = parseFloat(editForm.lowStockThreshold);
    }

    try {
      await onUpdateTemplate(editingTemplate, updates);
      setEditingTemplate(null);
      setEditForm({ name: '', wholesaleCost: '', type: 'stem', unit: 'stem', inventoryCount: '', lowStockThreshold: '' });
    } catch {
      showToast('Failed to save changes. Please try again.', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setEditForm({ name: '', wholesaleCost: '', type: 'stem', unit: 'stem', inventoryCount: '', lowStockThreshold: '' });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'stem': return 'bg-green-100 text-green-800';
      case 'vase': return 'bg-blue-100 text-blue-800';
      case 'accessory': return 'bg-orange-100 text-orange-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUnitLabel = (unit: string | undefined) => unit === 'bunch' ? 'bunch' : 'stem';

  const formatInventory = (count: number | undefined, unit: string | undefined) => {
    if (count === undefined) return '';
    const isBunch = unit === 'bunch';
    const rounded = Math.round(count * 100) / 100;
    const isWhole = Number.isInteger(rounded);
    const display = isWhole ? rounded.toString() : rounded.toFixed(2);
    return `${display} ${isBunch ? 'bunch' : 'unit'}${rounded !== 1 ? 's' : ''}`;
  };

  if (templates.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Library className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">Product Library</h2>
        </div>
        <div className="text-center py-8">
          <Library className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Your product library is empty. Add products to build your library automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Library className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-semibold text-gray-800">Product Library</h2>
        <span className="text-sm text-gray-500">
          ({filteredAndSortedTemplates.length} of {templates.length} items)
        </span>
      </div>

      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search products..."
          />
        </div>
        
        <div className="relative">
          <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
          >
            <option value="all">All Types</option>
            <option value="stem">Stems Only</option>
            <option value="vase">Vases Only</option>
            <option value="accessory">Accessories Only</option>
            <option value="other">Other Items</option>
            <option value="bunch">Bunch Products</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedTemplates.map((template) => (
          <div 
            key={template.id} 
            id={`template-${template.id}`}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-300"
          >
            {editingTemplate === template.id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  disabled={editForm.unit === 'bunch'}
                >
                  <option value="stem">Stem</option>
                  <option value="vase">Vase</option>
                  <option value="accessory">Accessory</option>
                  <option value="other">Other</option>
                </select>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, unit: 'stem' })}
                    className={`flex-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      editForm.unit === 'stem' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'
                    }`}
                  >Per Stem</button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, unit: 'bunch' })}
                    className={`flex-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      editForm.unit === 'bunch' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'
                    }`}
                  >Per Bunch</button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editForm.wholesaleCost}
                  onChange={(e) => setEditForm({ ...editForm, wholesaleCost: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={editForm.inventoryCount}
                    onChange={(e) => setEditForm({ ...editForm, inventoryCount: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Inventory"
                  />
                  <input
                    type="number"
                    min="0"
                    value={editForm.lowStockThreshold}
                    onChange={(e) => setEditForm({ ...editForm, lowStockThreshold: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Low Stock"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-green-600 text-white py-1 px-2 rounded text-sm hover:bg-green-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 bg-gray-500 text-white py-1 px-2 rounded text-sm hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-800 text-sm">{template.name}</h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(template)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit template"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDeleteTemplate(template.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <div className="mb-3">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(template.type)}`}>
                    {template.type}
                  </span>
                  {(template.unit ?? 'stem') === 'bunch' && (
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 ml-1">
                      per bunch
                    </span>
                  )}
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>{(template.unit ?? 'stem') === 'bunch' ? 'Bunch Cost:' : 'Wholesale:'}</span>
                      <span className="font-medium">${template.wholesaleCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Retail Price:</span>
                      <span className="font-bold text-green-600">
                        ${(template.retailPrice ?? Math.round(template.wholesaleCost * markupSettings[(template.unit ?? 'stem') === 'bunch' ? 'bunch' : template.type] * 100) / 100).toFixed(2)}
                        {(template.unit ?? 'stem') === 'bunch' && ' /bunch'}
                      </span>
                    </div>
                    {(template.unit ?? 'stem') === 'bunch' && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Portion prices:</span>
                        <span>½ = ${((template.retailPrice ?? template.wholesaleCost * markupSettings.bunch) / 2).toFixed(2)} · ⅓ = ${((template.retailPrice ?? template.wholesaleCost * markupSettings.bunch) / 3).toFixed(2)} · ¼ = ${((template.retailPrice ?? template.wholesaleCost * markupSettings.bunch) / 4).toFixed(2)}</span>
                      </div>
                    )}
                    {template.inventoryCount !== undefined && (
                      <div className="flex justify-between">
                        <span>In Stock:</span>
                        <span className={`font-medium ${
                          template.lowStockThreshold && template.inventoryCount <= template.lowStockThreshold
                            ? 'text-red-600' 
                            : template.inventoryCount === 0 
                            ? 'text-red-600' 
                            : 'text-gray-700'
                        }`}>
                          {formatInventory(template.inventoryCount, template.unit)}
                          {template.inventoryCount === 0 && ' (Out of Stock)'}
                          {template.lowStockThreshold && template.inventoryCount <= template.lowStockThreshold && template.inventoryCount > 0 && ' (Low Stock)'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <Clock className="w-3 h-3" />
                  <span>Last used: {template.lastUsed.toLocaleDateString()}</span>
                </div>
                
                {template.inventoryCount !== undefined ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step={(template.unit ?? 'stem') === 'bunch' ? "0.1" : "1"}
                      min={(template.unit ?? 'stem') === 'bunch' ? "0.1" : "1"}
                      value={restockAmounts[template.id] ?? ''}
                      onChange={e => setRestockAmounts(prev => ({ ...prev, [template.id]: e.target.value }))}
                      placeholder="Add qty"
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={() => handleRestock(template)}
                      disabled={restockAmounts[template.id] === '' || !restockAmounts[template.id]}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Restock
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-xs text-gray-500 bg-gray-50 py-2 rounded">
                    Use "Create New Order" to add this product
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductLibrary;