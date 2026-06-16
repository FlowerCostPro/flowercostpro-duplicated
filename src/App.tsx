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
import TrialExpiredOverlay from './components/TrialExpiredOverlay';
import POSConfiguration from './components/POSConfiguration';
import POSOrderView from './components/POSOrderView';
import LowStockAlert from './components/LowStockAlert';
import SubscriptionBanner from './components/SubscriptionBanner';
import { supabase } from './lib/supabase';
import { useSupabaseData } from './hooks/useSupabaseData';
import { Product, ProductTemplate, OrderRecord } from './types/Product';
import { UserRole } from './types/shared';
import { useToast } from './components/Toast';

interface FeedbackModalProps {
  onClose: () => void;
  userId?: string | null;
  userEmail?: string | null;
  onTrialExtended?: (newTrialEndsAt: string) => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose, userId, userEmail, onTrialExtended }) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState(userEmail ?? '');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !feedback.trim()) {
      showToast('Please fill in both email and feedback fields.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const { error } = await supabase
        .from('beta_feedback')
        .insert({
          email: trimmedEmail,
          feedback: feedback.trim(),
          timestamp: new Date().toISOString()
        });

      if (error) throw error;

      // Extend trial to 30 days from signup for authenticated users
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('created_at, trial_ends_at')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          const thirtyDaysFromSignup = new Date(
            new Date(profile.created_at).getTime() + 30 * 24 * 60 * 60 * 1000
          );
          const currentTrialEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : new Date(0);

          if (thirtyDaysFromSignup > currentTrialEnd) {
            await supabase
              .from('profiles')
              .update({
                trial_ends_at: thirtyDaysFromSignup.toISOString(),
                subscription_status: 'trialing'
              })
              .eq('id', userId);

            onTrialExtended?.(thirtyDaysFromSignup.toISOString());
            showToast('Thank you! Your trial has been extended to 30 days.', 'success');
            onClose();
            return;
          }
        }
      }

      showToast('Thank you for your feedback! We really appreciate it.', 'success');
      onClose();
    } catch (error) {
      console.error('Feedback submission error:', error);
      showToast('There was an error submitting your feedback. Please try again.', 'error');
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="your@email.com"
              required
              disabled={!!userEmail}
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
          {userId && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              Submit feedback and get 30 days free — your trial will be extended automatically.
            </p>
          )}
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

// Simulation overrides for testing trial states via ?simulate=X URL param
// Values: expired | 1day | 3days | 7days | active | past_due | canceled
function getSimulatedSubscriptionState(): { status: string | null; trialEndsAt: string | null } | null {
  const params = new URLSearchParams(window.location.search);
  const sim = params.get('simulate');
  if (!sim) return null;
  const now = Date.now();
  const day = 86400000;
  switch (sim) {
    case 'expired':
      return { status: 'trialing', trialEndsAt: new Date(now - day).toISOString() };
    case '1day':
      return { status: 'trialing', trialEndsAt: new Date(now + day * 0.5).toISOString() };
    case '3days':
      return { status: 'trialing', trialEndsAt: new Date(now + day * 3).toISOString() };
    case '7days':
      return { status: 'trialing', trialEndsAt: new Date(now + day * 7).toISOString() };
    case 'active':
      return { status: 'active', trialEndsAt: null };
    case 'past_due':
      return { status: 'past_due', trialEndsAt: null };
    case 'canceled':
      return { status: 'canceled', trialEndsAt: null };
    default:
      return null;
  }
}

function App() {
  const { showToast } = useToast();
  const [currentView, setCurrentView] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [activeSection, setActiveSection] = useState('overview');
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentOrderProducts, setCurrentOrderProducts] = useState<Product[]>([]);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  const simulation = getSimulatedSubscriptionState();
  const effectiveStatus = simulation ? simulation.status : subscriptionStatus;
  const effectiveTrialEndsAt = simulation ? simulation.trialEndsAt : trialEndsAt;

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
    // Handle Stripe checkout return
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      showToast('Subscription set up! Your trial is now active.', 'success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('checkout') === 'cancelled') {
      showToast('Checkout cancelled. You can subscribe anytime from your dashboard.', 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Keep this callback synchronous — never call supabase.from() inside
    // onAuthStateChange. The SDK has not fully committed the session when the
    // callback fires; awaiting a DB query here deadlocks the Supabase client
    // and hangs every subsequent query (including loadAllData).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
          setUser(session.user);
          setCurrentView('dashboard');
        } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
          setUser(null);
          setCurrentView('landing');
          setSubscriptionStatus(null);
          setTrialEndsAt(null);
        } else if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordReset(true);
          setCurrentView('auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Fetch subscription data in a separate effect, safely outside onAuthStateChange.
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSubscriptionStatus(data.subscription_status ?? 'trialing');
          setTrialEndsAt(data.trial_ends_at ?? null);
        }
      })
      .catch((err) => console.error('Error fetching subscription:', err));
  }, [user?.id]);

  const handleStartTrial = () => {
    setAuthMode('signup');
    setCurrentView('auth');
    setIsPasswordReset(false);
  };

  const handleSignIn = () => {
    setAuthMode('signin');
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
      showToast('Error adding product. Please try again.', 'error');
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
      showToast('Order updated successfully!', 'success');
    } catch (error: any) {
      console.error('Error updating order:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      showToast(`Error updating order: ${errorMessage}`, 'error');
    }
  };

  const userName = user?.user_metadata?.full_name || profile?.full_name || (user ? 'User' : 'Demo User');
  const storeName = profile?.store_name || posSettings?.storeName || 'Demo Flower Shop';

  if (currentView === 'landing') {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <LandingPage
          onStartTrial={handleStartTrial}
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
          initialMode={authMode}
        />
      </ErrorBoundary>
    );
  }

  if (loading && !simulation) {
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
      case 'low-stock':
        return (
          <LowStockAlert
            templates={productTemplates}
            onUpdateTemplate={updateProductTemplate}
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
            <LowStockAlert
              templates={productTemplates}
              onUpdateTemplate={updateProductTemplate}
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
      {user?.id && (
        <SubscriptionBanner
          userId={user.id}
          email={user.email ?? ''}
          subscriptionStatus={effectiveStatus}
          trialEndsAt={effectiveTrialEndsAt}
        />
      )}
      {/* Paywall overlay — blocks access when trial has expired */}
      {user?.id && (() => {
        if (effectiveStatus === 'active') return null;
        const trialEnd = effectiveTrialEndsAt ? new Date(effectiveTrialEndsAt) : null;
        const expired = trialEnd ? trialEnd < new Date() : false;
        if (!expired && effectiveStatus !== 'canceled') return null;
        return (
          <TrialExpiredOverlay
            userId={user.id}
            email={user.email ?? ''}
            isCanceled={effectiveStatus === 'canceled'}
            onLogout={handleLogout}
            isSimulated={!!simulation}
          />
        );
      })()}
      <Dashboard
        userRole={userRole}
        userName={userName}
        storeName={storeName}
        onRoleChange={setUserRole}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onLogout={handleLogout}
        onShowFeedback={handleShowFeedback}
        templates={productTemplates}
      >
        <DashboardContent
          activeSection={activeSection}
          userRole={userRole}
          orders={savedOrders}
          templates={productTemplates}
          onSectionChange={handleSectionChange}
        >
          {renderActiveSection()}
        </DashboardContent>
      </Dashboard>
      {showFeedbackModal && (
        <FeedbackModal
          onClose={() => setShowFeedbackModal(false)}
          userId={user?.id}
          userEmail={user?.email}
          onTrialExtended={(newDate) => setTrialEndsAt(newDate)}
        />
      )}
    </ErrorBoundary>
  );
}

export default App;