import { OrderRecord } from '../types/Product';
import { supabase } from './supabase';

export async function buildPOSText(
  order: OrderRecord,
  _userRole: 'staff' | 'owner'
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_pos_text', {
    p_order_id: order.id,
  });

  if (error) {
    throw new Error(`Failed to generate POS text: ${error.message}`);
  }
  if (!data) {
    throw new Error('Failed to generate POS text: no data returned');
  }

  return data as string;
}
