import React, { useState, useEffect, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import AdminDashboard from './components/AdminDashboard';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import DashboardContent from './components/DashboardContent';
import OrderBuilder from './components/OrderBuilder';
import ProductLibrary from './components/ProductLibrary';
import ProductForm from './components/ProductForm';
import MarkupSettingsComponent from './components/MarkupSettings';
import SavedOrders from './components/SavedOrders';
import StaffSavedOrders from './components/StaffSavedOrders';
import ArrangementRecipes from './components/ArrangementRecipes';
import StaffArrangementRecipes from './components/StaffArrangementRecipes';
import ProfitAnalytics from './components/ProfitAnalytics';
import BusinessInsights from './components/BusinessInsights';
import StaffTrainingMode from './components/StaffTrainingMode';
import StaffManagement from './components/StaffManagement';
import StaffInviteAcceptance from './components/StaffInviteAcceptance';
import TrialExpiredOverlay from './components/TrialExpiredOverlay';
import POSConfiguration from './components/POSConfiguration';
import POSOrderView from './components/POSOrderView';
import LowStockAlert from './components/LowStockAlert';
import SubscriptionBanner from './components/SubscriptionBanner';
import { supabase } from './lib/supabase';
import { useSupabaseData } from './hooks/useSupabaseData';
import { Product, ProductTemplate, OrderRecord } from './types/Product';
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

      if (userId) {
        // Authenticated: single server-side call that inserts feedback AND
        // extends the trial atomically via SECURITY DEFINER RPC (bypasses RLS)
        const { data: newTrialEnd, error } = await supabase.rpc(
          'submit_feedback_and_extend_trial',
          { p_email: trimmedEmail, p_feedback: feedback.trim() }
        );

        if (error) throw error;

        if (newTrialEnd) {
          onTrialExtended?.(newTrialEnd);
          showToast('Thank you! Your trial has been extended to 30 days.', 'success');
        } else {
          showToast('Thank you for your feedback! We really appreciate it.', 'success');
        }
      } else {
        // Unauthenticated (landing page): direct insert only, no trial to extend
        const { error } = await supabase
          .from('beta_feedback')
          .insert({
            email: trimmedEmail,
            feedback: feedback.trim(),
            timestamp: new Date().toISOString()
          });

        if (error) throw error;

        showToast('Thank you for your feedback! We really appreciate it.', 'success');
      }

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
  // accountRole is loaded from DB: 'owner' or 'staff'. null = not yet loaded.
  const [accountRole, setAccountRole] = useState<'owner' | 'staff' | null>(null);
  // ownerId: for owners = their own id; for staff = their owner's id
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const passwordResetRef = useRef(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentOrderProducts, setCurrentOrderProducts] = useState<Product[]>([]);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // invite token from URL ?invite=<token>
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const isAdminPath = window.location.pathname === '/admin';

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
    deleteSampleProducts,
    saveMarkupSettings,
    saveOrder,
    updateOrder,
    deleteOrder,
    saveArrangementRecipe,
    updateArrangementRecipe,
    deleteArrangementRecipe,
    savePosSettings,
    pricingProfiles,
    staffPricingProfiles,
    savePricingProfile,
    deletePricingProfile
  } = useSupabaseData(user?.id || null, ownerId);

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

    // Check for invite token in URL
    const inviteToken = params.get('invite');
    if (inviteToken) {
      setPendingInviteToken(inviteToken);
      setAuthMode('signup');
      setCurrentView('auth');
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Detect recovery URL from password reset email link.
    // Set the ref so INITIAL_SESSION (which fires before PASSWORD_RECOVERY)
    // doesn't route to the dashboard or landing page. Do NOT strip the URL
    // here — Supabase's PKCE flow needs the code param to exchange for a
    // recovery session. The URL is cleaned after PASSWORD_RECOVERY fires.
    if (params.get('type') === 'recovery') {
      passwordResetRef.current = true;
      setIsPasswordReset(true);
      setCurrentView('auth');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          passwordResetRef.current = true;
          setIsPasswordReset(true);
          setCurrentView('auth');
          // Code has been exchanged — safe to clean the URL now.
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
          // Don't route to dashboard if the user arrived via a password reset link.
          // They must submit a new password first.
          if (passwordResetRef.current) {
            setUser(session.user);
            return;
          }
          setUser(session.user);
          setCurrentView('dashboard');
        } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
          // During password reset, INITIAL_SESSION fires with no session before
          // PASSWORD_RECOVERY fires. Don't route away from the auth screen.
          if (passwordResetRef.current) return;
          setUser(null);
          setAccountRole(null);
          setOwnerId(null);
          setCurrentView('landing');
          setSubscriptionStatus(null);
          setTrialEndsAt(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile data (role, subscription, admin flag) outside onAuthStateChange.
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    supabase
      .rpc('get_owner_profile')
      .then(({ data }: { data: any }) => {
        if (data) {
          setSubscriptionStatus(data.subscription_status ?? 'trialing');
          setTrialEndsAt(data.trial_ends_at ?? null);
          setIsAdmin(data.is_admin === true);
          const role = (data.account_role as 'owner' | 'staff') ?? 'owner';
          setAccountRole(role);
          // For staff: owner_id is their shop owner's id.
          // For owners: ownerId = their own id (so data queries still work).
          setOwnerId(role === 'staff' ? data.owner_id : userId);
        }
      })
      .catch((err) => console.error('Error fetching profile:', err));
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
    passwordResetRef.current = false;
    setIsPasswordReset(false);
    setCurrentView('dashboard');
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
    setIsPasswordReset(false);
  };

  const handleSectionChange = (section: string) => {
    if (section !== 'create-order') {
      setEditingOrder(null);
    }
    if (section !== 'orders' && section !== 'my-orders') {
      setSelectedOrderId(null);
    }
    setActiveSection(section);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAccountRole(null);
      setOwnerId(null);
      setCurrentView('landing');
      setActiveSection('overview');
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
          unit: (product as any).unit ?? 'stem',
          lastUsed: new Date(),
          inventoryCount: (product as any).inventoryCount,
          lowStockThreshold: (product as any).lowStockThreshold
        };

        await saveProductTemplate(template);
      }
    } catch (error: any) {
      console.error('Error adding product:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      showToast(`Error adding product: ${errorMessage}`, 'error');
    }
  };

  const handleOrderChange = (products: Product[]) => {
    setCurrentOrderProducts(products);
  };

  const handleEditOrder = (order: OrderRecord) => {
    setEditingOrder(order);
    setActiveSection('create-order');
  };

  const handleOrderSaved = (order: OrderRecord) => {
    setEditingOrder(null);
    setSelectedOrderId(order.id);
    setActiveSection(accountRole === 'staff' ? 'my-orders' : 'orders');
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

  const userName = profile?.full_name || user?.user_metadata?.full_name || (user ? 'User' : 'Demo User');
  const storeName = profile?.store_name || posSettings?.storeName || 'Demo Flower Shop';

  // Sections that staff are completely forbidden from accessing
  const OWNER_ONLY_SECTIONS = new Set([
    'settings', 'analytics', 'insights', 'products', 'low-stock',
    'orders', 'staff-training', 'team',
  ]);

  const isStaff = accountRole === 'staff';

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
    if (pendingInviteToken) {
      return (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <StaffInviteAcceptance
            token={pendingInviteToken}
            onAuthSuccess={handleAuthSuccess}
            onBackToLanding={handleBackToLanding}
          />
        </ErrorBoundary>
      );
    }
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

  // Admin route — gate on is_admin flag checked server-side by the edge function.
  // Non-admins who try /admin are silently redirected to the normal dashboard.
  if (isAdminPath && currentView === 'dashboard') {
    if (!isAdmin) {
      // Still waiting for the isAdmin check, or user is not admin: fall through to normal dashboard
      if (!user?.id) {
        window.history.replaceState({}, '', '/');
        return null;
      }
    } else {
      return (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <AdminDashboard user={user} />
        </ErrorBoundary>
      );
    }
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

  // Wait for accountRole to be resolved before rendering the dashboard.
  // Without this, staff members briefly see the owner layout (accountRole=null → defaulted to 'owner').
  if (user && accountRole === null) {
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
    // Hard block: staff cannot access owner-only sections regardless of URL/state
    if (isStaff && OWNER_ONLY_SECTIONS.has(activeSection)) {
      return (
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center p-8 bg-red-50 border border-red-200 rounded-xl max-w-md">
            <p className="text-red-700 font-semibold text-lg mb-2">Access Denied</p>
            <p className="text-red-600 text-sm">This section is only available to the shop owner.</p>
          </div>
        </div>
      );
    }

    switch (activeSection) {
      case 'create-order':
        return (
          <OrderBuilder
            templates={productTemplates}
            recipes={arrangementRecipes}
            markupSettings={markupSettings}
            onSaveOrder={saveOrder}
            onOrderSaved={handleOrderSaved}
            onUpdateOrder={handleUpdateOrder}
            pricingProfiles={isStaff ? undefined : pricingProfiles}
            staffPricingProfiles={isStaff ? staffPricingProfiles : undefined}
            onOrderChange={handleOrderChange}
            userRole={accountRole === 'staff' ? 'staff' : 'owner'}
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
              onDeleteSampleProducts={deleteSampleProducts}
            />
            <LowStockAlert
              templates={productTemplates}
              onUpdateTemplate={updateProductTemplate}
            />
          </div>
        );
      case 'recipes':
        return isStaff ? (
          <StaffArrangementRecipes recipes={arrangementRecipes} />
        ) : (
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
            userRole={accountRole === 'staff' ? 'staff' : 'owner'}
            selectedOrderId={selectedOrderId}
          />
        );
      case 'my-orders':
        return (
          <StaffSavedOrders
            orders={savedOrders}
            selectedOrderId={selectedOrderId}
            staffPricingProfiles={staffPricingProfiles}
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
              pricingProfiles={pricingProfiles}
              onSavePricingProfile={savePricingProfile}
              onDeletePricingProfile={deletePricingProfile}
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
              userRole="owner"
            />
            <POSOrderView orders={savedOrders} />
          </div>
        );
      case 'team':
        return (
          <StaffManagement
            ownerId={user?.id ?? ''}
            ownerEmail={user?.email ?? ''}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {user?.id && !isAdmin && accountRole === 'owner' && (
        <SubscriptionBanner
          userId={user.id}
          email={user.email ?? ''}
          subscriptionStatus={effectiveStatus}
          trialEndsAt={effectiveTrialEndsAt}
        />
      )}
      {/* Paywall overlay — only shown to owners (staff accounts don't have their own subscription) */}
      {user?.id && !isAdmin && accountRole === 'owner' && (() => {
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
        accountRole={accountRole ?? 'owner'}
        userName={userName}
        storeName={storeName}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onLogout={handleLogout}
        onShowFeedback={handleShowFeedback}
        templates={productTemplates}
      >
        <DashboardContent
          activeSection={activeSection}
          userRole={accountRole === 'staff' ? 'staff' : 'owner'}
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