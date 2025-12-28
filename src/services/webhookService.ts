interface WebhookOrderData {
  orderId: string;
  orderName: string;
  staffName?: string;
  staffId?: string;
  storeName: string;
  totalAmount: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    category: string;
  }>;
  notes?: string;
  timestamp: string;
  source: 'FlowerCost Pro';
}

interface WebhookResponse {
  success: boolean;
  invoiceNumber?: string;
  orderId?: string;
  message?: string;
  error?: string;
}

export class WebhookService {
  private static async createSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async sendOrderToPOS(
    webhookUrl: string,
    orderData: WebhookOrderData,
    secret?: string
  ): Promise<WebhookResponse> {
    try {
      const payload = JSON.stringify(orderData);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'FlowerCost-Pro/1.0',
        'X-Webhook-Source': 'FlowerCost Pro'
      };

      // Add signature for security if secret is provided
      if (secret) {
        const signature = await this.createSignature(payload, secret);
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: payload
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        invoiceNumber: result.invoiceNumber || result.invoice_number,
        orderId: result.orderId || result.order_id,
        message: result.message || 'Order sent successfully'
      };

    } catch (error) {
      console.error('Webhook error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static generateOrderData(
    order: any,
    storeName: string,
    markupSettings: any
  ): WebhookOrderData {
    return {
      orderId: order.id,
      orderName: order.name,
      staffName: order.staffName,
      staffId: order.staffId,
      storeName,
      totalAmount: order.totalRetail,
      items: order.products.map((product: any) => {
        const markup = markupSettings[product.type] || 2.0;
        const retailPrice = product.wholesaleCost * markup;
        return {
          name: product.name,
          quantity: product.quantity,
          price: retailPrice,
          category: product.type
        };
      }),
      notes: order.notes,
      timestamp: order.date.toISOString(),
      source: 'FlowerCost Pro'
    };
  }
}