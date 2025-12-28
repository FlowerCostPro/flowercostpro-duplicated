import React, { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { POSSettings } from '../types/Product';

interface POSConfigurationProps {
  posSettings: POSSettings;
  onUpdateSettings: (settings: POSSettings) => void;
}

const POSConfiguration: React.FC<POSConfigurationProps> = ({
  posSettings,
  onUpdateSettings
}) => {
  const [settings, setSettings] = useState<POSSettings>(posSettings);

  // Update local state when parent state changes (e.g., after loading from localStorage)
  useEffect(() => {
    console.log('POSConfiguration: Parent posSettings changed:', posSettings);
    setSettings(posSettings);
  }, [posSettings]);

  const handleSave = () => {
    if (!settings.storeName.trim()) {
      alert('Please enter a store name before saving.');
      return;
    }
    
    const updatedSettings: POSSettings = {
      storeName: settings.storeName.trim(),
      isConfigured: true
    };
    
    console.log('POSConfiguration: Saving settings to localStorage:', updatedSettings);
    
    // Update parent component
    onUpdateSettings(updatedSettings);
    
    // Update local state
    setSettings(updatedSettings);
    
    // Show success message
    alert('Store settings saved successfully!');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-semibold text-gray-800">Store Configuration</h2>
        {settings.isConfigured && (
          <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">
            CONFIGURED
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Store Information */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-3">Store Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                Store/Business Name *
              </label>
              <input
                type="text"
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Bloom & Blossom Florist"
                required
              />
            </div>
          </div>
        </div>

        {/* Manual Integration Info */}
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-800 mb-3">How Staff Orders Work</h3>
          <p className="text-sm text-green-700 mb-3">
            FlowerCost Pro uses a simple copy/paste system that works with any POS system.
            No technical setup or integrations required.
          </p>
          <div className="bg-green-100 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800 mb-2">
              <strong>Simple 4-Step Process:</strong>
            </p>
            <ol className="text-sm text-green-700 list-decimal list-inside space-y-1">
              <li>Staff creates arrangement in FlowerCost Pro</li>
              <li>System generates formatted order details with staff name</li>
              <li>Staff clicks "Copy Order Details" button</li>
              <li>Staff pastes details into your POS system and processes payment</li>
            </ol>
          </div>
          <div className="mt-3 p-3 bg-green-100 border border-green-200 rounded-md">
            <p className="text-xs text-green-700">
              <strong>✅ Benefits:</strong> Works with Square, Clover, Toast, Shopify POS, or any system • 
              No monthly integration fees • Staff names tracked • Instant setup
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={!settings.storeName}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Store Settings
          </button>
        </div>

        {/* Current Configuration Summary */}
        {settings.isConfigured && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">Current Configuration</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>Store:</strong> {settings.storeName}</div>
              <div><strong>Integration:</strong> Manual Copy/Paste (Universal)</div>
              <div><strong>Status:</strong> 
                <span className="text-green-600 font-medium ml-1">Ready for Staff Use</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSConfiguration;