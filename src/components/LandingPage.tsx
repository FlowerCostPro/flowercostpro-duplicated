import React, { useState, FormEvent } from 'react';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  CheckCircle, 
  ArrowRight, 
  Play,
  Star,
  Shield,
  Clock,
  Target,
  BarChart3,
  Smartphone
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LandingPageProps {
  onStartDemo: () => void;
  onSignIn: () => void;
  onShowFeedback: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartDemo, onSignIn, onShowFeedback }) => {
  const [email, setEmail] = useState('');

  const handleGetStarted = () => {
    console.log('LandingPage: handleGetStarted called');
    console.log('LandingPage: About to call onStartDemo');
    console.log('LandingPage: onStartDemo function:', typeof onStartDemo);
    onStartDemo();
    console.log('LandingPage: onStartDemo called successfully');
  };

  const handleEmailSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      // Submit to Supabase
      const { error } = await supabase
        .from('email_signups')
        .insert({
          email: email.trim().toLowerCase(),
          source: 'landing-page'
        });

      if (error) {
        // Handle duplicate email error gracefully
        if (error.code === '23505') {
          alert(`Thanks! ${email} is already on our notification list.`);
        } else {
          throw error;
        }
      } else {
        alert(`Thanks! We'll notify ${email} when FlowerCost Pro launches.`);
      }
      
      setEmail('');
    } catch (error) {
      console.error('Email signup error:', error);
      alert('There was an error signing up. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <img 
                src="/image.png" 
                alt="FlowerCost Pro" 
                className="h-36 w-auto"
              />
            </div>
            <div className="flex items-center gap-4">
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
                Try Free Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="bg-red-100 text-red-800 px-4 py-2 rounded-full text-sm font-medium inline-block mb-6">
                🚨 Stop Losing Money on Arrangements
              </div>
              <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Train Staff to Maintain
                <span className="text-green-600"> 40%+ Profit</span> Margins
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                FlowerCost Pro prevents costly pricing mistakes during busy seasons. 
                Real-time cost tracking ensures every arrangement stays profitable, 
                even with seasonal staff.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button
                  onClick={handleGetStarted}
                  className="bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Try Free Demo
                </button>
                <form onSubmit={handleEmailSignup} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Get Notified
                  </button>
                </form>
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-600">
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
      <section className="py-20 bg-red-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              The Hidden Profit Killer in Your Shop
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              During busy seasons, well-meaning staff create beautiful arrangements that lose money. 
              One $20 mistake per day costs you $7,300 per year.
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
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Real-Time Profit Protection
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              FlowerCost Pro guides staff to create profitable arrangements every time. 
              No complex training required - just instant feedback.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="bg-green-100 p-3 rounded-full flex-shrink-0">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Staff Training Mode</h3>
                    <p className="text-gray-600">
                      Staff see customer budget and real-time cost tracking. 
                      Green means profitable, red means stop adding items.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
                    <Smartphone className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Universal POS Integration</h3>
                    <p className="text-gray-600">
                      Works with Square, Clover, Toast, or any POS system. 
                      Simple copy/paste - no technical setup required.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-purple-100 p-3 rounded-full flex-shrink-0">
                    <BarChart3 className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Profit Analytics</h3>
                    <p className="text-gray-600">
                      Track which arrangements make money and which don't. 
                      Identify your most profitable products and staff performance.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-8">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="text-center mb-6">
                  <div className="bg-green-100 p-3 rounded-full w-fit mx-auto mb-3">
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900">Profit Impact</h4>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="text-red-700">Before FlowerCost Pro:</span>
                    <span className="font-bold text-red-700">25% margin</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-green-700">After FlowerCost Pro:</span>
                    <span className="font-bold text-green-700">45% margin</span>
                  </div>
                  <div className="text-center pt-4 border-t">
                    <div className="text-3xl font-bold text-green-600">+$15,600</div>
                    <div className="text-sm text-gray-600">Additional profit per year*</div>
                    <div className="text-xs text-gray-500 mt-2">*Based on $200/day average sales</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
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
                Works with any point-of-sale system. Simple copy/paste 
                integration - no technical setup required.
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
                Start protecting profits in under 10 minutes. Import your 
                products and begin training staff immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Florists Love FlowerCost Pro
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-green-50 rounded-xl p-8 border border-green-200">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-4 italic">
                "Finally, a solution that actually works with our existing POS! 
                My seasonal staff can now create arrangements without me worrying 
                about profit margins."
              </p>
              <div className="font-semibold text-gray-900">Sarah M.</div>
              <div className="text-sm text-gray-600">Bloom & Blossom Florist</div>
            </div>

            <div className="bg-blue-50 rounded-xl p-8 border border-blue-200">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-4 italic">
                "The staff training mode is genius. New employees understand 
                profitable pricing in minutes, not hours. Our margins improved 
                immediately."
              </p>
              <div className="font-semibold text-gray-900">Mike R.</div>
              <div className="text-sm text-gray-600">Garden Gate Flowers</div>
            </div>

            <div className="bg-purple-50 rounded-xl p-8 border border-purple-200">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-4 italic">
                "I wish I had this during last Valentine's Day! The profit 
                analytics showed me exactly which arrangements were losing money. 
                Never again."
              </p>
              <div className="font-semibold text-gray-900">Jennifer L.</div>
              <div className="text-sm text-gray-600">Petals & Stems</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              One price, all features. Cancel anytime.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-green-500 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-green-500 text-white px-6 py-2 rounded-full text-sm font-bold">
                  MOST POPULAR
                </div>
              </div>
              
              <div className="p-8 text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">FlowerCost Pro</h3>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900">$39</span>
                  <span className="text-xl text-gray-600">/month</span>
                </div>
                
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
                
                <p className="text-sm text-gray-500 mt-4">
                  No credit card required • Cancel anytime
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">
              <strong>ROI Guarantee:</strong> FlowerCost Pro pays for itself with just 1-2 prevented mistakes per month.
            </p>
            <div className="bg-green-100 border border-green-200 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-green-800 font-medium">
                💰 Average customer saves $15,600+ per year in recovered profit margins
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-green-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Stop Losing Money on Beautiful Arrangements
          </h2>
          <p className="text-xl text-green-100 mb-8 max-w-3xl mx-auto">
            Join hundreds of florists who've protected their profits with FlowerCost Pro. 
            Start your free trial today - no credit card required.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleGetStarted}
              className="bg-white text-green-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              Try Free Demo
            </button>
            <form onSubmit={handleEmailSignup} className="flex gap-2" name="email-signup-cta">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="px-4 py-4 border border-green-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-white bg-green-500 text-white placeholder-green-200"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Get Notified
              </button>
            </form>
          </div>
          
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
                  src="/image.png" 
                  alt="FlowerCost Pro" 
                  className="h-24 w-auto"
                />
              </div>
              <p className="text-gray-400 text-sm">
                Professional florist profit analysis and staff training software.
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