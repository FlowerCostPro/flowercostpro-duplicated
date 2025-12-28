import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ProductTemplate, MarkupSettings, OrderRecord, ArrangementRecipe, POSSettings, Product } from '../types/Product';
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

export const useSupabaseData = (userId: string | null) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [productTemplates, setProductTemplates] = useState<ProductTemplate[]>([]);
  const [markupSettings, setMarkupSettings] = useState<MarkupSettings>({
    stem: 2.5,
    vase: 2.0,
    accessory: 3.0,
    other: 2.0
  });
  const [savedOrders, setSavedOrders] = useState<OrderRecord[]>([]);
  const [arrangementRecipes, setArrangementRecipes] = useState<ArrangementRecipe[]>([]);
  const [posSettings, setPosSettings] = useState<POSSettings>({
    storeName: '',
    isConfigured: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadProfile = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      setError(error.message);
    }
  };

  // Load product templates
  const loadProductTemplates = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .eq('user_id', userId)
        .order('last_used', { ascending: false });

      if (error) throw error;

      const templates: ProductTemplate[] = data.map(item => ({
        id: item.id,
        name: item.name,
        wholesaleCost: Number(item.wholesale_cost),
        type: item.type,
        lastUsed: new Date(item.last_used),
        inventoryCount: item.inventory_count !== null ? item.inventory_count : undefined,
        lowStockThreshold: item.low_stock_threshold !== null ? item.low_stock_threshold : undefined
      }));

      setProductTemplates(templates);
    } catch (error: any) {
      console.error('Error loading product templates:', error);
      setError(error.message);
    }
  };

  // Load markup settings
  const loadMarkupSettings = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('markup_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116' || !data) {
          setMarkupSettings({
            stem: 2.5,
            vase: 2.0,
            accessory: 3.0,
            other: 2.0
          });
          return;
        }
        throw error;
      }

      if (data) {
        setMarkupSettings({
          stem: Number(data.stem),
          vase: Number(data.vase),
          accessory: Number(data.accessory),
          other: Number(data.other)
        });
      }
    } catch (error: any) {
      console.error('Error loading markup settings:', error);
      setError(error.message);
    }
  };

  // Load saved orders
  const loadSavedOrders = async () => {
    if (!userId) return;

    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_products (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const orders: OrderRecord[] = ordersData.map(order => ({
        id: order.id,
        name: order.name,
        date: new Date(order.created_at),
        products: order.order_products.map(product => ({
          id: product.id,
          name: product.name,
          wholesaleCost: Number(product.wholesale_cost),
          quantity: product.quantity,
          type: product.type
        })),
        totalWholesale: Number(order.total_wholesale),
        totalRetail: Number(order.total_retail),
        profit: Number(order.profit),
        photo: order.photo || undefined,
        notes: order.notes || undefined,
        staffName: order.staff_name || undefined,
        staffId: order.staff_id || undefined
      }));

      setSavedOrders(orders);
    } catch (error: any) {
      console.error('Error loading saved orders:', error);
      setError(error.message);
    }
  };

  // Load arrangement recipes
  const loadArrangementRecipes = async () => {
    if (!userId) return;

    try {
      const { data: recipesData, error: recipesError } = await supabase
        .from('arrangement_recipes')
        .select(`
          *,
          recipe_ingredients (*)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (recipesError) throw recipesError;

      const recipes: ArrangementRecipe[] = recipesData.map(recipe => ({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description || undefined,
        websitePrice: Number(recipe.website_price),
        websiteUrl: recipe.website_url || undefined,
        photo: recipe.photo || undefined,
        ingredients: recipe.recipe_ingredients.map(ingredient => ({
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
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('pos_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116' || !data) {
          setPosSettings({
            storeName: '',
            isConfigured: false
          });
          return;
        }
        throw error;
      }

      if (data) {
        setPosSettings({
          storeName: data.store_name,
          isConfigured: data.is_configured
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
      // Demo mode: Load data from sample-florist-data.json
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

    try {
      await Promise.all([
        loadProfile(),
        loadProductTemplates(),
        loadMarkupSettings(),
        loadSavedOrders(),
        loadArrangementRecipes(),
        loadPosSettings()
      ]);
    } catch (error: any) {
      console.error('Error loading data:', error);
      setError(error.message);
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
      const { data, error } = await supabase
        .from('product_templates')
        .insert({
          user_id: userId,
          name: template.name,
          wholesale_cost: template.wholesaleCost,
          type: template.type,
          last_used: template.lastUsed.toISOString(),
          inventory_count: template.inventoryCount !== undefined ? template.inventoryCount : null,
          low_stock_threshold: template.lowStockThreshold !== undefined ? template.lowStockThreshold : null
        })
        .select()
        .single();

      if (error) throw error;

      const newTemplate: ProductTemplate = {
        id: data.id,
        name: data.name,
        wholesaleCost: Number(data.wholesale_cost),
        type: data.type,
        lastUsed: new Date(data.last_used),
        inventoryCount: data.inventory_count !== null ? data.inventory_count : undefined,
        lowStockThreshold: data.low_stock_threshold !== null ? data.low_stock_threshold : undefined
      };

      setProductTemplates((prev: ProductTemplate[]) => [newTemplate, ...prev]);
      return newTemplate;
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
      if ('inventoryCount' in updates && updates.inventoryCount !== undefined) {
        updateData.inventory_count = updates.inventoryCount;
      }
      if ('lowStockThreshold' in updates && updates.lowStockThreshold !== undefined) {
        updateData.low_stock_threshold = updates.lowStockThreshold;
      }

      console.log('Updating product template:', templateId, 'with data:', updateData);

      const { data, error } = await supabase
        .from('product_templates')
        .update(updateData)
        .eq('id', templateId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      console.log('Update successful, new data:', data);

      // Update local state with the data from database to ensure consistency
      const updatedTemplate: ProductTemplate = {
        id: data.id,
        name: data.name,
        wholesaleCost: Number(data.wholesale_cost),
        type: data.type,
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
      const { error } = await supabase
        .from('product_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', userId);

      if (error) throw error;

      setProductTemplates((prev: ProductTemplate[]) => prev.filter((template: ProductTemplate) => template.id !== templateId));
    } catch (error: any) {
      console.error('Error deleting product template:', error);
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
      const { error } = await supabase
        .from('markup_settings')
        .upsert({
          user_id: userId,
          stem: settings.stem,
          vase: settings.vase,
          accessory: settings.accessory,
          other: settings.other
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
      // Insert order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          name: order.name,
          total_wholesale: order.totalWholesale,
          total_retail: order.totalRetail,
          profit: order.profit,
          photo: order.photo,
          notes: order.notes,
          staff_name: order.staffName,
          staff_id: order.staffId
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order products
      const orderProducts = order.products.map(product => ({
        order_id: orderData.id,
        name: product.name,
        wholesale_cost: product.wholesaleCost,
        quantity: product.quantity,
        type: product.type
      }));

      const { error: productsError } = await supabase
        .from('order_products')
        .insert(orderProducts);

      if (productsError) throw productsError;

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
    const updatedTemplates: ProductTemplate[] = [];

    setProductTemplates((prevTemplates: ProductTemplate[]) =>
      prevTemplates.map((template: ProductTemplate) => {
        // Find matching products in the order
        const matchingProduct = order.products.find((product: any) =>
          product.name === template.name && product.type === template.type
        );

        if (matchingProduct && template.inventoryCount !== undefined) {
          const newCount = Math.max(0, template.inventoryCount - matchingProduct.quantity);
          const updatedTemplate = {
            ...template,
            inventoryCount: newCount
          };
          updatedTemplates.push(updatedTemplate);
          return updatedTemplate;
        }

        return template;
      })
    );

    // Update database for authenticated users
    if (userId && updatedTemplates.length > 0) {
      try {
        for (const template of updatedTemplates) {
          const { error } = await supabase
            .from('product_templates')
            .update({ inventory_count: template.inventoryCount })
            .eq('id', template.id)
            .eq('user_id', userId);

          if (error) {
            console.error('Error updating inventory in database:', error);
          }
        }
        console.log('Inventory updated in database for', updatedTemplates.length, 'products');
      } catch (error) {
        console.error('Error updating inventory in database:', error);
      }
    }

    // Update localStorage for demo mode
    if (!userId) {
      try {
        const updatedTemplates = productTemplates.map((template: ProductTemplate) => {
          const matchingProduct = order.products.find((product: any) =>
            product.name === template.name && product.type === template.type
          );

          if (matchingProduct && template.inventoryCount !== undefined) {
            const newCount = Math.max(0, template.inventoryCount - matchingProduct.quantity);
            return {
              ...template,
              inventoryCount: newCount
            };
          }

          return template;
        });

        localStorage.setItem('demo_product_templates', JSON.stringify(updatedTemplates));
      } catch (error) {
        console.error('Error updating inventory in localStorage:', error);
      }
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
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .eq('user_id', userId);

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
      // Insert recipe
      const { data: recipeData, error: recipeError } = await supabase
        .from('arrangement_recipes')
        .insert({
          user_id: userId,
          name: recipe.name,
          description: recipe.description,
          website_price: recipe.websitePrice,
          website_url: recipe.websiteUrl,
          photo: recipe.photo
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Insert recipe ingredients
      const ingredients = recipe.ingredients.map(ingredient => ({
        recipe_id: recipeData.id,
        name: ingredient.name,
        quantity: ingredient.quantity,
        type: ingredient.type,
        notes: ingredient.notes
      }));

      const { error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredients);

      if (ingredientsError) throw ingredientsError;

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
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.websitePrice !== undefined) updateData.website_price = updates.websitePrice;
      if (updates.websiteUrl !== undefined) updateData.website_url = updates.websiteUrl;
      if (updates.photo !== undefined) updateData.photo = updates.photo;

      const { error: recipeError } = await supabase
        .from('arrangement_recipes')
        .update(updateData)
        .eq('id', recipeId)
        .eq('user_id', userId);

      if (recipeError) throw recipeError;

      // Update ingredients if provided
      if (updates.ingredients) {
        // Delete existing ingredients
        const { error: deleteError } = await supabase
          .from('recipe_ingredients')
          .delete()
          .eq('recipe_id', recipeId);

        if (deleteError) throw deleteError;

        // Insert new ingredients
        const ingredients = updates.ingredients.map(ingredient => ({
          recipe_id: recipeId,
          name: ingredient.name,
          quantity: ingredient.quantity,
          type: ingredient.type,
          notes: ingredient.notes
        }));

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredients);

        if (ingredientsError) throw ingredientsError;
      }

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
      const { error } = await supabase
        .from('arrangement_recipes')
        .delete()
        .eq('id', recipeId)
        .eq('user_id', userId);

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
      const { error } = await supabase
        .from('pos_settings')
        .upsert({
          user_id: userId,
          store_name: settings.storeName,
          is_configured: settings.isConfigured
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
  }, [userId]);

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
    saveMarkupSettings,
    saveOrder,
    deleteOrder,
    saveArrangementRecipe,
    updateArrangementRecipe,
    deleteArrangementRecipe,
    savePosSettings,
    // Reload function
    loadAllData
  };
};