import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import DashboardContent from './components/DashboardContent';
import OrderBuilder from './components/OrderBuilder';
import ProductLibrary from './components/ProductLibrary';
import ProductForm from './components/ProductForm';
import MarkupSettingsComponent from './components/MarkupSettings';
import SavedOrders from './components/SavedOrders';
import ArrangementRecipes from './components/ArrangementRecipes';
import ProfitAnalytics from './components/ProfitAnalytics';
import BusinessInsights from './components/BusinessInsights';
import StaffTrainingMode from './components/StaffTrainingMode';
import POSConfiguration from './components/POSConfiguration';
import POSOrderView from './components/POSOrderView';
import { supabase, getCurrentUser } from './lib/supabase';
import { useSupabaseData } from './hooks/useSupabaseData';
import { Product, ProductTemplate, UserRole } from './types/Product';

interface FeedbackModalProps {
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !feedback.trim()) {
      alert('Please fill in both email and feedback fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('beta_feedback')
        .insert({
          email: email.trim().toLowerCase(),
          feedback: feedback.trim(),
          timestamp: new Date().toISOString()
        });

      if (error) throw error;
      
      alert('Thank you for your feedback! We really appreciate it.');
      onClose();
    } catch (error) {
      console.error('Feedback submission error:', error);
      alert('There was an error submitting your feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Share Your Feedback</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="What do you think about FlowerCost Pro? Any suggestions or issues?"
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong</h2>
        <p className="text-gray-600 mb-4">We're sorry, but there was an error loading the application.</p>
        <button
          onClick={resetErrorBoundary}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [activeSection, setActiveSection] = useState('overview');
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentOrderProducts, setCurrentOrderProducts] = useState<Product[]>([]);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);

  const {
    profile,
    productTemplates,
    markupSettings,
    savedOrders,
    arrangementRecipes,
    posSettings,
    loading,
    error,
    saveProductTemplate,
    updateProductTemplate,
    deleteProductTemplate,
    saveMarkupSettings,
    saveOrder,
    updateOrder,
    deleteOrder,
    saveArrangementRecipe,
    updateArrangementRecipe,
    deleteArrangementRecipe,
    savePosSettings
  } = useSupabaseData(user?.id || null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { user: currentUser } = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setCurrentView('dashboard');
        }
      } catch (error) {
        console.error('Error checking user:', error);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setCurrentView('dashboard');
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setCurrentView('landing');
        } else if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordReset(true);
          setCurrentView('auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleStartDemo = () => {
    console.log('App: handleStartDemo called');
    console.log('App: Setting currentView to dashboard and user to demo');
    setUser({ id: null, email: 'demo@flowercostpro.com' });
    setCurrentView('dashboard');
    setUserRole('owner');
    setActiveSection('overview');
    console.log('App: Demo mode activated');
  };

  const handleSignIn = () => {
    setCurrentView('auth');
    setIsPasswordReset(false);
  };

  const handleAuthSuccess = () => {
    setCurrentView('dashboard');
    setIsPasswordReset(false);
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
    setIsPasswordReset(false);
  };

  const handleSectionChange = (section: string) => {
    // Clear editing order when navigating away from create-order
    if (section !== 'create-order') {
      setEditingOrder(null);
    }
    setActiveSection(section);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setCurrentView('landing');
      setActiveSection('overview');
      setUserRole('owner');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleShowFeedback = () => {
    console.log('App: handleShowFeedback called');
    setShowFeedbackModal(true);
  };

  const addProductFromForm = async (product: Omit<Product, 'id'>) => {
    try {
      const existingTemplate = productTemplates.find(
        (t: ProductTemplate) => t.name.toLowerCase() === product.name.toLowerCase() && t.type === product.type
      );

      if (existingTemplate) {
        const updates: Partial<ProductTemplate> = {
          wholesaleCost: product.wholesaleCost,
          lastUsed: new Date()
        };

        if ((product as any).inventoryCount !== undefined) {
          updates.inventoryCount = (product as any).inventoryCount;
        }
        if ((product as any).lowStockThreshold !== undefined) {
          updates.lowStockThreshold = (product as any).lowStockThreshold;
        }

        await updateProductTemplate(existingTemplate.id, updates);
      } else {
        const template: Omit<ProductTemplate, 'id'> = {
          name: product.name,
          wholesaleCost: product.wholesaleCost,
          type: product.type,
          lastUsed: new Date(),
          inventoryCount: (product as any).inventoryCount,
          lowStockThreshold: (product as any).lowStockThreshold
        };

        await saveProductTemplate(template);
      }
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product. Please try again.');
    }
  };

  const handleOrderChange = (products: Product[]) => {
    setCurrentOrderProducts(products);
  };

  const handleEditOrder = (order: OrderRecord) => {
    setEditingOrder(order);
    setActiveSection('create-order');
  };

  const handleUpdateOrder = async (orderId: string, order: OrderRecord) => {
    try {
      await updateOrder(orderId, order);
      setEditingOrder(null);
      alert('Order updated successfully!');
    } catch (error: any) {
      console.error('Error updating order:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      alert(`Error updating order: ${errorMessage}\n\nPlease check the console for more details.`);
    }
  };

  const userName = user?.user_metadata?.full_name || profile?.full_name || (user ? 'User' : 'Demo User');
  const storeName = profile?.store_name || posSettings?.storeName || 'Demo Flower Shop';

  if (currentView === 'landing') {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <LandingPage 
          onStartDemo={handleStartDemo}
          onSignIn={handleSignIn}
          onShowFeedback={handleShowFeedback}
        />
        {showFeedbackModal && (
          <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
        )}
      </ErrorBoundary>
    );
  }

  if (currentView === 'auth') {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Auth 
          onAuthSuccess={handleAuthSuccess}
          isPasswordReset={isPasswordReset}
          onBackToLanding={handleBackToLanding}
        />
      </ErrorBoundary>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'create-order':
        return (
          <OrderBuilder
            templates={productTemplates}
            recipes={arrangementRecipes}
            markupSettings={markupSettings}
            onSaveOrder={saveOrder}
            onUpdateOrder={handleUpdateOrder}
            onOrderChange={handleOrderChange}
            userRole={userRole}
            posSettings={posSettings}
            initialOrder={editingOrder || undefined}
          />
        );
      case 'products':
        return (
          <div className="space-y-6">
            <ProductForm
              onAddProduct={addProductFromForm}
              existingTemplates={productTemplates}
            />
            <ProductLibrary
              templates={productTemplates}
              markupSettings={markupSettings}
              onUpdateTemplate={updateProductTemplate}
              onDeleteTemplate={deleteProductTemplate}
            />
          </div>
        );
      case 'recipes':
        return (
          <ArrangementRecipes
            recipes={arrangementRecipes}
            templates={productTemplates}
            markupSettings={markupSettings}
            onSaveRecipe={saveArrangementRecipe}
            onDeleteRecipe={deleteArrangementRecipe}
            onUpdateRecipe={updateArrangementRecipe}
          />
        );
      case 'orders':
        return (
          <SavedOrders
            orders={savedOrders}
            onDeleteOrder={deleteOrder}
            onEditOrder={handleEditOrder}
          />
        );
      case 'analytics':
        return (
          <ProfitAnalytics orders={savedOrders} />
        );
      case 'insights':
        return (
          <BusinessInsights
            orders={savedOrders}
            templates={productTemplates}
          />
        );
      case 'settings':
        return (
          <div className="space-y-6">
            <MarkupSettingsComponent
              markupSettings={markupSettings}
              onMarkupChange={saveMarkupSettings}
            />
            <POSConfiguration
              posSettings={posSettings}
              onUpdateSettings={savePosSettings}
            />
          </div>
        );
      case 'staff-training':
        return (
          <div className="space-y-6">
            <StaffTrainingMode
              products={currentOrderProducts}
              markupSettings={markupSettings}
              targetBudget={100}
              userRole={userRole}
            />
            <POSOrderView orders={savedOrders} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Dashboard
        userRole={userRole}
        userName={userName}
        storeName={storeName}
        onRoleChange={setUserRole}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onLogout={handleLogout}
        onShowFeedback={handleShowFeedback}
      >
        <DashboardContent
          activeSection={activeSection}
          userRole={userRole}
          orders={savedOrders}
          templates={productTemplates}
        >
          {renderActiveSection()}
        </DashboardContent>
      </Dashboard>
      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}
    </ErrorBoundary>
  );
}

export default App;