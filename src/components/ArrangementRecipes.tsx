import React, { useState, ChangeEvent } from 'react';
import { BookOpen, Plus, Calculator, Edit2, Trash2, ExternalLink, Save, X } from 'lucide-react';
import { ArrangementRecipe, RecipeIngredient, ProductTemplate, MarkupSettings } from '../types/Product';

interface ArrangementRecipesProps {
  recipes: ArrangementRecipe[];
  templates: ProductTemplate[];
  markupSettings: MarkupSettings;
  onSaveRecipe: (recipe: ArrangementRecipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onUpdateRecipe: (recipeId: string, updates: Partial<ArrangementRecipe>) => void;
}

const ArrangementRecipes = ({
  recipes,
  templates,
  markupSettings,
  onSaveRecipe,
  onDeleteRecipe,
  onUpdateRecipe
}: ArrangementRecipesProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<ArrangementRecipe | null>(null);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    description: '',
    websitePrice: '',
    websiteUrl: '',
    photo: '',
    ingredients: [] as RecipeIngredient[]
  });

  const [editRecipe, setEditRecipe] = useState({
    name: '',
    description: '',
    websitePrice: '',
    websiteUrl: '',
    photo: '',
    ingredients: [] as RecipeIngredient[]
  });

  const [newIngredient, setNewIngredient] = useState({
    name: '',
    quantity: '1',
    type: 'stem' as const,
    notes: ''
  });

  const [editIngredient, setEditIngredient] = useState({
    name: '',
    quantity: '1',
    type: 'stem' as const,
    notes: ''
  });

  const calculateRecipeCost = (recipe: ArrangementRecipe) => {
    let totalWholesale = 0;
    let totalRetail = 0;
    let missingItems: string[] = [];

    recipe.ingredients.forEach(ingredient => {
      // Try to find matching template
      const template = templates.find(t => 
        t.name.toLowerCase().includes(ingredient.name.toLowerCase()) ||
        ingredient.name.toLowerCase().includes(t.name.toLowerCase())
      );

      if (template) {
        const wholesaleCost = template.wholesaleCost * ingredient.quantity;
        const markup = markupSettings[ingredient.type];
        const retailCost = template.wholesaleCost * markup * ingredient.quantity;
        
        totalWholesale += wholesaleCost;
        totalRetail += retailCost;
      } else {
        missingItems.push(ingredient.name);
      }
    });

    const profit = totalRetail - totalWholesale;
    const websiteProfit = recipe.websitePrice - totalWholesale;
    const profitDifference = websiteProfit - profit;

    return {
      totalWholesale,
      totalRetail,
      profit,
      websiteProfit,
      profitDifference,
      missingItems,
      canCalculate: missingItems.length === 0
    };
  };

  const addIngredient = () => {
    if (!newIngredient.name) return;

    setNewRecipe({
      ...newRecipe,
      ingredients: [...newRecipe.ingredients, {
        name: newIngredient.name,
        quantity: parseInt(newIngredient.quantity),
        type: newIngredient.type,
        notes: newIngredient.notes || undefined
      }]
    });

    setNewIngredient({
      name: '',
      quantity: '1',
      type: 'stem',
      notes: ''
    });
  };

  const removeIngredient = (index: number) => {
    setNewRecipe({
      ...newRecipe,
      ingredients: newRecipe.ingredients.filter((_: any, i: number) => i !== index)
    });
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewRecipe({ ...newRecipe, photo: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveRecipe = () => {
    if (!newRecipe.name || newRecipe.ingredients.length === 0) {
      alert('Please enter a recipe name and add at least one ingredient.');
      return;
    }

    try {
      const recipe: ArrangementRecipe = {
        id: Date.now().toString(),
        name: newRecipe.name.trim(),
        description: newRecipe.description?.trim() || undefined,
        websitePrice: parseFloat(newRecipe.websitePrice) || 0,
        websiteUrl: newRecipe.websiteUrl?.trim() || undefined,
        photo: newRecipe.photo || undefined,
        ingredients: newRecipe.ingredients.map((ing: any) => ({
          ...ing,
          name: ing.name.trim(),
          notes: ing.notes?.trim() || undefined
        })),
        lastUpdated: new Date()
      };

      onSaveRecipe(recipe);
      
      // Reset form only after successful save
      setNewRecipe({
        name: '',
        description: '',
        websitePrice: '',
        websiteUrl: '',
        photo: '',
        ingredients: []
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error creating recipe:', error);
      alert('Error saving recipe. Please check your data and try again.');
    }
  };

  const startEditRecipe = (recipe: ArrangementRecipe) => {
    setEditingRecipe(recipe.id);
    setEditRecipe({
      name: recipe.name,
      description: recipe.description || '',
      websitePrice: recipe.websitePrice.toString(),
      websiteUrl: recipe.websiteUrl || '',
      photo: recipe.photo || '',
      ingredients: [...recipe.ingredients]
    });
  };

  const saveEditRecipe = () => {
    if (!editRecipe.name || editRecipe.ingredients.length === 0) {
      alert('Please enter a recipe name and add at least one ingredient.');
      return;
    }

    const updates: Partial<ArrangementRecipe> = {
      name: editRecipe.name,
      description: editRecipe.description || undefined,
      websitePrice: parseFloat(editRecipe.websitePrice) || 0,
      websiteUrl: editRecipe.websiteUrl || undefined,
      photo: editRecipe.photo || undefined,
      ingredients: editRecipe.ingredients,
      lastUpdated: new Date()
    };

    onUpdateRecipe(editingRecipe!, updates);
    setEditingRecipe(null);
  };

  const cancelEditRecipe = () => {
    setEditingRecipe(null);
    setEditRecipe({
      name: '',
      description: '',
      websitePrice: '',
      websiteUrl: '',
      photo: '',
      ingredients: []
    });
  };

  const addEditIngredient = () => {
    if (!editIngredient.name) return;

    setEditRecipe({
      ...editRecipe,
      ingredients: [...editRecipe.ingredients, {
        name: editIngredient.name,
        quantity: parseInt(editIngredient.quantity),
        type: editIngredient.type,
        notes: editIngredient.notes || undefined
      }]
    });

    setEditIngredient({
      name: '',
      quantity: '1',
      type: 'stem',
      notes: ''
    });
  };

  const removeEditIngredient = (index: number) => {
    setEditRecipe({
      ...editRecipe,
      ingredients: editRecipe.ingredients.filter((_: any, i: number) => i !== index)
    });
  };

  const handleEditPhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setEditRecipe({ ...editRecipe, photo: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
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
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-semibold text-gray-800">Arrangement Recipes</h2>
          <span className="text-sm text-gray-500">({recipes.length} recipes)</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Recipe
        </button>
      </div>

      {/* Add Recipe Form */}
      {showAddForm && (
        <div className="bg-emerald-50 rounded-lg p-6 mb-6 border border-emerald-200">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Create New Arrangement Recipe</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arrangement Name *
              </label>
              <input
                type="text"
                value={newRecipe.name}
                onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Spring Garden Bouquet"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={newRecipe.websitePrice}
                onChange={(e) => setNewRecipe({ ...newRecipe, websitePrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={newRecipe.description}
              onChange={(e) => setNewRecipe({ ...newRecipe, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={2}
              placeholder="Brief description of the arrangement..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website URL (Optional)
            </label>
            <input
              type="url"
              value={newRecipe.websiteUrl}
              onChange={(e) => setNewRecipe({ ...newRecipe, websiteUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="https://yourwebsite.com/arrangements/spring-garden"
            />
          </div>

          <div className="mb-4">
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
              {newRecipe.photo && (
                <div className="relative">
                  <img
                    src={newRecipe.photo}
                    alt="Recipe preview"
                    className="w-16 h-16 object-cover rounded-md"
                  />
                  <button
                    onClick={() => setNewRecipe({ ...newRecipe, photo: '' })}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Add Ingredients */}
          <div className="mb-4">
            <h4 className="font-medium text-gray-800 mb-3">Recipe Ingredients</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
              <input
                type="text"
                value={newIngredient.name}
                onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ingredient name"
              />
              <input
                type="number"
                min="1"
                value={newIngredient.quantity}
                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Qty"
              />
              <select
                value={newIngredient.type}
                onChange={(e) => setNewIngredient({ ...newIngredient, type: e.target.value as any })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="stem">Stem</option>
                <option value="vase">Vase</option>
                <option value="accessory">Accessory</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                value={newIngredient.notes}
                onChange={(e) => setNewIngredient({ ...newIngredient, notes: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Notes (optional)"
              />
              <button
                onClick={addIngredient}
                className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors"
              >
                Add
              </button>
            </div>

            {newRecipe.ingredients.length > 0 && (
              <div className="space-y-2">
                {newRecipe.ingredients.map((ingredient: any, index: number) => (
                  <div key={index} className="flex items-center justify-between bg-white p-3 rounded-md border">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{ingredient.name}</span>
                      <span className="text-gray-500">x{ingredient.quantity}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(ingredient.type)}`}>
                        {ingredient.type}
                      </span>
                      {ingredient.notes && (
                        <span className="text-sm text-gray-500">({ingredient.notes})</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeIngredient(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveRecipe}
              className="bg-emerald-600 text-white px-6 py-2 rounded-md hover:bg-emerald-700 transition-colors"
            >
              Save Recipe
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Recipe Form */}
      {editingRecipe && (
        <div className="bg-blue-50 rounded-lg p-6 mb-6 border border-blue-200">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Edit Arrangement Recipe</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arrangement Name *
              </label>
              <input
                type="text"
                value={editRecipe.name}
                onChange={(e) => setEditRecipe({ ...editRecipe, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Spring Garden Bouquet"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={editRecipe.websitePrice}
                onChange={(e) => setEditRecipe({ ...editRecipe, websitePrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={editRecipe.description}
              onChange={(e) => setEditRecipe({ ...editRecipe, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Brief description of the arrangement..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website URL (Optional)
            </label>
            <input
              type="url"
              value={editRecipe.websiteUrl}
              onChange={(e) => setEditRecipe({ ...editRecipe, websiteUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://yourwebsite.com/arrangements/spring-garden"
            />
          </div>

          <div className="mb-4">
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
                  onChange={handleEditPhotoUpload}
                  className="hidden"
                />
              </label>
              {editRecipe.photo && (
                <div className="relative">
                  <img
                    src={editRecipe.photo}
                    alt="Recipe preview"
                    className="w-16 h-16 object-cover rounded-md"
                  />
                  <button
                    onClick={() => setEditRecipe({ ...editRecipe, photo: '' })}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Edit Ingredients */}
          <div className="mb-4">
            <h4 className="font-medium text-gray-800 mb-3">Recipe Ingredients</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
              <input
                type="text"
                value={editIngredient.name}
                onChange={(e) => setEditIngredient({ ...editIngredient, name: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ingredient name"
              />
              <input
                type="number"
                min="1"
                value={editIngredient.quantity}
                onChange={(e) => setEditIngredient({ ...editIngredient, quantity: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Qty"
              />
              <select
                value={editIngredient.type}
                onChange={(e) => setEditIngredient({ ...editIngredient, type: e.target.value as any })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="stem">Stem</option>
                <option value="vase">Vase</option>
                <option value="accessory">Accessory</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                value={editIngredient.notes}
                onChange={(e) => setEditIngredient({ ...editIngredient, notes: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notes (optional)"
              />
              <button
                onClick={addEditIngredient}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            </div>

            {editRecipe.ingredients.length > 0 && (
              <div className="space-y-2">
                {editRecipe.ingredients.map((ingredient: any, index: number) => (
                  <div key={index} className="flex items-center justify-between bg-white p-3 rounded-md border">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{ingredient.name}</span>
                      <span className="text-gray-500">x{ingredient.quantity}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(ingredient.type)}`}>
                        {ingredient.type}
                      </span>
                      {ingredient.notes && (
                        <span className="text-sm text-gray-500">({ingredient.notes})</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeEditIngredient(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveEditRecipe}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
            <button
              onClick={cancelEditRecipe}
              className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recipe List */}
      {recipes.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No arrangement recipes yet. Add your first recipe to start analyzing costs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recipes.map((recipe) => {
            const costAnalysis = calculateRecipeCost(recipe);
            
            return (
              <div key={recipe.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">{recipe.name}</h3>
                    {recipe.description && (
                      <p className="text-sm text-gray-600 mb-2">{recipe.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Website: ${recipe.websitePrice.toFixed(2)}</span>
                      <span>{recipe.ingredients.length} ingredients</span>
                      {recipe.websiteUrl && (
                        <a
                          href={recipe.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </a>
                      )}
                    </div>
                  </div>
                  
                  {recipe.photo && (
                    <img
                      src={recipe.photo}
                      alt={recipe.name}
                      className="w-20 h-20 object-cover rounded-md ml-4"
                    />
                  )}
                </div>

                {/* Cost Analysis */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Cost Analysis
                  </h4>
                  
                  {costAnalysis.canCalculate ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Your Wholesale:</span>
                        <div className="font-medium">${costAnalysis.totalWholesale.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Your Retail:</span>
                        <div className="font-medium text-green-600">${costAnalysis.totalRetail.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Your Profit:</span>
                        <div className="font-medium text-blue-600">${costAnalysis.profit.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Website Profit:</span>
                        <div className={`font-medium ${costAnalysis.websiteProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${costAnalysis.websiteProfit.toFixed(2)}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Profit Difference:</span>
                        <div className={`font-bold ${costAnalysis.profitDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${costAnalysis.profitDifference >= 0 ? '+' : ''}${costAnalysis.profitDifference.toFixed(2)}
                          {costAnalysis.profitDifference >= 0 ? ' (Website pays more)' : ' (Your price is better)'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-amber-600 text-sm">
                      <p className="mb-2">⚠️ Missing price data for:</p>
                      <ul className="list-disc list-inside">
                        {costAnalysis.missingItems.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-gray-600">
                        Add these items to your product library to calculate costs.
                      </p>
                    </div>
                  )}
                </div>

                {/* Ingredients List */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">Ingredients</h4>
                  <div className="space-y-1">
                    {recipe.ingredients.map((ingredient, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span>{ingredient.name}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(ingredient.type)}`}>
                            {ingredient.type}
                          </span>
                          {ingredient.notes && (
                            <span className="text-gray-500">({ingredient.notes})</span>
                          )}
                        </div>
                        <span className="text-gray-600">x{ingredient.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <div className="text-xs text-gray-500">
                    Updated: {recipe.lastUpdated.toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditRecipe(recipe)}
                      className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => setSelectedRecipe(recipe)}
                      className="text-emerald-600 hover:text-emerald-700 text-sm flex items-center gap-1"
                    >
                      <Calculator className="w-3 h-3" />
                      Analyze
                    </button>
                    <button
                      onClick={() => onDeleteRecipe(recipe.id)}
                      className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Analysis Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-800">{selectedRecipe.name}</h3>
                  <p className="text-gray-600">Detailed Cost Analysis</p>
                </div>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              {/* Detailed analysis content would go here */}
              <div className="text-center py-8">
                <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Detailed analysis view coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArrangementRecipes;