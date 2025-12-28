import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Copy, Download } from 'lucide-react';
import { OrderRecord, POSSettings } from '../types/Product';

interface POSIntegrationProps {
  order: OrderRecord;
  posSettings: POSSettings;
  onClose: () => void;
}

const POSIntegration: React.FC<POSIntegrationProps> = ({ order, posSettings, onClose }) => {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const generateOrderData = () => {
    return {
      orderId: order.id,
      orderName: order.name,
      storeName: posSettings.storeName,
      staffName: order.staffName,
      staffId: order.staffId,
      totalAmount: order.totalRetail,
      items: order.products.map((product: any) => ({
        name: product.name,
        quantity: product.quantity,
        price: product.wholesaleCost * 2.5, // Estimated retail price
        category: product.type
      })),
      notes: order.notes,
      timestamp: order.date.toISOString()
    };
  };

  const generatePOSText = () => {
    const lines = [];
    lines.push('='.repeat(50));
    lines.push(`ARRANGEMENT: ${order.name}`);
    lines.push(`STAFF: ${order.staffName}${order.staffId ? ` (ID: ${order.staffId})` : ''}`);
    lines.push(`DATE: ${order.date.toLocaleDateString()} ${order.date.toLocaleTimeString()}`);
    lines.push(`ORDER ID: #${order.id}`);
    lines.push('='.repeat(50));
    lines.push('');
    
    if (order.notes) {
      lines.push('CUSTOMER NOTES:');
      lines.push(order.notes);
      lines.push('');
    }
    
    lines.push('ITEMS:');
    lines.push('-'.repeat(50));
    
    order.products.forEach((product: any, index: number) => {
      const estimatedRetailPrice = product.wholesaleCost * 2.5;
      const totalRetail = estimatedRetailPrice * product.quantity;
      
      lines.push(`${index + 1}. ${product.name} (${product.type})`);
      lines.push(`   Qty: ${product.quantity} x $${estimatedRetailPrice.toFixed(2)} = $${totalRetail.toFixed(2)}`);
      lines.push('');
    });
    
    lines.push('-'.repeat(50));
    lines.push(`TOTAL AMOUNT: $${order.totalRetail.toFixed(2)}`);
    lines.push(`STAFF: ${order.staffName}`);
    lines.push('='.repeat(50));
    
    return lines.join('\n');
  };

  const copyToClipboard = async () => {
    const posText = generatePOSText();
    
    console.log('Attempting to copy text:', posText); // Debug log
    
    try {
      await navigator.clipboard.writeText(posText);
      console.log('Clipboard write successful'); // Debug log
      setConnectionStatus('success');
      
      // Show success message with clear instructions
      const posSystemName = 'your POS system';
      alert(`✅ SUCCESS! Order details copied to clipboard!

📋 NEXT STEPS:
1. Go to your ${posSystemName}
2. Create a new sale for $${order.totalRetail.toFixed(2)}
3. In the notes/description field, press Ctrl+V (or Cmd+V on Mac) to paste
4. Process customer payment

👤 Staff: ${order.staffName} will be recorded with this sale.`);
      
    } catch (err) {
      console.error('Clipboard API failed:', err); // Debug log
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = posText;
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        console.log('Fallback copy result:', successful); // Debug log
        
        if (successful) {
          setConnectionStatus('success');
          const posSystemName = 'your POS system';
          alert(`✅ SUCCESS! Order details copied to clipboard!

📋 NEXT STEPS:
1. Go to your ${posSystemName}
2. Create a new sale for $${order.totalRetail.toFixed(2)}
3. In the notes/description field, press Ctrl+V (or Cmd+V on Mac) to paste
4. Process customer payment

👤 Staff: ${order.staffName} will be recorded with this sale.`);
        } else {
          throw new Error('Copy command failed');
        }
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr); // Debug log
        setConnectionStatus('error');
        alert('❌ Copy failed. The manual copy area will appear below - please select all text and copy it manually.');
      }
    }
  };

  const downloadOrderFile = () => {
    const orderData = generateOrderData();
    const jsonString = JSON.stringify(orderData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order_${order.id}_${order.staffName?.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    onClose();
    // Don't automatically clear - let user decide when to clear
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-2xl font-semibold text-gray-800">Send to POS System</h3>
              <p className="text-gray-600">Copy arrangement details to your point of sale</p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>

          {/* Order Summary */}
          <div className="bg-purple-50 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-purple-800 mb-2">Arrangement Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-purple-600">Name:</span>
                <div className="font-medium">{order.name}</div>
              </div>
              <div>
                <span className="text-purple-600">Staff:</span>
                <div className="font-medium">{order.staffName}</div>
              </div>
              <div>
                <span className="text-purple-600">Total:</span>
                <div className="font-bold text-green-600">${order.totalRetail.toFixed(2)}</div>
              </div>
              <div>
                <span className="text-purple-600">Items:</span>
                <div className="font-medium">{order.products.length} products</div>
              </div>
              <div className="col-span-2">
                <span className="text-purple-600">POS System:</span>
                <div className="font-medium text-blue-600">Manual Copy/Paste (Universal)</div>
              </div>
            </div>
          </div>

          {/* Integration Methods */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800 mb-3">Copy Order to Your POS</h4>
            
            {/* Copy/Paste Method */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Copy className="w-5 h-5 text-blue-600" />
                <h5 className="font-medium text-gray-800">Copy Order Details</h5>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">UNIVERSAL</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Copy the formatted order details and paste them into any POS system.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={copyToClipboard}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Copy className="w-4 h-4" />
                  📋 Copy Order Details
                </button>
                <button
                  onClick={downloadOrderFile}
                  className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Backup
                </button>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {connectionStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium text-green-800">✅ Order details copied to clipboard!</div>
                  <div className="text-sm text-green-700 mt-1">
                    Now go to your POS system and paste (Ctrl+V or Cmd+V) in the order notes.
                  </div>
                </div>
              </div>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-800">❌ Copy to clipboard failed</div>
                  <div className="text-sm text-red-700 mt-1">
                    Please manually copy the order details from the text box below.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-2">📋 Step-by-Step Instructions:</h5>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Click "📋 Copy Order Details" button above</li>
              <li>Go to your POS system and create a new sale</li>
              <li>Enter the total amount: <strong>${order.totalRetail.toFixed(2)}</strong></li>
              <li>In the notes/description field, press <strong>Ctrl+V</strong> (or <strong>Cmd+V</strong> on Mac) to paste</li>
              <li>Process payment with customer</li>
              <li>The staff name ({order.staffName}) will be recorded with the sale</li>
            </ol>
            
            <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
              <div className="text-sm text-blue-800">
                <strong>💡 Tip:</strong> After clicking "Copy Order Details", the information is saved to your clipboard. 
                You can then paste it anywhere by pressing Ctrl+V (Windows) or Cmd+V (Mac).
              </div>
            </div>
          </div>
          {/* Manual Copy Area (if copy fails) */}
          {(connectionStatus === 'error' || connectionStatus === 'idle') && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h5 className="font-medium text-yellow-800 mb-2">
                {connectionStatus === 'error' ? 'Manual Copy - Select All Text Below:' : 'Order Details (Manual Copy if needed):'}
              </h5>
              <textarea
                value={generatePOSText()}
                readOnly
                className="w-full h-48 p-3 border border-yellow-300 rounded-md text-sm font-mono bg-white resize-none"
                onClick={(e) => e.currentTarget.select()}
              />
              <p className="text-xs text-yellow-700 mt-2">
                Click in the text area above, press Ctrl+A to select all, then Ctrl+C to copy. Then paste in your POS with Ctrl+V.
              </p>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};

export default POSIntegration;