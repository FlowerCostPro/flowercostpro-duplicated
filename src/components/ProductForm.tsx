import React, { useState, FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Product, ProductTemplate } from '../types/Product';

interface ProductFormProps {
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  existingTemplates: ProductTemplate[];
}

const ProductForm: React.FC<ProductFormProps> = ({ onAddProduct, existingTemplates }) => {
  const [formData, setFormData] = useState({
    name: '',
    wholesaleCost: '',
    quantity: '1',
    type: 'stem' as const,
    inventoryCount: '',
    lowStockThreshold: ''
  });

  const existingProduct = existingTemplates.find(
    t => t.name.toLowerCase() === formData.name.toLowerCase().trim() && t.type === formData.type
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const wholesaleCost = formData.wholesaleCost || (existingProduct?.wholesaleCost.toString() || '');

    if (!formData.name || !wholesaleCost) {
      alert('Please enter a product name and wholesale cost.');
      return;
    }

    const quantityToAdd = parseInt(formData.quantity);
    let newInventoryCount: number;

    if (existingProduct) {
      newInventoryCount = (existingProduct.inventoryCount || 0) + quantityToAdd;
    } else {
      newInventoryCount = formData.inventoryCount !== '' ? parseInt(formData.inventoryCount) : 0;
    }

    onAddProduct({
      name: formData.name.trim(),
      wholesaleCost: parseFloat(wholesaleCost),
      quantity: quantityToAdd,
      type: formData.type,
      inventoryCount: newInventoryCount,
      lowStockThreshold: formData.lowStockThreshold !== ''
        ? parseInt(formData.lowStockThreshold)
        : existingProduct?.lowStockThreshold
    });

    setFormData({
      name: '',
      wholesaleCost: '',
      quantity: '1',
      type: 'stem',
      inventoryCount: '',
      lowStockThreshold: ''
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Plus className="w-5 h-5 text-green-600" />
        <h2 className="text-xl font-semibold text-gray-800">Add New Product</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., Red Roses"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="stem">Stem</option>
              <option value="vase">Vase</option>
              <option value="accessory">Accessory</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wholesale Cost ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.wholesaleCost || (existingProduct?.wholesaleCost || '')}
              onChange={(e) => setFormData({ ...formData, wholesaleCost: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder={existingProduct ? existingProduct.wholesaleCost.toFixed(2) : "0.00"}
              required={!existingProduct}
            />
            {existingProduct && !formData.wholesaleCost && (
              <p className="text-xs text-gray-500 mt-1">Current: ${existingProduct.wholesaleCost.toFixed(2)}</p>
            )}
          </div>

          {!existingProduct && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Starting Inventory Count
              </label>
              <input
                type="number"
                min="0"
                value={formData.inventoryCount}
                onChange={(e) => setFormData({ ...formData, inventoryCount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">How many units do you currently have in stock?</p>
            </div>
          )}

          {existingProduct && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity to Add to Inventory
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Add more units to existing inventory</p>
            </div>
          )}

          {existingProduct && (
            <div className="col-span-2">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>This product already exists!</strong>
                  <br />
                  Current inventory: <strong>{existingProduct.inventoryCount || 0}</strong> units
                  <br />
                  Adding <strong>{formData.quantity}</strong> units will result in <strong>{(existingProduct.inventoryCount || 0) + parseInt(formData.quantity || '0')}</strong> total units
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Low Stock Alert (Optional)
            </label>
            <input
              type="number"
              min="0"
              value={formData.lowStockThreshold || (existingProduct?.lowStockThreshold || '')}
              onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder={existingProduct?.lowStockThreshold?.toString() || "5"}
            />
            <p className="text-xs text-gray-500 mt-1">Get notified when stock falls below this number</p>
            {existingProduct && existingProduct.lowStockThreshold && !formData.lowStockThreshold && (
              <p className="text-xs text-gray-500 mt-1">Current: {existingProduct.lowStockThreshold}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {existingProduct ? 'Update Product & Add to Inventory' : 'Add Product to Library'}
        </button>
      </form>
    </div>
  );
};

export default ProductForm;