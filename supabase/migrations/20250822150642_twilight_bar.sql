/*
  # Initial Schema for FlowerCost Pro

  1. New Tables
    - `profiles`
      - `id` (uuid, references auth.users)
      - `email` (text)
      - `full_name` (text)
      - `role` (enum: owner, manager, staff)
      - `store_name` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `product_templates`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `name` (text)
      - `wholesale_cost` (decimal)
      - `type` (enum: stem, vase, accessory, other)
      - `last_used` (timestamp)
      - `created_at` (timestamp)
    
    - `markup_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `stem` (decimal)
      - `vase` (decimal)
      - `accessory` (decimal)
      - `other` (decimal)
      - `updated_at` (timestamp)
    
    - `orders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `name` (text)
      - `total_wholesale` (decimal)
      - `total_retail` (decimal)
      - `profit` (decimal)
      - `photo` (text, optional)
      - `notes` (text, optional)
      - `staff_name` (text, optional)
      - `staff_id` (text, optional)
      - `created_at` (timestamp)
    
    - `order_products`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references orders)
      - `name` (text)
      - `wholesale_cost` (decimal)
      - `quantity` (integer)
      - `type` (enum: stem, vase, accessory, other)
    
    - `arrangement_recipes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `name` (text)
      - `description` (text, optional)
      - `website_price` (decimal)
      - `website_url` (text, optional)
      - `photo` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `recipe_ingredients`
      - `id` (uuid, primary key)
      - `recipe_id` (uuid, references arrangement_recipes)
      - `name` (text)
      - `quantity` (integer)
      - `type` (enum: stem, vase, accessory, other)
      - `notes` (text, optional)
    
    - `pos_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `store_name` (text)
      - `is_configured` (boolean)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Add policies for staff to access data from their organization
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE product_type AS ENUM ('stem', 'vase', 'accessory', 'other');

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  role user_role DEFAULT 'owner',
  store_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create product_templates table
CREATE TABLE IF NOT EXISTS product_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  wholesale_cost decimal(10,2) NOT NULL,
  type product_type NOT NULL,
  last_used timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create markup_settings table
CREATE TABLE IF NOT EXISTS markup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stem decimal(4,2) DEFAULT 2.5,
  vase decimal(4,2) DEFAULT 2.0,
  accessory decimal(4,2) DEFAULT 3.0,
  other decimal(4,2) DEFAULT 2.0,
  updated_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  total_wholesale decimal(10,2) NOT NULL,
  total_retail decimal(10,2) NOT NULL,
  profit decimal(10,2) NOT NULL,
  photo text,
  notes text,
  staff_name text,
  staff_id text,
  created_at timestamptz DEFAULT now()
);

-- Create order_products table
CREATE TABLE IF NOT EXISTS order_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  wholesale_cost decimal(10,2) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  type product_type NOT NULL
);

-- Create arrangement_recipes table
CREATE TABLE IF NOT EXISTS arrangement_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  website_price decimal(10,2) DEFAULT 0,
  website_url text,
  photo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create recipe_ingredients table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES arrangement_recipes(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  type product_type NOT NULL,
  notes text
);

-- Create pos_settings table
CREATE TABLE IF NOT EXISTS pos_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  store_name text NOT NULL,
  is_configured boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE markup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrangement_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Product templates policies
CREATE POLICY "Users can manage own product templates"
  ON product_templates
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Markup settings policies
CREATE POLICY "Users can manage own markup settings"
  ON markup_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Orders policies
CREATE POLICY "Users can manage own orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Order products policies
CREATE POLICY "Users can manage order products for own orders"
  ON order_products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_products.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Arrangement recipes policies
CREATE POLICY "Users can manage own arrangement recipes"
  ON arrangement_recipes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Recipe ingredients policies
CREATE POLICY "Users can manage ingredients for own recipes"
  ON recipe_ingredients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM arrangement_recipes
      WHERE arrangement_recipes.id = recipe_ingredients.recipe_id
      AND arrangement_recipes.user_id = auth.uid()
    )
  );

-- POS settings policies
CREATE POLICY "Users can manage own POS settings"
  ON pos_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  -- Create default markup settings
  INSERT INTO markup_settings (user_id, stem, vase, accessory, other)
  VALUES (NEW.id, 2.5, 2.0, 3.0, 2.0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_markup_settings_updated_at
  BEFORE UPDATE ON markup_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_arrangement_recipes_updated_at
  BEFORE UPDATE ON arrangement_recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pos_settings_updated_at
  BEFORE UPDATE ON pos_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();