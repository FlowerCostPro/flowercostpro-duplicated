import React, { useState, useRef, useCallback } from 'react';
import { FileText, Upload, X, Check, Loader2, AlertCircle, Package, SkipForward } from 'lucide-react';
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

interface ReviewLine extends ExtractedLine {
  matchAction: MatchAction;
  matchedTemplateId: string | null;
  matchedTemplate: ProductTemplate | null;
  perStemCost: number;
  finalName: string;
  finalUnit: 'stem' | 'bunch';
  finalType: 'stem' | 'vase' | 'accessory' | 'other';
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
  const [savedCount, setSavedCount] = useState(0);

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
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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

        return {
          ...line,
          matchAction: match ? 'update' : 'new',
          matchedTemplateId: match?.id ?? null,
          matchedTemplate: match,
          perStemCost,
          finalName,
          finalUnit: (line.unit === 'bunch' ? 'bunch' : 'stem') as 'stem' | 'bunch',
          finalType: 'stem' as 'stem' | 'vase' | 'accessory' | 'other',
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

  const handleInputChange = (index: number, field: keyof ReviewLine, value: string | number) => {
    setReviewLines((prev) => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (['quantity', 'stemsPerUnit', 'linePrice'].includes(field as string)) {
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
        if (line.matchAction === 'update' && line.matchedTemplateId) {
          await onUpdateTemplate(line.matchedTemplateId, {
            wholesaleCost: line.finalUnit === 'bunch'
              ? Math.round((line.linePrice / line.quantity) * 100) / 100
              : line.perStemCost,
            unit: line.finalUnit,
            type: line.finalType,
            lastUsed: new Date(),
          });
        } else {
          onAddProduct({
            name: line.finalName,
            wholesaleCost: line.finalUnit === 'bunch'
              ? Math.round((line.linePrice / line.quantity) * 100) / 100
              : line.perStemCost,
            quantity: 1,
            type: line.finalType,
            unit: line.finalUnit,
            inventoryCount: undefined,
            lowStockThreshold: undefined,
          });
        }
        count++;
      }

      setSavedCount(count);
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
                {reviewLines.map((line, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 transition-colors ${
                      line.matchAction === 'skip'
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    {/* Match status row */}
                    <div className="flex items-center gap-3 mb-3">
                      {line.matchAction === 'update' && line.matchedTemplate ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-amber-700 font-medium">Update existing:</span>
                          <span className="text-gray-700">{line.matchedTemplate.name}</span>
                          <span className="text-gray-400">—</span>
                          <span className="text-red-600 line-through">${line.matchedTemplate.wholesaleCost.toFixed(2)}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-600 font-medium">
                            ${line.finalUnit === 'bunch'
                              ? (line.linePrice / line.quantity).toFixed(2)
                              : line.perStemCost.toFixed(2)}
                          </span>
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

                    {/* Template picker (only when updating and multiple options exist) */}
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
                              {t.name} (${t.wholesaleCost.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Editable fields */}
                    {line.matchAction !== 'skip' && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="col-span-2 md:col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Product Name</label>
                          <input
                            type="text"
                            value={line.finalName}
                            onChange={(e) => handleInputChange(index, 'finalName', e.target.value)}
                            disabled={isSaving}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleInputChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            disabled={isSaving}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                          <select
                            value={line.unit}
                            onChange={(e) => {
                              const unit = e.target.value;
                              setReviewLines((prev) => {
                                if (!prev) return prev;
                                const updated = [...prev];
                                updated[index] = {
                                  ...updated[index],
                                  unit,
                                  finalUnit: unit === 'bunch' ? 'bunch' : 'stem',
                                  perStemCost: computePerStemCost(updated[index]),
                                };
                                return updated;
                              });
                            }}
                            disabled={isSaving}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="stem">stem</option>
                            <option value="bunch">bunch</option>
                            <option value="box">box</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Stems / Unit</label>
                          <input
                            type="number"
                            min="1"
                            value={line.stemsPerUnit}
                            onChange={(e) => handleInputChange(index, 'stemsPerUnit', parseInt(e.target.value) || 1)}
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
                            onChange={(e) => handleInputChange(index, 'linePrice', parseFloat(e.target.value) || 0)}
                            disabled={isSaving}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Per-Stem Cost</label>
                          <div className="w-full px-2 py-1.5 text-sm bg-green-50 border border-green-200 rounded-md font-medium text-green-700">
                            ${line.perStemCost.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                          <select
                            value={line.finalType}
                            onChange={(e) => handleInputChange(index, 'finalType', e.target.value as 'stem' | 'vase' | 'accessory' | 'other')}
                            disabled={isSaving || line.finalUnit === 'bunch'}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
                          >
                            <option value="stem">Stem</option>
                            <option value="vase">Vase</option>
                            <option value="accessory">Accessory</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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
