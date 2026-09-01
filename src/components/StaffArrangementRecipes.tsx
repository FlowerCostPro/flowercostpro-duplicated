import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { ArrangementRecipe } from '../types/Product';

interface StaffArrangementRecipesProps {
  recipes: ArrangementRecipe[];
}

const getTypeColor = (type: string) => {
  switch (type) {
    case 'stem': return 'bg-green-100 text-green-800';
    case 'bunch': return 'bg-teal-100 text-teal-800';
    case 'vase': return 'bg-blue-100 text-blue-800';
    case 'accessory': return 'bg-purple-100 text-purple-800';
    case 'other': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const PORTION_LABELS: Record<number, string> = { 1: 'Full', 2: '½', 3: '⅓', 4: '¼' };

const StaffArrangementRecipes: React.FC<StaffArrangementRecipesProps> = ({ recipes }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="w-5 h-5 text-emerald-600" />
        <h2 className="text-xl font-semibold text-gray-800">Arrangement Recipes</h2>
        <span className="text-sm text-gray-500">({recipes.length} recipes)</span>
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No arrangement recipes have been saved yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{recipe.name}</h3>
                  {recipe.description && (
                    <p className="text-sm text-gray-600 mb-2">{recipe.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                      Retail Total: ${recipe.websitePrice.toFixed(2)}
                    </span>
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
                        {ingredient.type === 'bunch' && ingredient.portionDivisor && ingredient.portionDivisor !== 1 && (
                          <span className="text-xs text-teal-700 font-medium">{PORTION_LABELS[ingredient.portionDivisor]} bunch</span>
                        )}
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
                <div className="text-sm font-bold text-emerald-700">
                  ${recipe.websitePrice.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffArrangementRecipes;
