import React, { useState, useRef, useCallback } from 'react';
import { FileText, Upload, X, Check, Loader2, AlertCircle, Package, SkipForward, AlertTriangle } from 'lucide-react';
import { Product, ProductTemplate } from '../types/Product';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';

interface InvoiceImportProps {
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<ProductTemplate>) => Promise<void>;
  existingTemplates: ProductTemplate[];
  onClose: () => void;
}

interface ExtractedLine {
  productName: string;
  variety: string;
  quantity: number;
  unit: string;
  stemsPerUnit: number;
  linePrice: number;
}

type MatchAction = 'new' | 'update' | 'skip';
type SaveUnit = 'stem' | 'bunch';

interface ReviewLine extends ExtractedLine {
  matchAction: MatchAction;
  matchedTemplateId: string | null;
  matchedTemplate: ProductTemplate | null;
  perStemCost: number;
  finalName: string;
  saveUnit: SaveUnit;
  stemsPerBunch: number;
  finalType: 'stem' | 'vase' | 'accessory' | 'other';
  addToInventory: boolean;
}

function findBestMatch(line: ExtractedLine, templates: ProductTemplate[]): ProductTemplate | null {
  const lineName = line.productName.toLowerCase().trim();
  if (!lineName) return null;

  let best: ProductTemplate | null = null;
  let bestScore = 0;

  for (const t of templates) {
    const tName = t.name.toLowerCase().trim();
    let score = 0;

    if (tName === lineName) {
      score = 100;
    } else if (tName.includes(lineName) || lineName.includes(tName)) {
      score = 70;
    } else {
      const lineWords = lineName.split(/\s+/).filter((w) => w.length > 2);
      const tWords = tName.split(/\s+/).filter((w) => w.length > 2);
      const overlap = lineWords.filter((w) => tWords.some((tw) => tw.includes(w) || w.includes(tw)));
      if (overlap.length > 0) {
        score = (overlap.length / Math.max(lineWords.length, tWords.length)) * 50;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  return bestScore >= 50 ? best : null;
}

function computePerStemCost(line: ExtractedLine): number {
  const totalStems = line.quantity * line.stemsPerUnit;
  if (totalStems <= 0) return 0;
  return Math.round((line.linePrice / totalStems) * 100) / 100;
}

function computeSavedCost(line: ReviewLine): number {
  if (line.saveUnit === 'bunch') {
    if (line.stemsPerBunch <= 0) return 0;
    return Math.round((line.linePrice / (line.quantity * line.stemsPerBunch / line.stemsPerBunch)) * 100) / 100;
  }
  return line.perStemCost;
}

function computeBunchCost(line: ReviewLine): number {
  const totalBunches = line.stemsPerBunch > 0
    ? (line.quantity * line.stemsPerUnit) / line.stemsPerBunch
    : line.quantity;
  if (totalBunches <= 0) return 0;
  return Math.round((line.linePrice / totalBunches) * 100) / 100;
}

const InvoiceImport: React.FC<InvoiceImportProps> = ({
  onAddProduct,
  onUpdateTemplate,
  existingTemplates,
  onClose,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewLines, setReviewLines] = useState<ReviewLine[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setReviewLines(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setError('You must be signed in to import invoices.');
        setIsProcessing(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-invoice`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to process invoice. Please try again.');
        setIsProcessing(false);
        return;
      }

      const extractedLines: ExtractedLine[] = result.lineItems || [];
      if (extractedLines.length === 0) {
        setError('No product line items found in this invoice.');
        setIsProcessing(false);
        return;
      }

      const lines: ReviewLine[] = extractedLines.map((line) => {
        const match = findBestMatch(line, existingTemplates);
        const perStemCost = computePerStemCost(line);
        const finalName = line.variety
          ? `${line.productName} - ${line.variety}`.trim()
          : line.productName;

        const isBox = line.unit === 'box';
        let saveUnit: SaveUnit = 'stem';
        let stemsPerBunch = line.stemsPerUnit;

        if (match) {
          saveUnit = (match.unit ?? 'stem') === 'bunch' ? 'bunch' : 'stem';
        } else if (line.unit === 'bunch') {
          saveUnit = 'bunch';
          stemsPerBunch = line.stemsPerUnit;
        } else if (isBox) {
          saveUnit = 'stem';
        }

        return {
          ...line,
          matchAction: match ? 'update' : 'new',
          matchedTemplateId: match?.id ?? null,
          matchedTemplate: match,
          perStemCost,
          finalName,
          saveUnit,
          stemsPerBunch,
          finalType: 'stem' as 'stem' | 'vase' | 'accessory' | 'other',
          addToInventory: true,
        };
      });

      setReviewLines(lines);
      setIsProcessing(false);
    } catch (err) {
      console.error('Invoice import error:', err);
      setError('An unexpected error occurred while processing the invoice.');
      setIsProcessing(false);
    }
  }, [existingTemplates]);

  const updateLine = (index: number, patch: Partial<ReviewLine>) => {
    setReviewLines((prev) => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      if (patch.quantity !== undefined || patch.stemsPerUnit !== undefined || patch.linePrice !== undefined) {
        updated[index].perStemCost = computePerStemCost(updated[index]);
      }
      return updated;
    });
  };

  const handleMatchChange = (index: number, action: MatchAction, templateId?: string) => {
    setReviewLines((prev) => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[index].matchAction = action;
      if (action === 'update' && templateId) {
        const template = existingTemplates.find((t) => t.id === templateId) ?? null;
        updated[index].matchedTemplateId = templateId;
        updated[index].matchedTemplate = template;
        if (template) {
          const templateUnit = (template.unit ?? 'stem') === 'bunch' ? 'bunch' : 'stem';
          updated[index].saveUnit = templateUnit;
        }
      } else if (action === 'new') {
        updated[index].matchedTemplateId = null;
        updated[index].matchedTemplate = null;
      }
      return updated;
    });
  };

  const handleConfirm = async () => {
    if (!reviewLines) return;
    const linesToSave = reviewLines.filter((l) => l.matchAction !== 'skip');
    if (linesToSave.length === 0) {
      showToast('No lines selected to import. Skipping all lines.', 'warning');
      onClose();
      return;
    }

    setIsSaving(true);
    let count = 0;

    try {
      for (const line of linesToSave) {
        if (line.saveUnit === 'bunch') {
          const bunchCost = computeBunchCost(line);
          if (line.matchAction === 'update' && line.matchedTemplateId) {
            const updates: Partial<ProductTemplate> = {
              wholesaleCost: bunchCost,
              unit: 'bunch',
              type: line.finalType,
              lastUsed: new Date(),
            };
            if (line.addToInventory && line.matchedTemplate) {
              const totalBunches = line.stemsPerBunch > 0
                ? (line.quantity * line.stemsPerUnit) / line.stemsPerBunch
                : line.quantity;
              updates.inventoryCount = (line.matchedTemplate.inventoryCount ?? 0) + Math.round(totalBunches * 100) / 100;
            }
            await onUpdateTemplate(line.matchedTemplateId, updates);
          } else {
            onAddProduct({
              name: line.finalName,
              wholesaleCost: bunchCost,
              quantity: 1,
              type: line.finalType,
              unit: 'bunch',
              inventoryCount: undefined,
              lowStockThreshold: undefined,
            });
          }
        } else {
          if (line.matchAction === 'update' && line.matchedTemplateId) {
            const updates: Partial<ProductTemplate> = {
              wholesaleCost: line.perStemCost,
              unit: 'stem',
              type: line.finalType,
              lastUsed: new Date(),
            };
            if (line.addToInventory && line.matchedTemplate) {
              const totalStems = line.quantity * line.stemsPerUnit;
              updates.inventoryCount = (line.matchedTemplate.inventoryCount ?? 0) + totalStems;
            }
            await onUpdateTemplate(line.matchedTemplateId, updates);
          } else {
            onAddProduct({
              name: line.finalName,
              wholesaleCost: line.perStemCost,
              quantity: 1,
              type: line.finalType,
              unit: 'stem',
              inventoryCount: undefined,
              lowStockThreshold: undefined,
            });
          }
        }
        count++;
      }

      setIsSaving(false);
      showToast(`Successfully imported ${count} product${count !== 1 ? 's' : ''} from invoice.`, 'success');
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      setIsSaving(false);
      setError(`Saved ${count} product(s) before an error occurred. Please check your product library and try importing the remaining lines again.`);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const activeLines = reviewLines?.filter((l) => l.matchAction !== 'skip') ?? [];

  const getSavedCostDisplay = (line: ReviewLine): { cost: number; unit: string } => {
    if (line.saveUnit === 'bunch') {
      return { cost: computeBunchCost(line), unit: 'bunch' };
    }
    return { cost: line.perStemCost, unit: 'stem' };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">Import from Invoice</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 font-medium">Import Error</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Reading your invoice...</p>
              <p className="text-gray-400 text-sm mt-1">Extracting product lines with AI. This usually takes a few seconds.</p>
            </div>
          )}

          {!isProcessing && !reviewLines && !error && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-green-400 hover:bg-green-50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">Upload an invoice</p>
              <p className="text-sm text-gray-500 mb-1">Drag and drop a PDF or image here, or click to browse</p>
              <p className="text-xs text-gray-400 mt-3">PDF, PNG, JPG, WebP — up to 20MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,application/pdf,image/*"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {!isProcessing && reviewLines && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Review {reviewLines.length} extracted line{reviewLines.length !== 1 ? 's' : ''}.{' '}
                  <span className="font-medium">{activeLines.length}</span> will be imported.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Upload different file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,application/pdf,image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>

              {/* Line items */}
              <div className="space-y-3">
                {reviewLines.map((line, index) => {
                  const saved = getSavedCostDisplay(line);
                  const isBox = line.unit === 'box';
                  const unitMismatch = line.matchedTemplate &&
                    line.unit !== 'box' &&
                    ((line.matchedTemplate.unit ?? 'stem') !== line.unit);

                  return (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 transition-colors ${
                        line.matchAction === 'skip'
                          ? 'border-gray-200 bg-gray-50 opacity-60'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      {/* Match status row */}
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        {line.matchAction === 'update' && line.matchedTemplate ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-amber-700 font-medium">Update existing:</span>
                            <span className="text-gray-700">{line.matchedTemplate.name}</span>
                            <span className="text-gray-400">—</span>
                            <span className="text-red-600 line-through">${line.matchedTemplate.wholesaleCost.toFixed(2)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-600 font-medium">${saved.cost.toFixed(2)}</span>
                          </div>
                        ) : line.matchAction === 'new' ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 font-medium">Add as new product</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm">
                            <SkipForward className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500 font-medium">Skipped</span>
                          </div>
                        )}
                        <select
                          value={line.matchAction}
                          onChange={(e) => {
                            const action = e.target.value as MatchAction;
                            if (action === 'update') {
                              const firstTemplate = existingTemplates[0];
                              if (firstTemplate) {
                                handleMatchChange(index, 'update', firstTemplate.id);
                              } else {
                                handleMatchChange(index, 'new');
                              }
                            } else {
                              handleMatchChange(index, action);
                            }
                          }}
                          disabled={isSaving}
                          className="ml-auto text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="new">Add as new</option>
                          {line.matchAction === 'update' && line.matchedTemplateId && (
                            <option value="update">Update: {line.matchedTemplate?.name}</option>
                          )}
                          {line.matchAction !== 'update' && existingTemplates.length > 0 && (
                            <option value="update">Update existing...</option>
                          )}
                          <option value="skip">Skip this line</option>
                        </select>
                      </div>

                      {/* Template picker */}
                      {line.matchAction === 'update' && existingTemplates.length > 1 && (
                        <div className="mb-3">
                          <select
                            value={line.matchedTemplateId ?? ''}
                            onChange={(e) => handleMatchChange(index, 'update', e.target.value)}
                            disabled={isSaving}
                            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            {existingTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} (${t.wholesaleCost.toFixed(2)}/{t.unit ?? 'stem'})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Unit mismatch warning */}
                      {unitMismatch && (
                        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span className="text-xs text-amber-700">
                            Invoice lists this as "{line.unit}" but your existing product uses "{line.matchedTemplate?.unit ?? 'stem'}".
                            Saving will use the existing product's unit.
                          </span>
                        </div>
                      )}

                      {/* Box conversion notice */}
                      {isBox && line.matchAction !== 'skip' && (
                        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="text-xs text-blue-700">
                            Invoice lists this as "box" — choose how to save it below. Box is not a valid product unit.
                          </span>
                        </div>
                      )}

                      {/* Editable fields */}
                      {line.matchAction !== 'skip' && (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="col-span-2 md:col-span-2">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Product Name</label>
                              <input
                                type="text"
                                value={line.finalName}
                                onChange={(e) => updateLine(index, { finalName: e.target.value })}
                                disabled={isSaving}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Qty</label>
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) => updateLine(index, { quantity: parseInt(e.target.value) || 1 })}
                                disabled={isSaving}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Unit</label>
                              <div className="w-full px-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-600">
                                {line.unit}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Stems / Unit</label>
                              <input
                                type="number"
                                min="1"
                                value={line.stemsPerUnit}
                                onChange={(e) => updateLine(index, { stemsPerUnit: parseInt(e.target.value) || 1 })}
                                disabled={isSaving}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Line Price ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.linePrice}
                                onChange={(e) => updateLine(index, { linePrice: parseFloat(e.target.value) || 0 })}
                                disabled={isSaving}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Per-Stem Cost</label>
                              <div className="w-full px-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md font-medium text-gray-700">
                                ${line.perStemCost.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                              <select
                                value={line.finalType}
                                onChange={(e) => updateLine(index, { finalType: e.target.value as 'stem' | 'vase' | 'accessory' | 'other' })}
                                disabled={isSaving || line.saveUnit === 'bunch'}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
                              >
                                <option value="stem">Stem</option>
                                <option value="vase">Vase</option>
                                <option value="accessory">Accessory</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </div>

                          {/* Save-as selector (always visible, but especially for box) */}
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Save as unit</label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateLine(index, { saveUnit: 'stem' })}
                                  disabled={isSaving}
                                  className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                    line.saveUnit === 'stem'
                                      ? 'bg-green-600 text-white border-green-600'
                                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  Per Stem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateLine(index, { saveUnit: 'bunch' })}
                                  disabled={isSaving}
                                  className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                    line.saveUnit === 'bunch'
                                      ? 'bg-green-600 text-white border-green-600'
                                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  Per Bunch
                                </button>
                              </div>
                            </div>
                            {line.saveUnit === 'bunch' && (
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Stems per bunch</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={line.stemsPerBunch}
                                  onChange={(e) => updateLine(index, { stemsPerBunch: parseInt(e.target.value) || 1 })}
                                  disabled={isSaving}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                              </div>
                            )}
                          </div>

                          {/* Saved value display */}
                          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                            <span className="text-sm text-green-700">
                              Will save: <strong>${saved.cost.toFixed(2)} per {saved.unit}</strong>
                              {line.matchAction === 'update' && line.matchedTemplate && (
                                <span className="text-gray-500"> (was ${line.matchedTemplate.wholesaleCost.toFixed(2)} per {line.matchedTemplate.unit ?? 'stem'})</span>
                              )}
                            </span>
                          </div>

                          {/* Inventory section for updates */}
                          {line.matchAction === 'update' && line.matchedTemplate && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.addToInventory}
                                  onChange={(e) => updateLine(index, { addToInventory: e.target.checked })}
                                  disabled={isSaving}
                                  className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm text-amber-800">
                                  Add received quantity to inventory
                                </span>
                              </label>
                              {line.addToInventory && (
                                <p className="text-xs text-amber-700 mt-1 ml-6">
                                  {(() => {
                                    const existing = line.matchedTemplate!.inventoryCount ?? 0;
                                    if (line.saveUnit === 'bunch') {
                                      const totalBunches = line.stemsPerBunch > 0
                                        ? (line.quantity * line.stemsPerUnit) / line.stemsPerBunch
                                        : line.quantity;
                                      return `${existing} + ${Math.round(totalBunches * 100) / 100} received = ${Math.round((existing + totalBunches) * 100) / 100} bunches`;
                                    }
                                    const totalStems = line.quantity * line.stemsPerUnit;
                                    return `${existing} + ${totalStems} received = ${existing + totalStems} stems`;
                                  })()}
                                </p>
                              )}
                              {!line.addToInventory && (
                                <p className="text-xs text-amber-700 mt-1 ml-6">
                                  Inventory unchanged at {line.matchedTemplate.inventoryCount ?? 0} {line.matchedTemplate.unit ?? 'stem'}s
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isProcessing && reviewLines && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              {activeLines.length} of {reviewLines.length} lines will be imported
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSaving || activeLines.length === 0}
                className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm & Import ({activeLines.length})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceImport;
