import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { ShoppingCart, Plus, Minus, Search, X, Camera, RefreshCw, Copy, Image } from 'lucide-react';
import { Product, MarkupSettings, ProductTemplate, OrderRecord, ArrangementRecipe, POSSettings } from '../types/Product';
import POSIntegration from './POSIntegration';
import { useToast } from './Toast';

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
  const { showToast } = useToast();
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
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [savedOrderForPOS, setSavedOrderForPOS] = useState<OrderRecord | null>(null);
  const [showPOSIntegration, setShowPOSIntegration] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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
    // Use pre-computed retailPrice when available (staff templates from secure RPC)
    const retailPrice = template.retailPrice ?? (template.wholesaleCost * markupSettings[template.type]);
    const totalWholesale = template.wholesaleCost * quantity;
    const totalRetail = retailPrice * quantity;

    const newItem: OrderItem = {
      id: `order-item-${Date.now()}`,
      templateId: template.id,
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
        // Use pre-computed retailPrice when available (staff templates from secure RPC)
        const retailPrice = template.retailPrice ?? (template.wholesaleCost * markupSettings[ingredient.type]);
        const totalWholesale = template.wholesaleCost * ingredient.quantity;
        const totalRetail = retailPrice * ingredient.quantity;

        const newItem: OrderItem = {
          id: `recipe-item-${Date.now()}-${Math.random()}`,
          templateId: template.id,
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
      showToast(`Missing ingredients: ${missingIngredients.join(', ')}. Add these to your product library first.`, 'warning');
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

  const handleCopyForPOS = async () => {
    if (orderItems.length === 0) {
      showToast('Add items to the order before copying.', 'warning');
      return;
    }
    const lines: string[] = [];
    lines.push('='.repeat(50));
    lines.push(`ARRANGEMENT: ${orderName || '(unnamed)'}`);
    if (staffName) lines.push(`STAFF: ${staffName}${staffId ? ` (ID: ${staffId})` : ''}`);
    lines.push('='.repeat(50));
    lines.push('');
    if (photo) { lines.push('PHOTO: [See attached image]'); lines.push(''); }
    if (notes) { lines.push('NOTES:'); lines.push(notes); lines.push(''); }
    lines.push('RECIPE / INGREDIENTS:');
    lines.push('-'.repeat(50));
    orderItems.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.quantity}x ${item.name} (${item.type})`);
    });
    lines.push('');
    lines.push('PRICING:');
    lines.push('-'.repeat(50));
    orderItems.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.name}: ${item.quantity} x $${item.retailPrice.toFixed(2)} = $${item.totalRetail.toFixed(2)}`);
    });
    lines.push('');
    lines.push(`TOTAL: $${totalRetail.toFixed(2)}`);
    lines.push('='.repeat(50));
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('Recipe text copied! Paste into your POS notes field.', 'success');
    } catch {
      showToast('Could not access clipboard. Try again or use a different browser.', 'error');
    }
  };

  const handleCopyWithPhoto = async () => {
    if (orderItems.length === 0) {
      showToast('Add items to the order before copying.', 'warning');
      return;
    }

    // Plain text fallback
    const lines: string[] = [];
    lines.push(`ARRANGEMENT: ${orderName || '(unnamed)'}`);
    if (staffName) lines.push(`STAFF: ${staffName}${staffId ? ` (ID: ${staffId})` : ''}`);
    lines.push(`DATE: ${new Date().toLocaleDateString()}`);
    lines.push('');
    if (notes) { lines.push('NOTES:'); lines.push(notes); lines.push(''); }
    lines.push('RECIPE / INGREDIENTS:');
    orderItems.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.quantity}x ${item.name} (${item.type})`);
    });
    lines.push('');
    lines.push('PRICING:');
    orderItems.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.name}: ${item.quantity} x $${item.retailPrice.toFixed(2)} = $${item.totalRetail.toFixed(2)}`);
    });
    lines.push('');
    lines.push(`TOTAL: $${totalRetail.toFixed(2)}`);
    const plainText = lines.join('\n');

    // Rich HTML with embedded photo
    const itemRows = orderItems.map((item, i) =>
      `<tr><td style="padding:4px 8px">${i + 1}. ${item.name} <span style="color:#666;font-size:12px">(${item.type})</span></td><td style="padding:4px 8px;text-align:center">${item.quantity}x</td><td style="padding:4px 8px;text-align:right">$${item.retailPrice.toFixed(2)}</td><td style="padding:4px 8px;text-align:right;font-weight:600">$${item.totalRetail.toFixed(2)}</td></tr>`
    ).join('');
    const html = `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a">
      <h2 style="margin:0 0 6px;font-size:20px">${orderName || '(unnamed)'}</h2>
      ${staffName ? `<p style="margin:0 0 4px;color:#666;font-size:14px">Staff: ${staffName}${staffId ? ` (ID: ${staffId})` : ''}</p>` : ''}
      <p style="margin:0 0 12px;color:#999;font-size:13px">${new Date().toLocaleDateString()}</p>
      ${notes ? `<p style="margin:0 0 12px;padding:8px 12px;background:#f9f9f9;border-left:3px solid #ccc;font-style:italic">${notes}</p>` : ''}
      ${photo ? `<img src="${photo}" style="max-width:100%;width:400px;border-radius:8px;margin-bottom:16px;display:block" />` : ''}
      <table style="border-collapse:collapse;width:100%;margin-bottom:12px;font-size:14px">
        <thead><tr style="background:#f0f4f8"><th style="padding:6px 8px;text-align:left">Item</th><th style="padding:6px 8px">Qty</th><th style="padding:6px 8px;text-align:right">Each</th><th style="padding:6px 8px;text-align:right">Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="font-size:16px;font-weight:bold;border-top:2px solid #e0e0e0;padding-top:8px">Total: $${totalRetail.toFixed(2)}</p>
    </div>`;

    // Desktop: write rich HTML + plain text to clipboard
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
          })
        ]);
        showToast(photo ? 'Copied! Paste into your POS notes to include photo + details.' : 'Order details copied!', 'success');
        return;
      } catch {
        // fall through
      }
    }

    // Mobile: Web Share with image + text
    if (photo && navigator.share) {
      try {
        const res = await fetch(photo);
        const blob = await res.blob();
        const file = new File([blob], `${orderName || 'arrangement'}.jpg`, { type: blob.type || 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: plainText, title: orderName || 'Arrangement' });
          return;
        }
      } catch {
        // fall through
      }
    }

    // Final fallback: text only
    try {
      await navigator.clipboard.writeText(plainText);
      showToast('Copied as text (photo could not be included).', 'success');
    } catch {
      showToast('Could not copy. Try a different browser.', 'error');
    }
  };

  const handleSaveOrder = () => {
    if (!orderName.trim() || orderItems.length === 0) {
      if (!orderName.trim()) {
        showToast('Please enter an order name before saving.', 'warning');
      } else {
        showToast('Please add at least one item to the order.', 'warning');
      }
      return;
    }

    if (userRole === 'staff' && !staffName.trim()) {
      showToast('Please enter your name before saving the order.', 'warning');
      return;
    }

    console.log(editingOrderId ? 'Updating order with items:' : 'Creating order with items:', orderItems);
    console.log('Current POS settings:', posSettings);

    const totalWholesale = orderItems.reduce((sum: number, item: OrderItem) => sum + item.totalWholesale, 0);
    const totalRetail = orderItems.reduce((sum: number, item: OrderItem) => sum + item.totalRetail, 0);

    // When labor is configured and a customer budget was entered, profit accounts for labor
    const budgetVal = customerBudget ? parseFloat(customerBudget) : null;
    const laborPct = markupSettings.laborPercent ?? 0;
    const laborAmount = (budgetVal && laborPct > 0) ? budgetVal * (laborPct / 100) : null;
    const customerPrice = budgetVal ?? null;
    const profit = customerPrice != null && laborAmount != null
      ? customerPrice - totalWholesale - laborAmount
      : totalRetail - totalWholesale;

    const order: OrderRecord = {
      id: editingOrderId || Date.now().toString(),
      name: orderName,
      date: new Date(),
      products: orderItems.map((item: OrderItem) => ({
        id: item.id,
        templateId: item.templateId,
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
      staffId: staffId || undefined,
      customerPrice,
      laborAmount
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
        // clearOrder is called when the POS modal closes
      } else {
        showToast('Order saved! Ask your manager to set up store info in Settings for POS copy-paste.', 'success');
        setTimeout(() => clearOrder(), 100);
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

      {/* Budget input — owner/manager */}
      {userRole !== 'staff' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
          <label className="text-sm font-medium text-blue-800 whitespace-nowrap">
            Customer Price ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={customerBudget}
            onChange={(e) => setCustomerBudget(e.target.value)}
            className="w-36 px-3 py-1.5 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 75.00"
          />
          <span className="text-xs text-blue-600">Enter what the customer is paying to track budget as you build</span>
        </div>
      )}

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
            clearOrder();
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
                      <input
                        type="number"
                        min="1"
                        value={quantityInputs[item.id] ?? item.quantity.toString()}
                        onChange={e => {
                          setQuantityInputs(prev => ({ ...prev, [item.id]: e.target.value }));
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val > 0) updateItemQuantity(item.id, val);
                        }}
                        onBlur={e => {
                          const val = parseInt(e.target.value);
                          if (isNaN(val) || val <= 0) {
                            setQuantityInputs(prev => ({ ...prev, [item.id]: item.quantity.toString() }));
                          } else {
                            setQuantityInputs(prev => { const next = { ...prev }; delete next[item.id]; return next; });
                          }
                        }}
                        className="w-14 text-center font-medium border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
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
          {/* Budget Tracker */}
          {customerBudget && parseFloat(customerBudget) > 0 && (() => {
            const fullBudget = parseFloat(customerBudget);
            const laborPct = markupSettings.laborPercent ?? 0;
            // For staff: silently apply labor deduction so they build to the reduced amount
            const workingBudget = (userRole === 'staff' && laborPct > 0)
              ? fullBudget * (1 - laborPct / 100)
              : fullBudget;
            const remaining = workingBudget - totalRetail;
            const pct = Math.min((totalRetail / workingBudget) * 100, 100);
            const isOver = remaining < 0;
            const isClose = !isOver && remaining / workingBudget < 0.1;
            const barColor = isOver ? 'bg-red-500' : isClose ? 'bg-amber-400' : 'bg-emerald-500';
            const textColor = isOver ? 'text-red-700' : isClose ? 'text-amber-700' : 'text-emerald-700';
            const bgColor = isOver ? 'bg-red-50 border-red-200' : isClose ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';

            return (
              <div className={`mt-4 rounded-lg border p-4 ${bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Budget Tracker</span>
                  <span className={`text-sm font-bold ${textColor}`}>
                    {isOver
                      ? `Over budget by $${Math.abs(remaining).toFixed(2)}`
                      : `$${remaining.toFixed(2)} remaining`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 text-xs text-gray-600 gap-2">
                  <div>
                    <div className="text-gray-500">{userRole === 'staff' ? 'Flower Budget' : 'Customer Price'}</div>
                    <div className="font-semibold text-gray-800">${workingBudget.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Used so far</div>
                    <div className="font-semibold text-gray-800">${totalRetail.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">{isOver ? 'Over by' : 'Remaining'}</div>
                    <div className={`font-bold ${textColor}`}>${Math.abs(remaining).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Order Details */}
        <div className="space-y-4">
          {/* Photo Capture */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Arrangement Photo (Optional)
            </label>
            {photo ? (
              <div>
                <img
                  src={photo}
                  alt="Arrangement"
                  className="w-full max-h-56 object-contain rounded-lg border border-gray-200 bg-gray-50 mb-3"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhoto('')}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md text-sm font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-emerald-300 rounded-lg text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                <Camera className="w-8 h-8 text-emerald-500" />
                <span className="font-medium">Take Photo</span>
                <span className="text-xs text-gray-500">Opens camera on phone/tablet — or choose from gallery on desktop</span>
              </button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

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

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleSaveOrder}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              {editingOrderId
                ? 'Update Order'
                : userRole === 'staff'
                  ? 'Save & Copy for POS'
                  : 'Save Order'
              }
            </button>
            <button
              onClick={handleCopyForPOS}
              title="Copy recipe text for POS notes"
              className="px-4 py-2 border border-emerald-500 text-emerald-700 rounded-md hover:bg-emerald-50 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Copy className="w-4 h-4" />
              Copy Recipe
            </button>
            <button
              onClick={handleCopyWithPhoto}
              title={photo ? 'Copy details + photo for POS notes' : 'Copy order details'}
              className="px-4 py-2 border border-blue-400 text-blue-700 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Image className="w-4 h-4" />
              {photo ? 'Copy + Photo' : 'Copy Details'}
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