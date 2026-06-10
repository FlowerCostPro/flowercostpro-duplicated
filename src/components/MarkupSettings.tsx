import React, { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { MarkupSettings } from '../types/Product';

interface MarkupSettingsProps {
  markupSettings: MarkupSettings;
  onMarkupChange: (settings: MarkupSettings) => void;
}

const MarkupSettingsComponent: React.FC<MarkupSettingsProps> = ({
  markupSettings, 
  onMarkupChange 
}) => {
  const [localSettings, setLocalSettings] = useState<MarkupSettings>(markupSettings);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when parent state changes
  useEffect(() => {
    setLocalSettings(markupSettings);
    setHasChanges(false);
  }, [markupSettings]);

  const handleChange = (type: keyof MarkupSettings, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newSettings = {
      ...localSettings,
      [type]: numValue
    };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = () => {
    console.log('MarkupSettings: handleSave called with:', localSettings);
    
    try {
      onMarkupChange(localSettings);
      setHasChanges(false);
      console.log('MarkupSettings: Settings saved successfully');
      alert('Markup settings saved successfully!');
    } catch (error) {
      console.error('MarkupSettings: Error saving settings:', error);
      alert('Error saving markup settings. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-purple-600" />
        <h2 className="text-xl font-semibold text-gray-800">Markup Settings</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stems Markup
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="1"
              value={localSettings.stem}
              onChange={(e) => handleChange('stem', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vases Markup
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="1"
              value={localSettings.vase}
              onChange={(e) => handleChange('vase', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Accessories Markup
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="1"
              value={localSettings.accessory}
              onChange={(e) => handleChange('accessory', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Other Items Markup
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="1"
              value={localSettings.other}
              onChange={(e) => handleChange('other', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Save Markup Settings
        </button>
        {hasChanges && (
          <span className="text-sm text-amber-600">You have unsaved changes</span>
        )}
      </div>

      <div className="mt-4 p-3 bg-purple-50 rounded-lg">
        <p className="text-sm text-purple-700">
          <strong>Markup multipliers</strong> determine your retail pricing. For example, a 2.5x markup on a $4 wholesale stem = $10 retail price.
        </p>
      </div>
    </div>
  );
};

export default MarkupSettingsComponent;