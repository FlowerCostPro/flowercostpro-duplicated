import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ProductTemplate, MarkupSettings, OrderRecord, ArrangementRecipe, POSSettings, Product } from '../types/Product';

const DEFAULT_MARKUP: MarkupSettings = {
  stem: 2.5,
  vase: 2.0,
  accessory: 3.0,
  other: 2.0,
  bunch: 2.0,
  laborPercent: null
};
import { Database } from '../lib/database.types';
import sampleData from '../../sample-florist-data.json';

// Raw types for localStorage data parsing
interface RawProductTemplate extends Omit<ProductTemplate, 'lastUsed'> {
  lastUsed: string;
}

interface RawOrderRecord extends Omit<OrderRecord, 'date' | 'products'> {
  date: string;
  products: Array<Omit<Product, 'wholesaleCost'> & { wholesaleCost: number | string }>;
}

type Profile = Database['public']['Tables']['profiles']['Row'];

// For staff accounts, ownerId is the shop owner's user_id (their data bucket).
// For owner accounts, ownerId === userId.
export const useSupabaseData = (userId: string | null, ownerId?: string | null) => {
  // The data owner is whoever owns the shop — for staff that's their owner, for owners it's themselves.
  const dataUserId = ownerId ?? userId;
  // Ref always holds the latest dataUserId so async callbacks can detect stale loads.
  const dataUserIdRef = useRef<string | null>(null);
  dataUserIdRef.current = dataUserId;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [productTemplates, setProductTemplates] = useState<ProductTemplate[]>([]);
  const [markupSettings, setMarkupSettings] = useState<MarkupSettings>(DEFAULT_MARKUP);
  const [savedOrders, setSavedOrders] = useState<OrderRecord[]>([]);
  const [arrangementRecipes, setArrangementRecipes] = useState<ArrangementRecipe[]>([]);
  const [posSettings, setPosSettings] = useState<POSSettings>({
    storeName: '',
    isConfigured: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadProfile = async () => {
    if (!dataUserId) return;

    try {
      const { data, error } = await supabase.rpc('get_owner_profile');

      if (error) throw error;
      if (data) setProfile(data as unknown as Profile);
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  // Load product templates
  const loadProductTemplates = async () => {
    if (!dataUserId) return;
    const capturedDataUserId = dataUserId;

    try {
      // Staff: use secure RPC — returns retail_price but NOT wholesale_cost
      if (ownerId && ownerId !== userId) {
        const { data, error } = await supabase.rpc('get_staff_product_templates');
        if (error) throw error;
        if (dataUserIdRef.current !== capturedDataUserId) return; // stale load
        const templates: ProductTemplate[] = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          wholesaleCost: 0, // not exposed to staff
          retailPrice: Number(item.retail_price),
          type: item.type,
          unit: item.unit ?? 'stem',
          lastUsed: new Date(item.last_used),
          inventoryCount: item.inventory_count !== null ? item.inventory_count : undefined,
          lowStockThreshold: item.low_stock_threshold !== null ? item.low_stock_threshold : undefined
        }));
        setProductTemplates(templates);
        return;
      }

      // Owner: full data including wholesale_cost via RPC
      const { data, error } = await supabase.rpc('get_owner_product_templates');

      if (error) throw error;
      if (dataUserIdRef.current !== capturedDataUserId) return; // stale load

      const templates: ProductTemplate[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        wholesaleCost: Number(item.wholesale_cost),
        type: item.type,
        unit: item.unit ?? 'stem',
        lastUsed: new Date(item.last_used),
        inventoryCount: item.inventory_count !== null ? item.inventory_count : undefined,
        lowStockThreshold: item.low_stock_threshold !== null ? item.low_stock_threshold : undefined,
        isSample: Boolean(item.is_sample)
      }));

      setProductTemplates(templates);
    } catch (error: any) {
      console.error('Error loading product templates:', error);
      setError(error.message);
    }
  };

  // Load markup settings
  const loadMarkupSettings = async () => {
    if (!dataUserId) return;

    try {
      // Staff: use secure RPC — labor_percent is never returned
      if (ownerId && ownerId !== userId) {
        const { data, error } = await supabase.rpc('get_staff_markup_settings');
        if (error) throw error;
        if (data) {
          setMarkupSettings({
            stem: Number(data.stem),
            vase: Number(data.vase),
            accessory: Number(data.accessory),
            other: Number(data.other),
            bunch: Number(data.bunch),
            laborPercent: null
          });
        }
        return;
      }

      const { data, error } = await supabase.rpc('get_owner_markup_settings');

      if (error) {
        console.error('Error loading markup settings:', error);
        setMarkupSettings(DEFAULT_MARKUP);
        return;
      }

      if (data) {
        setMarkupSettings({
          stem: Number(data.stem),
          vase: Number(data.vase),
          accessory: Number(data.accessory),
          other: Number(data.other),
          bunch: Number(data.bunch ?? 2.0),
          laborPercent: data.labor_percent != null ? Number(data.labor_percent) : null
        });
      } else {
        setMarkupSettings(DEFAULT_MARKUP);
      }
    } catch (error: any) {
      console.error('Error loading markup settings:', error);
      setError(error.message);
    }
  };

  // Load saved orders
  const loadSavedOrders = async () => {
    if (!dataUserId) return;
    const capturedDataUserId = dataUserId;

    try {
      // Staff: use secure RPC — no wholesale/profit/labor fields are returned
      if (ownerId && ownerId !== userId) {
        const { data, error } = await supabase.rpc('get_staff_saved_orders');
        if (error) throw error;
        if (dataUserIdRef.current !== capturedDataUserId) return; // stale load
        const orders: OrderRecord[] = (data as any[]).map((order: any) => ({
          id: order.id,
          name: order.name,
          date: new Date(order.created_at),
          products: (order.products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            wholesaleCost: 0,
            quantity: p.quantity,
            type: p.type,
            unit: p.unit ?? 'stem',
            portionDivisor: p.portion_divisor ?? undefined,
            retailPrice: p.retail_price != null ? Number(p.retail_price) : undefined
          })),
          totalWholesale: 0,
          totalRetail: Number(order.total_retail),
          photo: order.photo || undefined,
          notes: order.notes || undefined,
          staffName: order.staff_name || undefined,
          staffId: order.staff_id || undefined,
          customerPrice: order.customer_price != null ? Number(order.customer_price) : null,
          laborAmount: order.labor_amount != null ? Number(order.labor_amount) : undefined,
          profit: 0
        }));
        setSavedOrders(orders);
        return;
      }

      // Owner: full data including wholesale/profit/labor via RPC
      const { data: ordersData, error: ordersError } = await supabase.rpc('get_owner_orders');

      if (ordersError) throw ordersError;
      if (dataUserIdRef.current !== capturedDataUserId) return; // stale load

      const orders: OrderRecord[] = (ordersData || []).map((order: any) => ({
        id: order.id,
        name: order.name,
        date: new Date(order.created_at),
        products: (order.products || []).map((product: any) => ({
          id: product.id,
          name: product.name,
          wholesaleCost: Number(product.wholesale_cost),
          quantity: product.quantity,
          type: product.type,
          unit: product.unit ?? 'stem',
          portionDivisor: product.portion_divisor ?? undefined,
          retailPrice: product.retail_price != null ? Number(product.retail_price) : undefined
        })),
        totalWholesale: Number(order.total_wholesale),
        totalRetail: Number(order.total_retail),
        profit: Number(order.profit),
        photo: order.photo || undefined,
        notes: order.notes || undefined,
        staffName: order.staff_name || undefined,
        staffId: order.staff_id || undefined,
        customerPrice: order.customer_price != null ? Number(order.customer_price) : null,
        laborAmount: order.labor_amount != null ? Number(order.labor_amount) : null
      }));

      setSavedOrders(orders);
    } catch (error: any) {
      console.error('Error loading saved orders:', error);
      setError(error.message);
    }
  };

  // Load arrangement recipes
  const loadArrangementRecipes = async () => {
    if (!dataUserId) return;

    try {
      const { data: recipesData, error: recipesError } = await supabase.rpc('get_owner_arrangement_recipes');

      if (recipesError) throw recipesError;

      const recipes: ArrangementRecipe[] = (recipesData || []).map((recipe: any) => ({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description || undefined,
        websitePrice: Number(recipe.website_price),
        websiteUrl: recipe.website_url || undefined,
        photo: recipe.photo || undefined,
        ingredients: (recipe.ingredients || []).map((ingredient: any) => ({
          name: ingredient.name,
          quantity: ingredient.quantity,
          type: ingredient.type,
          notes: ingredient.notes || undefined
        })),
        lastUpdated: new Date(recipe.updated_at)
      }));

      setArrangementRecipes(recipes);
    } catch (error: any) {
      console.error('Error loading arrangement recipes:', error);
      setError(error.message);
    }
  };

  // Load POS settings
  const loadPosSettings = async () => {
    if (!dataUserId) return;

    try {
      const { data, error } = await supabase.rpc('get_owner_pos_settings');

      if (error) {
        console.error('Error loading POS settings:', error);
        setPosSettings({
          storeName: '',
          isConfigured: false
        });
        return;
      }

      if (data) {
        setPosSettings({
          storeName: data.store_name,
          isConfigured: data.is_configured
        });
      } else {
        setPosSettings({
          storeName: '',
          isConfigured: false
        });
      }
    } catch (error: any) {
      console.error('Error loading POS settings:', error);
      setError(error.message);
    }
  };

  // Load all data
  const loadAllData = async () => {
    if (!userId) {
      // Demo mode (not logged in)
      console.log('Demo mode: Loading sample data...');
      
      // Load product templates from localStorage first, fallback to sample data
      try {
        const savedTemplates = localStorage.getItem('demo_product_templates');
        if (savedTemplates) {
          const parsedTemplates: RawProductTemplate[] = JSON.parse(savedTemplates);
          const migratedTemplates = parsedTemplates.map((t: RawProductTemplate) => {
            const template: ProductTemplate = {
              ...t,
              lastUsed: new Date(t.lastUsed),
              inventoryCount: t.inventoryCount !== undefined ? t.inventoryCount : undefined,
              lowStockThreshold: t.lowStockThreshold !== undefined ? t.lowStockThreshold : undefined
            };
            return template;
          });
          setProductTemplates(migratedTemplates);
          console.log('Demo mode: Loaded product templates from localStorage:', migratedTemplates.length);
        } else {
          setProductTemplates(sampleData.templates.map(t => ({
            ...t,
            lastUsed: new Date(t.lastUsed)
          })));
          console.log('Demo mode: Using default product templates from sample data');
        }
      } catch (error) {
        console.error('Error loading demo product templates from localStorage:', error);
        setProductTemplates(sampleData.templates.map(t => ({
          ...t,
          lastUsed: new Date(t.lastUsed)
        })));
      }
      
      // Load markup settings from localStorage first, fallback to sample data
      try {
        const savedMarkupSettings = localStorage.getItem('demo_markup_settings');
        if (savedMarkupSettings) {
          const parsedMarkup = JSON.parse(savedMarkupSettings);
          setMarkupSettings(parsedMarkup);
          console.log('Demo mode: Loaded markup settings from localStorage:', parsedMarkup);
        } else {
          setMarkupSettings(sampleData.markupSettings);
          console.log('Demo mode: Using default markup settings from sample data');
        }
      } catch (error) {
        console.error('Error loading demo markup settings from localStorage:', error);
        setMarkupSettings(sampleData.markupSettings);
      }
      
      // Load saved orders from localStorage first, fallback to sample data
      try {
        const savedOrders = localStorage.getItem('demo_saved_orders');
        if (savedOrders) {
          const parsedOrders: RawOrderRecord[] = JSON.parse(savedOrders);
          setSavedOrders(parsedOrders.map((o: RawOrderRecord) => ({
            ...o,
            date: new Date(o.date), // Convert string to Date object
            products: o.products.map((p: any) => ({
              ...p,
              wholesaleCost: Number(p.wholesaleCost) // Ensure number type
            }))
          })));
          console.log('Demo mode: Loaded saved orders from localStorage:', parsedOrders.length);
        } else {
          setSavedOrders(sampleData.savedOrders.map(o => ({
            ...o,
            date: new Date(o.date), // Convert string to Date object
            products: o.products.map(p => ({
              ...p,
              wholesaleCost: Number(p.wholesaleCost) // Ensure number type
            }))
          })));
          console.log('Demo mode: Using default saved orders from sample data');
        }
      } catch (error) {
        console.error('Error loading demo saved orders from localStorage:', error);
        setSavedOrders(sampleData.savedOrders.map(o => ({
          ...o,
          date: new Date(o.date), // Convert string to Date object
          products: o.products.map(p => ({
            ...p,
            wholesaleCost: Number(p.wholesaleCost) // Ensure number type
          }))
        })));
      }
      
      setArrangementRecipes(sampleData.arrangementRecipes.map(r => ({
        ...r,
        lastUpdated: new Date(r.lastUpdated), // Convert string to Date object
        websitePrice: Number(r.websitePrice) // Ensure number type
      })));

      // Load demo POS settings from localStorage if available
      try {
        const savedSettings = localStorage.getItem('demo_pos_settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setPosSettings(parsed);
          console.log('Demo mode: Loaded POS settings from localStorage:', parsed);
        }
      } catch (error) {
        console.error('Error loading demo POS settings from localStorage:', error);
      }
      
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Data loading timed out')), 10000)
    );

    try {
      await Promise.race([
        Promise.all([
          loadProfile(),
          loadProductTemplates(),
          loadMarkupSettings(),
          loadSavedOrders(),
          loadArrangementRecipes(),
          loadPosSettings()
        ]),
        timeout
      ]);
    } catch (error: any) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save functions
  const saveProductTemplate = async (template: Omit<ProductTemplate, 'id'>) => {
    if (!userId) {
      // Demo mode - add to local state
      const newTemplate: ProductTemplate = {
        id: `demo-${Date.now()}`,
        name: template.name,
        wholesaleCost: template.wholesaleCost,
        type: template.type,
        unit: template.unit ?? 'stem',
        lastUsed: template.lastUsed,
        inventoryCount: template.inventoryCount,
        lowStockThreshold: template.lowStockThreshold
      };
      
      setProductTemplates((prev: ProductTemplate[]) => [newTemplate, ...prev]);
     
     // Save to localStorage for demo mode persistence
     try {
       const updatedTemplates = [newTemplate, ...productTemplates];
       localStorage.setItem('demo_product_templates', JSON.stringify(updatedTemplates));
       console.log('Demo mode: Product templates saved to localStorage');
     } catch (error) {
       console.error('Error saving product templates to localStorage:', error);
     }
     
      return newTemplate;
    }

    try {
      const { data, error } = await supabase.rpc('save_owner_product_template', {
        p_name: template.name,
        p_wholesale_cost: template.wholesaleCost,
        p_type: template.type,
        p_last_used: template.lastUsed.toISOString(),
        p_unit: template.unit ?? 'stem',
        p_inventory_count: template.inventoryCount !== undefined ? template.inventoryCount : null,
        p_low_stock_threshold: template.lowStockThreshold !== undefined ? template.lowStockThreshold : null
      });

      if (error) throw error;

      const newTemplate: ProductTemplate = {
        id: data.id,
        name: data.name,
        wholesaleCost: Number(data.wholesale_cost),
        type: data.type,
        unit: data.unit ?? 'stem',
        lastUsed: new Date(data.last_used),
        inventoryCount: data.inventory_count !== null ? data.inventory_count : undefined,
        lowStockThreshold: data.low_stock_threshold !== null ? data.low_stock_threshold : undefined
      };

      setProductTemplates((prev: ProductTemplate[]) => [newTemplate, ...prev]);
      return newTemplate
    } catch (error: any) {
      console.error('Error saving product template:', error);
      throw error;
    }
  };

  const updateProductTemplate = async (templateId: string, updates: Partial<ProductTemplate>) => {
    if (!userId) {
      // Demo mode - update local state
      setProductTemplates((prev: ProductTemplate[]) => {
        const updatedTemplates = prev.map((template: ProductTemplate) =>
          template.id === templateId ? { ...template, ...updates } : template
        );

        // Save to localStorage for demo mode persistence
        try {
          localStorage.setItem('demo_product_templates', JSON.stringify(updatedTemplates));
          console.log('Demo mode: Product templates updated in localStorage');
        } catch (error) {
          console.error('Error updating product templates in localStorage:', error);
        }

        return updatedTemplates;
      });
      return;
    }

    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.wholesaleCost !== undefined) updateData.wholesale_cost = updates.wholesaleCost;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.lastUsed !== undefined) updateData.last_used = updates.lastUsed.toISOString();

      // Only update inventory fields if explicitly provided
      if ('inventoryCount' in updates) {
        updateData.inventory_count = updates.inventoryCount !== undefined ? updates.inventoryCount : null;
      }
      if ('lowStockThreshold' in updates) {
        updateData.low_stock_threshold = updates.lowStockThreshold !== undefined ? updates.lowStockThreshold : null;
      }

      // Staff: use RPC (RLS blocks direct UPDATE on owner's rows)
      if (ownerId && ownerId !== userId) {
        const { error: rpcError } = await supabase.rpc('restock_product_template', {
          p_template_id: templateId,
          p_inventory_count: updates.inventoryCount ?? null,
          p_low_stock_threshold: updates.lowStockThreshold ?? null
        });
        if (rpcError) throw rpcError;

        setProductTemplates((prev: ProductTemplate[]) =>
          prev.map((template: ProductTemplate) =>
            template.id === templateId
              ? { ...template, inventoryCount: updates.inventoryCount, lowStockThreshold: updates.lowStockThreshold ?? template.lowStockThreshold }
              : template
          )
        );
        return;
      }

      // Owner: use RPC
      const { data, error } = await supabase.rpc('update_owner_product_template', {
        p_template_id: templateId,
        p_name: updates.name ?? null,
        p_wholesale_cost: updates.wholesaleCost ?? null,
        p_type: updates.type ?? null,
        p_last_used: updates.lastUsed ? updates.lastUsed.toISOString() : null,
        p_unit: updates.unit ?? null,
        p_inventory_count: ('inventoryCount' in updates) ? (updates.inventoryCount ?? null) : null,
        p_low_stock_threshold: ('lowStockThreshold' in updates) ? (updates.lowStockThreshold ?? null) : null
      });

      if (error) throw error;

      // Update local state with the data from database to ensure consistency
      const updatedTemplate: ProductTemplate = {
        id: data.id,
        name: data.name,
        wholesaleCost: Number(data.wholesale_cost),
        type: data.type,
        unit: data.unit ?? 'stem',
        lastUsed: new Date(data.last_used),
        inventoryCount: data.inventory_count !== null ? data.inventory_count : undefined,
        lowStockThreshold: data.low_stock_threshold !== null ? data.low_stock_threshold : undefined
      };

      setProductTemplates((prev: ProductTemplate[]) =>
        prev.map((template: ProductTemplate) =>
          template.id === templateId ? updatedTemplate : template
        )
      );
    } catch (error: any) {
      console.error('Error updating product template:', error);
      throw error;
    }
  };

  const deleteProductTemplate = async (templateId: string) => {
    if (!userId) {
      // Demo mode - remove from local state and localStorage
      const updatedTemplates = productTemplates.filter((template: ProductTemplate) => template.id !== templateId);
      setProductTemplates(updatedTemplates);
      
      try {
        localStorage.setItem('demo_product_templates', JSON.stringify(updatedTemplates));
        console.log('Demo mode: Product template deleted from localStorage');
      } catch (error) {
        console.error('Error deleting product template from localStorage:', error);
      }
      return;
    }

    try {
      const { error } = await supabase.rpc('delete_owner_product_template', {
        p_template_id: templateId
      });

      if (error) throw error;

      setProductTemplates((prev: ProductTemplate[]) => prev.filter((template: ProductTemplate) => template.id !== templateId));
    } catch (error: any) {
      console.error('Error deleting product template:', error);
      throw error;
    }
  };

  const deleteSampleProducts = async () => {
    if (!userId) {
      const filtered = productTemplates.filter((t: ProductTemplate) => !t.isSample);
      setProductTemplates(filtered);
      try {
        localStorage.setItem('demo_product_templates', JSON.stringify(filtered));
      } catch (error) {
        console.error('Error deleting sample products from localStorage:', error);
      }
      return;
    }

    try {
      const { data, error } = await supabase.rpc('delete_owner_sample_products');
      if (error) throw error;

      setProductTemplates((prev: ProductTemplate[]) => prev.filter((t: ProductTemplate) => !t.isSample));
      return data as number;
    } catch (error: any) {
      console.error('Error deleting sample products:', error);
      throw error;
    }
  };

  const saveMarkupSettings = async (settings: MarkupSettings) => {
    if (!userId) {
      // Demo mode - save to local state
      console.log('Demo mode: Saving markup settings to local state:', settings);
      setMarkupSettings(settings);
      
      // Also save to localStorage for persistence in demo mode
      try {
        localStorage.setItem('demo_markup_settings', JSON.stringify(settings));
        console.log('Demo mode: Markup settings saved to localStorage successfully');
      } catch (error) {
        console.error('Error saving markup settings to localStorage:', error);
      }
      return;
    }

    try {
      const { error } = await supabase.rpc('save_owner_markup_settings', {
        p_stem: settings.stem,
        p_vase: settings.vase,
        p_accessory: settings.accessory,
        p_other: settings.other,
        p_bunch: settings.bunch ?? 2.0,
        p_labor_percent: settings.laborPercent ?? null
      });

      if (error) throw error;

      setMarkupSettings(settings);
    } catch (error: any) {
      console.error('Error saving markup settings:', error);
      throw error;
    }
  };

  const saveOrder = async (order: OrderRecord) => {
    if (!userId) {
      // Demo mode - save to local state
      const newOrder: OrderRecord = {
        ...order,
        id: `demo-order-${Date.now()}`,
        date: new Date()
      };
      
      console.log('Demo mode: Saving order to local state:', newOrder);
      setSavedOrders((prev: OrderRecord[]) => [newOrder, ...prev]);
      console.log('Demo mode: Order saved successfully');

      // Update inventory counts for demo mode
      await updateInventoryAfterOrder(newOrder);

      // Save to localStorage for demo mode persistence
      try {
        const updatedOrders = [newOrder, ...savedOrders];
        localStorage.setItem('demo_saved_orders', JSON.stringify(updatedOrders));
        console.log('Demo mode: Saved orders updated in localStorage');
      } catch (error) {
        console.error('Error saving orders to localStorage:', error);
      }
      
      return newOrder;
    }

    try {
      // Staff: use secure RPC — wholesale costs are never sent by or returned to the client
      if (ownerId && ownerId !== userId) {
        const products = order.products
          .filter(p => p.templateId)
          .map(p => ({
            template_id: p.templateId,
            quantity: p.quantity,
            portion_divisor: p.portionDivisor ?? null
          }));

        const { data: rpcData, error: rpcError } = await supabase.rpc('save_staff_order', {
          p_name: order.name,
          p_notes: order.notes || null,
          p_staff_name: order.staffName || null,
          p_staff_id: order.staffId || null,
          p_customer_budget: order.customerPrice ?? null,
          p_photo: order.photo || null,
          p_products: products
        });

        if (rpcError) throw rpcError;

        const newOrder: OrderRecord = {
          ...order,
          id: rpcData.order_id,
          date: new Date(rpcData.created_at),
          totalRetail: Number(rpcData.total_retail),
          totalWholesale: 0,
          profit: 0,
          laborAmount: rpcData.labor_amount != null ? Number(rpcData.labor_amount) : undefined
        };

        setSavedOrders((prev: OrderRecord[]) => [newOrder, ...prev]);
        // Reload templates to reflect inventory decrements performed by the RPC
        await loadProductTemplates();
        return newOrder;
      }

      // Owner: use RPC with full financial data
      const productsJson = order.products.map(product => ({
        name: product.name,
        wholesale_cost: product.wholesaleCost,
        quantity: product.quantity,
        type: product.type,
        unit: product.unit ?? 'stem',
        portion_divisor: product.portionDivisor ?? null,
        retail_price: product.retailPrice ?? null
      }));

      const { data: orderData, error: orderError } = await supabase.rpc('save_owner_order', {
        p_name: order.name,
        p_total_wholesale: order.totalWholesale,
        p_total_retail: order.totalRetail,
        p_profit: order.profit,
        p_photo: order.photo || null,
        p_notes: order.notes || null,
        p_staff_name: order.staffName || null,
        p_staff_id: order.staffId || null,
        p_customer_price: order.customerPrice ?? null,
        p_labor_amount: order.laborAmount ?? null,
        p_products: productsJson
      });

      if (orderError) throw orderError;

      // Update local state
      const newOrder: OrderRecord = {
        ...order,
        id: orderData.id,
        date: new Date(orderData.created_at)
      };

      setSavedOrders((prev: OrderRecord[]) => [newOrder, ...prev]);

      // Update inventory counts
      await updateInventoryAfterOrder(newOrder);

      return newOrder;
    } catch (error: any) {
      console.error('Error saving order:', error);
      throw error;
    }
  };

  // Helper function to update inventory after order
  const updateInventoryAfterOrder = async (order: OrderRecord) => {
    // Compute changes from the current state synchronously (no functional updater timing issue)
    const changes: Array<{ id: string; newCount: number }> = [];

    const updatedTemplates = productTemplates.map((template: ProductTemplate) => {
      const matchingProduct = order.products.find((product: any) =>
        product.name === template.name && product.type === template.type
      );

      if (matchingProduct && template.inventoryCount !== undefined) {
        const deduct = template.unit === 'bunch' && matchingProduct.portionDivisor
          ? 1 / matchingProduct.portionDivisor
          : matchingProduct.quantity;
        const newCount = Math.max(0, template.inventoryCount - deduct);
        changes.push({ id: template.id, newCount });
        return { ...template, inventoryCount: newCount };
      }

      return template;
    });

    setProductTemplates(updatedTemplates);

    if (!userId) {
      try {
        localStorage.setItem('demo_product_templates', JSON.stringify(updatedTemplates));
      } catch (err) {
        console.error('Error updating inventory in localStorage:', err);
      }
    }

    // Update database for authenticated users via RPC
    if (userId && changes.length > 0) {
      try {
        for (const { id, newCount } of changes) {
          const { error } = await supabase.rpc('restock_product_template', {
            p_template_id: id,
            p_inventory_count: newCount,
            p_low_stock_threshold: null
          });

          if (error) {
            console.error('Error updating inventory in database:', error);
          }
        }
      } catch (error) {
        console.error('Error updating inventory in database:', error);
      }
    }
  };

  const updateOrder = async (orderId: string, updatedOrder: OrderRecord) => {
    if (!userId) {
      // Demo mode - update local state and localStorage
      const updatedOrders = savedOrders.map((order: OrderRecord) =>
        order.id === orderId ? { ...updatedOrder, id: orderId } : order
      );
      setSavedOrders(updatedOrders);

      try {
        localStorage.setItem('demo_saved_orders', JSON.stringify(updatedOrders));
        console.log('Demo mode: Order updated in localStorage');
      } catch (error) {
        console.error('Error updating order in localStorage:', error);
      }
      return;
    }

    try {
      console.log('Starting order update for:', orderId);

      // Update order - handle photo carefully
      const updateData: any = {
        name: updatedOrder.name,
        total_wholesale: updatedOrder.totalWholesale,
        total_retail: updatedOrder.totalRetail,
        profit: updatedOrder.profit,
        notes: updatedOrder.notes || null,
        staff_name: updatedOrder.staffName || null,
        staff_id: updatedOrder.staffId || null
      };

      // Only include photo if it's provided and not too large
      if (updatedOrder.photo) {
        // Check if photo is base64 and potentially too large
        if (updatedOrder.photo.startsWith('data:image')) {
          const photoSize = updatedOrder.photo.length;
          console.log('Photo size:', photoSize, 'characters');

          // Supabase can handle large text, but let's be cautious
          if (photoSize > 5000000) { // ~5MB limit for base64
            throw new Error('Photo is too large. Please use a smaller image (max 5MB).');
          }
        }
        updateData.photo = updatedOrder.photo;
      } else {
        updateData.photo = null;
      }

      // Use RPC to update order + products atomically
      const productsJson = updatedOrder.products.map(product => ({
        name: product.name,
        wholesale_cost: product.wholesaleCost,
        quantity: product.quantity,
        type: product.type,
        unit: product.unit ?? 'stem',
        portion_divisor: product.portionDivisor ?? null,
        retail_price: product.retailPrice ?? null
      }));

      const { error: orderError } = await supabase.rpc('update_owner_order', {
        p_order_id: orderId,
        p_name: updatedOrder.name,
        p_total_wholesale: updatedOrder.totalWholesale,
        p_total_retail: updatedOrder.totalRetail,
        p_profit: updatedOrder.profit,
        p_photo: updatedOrder.photo || null,
        p_notes: updatedOrder.notes || null,
        p_staff_name: updatedOrder.staffName || null,
        p_staff_id: updatedOrder.staffId || null,
        p_products: productsJson
      });

      if (orderError) {
        console.error('Order update error:', orderError);
        throw orderError;
      }

      // Update local state
      setSavedOrders((prev: OrderRecord[]) =>
        prev.map((order: OrderRecord) =>
          order.id === orderId ? { ...updatedOrder, id: orderId } : order
        )
      );
    } catch (error: any) {
      console.error('Error updating order:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      throw new Error(`Failed to update order: ${errorMessage}`);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!userId) {
      // Demo mode - remove from local state and localStorage
      const updatedOrders = savedOrders.filter((order: OrderRecord) => order.id !== orderId);
      setSavedOrders(updatedOrders);

      try {
        localStorage.setItem('demo_saved_orders', JSON.stringify(updatedOrders));
        console.log('Demo mode: Order deleted from localStorage');
      } catch (error) {
        console.error('Error deleting order from localStorage:', error);
      }
      return;
    }

    try {
      const { error } = await supabase.rpc('delete_owner_order', {
        p_order_id: orderId
      });

      if (error) throw error;

      setSavedOrders((prev: OrderRecord[]) => prev.filter((order: OrderRecord) => order.id !== orderId));
    } catch (error: any) {
      console.error('Error deleting order:', error);
      throw error;
    }
  };

  const saveArrangementRecipe = async (recipe: ArrangementRecipe) => {
    if (!userId) return;

    try {
      const ingredientsJson = recipe.ingredients.map(ingredient => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        type: ingredient.type,
        notes: ingredient.notes
      }));

      const { data: recipeData, error: recipeError } = await supabase.rpc('save_owner_arrangement_recipe', {
        p_name: recipe.name,
        p_description: recipe.description || null,
        p_website_price: recipe.websitePrice,
        p_website_url: recipe.websiteUrl || null,
        p_photo: recipe.photo || null,
        p_ingredients: ingredientsJson
      });

      if (recipeError) throw recipeError;

      // Update local state
      const newRecipe: ArrangementRecipe = {
        ...recipe,
        id: recipeData.id,
        lastUpdated: new Date(recipeData.updated_at)
      };

      setArrangementRecipes((prev: ArrangementRecipe[]) => [newRecipe, ...prev]);
      return newRecipe;
    } catch (error: any) {
      console.error('Error saving arrangement recipe:', error);
      throw error;
    }
  };

  const updateArrangementRecipe = async (recipeId: string, updates: Partial<ArrangementRecipe>) => {
    if (!userId) return;

    try {
      const ingredientsJson = updates.ingredients
        ? updates.ingredients.map(ingredient => ({
            name: ingredient.name,
            quantity: ingredient.quantity,
            type: ingredient.type,
            notes: ingredient.notes
          }))
        : null;

      const { error: recipeError } = await supabase.rpc('update_owner_arrangement_recipe', {
        p_recipe_id: recipeId,
        p_name: updates.name ?? null,
        p_description: updates.description ?? null,
        p_website_price: updates.websitePrice ?? null,
        p_website_url: updates.websiteUrl ?? null,
        p_photo: updates.photo ?? null,
        p_ingredients: ingredientsJson
      });

      if (recipeError) throw recipeError;

      // Update local state
      setArrangementRecipes((prev: ArrangementRecipe[]) =>
        prev.map((recipe: ArrangementRecipe) =>
          recipe.id === recipeId 
            ? { ...recipe, ...updates, lastUpdated: new Date() }
            : recipe
        )
      );
    } catch (error: any) {
      console.error('Error updating arrangement recipe:', error);
      throw error;
    }
  };

  const deleteArrangementRecipe = async (recipeId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase.rpc('delete_owner_arrangement_recipe', {
        p_recipe_id: recipeId
      });

      if (error) throw error;

      setArrangementRecipes((prev: ArrangementRecipe[]) => prev.filter((recipe: ArrangementRecipe) => recipe.id !== recipeId));
    } catch (error: any) {
      console.error('Error deleting arrangement recipe:', error);
      throw error;
    }
  };

  const savePosSettings = async (settings: POSSettings) => {
    if (!userId) {
      // Demo mode - save to local state
      console.log('Demo mode: Saving POS settings to local state:', settings);
      setPosSettings(settings);
      
      // Also save to localStorage for persistence in demo mode
      try {
        localStorage.setItem('demo_pos_settings', JSON.stringify(settings));
        console.log('Demo mode: POS settings saved to localStorage successfully');
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
      return;
    }

    try {
      const { error } = await supabase.rpc('save_owner_pos_settings', {
        p_store_name: settings.storeName,
        p_is_configured: settings.isConfigured
      });

      if (error) throw error;

      setPosSettings(settings);
      console.log('Authenticated mode: POS settings saved to Supabase successfully');
    } catch (error: any) {
      console.error('Error saving POS settings:', error);
      throw error;
    }
  };

  // Load data when userId changes
  useEffect(() => {
    if (!userId) {
      // Load demo POS settings from localStorage if in demo mode
      try {
        const savedSettings = localStorage.getItem('demo_pos_settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setPosSettings(parsed);
          console.log('Demo mode: Loaded POS settings from localStorage:', parsed);
        }
        
        // Also load demo markup settings from localStorage
        const savedMarkupSettings = localStorage.getItem('demo_markup_settings');
        if (savedMarkupSettings) {
          const parsedMarkup = JSON.parse(savedMarkupSettings);
          setMarkupSettings(parsedMarkup);
          console.log('Demo mode: Loaded markup settings from localStorage:', parsedMarkup);
        }
      } catch (error) {
        console.error('Error loading demo settings from localStorage:', error);
      }
    }
    
    loadAllData();
  }, [userId, dataUserId]);

  return {
    profile,
    productTemplates,
    markupSettings,
    savedOrders,
    arrangementRecipes,
    posSettings,
    loading,
    error,
    // Save functions
    saveProductTemplate,
    updateProductTemplate,
    deleteProductTemplate,
    deleteSampleProducts,
    saveMarkupSettings,
    saveOrder,
    updateOrder,
    deleteOrder,
    saveArrangementRecipe,
    updateArrangementRecipe,
    deleteArrangementRecipe,
    savePosSettings,
    // Reload function
    loadAllData
  };
};