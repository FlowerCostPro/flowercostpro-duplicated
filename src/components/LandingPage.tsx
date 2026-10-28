import React from 'react';
import { Users, TrendingUp, CircleCheck as CheckCircle, ArrowRight, Play, Star, Shield, Clock, Target, ChartBar as BarChart3, Smartphone, RefreshCw } from 'lucide-react';

interface LandingPageProps {
  onStartTrial: () => void;
  onSignIn: () => void;
  onShowFeedback: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartTrial, onSignIn, onShowFeedback }) => {
  const handleGetStarted = () => {
    onStartTrial();
  };

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="FlowerCost Pro"
                className="h-20 sm:h-36 w-auto"
              />
            </div>
            <div className="flex flex-wrap justify-end items-center gap-2 sm:gap-4 text-sm sm:text-base">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Landing page feedback button clicked');
                  onShowFeedback();
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Give Feedback
              </button>
              <button
                onClick={onSignIn}
                className="text-gray-600 hover:text-gray-700 font-medium"
              >
                Sign In
              </button>
              <button
                onClick={handleGetStarted}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-50 to-blue-50 py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium inline-block mb-6">
                🌸 Built by a florist, for florists
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Know Your Profit on Every Arrangement
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Your designers just build. FlowerCost Pro prices each arrangement in real time
                with your markup and labor, and only you see the wholesale cost and profit,
                including on wire-ins.
              </p>

              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={handleGetStarted}
                  className="bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Play className="w-5 h-5" />
                  Start Your Free 14-Day Trial
                </button>
                <p className="text-sm text-gray-600">
                  No credit card needed · $25/month after · Free 15-minute setup call
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Works with any POS</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-purple-800">Staff Training Mode</span>
                  </div>
                  <div className="text-sm text-purple-700">
                    Customer Budget: <span className="font-bold">$75.00</span>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Red Roses (12)</span>
                    <span className="text-green-600 font-bold">$30.00</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Baby's Breath (3)</span>
                    <span className="text-green-600 font-bold">$16.88</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Glass Vase (1)</span>
                    <span className="text-green-600 font-bold">$17.00</span>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-green-700 font-medium">Total: $63.88</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 font-bold">WITHIN BUDGET</span>
                    </div>
                  </div>
                  <div className="text-sm text-green-600 mt-1">$11.12 remaining</div>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold">
                Live Demo!
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-12 sm:py-20 bg-red-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              The Hidden Profit Killer in Your Shop
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              During busy seasons, well-meaning staff create beautiful arrangements that lose money.
              Even one $20 pricing mistake a day adds up to over $7,000 a year.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg border border-red-200">
              <div className="bg-red-100 p-3 rounded-full w-fit mb-4">
                <TrendingUp className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Seasonal Staff Mistakes</h3>
              <p className="text-gray-600">
                Holiday workers don't know your costs. They create gorgeous arrangements
                that sell at a loss because they used too many premium stems.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg border border-red-200">
              <div className="bg-red-100 p-3 rounded-full w-fit mb-4">
                <Clock className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Rush Hour Pressure</h3>
              <p className="text-gray-600">
                When customers are waiting, staff grab whatever looks good.
                No time to calculate costs means profit margins disappear.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg border border-red-200">
              <div className="bg-red-100 p-3 rounded-full w-fit mb-4">
                <Target className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Inconsistent Pricing</h3>
              <p className="text-gray-600">
                Different staff price similar arrangements differently.
                Customers notice, and your profit margins suffer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              Real-Time Profit Protection
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              FlowerCost Pro guides staff to create profitable arrangements every time.
              No complex training required - just instant feedback.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              Everything You Need to Protect Profits
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="bg-green-100 p-3 rounded-full w-fit mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Staff Training Mode</h3>
              <p className="text-gray-600 text-sm">
                Real-time budget tracking prevents costly mistakes. Staff see exactly
                how much they can spend while staying profitable.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="bg-blue-100 p-3 rounded-full w-fit mb-4">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Profit Analytics</h3>
              <p className="text-gray-600 text-sm">
                Track performance by product, staff member, and time period.
                Identify what's working and what's not.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="bg-purple-100 p-3 rounded-full w-fit mb-4">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Arrangement Recipes</h3>
              <p className="text-gray-600 text-sm">
                Save profitable arrangements as templates. Ensure consistency
                and maintain margins on popular designs.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="bg-orange-100 p-3 rounded-full w-fit mb-4">
                <Smartphone className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Universal POS Integration</h3>
              <p className="text-gray-600 text-sm">
                Copy to any POS — one click copies order, photo, designer name, recipient, recipe and date. Photo record on every order.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="bg-red-100 p-3 rounded-full w-fit mb-4">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Data Security</h3>
              <p className="text-gray-600 text-sm">
                Your business data is encrypted and backed up automatically.
                Access from any device, anywhere.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="bg-yellow-100 p-3 rounded-full w-fit mb-4">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Quick Setup</h3>
              <p className="text-gray-600 text-sm">
                Up and running in about 10 minutes. Add the flowers and supplies you use,
                then update them as each delivery comes in, so your wholesale prices and
                inventory are always current.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="bg-teal-100 p-3 rounded-full w-fit mb-4">
                <RefreshCw className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Real-Time Inventory Tracking</h3>
              <p className="text-gray-600 text-sm">
                Inventory auto-updates as arrangements are built. Always know exactly what's on hand without manual counts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Review Section */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              What a Shop Owner Says
            </h2>
          </div>

          <div className="bg-green-50 rounded-xl p-8 border border-green-200">
            <div className="flex items-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
              ))}
            </div>
            <p className="text-gray-700 mb-6 text-lg leading-relaxed italic">
              "This is a great easy system to enter your recipes and keep up with your COGS
              and keep profit aligned. I love Flower Cost Pro and so do my employees.
              Simple, fast, easy to use. Highly recommend."
            </p>
            <p className="text-gray-600 font-medium">
              — Ginger, Allen Flower Shop
            </p>
          </div>
        </div>
      </section>

      {/* Who Built This Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl p-8 sm:p-10 shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Built by a Florist Who's Been There
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              I owned and operated a flower shop for 30 years. I know what it's like to price
              arrangements by feel during a holiday rush and wonder later where the profit went.
              I built FlowerCost Pro so shop owners can finally see their real numbers without
              slowing down the design table.
            </p>
            <p className="text-lg text-gray-700 mt-4 font-medium">
              — Karen, founder
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              One plan for every florist. Every feature included. Unlimited designers. Cancel anytime.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-green-500 relative">
              <div className="p-8 text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">FlowerCostPro</h3>
                <div className="mb-2">
                  <span className="text-4xl sm:text-5xl font-bold text-gray-900">$25</span>
                  <span className="text-xl text-gray-600">/month</span>
                </div>
                <p className="text-sm text-green-700 font-medium mb-6">
                  At $25 a month FlowerCostPro pays for itself with the profit from a single arrangement.
                </p>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Unlimited products & arrangements</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Staff training mode</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Inventory tracking</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Low stock alerts</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Profit analytics & reporting</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Universal POS integration</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Arrangement recipe library</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Email support</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>14-day free trial</span>
                  </li>
                </ul>

                <button
                  onClick={handleGetStarted}
                  className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg flex items-center justify-center gap-2"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div className="text-center mt-3 space-y-1">
                  <p className="text-sm text-gray-500">No credit card required &bull; Cancel anytime</p>
                  <p className="text-sm text-green-700 font-medium">Submit feedback during your trial and get 30 days free</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600">
              <strong>Pays for itself:</strong> at $25 a month, preventing just one or two underpriced arrangements covers the cost.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 bg-green-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Stop Losing Money on Beautiful Arrangements
          </h2>
          <p className="text-xl text-green-100 mb-8 max-w-3xl mx-auto">
            See your real profit on every arrangement. Start your free trial today — no credit card required.
          </p>

          <button
            onClick={handleGetStarted}
            className="bg-white text-green-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg flex items-center gap-2 mx-auto"
          >
            <Play className="w-5 h-5" />
            Start Your Free 14-Day Trial
          </button>

          <p className="text-green-200 text-sm mt-6">
            ✅ 14-day free trial • ✅ Works with any POS • ✅ Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/logo.jpg"
                  alt="FlowerCost Pro"
                  className="h-24 w-auto"
                />
              </div>
              <p className="text-gray-400 text-sm">
                Real-time cost and profit tracking for flower shops. Built by a florist.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Demo</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Training</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 FlowerCost Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
