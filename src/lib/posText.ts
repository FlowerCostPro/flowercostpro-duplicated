import { OrderRecord } from '../types/Product';
import { supabase } from './supabase';

export async function buildPOSText(
  order: OrderRecord,
  userRole: 'staff' | 'owner'
): Promise<string> {
  const lines: string[] = [];
  lines.push('='.repeat(50));
  lines.push(`ARRANGEMENT: ${order.name || '(unnamed)'}`);
  if (order.staffName) {
    lines.push(`DESIGNER: ${order.staffName}${order.staffId ? ` (ID: ${order.staffId})` : ''}`);
  }
  lines.push(`DATE: ${order.date.toLocaleDateString()}`);
  lines.push('='.repeat(50));
  lines.push('');

  if (order.photo) {
    lines.push('PHOTO: [See attached image]');
    lines.push('');
  }

  if (order.notes) {
    lines.push('NOTES:');
    lines.push(order.notes);
    lines.push('');
  }

  lines.push('ITEMS:');
  lines.push('-'.repeat(50));
  order.products.forEach((product: any, i: number) => {
    const retail = product.retailPrice ?? (product.wholesaleCost * 2.5);
    const lineTotal = retail * product.quantity;
    lines.push(`${i + 1}. ${product.name} (${product.type})`);
    lines.push(`   ${product.quantity} x $${retail.toFixed(2)} = $${lineTotal.toFixed(2)}`);
  });
  lines.push('-'.repeat(50));
  lines.push('');

  let laborAmount: number | null = null;

  if (userRole === 'staff') {
    const { data } = await supabase.rpc('get_order_labor_amount', {
      p_order_id: order.id,
    });
    laborAmount = data != null ? Number(data) : null;
  } else {
    laborAmount =
      order.customerPrice != null &&
      order.laborAmount != null &&
      order.laborAmount > 0
        ? order.laborAmount
        : null;
  }

  if (laborAmount != null && laborAmount > 0) {
    lines.push(`Design & labor: $${laborAmount.toFixed(2)}`);
    lines.push('');
  }

  const total = order.customerPrice ?? order.totalRetail;
  lines.push(`TOTAL: $${total.toFixed(2)}`);
  lines.push('='.repeat(50));

  return lines.join('\n');
}
