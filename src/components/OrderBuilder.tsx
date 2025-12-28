import React, { useState, useEffect, ChangeEvent } from 'react';
import { ShoppingCart, Plus, Minus, Search, X } from 'lucide-react';
import { Product, MarkupSettings, ProductTemplate, OrderRecord, ArrangementRecipe, POSSettings } from '../types/Product';
import POSIntegration from './POSIntegration';

interface OrderBuilderProps {
  templates: ProductTemplate[];
  recipes: ArrangementRecipe[];
  markupSettings: MarkupSettings;
  onSaveOrder: (order: OrderRecord) => void;
  onUpdateOrder?: (orderId: string, order: OrderRecord) => void;
  onOrderChange?: (products: Product[]) => void;
  userRole?: 'owner' | 'manager' | 'staff';
  posSettings: POSSettings;
  initialOrder?: OrderRecord;
}

interface OrderItem extends Product {
  retailPrice: number;
  totalWholesale: number;
  totalRetail: number;
}

const OrderBuilder: React.FC<OrderBuilderProps> = ({
  templates,
  recipes,
  markupSettings,
  onSaveOrder,
  onUpdateOrder,
  onOrderChange,
  userRole = 'owner',
  posSettings,
  initialOrder
}) => {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderName, setOrderName] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [staffName, setStaffName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [customerBudget, setCustomerBudget] = useState<string>('');
  const [arrangementMode, setArrangementMode] = useState<'custom' | 'recipe'>('custom');
  const [recipeSearchTerm, setRecipeSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRecipeSuggestions, setShowRecipeSuggestions] = useState(false);
  const [savedOrderForPOS, setSavedOrderForPOS] = useState<OrderRecord | null>(null);
  const [showPOSIntegration, setShowPOSIntegration] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Load initial order data if editing
  useEffect(() => {
    if (initialOrder) {
      setEditingOrderId(initialOrder.id);
      setOrderName(initialOrder.name);
      setNotes(initialOrder.notes || '');
      setPhoto(initialOrder.photo || '');
      setStaffName(initialOrder.staffName || '');
      setStaffId(initialOrder.staffId || '');

      // Convert products to OrderItems
      const items: OrderItem[] = initialOrder.products.map(product => {
        const markup = markupSettings[product.type];
        const retailPrice = product.wholesaleCost * markup;
        const totalWholesale = product.wholesaleCost * product.quantity;
        const totalRetail = retailPrice * product.quantity;

        return {
          id: product.id,
          name: product.name,
          wholesaleCost: product.wholesaleCost,
          quantity: product.quantity,
          type: product.type,
          retailPrice,
          totalWholesale,
          totalRetail
        };
      });

      setOrderItems(items);
    }
  }, [initialOrder, markupSettings]);
  
  const filteredTemplates = templates.filter((template: ProductTemplate) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const filteredRecipes = recipes.filter((recipe: ArrangementRecipe) =>
    recipe.name.toLowerCase().includes(recipeSearchTerm.toLowerCase().trim())
  );

  const addItemFromTemplate = (template: ProductTemplate, quantity: number = 1) => {
    const markup = markupSettings[template.type];
    const retailPrice = template.wholesaleCost * markup;
    const totalWholesale = template.wholesaleCost * quantity;
    const totalRetail = retailPrice * quantity;

    const newItem: OrderItem = {
      id: `order-item-${Date.now()}`,
      name: template.name,
      wholesaleCost: template.wholesaleCost,
      quantity,
      type: template.type,
      retailPrice,
      totalWholesale,
      totalRetail
    };

    const updatedItems = [...orderItems, newItem];
    setOrderItems(updatedItems);
    setSearchTerm('');
    setShowSuggestions(false);
    
    // Notify parent of order changes for Staff Training Mode
    if (onOrderChange) {
      const updatedProducts = updatedItems.map((item: OrderItem) => ({
        id: item.id,
        name: item.name,
        wholesaleCost: item.wholesaleCost,
        quantity: item.quantity,
        type: item.type
      }));
      onOrderChange(updatedProducts);
    }
  };

  const addItemsFromRecipe = (recipe: ArrangementRecipe) => {
    const newItems: OrderItem[] = [];
    let missingIngredients: string[] = [];

    recipe.ingredients.forEach(ingredient => {
      // Try to find matching template
      const template = templates.find((t: ProductTemplate) => 
        t.name.toLowerCase().includes(ingredient.name.toLowerCase()) ||
        ingredient.name.toLowerCase().includes(t.name.toLowerCase())
      );

      if (template) {
        const markup = markupSettings[ingredient.type];
        const retailPrice = template.wholesaleCost * markup;
        const totalWholesale = template.wholesaleCost * ingredient.quantity;
        const totalRetail = retailPrice * ingredient.quantity;

        const newItem: OrderItem = {
          id: `recipe-item-${Date.now()}-${Math.random()}`,
          name: ingredient.name,
          wholesaleCost: template.wholesaleCost,
          quantity: ingredient.quantity,
          type: ingredient.type,
          retailPrice,
          totalWholesale,
          totalRetail
        };
        newItems.push(newItem);
      } else {
        missingIngredients.push(ingredient.name);
      }
    });

    if (missingIngredients.length > 0) {
      alert(`Missing ingredients in your library: ${missingIngredients.join(', ')}. Please add these items to your product library first.`);
      return;
    }

    setOrderItems([...orderItems, ...newItems]);
    setOrderName(recipe.name);
    setRecipeSearchTerm('');
    setShowRecipeSuggestions(false);
    
    // Notify parent of order changes for Staff Training Mode
    if (onOrderChange) {
      const updatedProducts = [...orderItems, ...newItems].map((item: OrderItem) => ({
        id: item.id,
        name: item.name,
        wholesaleCost: item.wholesaleCost,
        quantity: item.quantity,
        type: item.type
      }));
      onOrderChange(updatedProducts);
    }
  };

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    const updatedItems = orderItems.map(item => {
      if (item.id === itemId) {
        const totalWholesale = item.wholesaleCost * newQuantity;
        const totalRetail = item.retailPrice * newQuantity;
        return {
          ...item,
          quantity: newQuantity,
          totalWholesale,
          totalRetail
        };
      }
      return item;
    });
    
    setOrderItems(updatedItems);
    
    // Notify parent of order changes for Staff Training Mode
    if (onOrderChange) {
      const updatedProducts = updatedItems.map((item: OrderItem) => ({
        id: item.id,
        name: item.name,
        wholesaleCost: item.wholesaleCost,
        quantity: item.quantity,
        type: item.type
      }));
      onOrderChange(updatedProducts);
    }
  };

  const updateItemRetailPrice = (itemId: string, newRetailPrice: number) => {
    setOrderItems(orderItems.map((item: OrderItem) => {
      if (item.id === itemId) {
        const totalRetail = newRetailPrice * item.quantity;
        return {
          ...item,
          retailPrice: newRetailPrice,
          totalRetail
        };
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    const updatedItems = orderItems.filter((item: OrderItem) => item.id !== itemId);
    setOrderItems(updatedItems);
    
    // Notify parent of order changes for Staff Training Mode
    if (onOrderChange) {
      const updatedProducts = updatedItems.map((item: OrderItem) => ({
        id: item.id,
        name: item.name,
        wholesaleCost: item.wholesaleCost,
        quantity: item.quantity,
        type: item.type
      }));
      onOrderChange(updatedProducts);
    }
  };

  const clearOrder = () => {
    setOrderItems([]);
    setOrderName('');
    setNotes('');
    setPhoto('');
    setCustomerBudget('');
    setArrangementMode('custom');
    setRecipeSearchTerm('');
    setSearchTerm('');
    setEditingOrderId(null);
    // Keep staff info for next order

    // Notify parent of order changes for Staff Training Mode
    if (onOrderChange) {
      onOrderChange([]);
    }
  };

  // Expose clearOrder function globally for POS integration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.clearCurrentOrder = clearOrder;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.clearCurrentOrder;
      }
    };
  }, []);

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveOrder = () => {
    if (!orderName.trim() || orderItems.length === 0) {
      if (!orderName.trim()) {
        alert('Please enter an order name before saving.');
      } else {
        alert('Please add at least one item to the order.');
      }
      return;
    }

    if (userRole === 'staff' && !staffName.trim()) {
      alert('Please enter your name before saving the order.');
      return;
    }

    console.log(editingOrderId ? 'Updating order with items:' : 'Creating order with items:', orderItems);
    console.log('Current POS settings:', posSettings);

    const totalWholesale = orderItems.reduce((sum: number, item: OrderItem) => sum + item.totalWholesale, 0);
    const totalRetail = orderItems.reduce((sum: number, item: OrderItem) => sum + item.totalRetail, 0);
    const profit = totalRetail - totalWholesale;

    const order: OrderRecord = {
      id: editingOrderId || Date.now().toString(),
      name: orderName,
      date: new Date(),
      products: orderItems.map((item: OrderItem) => ({
        id: item.id,
        name: item.name,
        wholesaleCost: item.wholesaleCost,
        quantity: item.quantity,
        type: item.type
      })),
      totalWholesale,
      totalRetail,
      profit,
      photo: photo || undefined,
      notes: notes || undefined,
      staffName: staffName || undefined,
      staffId: staffId || undefined
    };

    console.log('Final order object:', order);

    // Save or update the order
    if (editingOrderId && onUpdateOrder) {
      onUpdateOrder(editingOrderId, order);
    } else {
      onSaveOrder(order);
    }

    // Handle POS integration based on configuration
    if (userRole === 'staff') {
      console.log('Staff mode - checking store configuration:', posSettings.isConfigured, posSettings.storeName);
      if (posSettings.isConfigured && posSettings.storeName) {
        setSavedOrderForPOS(order);
        setShowPOSIntegration(true);
      } else {
        alert(`Store not configured. Please contact your manager to set up store information.

Debug info:
- isConfigured: ${posSettings.isConfigured}
- storeName: ${posSettings.storeName}`);
      }
    } else {
      setTimeout(() => {
        clearOrder();
      }, 100);
    }
  };

  const totalWholesale = orderItems.reduce((sum: number, item: OrderItem) => sum + item.totalWholesale, 0);
  const totalRetail = orderItems.reduce((sum: number, item: OrderItem) => sum + item.totalRetail, 0);
  const profit = totalRetail - totalWholesale;

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
        <ShoppingCart className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-800">
          {editingOrderId
            ? 'Edit Order'
            : userRole === 'staff'
              ? 'Create Arrangement'
              : 'Create New Order'
          }
        </h2>
        {editingOrderId && (
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full">
            EDITING
          </span>
        )}
        {userRole === 'staff' && !editingOrderId && (
          <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded-full">
            STAFF MODE
          </span>
        )}
      </div>

      {/* Staff Mode: Budget and Mode Selection */}
      {userRole === 'staff' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-purple-800 mb-4">Customer Requirements</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">
                Customer's Budget ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customerBudget}
                onChange={(e) => setCustomerBudget(e.target.value)}
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., 75.00"
              />
              <p className="text-xs text-purple-600 mt-1">
                This will be used for budget tracking in Staff Training Mode
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">
                Arrangement Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="arrangementMode"
                    value="custom"
                    checked={arrangementMode === 'custom'}
                    onChange={(e) => setArrangementMode(e.target.value as 'custom' | 'recipe')}
                    className="mr-2 text-purple-600"
                  />
                  <span className="text-sm">Designer's Choice (Custom)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="arrangementMode"
                    value="recipe"
                    checked={arrangementMode === 'recipe'}
                    onChange={(e) => setArrangementMode(e.target.value as 'custom' | 'recipe')}
                    className="mr-2 text-purple-600"
                  />
                  <span className="text-sm">Use Existing Recipe</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POS Integration Modal */}
      {showPOSIntegration && savedOrderForPOS && (
        <POSIntegration
          order={savedOrderForPOS}
          posSettings={posSettings}
          onClose={() => {
            setShowPOSIntegration(false);
            setSavedOrderForPOS(null);
          }}
        />
      )}

      {/* Product Search */}
      <div className={`mb-6 ${
        userRole === 'staff' 
          ? arrangementMode === 'recipe' 
            ? 'grid grid-cols-1' 
            : 'grid grid-cols-1'
          : 'grid grid-cols-1 lg:grid-cols-2 gap-6'
      }`}>
        {/* Recipe Search */}
        {(userRole !== 'staff' || arrangementMode === 'recipe') && (
        <div className={userRole === 'staff' ? 'mb-6' : ''}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {userRole === 'staff' ? '🌸 Select Recipe to Customize' : '🌸 Add Arrangement Recipe'}
          </label>
          <div className="relative">
            <div className="flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3" />
              <input
                type="text"
                value={recipeSearchTerm}
                onChange={(e) => {
                  setRecipeSearchTerm(e.target.value);
                  setShowRecipeSuggestions(e.target.value.length > 0);
                }}
                onFocus={() => setShowRecipeSuggestions(recipeSearchTerm.length > 0)}
                className="w-full pl-10 pr-4 py-2 border border-emerald-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder={userRole === 'staff' ? 'Search recipes to start with...' : 'Search arrangement recipes...'}
              />
            </div>
            
            {showRecipeSuggestions && filteredRecipes.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredRecipes.map((recipe: ArrangementRecipe) => {
                  const totalIngredients = recipe.ingredients.reduce((sum: number, ing: any) => sum + ing.quantity, 0);
                  return (
                    <div
                      key={recipe.id}
                      onClick={() => addItemsFromRecipe(recipe)}
                      className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-gray-800">{recipe.name}</div>
                          <div className="text-sm text-gray-500">
                            {totalIngredients} items • Website: ${recipe.websitePrice.toFixed(2)}
                          </div>
                          <div className="text-xs text-emerald-600">
                            {userRole === 'staff' ? 'Click to start with this recipe (you can modify)' : 'Click to add all ingredients to order'}
                          </div>
                        </div>
                        {recipe.photo && (
                          <img
                            src={recipe.photo}
                            alt={recipe.name}
                            className="w-12 h-12 object-cover rounded-md"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Individual Product Search */}
        {(userRole !== 'staff' || arrangementMode === 'custom') && (
        <div className={userRole === 'staff' ? 'mb-6' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {userRole === 'staff' ? '🌹 Build Custom Arrangement' : '🌹 Add Individual Products'}
        </label>
        <div className="relative">
          <div className="flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(e.target.value.trim().length > 0);
              }}
              onFocus={() => setShowSuggestions(searchTerm.trim().length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 300)}
              className="w-full pl-10 pr-4 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={userRole === 'staff' ? 'Search flowers, vases, accessories...' : 'Search individual products...'}
            />
          </div>
          
          {showSuggestions && searchTerm.trim().length > 0 && filteredTemplates.length === 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
              <div className="text-gray-500 text-sm">No products found. Try a different search term.</div>
            </div>
          )}
          
          {showSuggestions && searchTerm.trim().length > 0 && filteredTemplates.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredTemplates.map((template: ProductTemplate) => {
                const hasInventory = template.inventoryCount !== undefined;
                const isLowStock = hasInventory && template.lowStockThreshold !== undefined && template.inventoryCount! <= template.lowStockThreshold!;
                const isOutOfStock = hasInventory && template.inventoryCount === 0;

                return (
                  <div
                    key={template.id}
                    onClick={() => !isOutOfStock && addItemFromTemplate(template)}
                    className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                      isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-800">{template.name}</div>
                          {hasInventory && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              isOutOfStock
                                ? 'bg-red-100 text-red-800'
                                : isLowStock
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {isOutOfStock ? 'Out of Stock' : `${template.inventoryCount} in stock`}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          ${template.wholesaleCost.toFixed(2)} • {template.type}
                        </div>
                      </div>
                      <div className="text-sm text-blue-600">
                        ${(template.wholesaleCost * markupSettings[template.type]).toFixed(2)} retail
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
        )}
      </div>

      {/* Order Items */}
      {orderItems.length > 0 && (
        <>
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Order Items</h3>
          <div className="space-y-3">
            {orderItems.map((item: OrderItem) => (
              <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-800">{item.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
                      {item.type}
                    </span>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <label className="block text-gray-600 mb-1">Quantity</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-12 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  {userRole !== 'staff' && (
                    <div>
                      <label className="block text-gray-600 mb-1">Wholesale Cost</label>
                      <div className="font-medium">${item.wholesaleCost.toFixed(2)}</div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-gray-600 mb-1">
                      {userRole === 'staff' ? 'Price Each' : 'Retail Price (Editable)'}
                    </label>
                    {userRole === 'staff' ? (
                      <div className="font-medium">${item.retailPrice.toFixed(2)}</div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.retailPrice.toFixed(2)}
                        onChange={(e) => updateItemRetailPrice(item.id, parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-gray-600 mb-1">
                      {userRole === 'staff' ? 'Total Cost' : 'Total Retail'}
                    </label>
                    <div className="font-bold text-blue-600">${item.totalRetail.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-3">Order Summary</h4>
            <div className={`grid gap-4 text-sm ${userRole === 'staff' ? 'grid-cols-1' : 'grid-cols-3'}`}>
              {userRole !== 'staff' && (
                <div>
                  <span className="text-gray-600">Total Wholesale:</span>
                  <div className="font-medium">${totalWholesale.toFixed(2)}</div>
                </div>
              )}
              <div>
                <span className="text-gray-600">
                  {userRole === 'staff' ? 'Total Order Cost:' : 'Total Retail:'}
                </span>
                <div className="font-medium text-blue-600">${totalRetail.toFixed(2)}</div>
              </div>
              {userRole !== 'staff' && (
                <div>
                  <span className="text-gray-600">Profit:</span>
                  <div className="font-bold text-green-700">${profit.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="space-y-4">
          {/* Staff Information - Always visible but more prominent for staff */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border-2 ${
            userRole === 'staff' 
              ? 'bg-purple-50 border-purple-300' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {userRole === 'staff' ? 'Your Name *' : 'Staff Member Name'}
              </label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={userRole === 'staff' ? 'Enter your name' : 'Staff member who created this order'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {userRole === 'staff' ? 'Your Employee ID (Optional)' : 'Staff ID (Optional)'}
              </label>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={userRole === 'staff' ? 'Your employee ID' : 'Employee ID'}
              />
            </div>
            {userRole === 'staff' && (
              <div className="col-span-2 text-sm text-purple-700 bg-purple-100 p-2 rounded">
                💡 <strong>Your info will be included in all order records</strong> - This helps track who created each arrangement for training and accountability.
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order Name *
            </label>
            <input
              type="text"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Wedding Centerpieces - Smith"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Additional notes about this order..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photo (Optional)
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                <Plus className="w-4 h-4" />
                <span className="text-sm">Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              {photo && (
                <div className="relative">
                  <img
                    src={photo}
                    alt="Order preview"
                    className="w-16 h-16 object-cover rounded-md"
                  />
                  <button
                    onClick={() => setPhoto('')}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSaveOrder}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              {editingOrderId
                ? 'Update Order'
                : userRole === 'staff'
                  ? 'Save & Send to POS'
                  : 'Save Order'
              }
            </button>
            <button
              onClick={clearOrder}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              {editingOrderId ? 'Cancel' : 'Clear'}
            </button>
          </div>
        </div>
        </>
      )}

      {orderItems.length === 0 && (
        <div className="text-center py-8">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {userRole === 'staff' 
              ? arrangementMode === 'custom'
                ? 'Start typing to search for products and create your custom arrangement'
                : 'Search for a recipe above to start with, then customize as needed'
              : 'Start typing to search for products in your library'
            }
          </p>
          {userRole === 'staff' && (
            <div className="mt-4 p-4 bg-purple-50 rounded-lg max-w-md mx-auto">
              <h4 className="font-medium text-purple-800 mb-2">
                💡 {arrangementMode === 'custom' ? "Designer's Choice Tips:" : 'Recipe Customization Tips:'}
              </h4>
              <ul className="text-sm text-purple-700 text-left space-y-1">
                {arrangementMode === 'custom' ? (
                  <>
                    <li>• Search for "roses", "carnations", "vase", etc.</li>
                    <li>• Add products one by one to build your arrangement</li>
                    <li>• Watch the Staff Training budget tracker</li>
                    <li>• Adjust quantities to meet customer's budget</li>
                  </>
                ) : (
                  <>
                    <li>• Start with a recipe, then modify as needed</li>
                    <li>• Add or remove items to fit customer's budget</li>
                    <li>• Adjust quantities to personalize the arrangement</li>
                    <li>• Use recipes as inspiration, not strict rules</li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderBuilder;