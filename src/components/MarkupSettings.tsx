import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, Trash2, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { MarkupSettings, PricingProfile } from '../types/Product';
import { useToast } from './Toast';

interface MarkupSettingsProps {
  markupSettings: MarkupSettings;
  onMarkupChange: (settings: MarkupSettings) => void;
  pricingProfiles: PricingProfile[];
  onSavePricingProfile: (profile: Partial<PricingProfile> & { name: string }) => Promise<any>;
  onDeletePricingProfile: (profileId: string) => Promise<void>;
}

const DEFAULT_PROFILE_VALUES = {
  stem: 2.5,
  vase: 2.0,
  accessory: 3.0,
  other: 2.0,
  bunch: 2.0,
  laborPercent: null as number | null
};

const MarkupSettingsComponent: React.FC<MarkupSettingsProps> = ({
  markupSettings,
  onMarkupChange,
  pricingProfiles,
  onSavePricingProfile,
  onDeletePricingProfile
}) => {
  const { showToast } = useToast();
  const [localSettings, setLocalSettings] = useState<MarkupSettings>(markupSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);
  const [editingProfiles, setEditingProfiles] = useState<Record<string, PricingProfile>>({});
  const [profileChanges, setProfileChanges] = useState<Set<string>>(new Set());
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);

  useEffect(() => {
    setLocalSettings(markupSettings);
    setHasChanges(false);
  }, [markupSettings]);

  // Initialize editing state from loaded profiles
  useEffect(() => {
    const editMap: Record<string, PricingProfile> = {};
    pricingProfiles.forEach(p => { editMap[p.id] = { ...p }; });
    setEditingProfiles(editMap);
    setProfileChanges(new Set());
    // Auto-expand the default profile on first load
    if (expandedProfileId === null && pricingProfiles.length > 0) {
      const defaultProfile = pricingProfiles.find(p => p.isDefault);
      setExpandedProfileId(defaultProfile?.id || pricingProfiles[0].id);
    }
  }, [pricingProfiles]);

  const handleChange = (type: keyof MarkupSettings, value: string) => {
    const numValue = type === 'laborPercent'
      ? (value === '' ? null : parseFloat(value))
      : (parseFloat(value) || 0);
    const newSettings = { ...localSettings, [type]: numValue };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleProfileChange = (profileId: string, field: keyof PricingProfile, value: string) => {
    const profile = editingProfiles[profileId];
    if (!profile) return;
    const numValue = field === 'laborPercent'
      ? (value === '' ? null : parseFloat(value))
      : (parseFloat(value) || 0);
    const updated = { ...profile, [field]: numValue };
    setEditingProfiles({ ...editingProfiles, [profileId]: updated });
    setProfileChanges(new Set([...profileChanges, profileId]));
  };

  const handleProfileNameChange = (profileId: string, name: string) => {
    const profile = editingProfiles[profileId];
    if (!profile) return;
    setEditingProfiles({ ...editingProfiles, [profileId]: { ...profile, name } });
    setProfileChanges(new Set([...profileChanges, profileId]));
  };

  const handleSaveProfile = async (profileId: string) => {
    const profile = editingProfiles[profileId];
    if (!profile) return;
    setSavingProfileId(profileId);
    try {
      await onSavePricingProfile({
        id: profile.id,
        name: profile.name,
        stem: profile.stem,
        vase: profile.vase,
        accessory: profile.accessory,
        other: profile.other,
        bunch: profile.bunch,
        laborPercent: profile.laborPercent,
        isDefault: profile.isDefault,
        sortOrder: profile.sortOrder
      });
      const newChanges = new Set(profileChanges);
      newChanges.delete(profileId);
      setProfileChanges(newChanges);
      showToast(`Profile "${profile.name}" saved successfully!`, 'success');
    } catch (error: any) {
      showToast(`Error saving profile: ${error?.message ?? 'Unknown error'}`, 'error');
    } finally {
      setSavingProfileId(null);
    }
  };

  const handleAddProfile = async () => {
    try {
      const maxSort = Math.max(0, ...pricingProfiles.map(p => p.sortOrder));
      await onSavePricingProfile({
        name: 'New Profile',
        ...DEFAULT_PROFILE_VALUES,
        isDefault: false,
        sortOrder: maxSort + 1
      });
      showToast('New profile created! Edit the values and save.', 'success');
    } catch (error: any) {
      showToast(`Error creating profile: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    const profile = editingProfiles[profileId];
    if (!profile) return;
    if (profile.isDefault) {
      showToast('Cannot delete the default profile', 'error');
      return;
    }
    if (pricingProfiles.length <= 1) {
      showToast('Cannot delete the last pricing profile', 'error');
      return;
    }
    if (!confirm(`Delete the "${profile.name}" profile? Orders that used this profile will keep their saved prices but lose the profile reference.`)) return;
    try {
      await onDeletePricingProfile(profileId);
      showToast(`Profile "${profile.name}" deleted`, 'success');
    } catch (error: any) {
      showToast(`Error deleting profile: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const handleSetDefault = async (profileId: string) => {
    const profile = editingProfiles[profileId];
    if (!profile) return;
    setSavingProfileId(profileId);
    try {
      await onSavePricingProfile({
        id: profile.id,
        name: profile.name,
        stem: profile.stem,
        vase: profile.vase,
        accessory: profile.accessory,
        other: profile.other,
        bunch: profile.bunch,
        laborPercent: profile.laborPercent,
        isDefault: true,
        sortOrder: profile.sortOrder
      });
      showToast(`"${profile.name}" is now the default profile`, 'success');
    } catch (error: any) {
      showToast(`Error setting default: ${error?.message ?? 'Unknown error'}`, 'error');
    } finally {
      setSavingProfileId(null);
    }
  };

  const handleSave = () => {
    try {
      onMarkupChange(localSettings);
      setHasChanges(false);
      showToast('Markup settings saved successfully!', 'success');
    } catch (error) {
      showToast('Error saving markup settings. Please try again.', 'error');
    }
  };

  const renderProfileFields = (profile: PricingProfile) => {
    const isEditing = editingProfiles[profile.id];
    const values = isEditing || profile;
    const hasChange = profileChanges.has(profile.id);

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profile Name</label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => handleProfileNameChange(profile.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stems Markup</label>
          <div className="relative">
            <input
              type="number" step="0.1" min="1"
              value={values.stem}
              onChange={(e) => handleProfileChange(profile.id, 'stem', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vases Markup</label>
          <div className="relative">
            <input
              type="number" step="0.1" min="1"
              value={values.vase}
              onChange={(e) => handleProfileChange(profile.id, 'vase', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Accessories Markup</label>
          <div className="relative">
            <input
              type="number" step="0.1" min="1"
              value={values.accessory}
              onChange={(e) => handleProfileChange(profile.id, 'accessory', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Other Items Markup</label>
          <div className="relative">
            <input
              type="number" step="0.1" min="1"
              value={values.other}
              onChange={(e) => handleProfileChange(profile.id, 'other', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bunch Markup</label>
          <div className="relative">
            <input
              type="number" step="0.1" min="1"
              value={values.bunch}
              onChange={(e) => handleProfileChange(profile.id, 'bunch', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
            />
            <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
          </div>
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Labor Charge (optional)</label>
          <div className="flex items-center gap-3">
            <div className="relative w-36">
              <input
                type="number" step="0.1" min="0" max="100"
                value={values.laborPercent ?? ''}
                onChange={(e) => handleProfileChange(profile.id, 'laborPercent', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
                placeholder="e.g. 25"
              />
              <span className="absolute right-3 top-2 text-gray-500 text-sm">%</span>
            </div>
            <span className="text-sm text-gray-500">
              {values.laborPercent && values.laborPercent > 0
                ? `Deducted from customer budget before designers build — never shown to staff.`
                : 'No labor deduction for this profile.'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Pricing Profiles Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-gray-800">Pricing Profiles</h2>
          </div>
          <button
            onClick={handleAddProfile}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Profile
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Create pricing profiles for different occasions (Everyday, Wedding, Funeral, etc.). Each profile has its own markup multipliers and labor percentage. Designers select an occasion when building an arrangement — they see only the profile name, never the markup or labor values.
        </p>

        {pricingProfiles.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Tag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 mb-3">No pricing profiles yet. Your current markup settings will become the "Everyday" profile.</p>
            <button
              onClick={handleAddProfile}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Default Profiles
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pricingProfiles.map((profile) => {
              const isExpanded = expandedProfileId === profile.id;
              const hasChange = profileChanges.has(profile.id);
              return (
                <div key={profile.id} className={`border rounded-lg overflow-hidden ${profile.isDefault ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedProfileId(isExpanded ? null : profile.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                      <span className="font-medium text-gray-800">{editingProfiles[profile.id]?.name || profile.name}</span>
                      {profile.isDefault && (
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                          DEFAULT
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {profile.stem}x stems / {profile.bunch}x bunch{profile.laborPercent ? ` / ${profile.laborPercent}% labor` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {!profile.isDefault && (
                        <button
                          onClick={() => handleSetDefault(profile.id)}
                          disabled={savingProfileId === profile.id}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium px-2 py-1 rounded hover:bg-emerald-100 transition-colors"
                        >
                          Set as Default
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && editingProfiles[profile.id] && (
                    <div className="border-t border-gray-200 p-4 bg-white">
                      {renderProfileFields(profile)}
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={() => handleSaveProfile(profile.id)}
                          disabled={!hasChange || savingProfileId === profile.id}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          <Save className="w-4 h-4" />
                          {savingProfileId === profile.id ? 'Saving...' : 'Save Profile'}
                        </button>
                        {hasChange && (
                          <span className="text-sm text-amber-600">You have unsaved changes</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legacy Markup Settings (still used as fallback) */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-800">Default Markup Settings</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          These values are used as a fallback when no pricing profile is selected. The "Everyday" pricing profile above is seeded from these values.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {(['stem', 'vase', 'accessory', 'other', 'bunch'] as const).map((type) => (
            <div key={type}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {type === 'stem' ? 'Stems' : type === 'vase' ? 'Vases' : type === 'accessory' ? 'Accessories' : type === 'other' ? 'Other Items' : 'Bunch'} Markup
              </label>
              <div className="relative">
                <input
                  type="number" step="0.1" min="1"
                  value={localSettings[type]}
                  onChange={(e) => handleChange(type, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 pr-8"
                />
                <span className="absolute right-3 top-2 text-gray-500 text-sm">x</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="flex items-start gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Labor Charge (optional)
              </label>
              <div className="relative">
                <input
                  type="number" step="0.1" min="0" max="100"
                  value={localSettings.laborPercent ?? ''}
                  onChange={(e) => handleChange('laborPercent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 pr-8"
                  placeholder="e.g. 25"
                />
                <span className="absolute right-3 top-2 text-gray-500 text-sm">%</span>
              </div>
            </div>
            <div className="flex-1 pt-6 text-sm text-gray-500">
              {localSettings.laborPercent && localSettings.laborPercent > 0
                ? `When a designer enters an $85 budget, they build to $${(85 * (1 - localSettings.laborPercent / 100)).toFixed(2)} in flowers — $${(85 * localSettings.laborPercent / 100).toFixed(2)} is captured as labor.`
                : 'When set, this percentage is silently deducted from the customer budget before designers start building. Designers see only their reduced flower budget.'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Default Settings
          </button>
          {hasChanges && (
            <span className="text-sm text-amber-600">You have unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarkupSettingsComponent;
