/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Building2, Sparkles, User, Mail, Lock, Phone, 
  Search, ShieldCheck, MapPin, SlidersHorizontal, ArrowRight,
  MessageSquare, Star, HelpCircle, ChevronDown, Award, Briefcase, RefreshCw, LogOut, CheckSquare, X
} from "lucide-react";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { db, handleFirestoreError, OperationType, getDocsWithTimeout } from "./lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { Property, UserRole, ChatRoom } from "./types";
import { DEMO_PROPERTIES } from "./data/demoProperties";
import { logPasswordResetRequest } from "./lib/notifications";

import PropertyCard from "./components/PropertyCard";
import PropertyDetailsModal from "./components/PropertyDetailsModal";
import LandlordDashboard from "./components/LandlordDashboard";
import TenantDashboard from "./components/TenantDashboard";
import AdminDashboard from "./components/AdminDashboard";
import AIRecommendations from "./components/AIRecommendations";
import RentalMapView from "./components/RentalMapView";
import { LuxeRentLogo } from "./components/LuxeRentLogo";

function AppContent() {
  const { profile, loading, loginGoogle, loginEmail, signupEmail, logout } = useAuth();
  
  // Navigation tabs: 'home' | 'search' | 'map' | 'recommend' | 'dashboard'
  const [activeTab, setActiveTab] = useState<"home" | "search" | "map" | "recommend" | "dashboard">("home");

  // Core properties container
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState<boolean>(true);

  // Search & Filters parameters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("Lagos");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterBeds, setFilterBeds] = useState<string>("all");
  const [filterMaxPrice, setFilterMaxPrice] = useState<number>(30000000); // Max 30M NGN
  const [showFiltersFolder, setShowFiltersFolder] = useState<boolean>(false);

  // Interactive listing popups
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Authentication Dialog overlay popups
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authFormTab, setAuthFormTab] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authName, setAuthName] = useState<string>("");
  const [authRole, setAuthRole] = useState<UserRole>("tenant");
  const [authPhone, setAuthPhone] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [passwordResetSentEmail, setPasswordResetSentEmail] = useState<string | null>(null);

  // Active Chatroom tracking
  const [tenantActiveChat, setTenantActiveChat] = useState<ChatRoom | null>(null);

  // Mobile drawer links state
  const [showMobileNavbar, setShowMobileNavbar] = useState<boolean>(false);

  // 1. Dual Mode Loader: Fetch from Firestore & Seeder Fallback
  const fetchAndRegisterProperties = async () => {
    setLoadingProperties(true);
    try {
      // 1. Try reading properties collection from cloud with a fast timeout
      const propCollectionRef = collection(db, "properties");
      const snap = await getDocsWithTimeout(propCollectionRef, 1800);
      
      const firestoreList: Property[] = [];
      snap.forEach(docSnap => {
        firestoreList.push(docSnap.data() as Property);
      });

      if (firestoreList.length > 0) {
        setProperties(firestoreList);
        localStorage.setItem("luxerent_demo_properties", JSON.stringify(firestoreList));
      } else {
        // Seeding database empty condition
        console.log("Firestore properties database empty, bootstrapping luxurious Nigeria seed listings...");
        for (const seed of DEMO_PROPERTIES) {
          const docRef = doc(db, "properties", seed.id);
          await setDoc(docRef, seed);
        }
        setProperties(DEMO_PROPERTIES);
        localStorage.setItem("luxerent_demo_properties", JSON.stringify(DEMO_PROPERTIES));
      }
    } catch (err) {
      console.warn("Could not read from Firestore Cloud, falling back to cached local storage sandbox listings:", err);
      
      // Fallback local persistence storage in SQLite/LocalStorage style for premium testing
      const localCached = localStorage.getItem("luxerent_demo_properties");
      if (localCached) {
        setProperties(JSON.parse(localCached));
      } else {
        localStorage.setItem("luxerent_demo_properties", JSON.stringify(DEMO_PROPERTIES));
        setProperties(DEMO_PROPERTIES);
      }
    } finally {
      setLoadingProperties(false);
    }
  };

  useEffect(() => {
    // Force Light theme exclusively across all workspace views
    const root = window.document.documentElement;
    root.classList.remove("dark");
    localStorage.setItem("luxerent_theme", "light");

    fetchAndRegisterProperties();
    
    // Seed default chats/inquiries for demo sandbox if empty
    if (!localStorage.getItem("luxerent_demo_chats")) {
      localStorage.setItem("luxerent_demo_chats", JSON.stringify([]));
    }
    if (!localStorage.getItem("luxerent_demo_inquiries")) {
      localStorage.setItem("luxerent_demo_inquiries", JSON.stringify([]));
    }
  }, []);

  // Secure Route Protection - redirect unauthorized users trying to access dashboard tab
  useEffect(() => {
    if (!loading && !profile && activeTab === "dashboard") {
      setActiveTab("home");
      setShowAuthModal(true);
    }
  }, [profile, loading, activeTab]);

  // Filter application pipeline
  const filteredProperties = properties.filter((p) => {
    // Vetting verification match: only show approved listings in directory searches (except for landlords/admins)
    if (!p.isApproved && profile?.role !== "admin" && profile?.id !== p.landlordId) return false;

    // Search query titles or description matches
    const matchesSearch = searchQuery === "" || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLocation = filterLocation === "all" || p.location.toLowerCase() === filterLocation.toLowerCase();
    const matchesType = filterType === "all" || p.propertyType.toLowerCase() === filterType.toLowerCase();
    const matchesBeds = filterBeds === "all" || p.bedrooms === parseInt(filterBeds);
    const matchesPrice = p.price <= filterMaxPrice;

    return matchesSearch && matchesLocation && matchesType && matchesBeds && matchesPrice;
  });

  // Form error mapper
  const getFriendlyAuthErrorMessage = (err: any): string => {
    const code = err?.code || "";
    if (code === "auth/wrong-password") {
       return "Incorrect password. Please try again.";
    }
    if (code === "auth/user-not-found") {
       return "User account not found. Please register first.";
    }
    if (code === "auth/invalid-credential") {
       return "Invalid email or password. Please verify your credentials.";
    }
    if (code === "auth/email-already-in-use") {
       return "The email address is already registered.";
    }
    if (code === "auth/invalid-email") {
       return "Please enter a valid email address.";
    }
    if (code === "auth/network-request-failed") {
       return "A network error occurred. Please check your internet connection.";
    }
    if (code === "auth/weak-password") {
       return "The password is too weak. Please choose a stronger password.";
    }
    return err?.message || "An unexpected credentials verification error occurred.";
  };

  // Handle signup/signin submit via real Firebase Authentication
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (authFormTab === "signin") {
        await loginEmail(authEmail, authPassword);
      } else {
        await signupEmail(authEmail, authPassword, authName, authRole, authPhone);
      }
      setShowAuthModal(false);
      setAuthPassword("");
      setActiveTab("dashboard"); // Automatically redirect after successful sign in
    } catch (err: any) {
      setAuthError(getFriendlyAuthErrorMessage(err));
    }
  };

  const handleLaunchChat = (chat: ChatRoom) => {
    setSelectedProperty(null); // Minimize current detail overlay
    setTenantActiveChat(chat);
    setActiveTab("dashboard");
    // Switch to chats sub-tab (internal tab switching coordinated by DOM toggle triggers)
    setTimeout(() => {
      const chatTabBtn = document.getElementById("tenant-tab-chats");
      chatTabBtn?.click();
    }, 150);
  };

  const formatNaira = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-neutral-800 dark:text-neutral-100 transition-colors duration-350 relative overflow-hidden">
      
      {/* Full screen immersive beach background image */}
      <div 
        className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat pointer-events-none z-[-20]"
        style={{ backgroundImage: "url('/src/assets/images/beach_bg_1779468812221.png')" }}
      />
      
      {/* High-fidelity architectural blur glass overlay */}
      <div className="fixed inset-0 w-full h-full bg-[#fcfbf9]/65 dark:bg-[#0b0914]/85 pointer-events-none z-[-10] backdrop-blur-[8px] transition-colors duration-350" />

      {/* Decorative architectural layout glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-purple-600/5 to-transparent blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-gradient-to-tr from-blue-600/5 to-transparent blur-[140px] pointer-events-none" />

      {/* 1. TOP GLASSMOPRHIC NAVIGATION BAR */}
      <nav className="sticky top-0 z-30 w-full border-b border-neutral-200/40 dark:border-purple-950/30 bg-white/80 dark:bg-[#0c0a15]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-18 flex items-center justify-between">
          
          {/* Logo brand */}
          <button 
            id="navbar-logo-btn"
            onClick={() => setActiveTab("home")}
            className="flex items-center gap-2 cursor-pointer relative group"
          >
            <LuxeRentLogo size="md" />
          </button>

          {/* Core directory tabs menu - desktop navigation */}
          <div className="hidden md:flex items-center gap-6 text-xs font-mono">
            <button
              id="nav-tab-home"
              onClick={() => setActiveTab("home")}
              className={`py-1.5 px-3.5 cursor-pointer rounded-lg transition-all duration-300 ${
                activeTab === "home" 
                  ? "bg-purple-500/10 text-brand-purple font-semibold border border-purple-500/20 shadow-premium" 
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-purple-300"
              }`}
            >
              Lobby Home
            </button>
            <button
              id="nav-tab-search"
              onClick={() => setActiveTab("search")}
              className={`py-1.5 px-3.5 cursor-pointer rounded-lg transition-all duration-300 ${
                activeTab === "search" 
                  ? "bg-purple-500/10 text-brand-purple font-semibold border border-purple-500/20 shadow-premium" 
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-purple-300"
              }`}
            >
              Apartment Search
            </button>
            <button
              id="nav-tab-map"
              onClick={() => setActiveTab("map")}
              className={`py-1.5 px-3.5 cursor-pointer rounded-lg transition-all duration-300 ${
                activeTab === "map" 
                  ? "bg-purple-500/10 text-brand-purple font-semibold border border-purple-500/20 shadow-premium" 
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-purple-300"
              }`}
            >
              Interactive Map
            </button>
            <button
              id="nav-tab-recommend"
              onClick={() => setActiveTab("recommend")}
              className={`py-1.5 px-3.5 cursor-pointer rounded-lg transition-all duration-300 flex items-center gap-1.5 ${
                activeTab === "recommend" 
                  ? "bg-purple-500/10 text-brand-purple font-semibold border border-purple-500/20 shadow-premium" 
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-purple-300"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI recommendations
            </button>
            <button
              id="nav-tab-dashboard"
              onClick={() => {
                if (profile) setActiveTab("dashboard");
                else setShowAuthModal(true);
              }}
              className={`py-1.5 px-3.5 cursor-pointer rounded-lg transition-all duration-300 uppercase ${
                activeTab === "dashboard" 
                  ? "bg-purple-500/10 text-brand-purple font-semibold border border-purple-500/20 shadow-premium" 
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-purple-300"
              }`}
            >
              {profile ? `${profile.role} board` : "Join / Portal"}
            </button>
          </div>

          {/* Action Hub tools */}
          <div className="flex items-center gap-3">

            {/* Dynamic Authenticated Profile trigger view */}
            {profile ? (
              <div className="flex items-center gap-2.5">
                <button
                  id="nav-avatar-btn-dash"
                  onClick={() => setActiveTab("dashboard")}
                  className="w-8.5 h-8.5 rounded-full overflow-hidden border border-purple-500/35 hover:scale-105 duration-250 cursor-pointer shadow-premium"
                >
                  <img src={profile.avatarUrl} alt="Avatar profile representation" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </button>
                <button
                  id="nav-logout-btn"
                  onClick={logout}
                  className="p-1.5 text-neutral-450 dark:text-neutral-300 hover:text-rose-450 cursor-pointer hidden sm:block transition-all focus:outline-none"
                  title="Sign out Session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="nav-signin-prompt"
                onClick={() => setShowAuthModal(true)}
                className="py-1.5 sm:py-2 px-4 rounded-xl font-mono text-[10px] sm:text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white cursor-pointer transition glow-purple"
              >
                Sign In
              </button>
            )}

            {/* Mobile hamburger switcher toggle button */}
            <button
              id="mobile-drawer-toggle"
              onClick={() => setShowMobileNavbar(!showMobileNavbar)}
              className="p-2 text-neutral-500 dark:text-purple-300 md:hidden cursor-pointer"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

        </div>
      </nav>

      {/* MOBILE NAVBAR DRAWER LINKS */}
      <AnimatePresence>
        {showMobileNavbar && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden w-full bg-white dark:bg-[#090710] border-b border-neutral-250 dark:border-purple-950/40 px-4 py-4 space-y-2 z-20 font-mono text-xs"
          >
            <button
              id="mobile-tab-home"
              onClick={() => { setActiveTab("home"); setShowMobileNavbar(false); }}
              className="w-full text-left py-2.5 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-purple-950/30 text-neutral-700 dark:text-neutral-200"
            >
              Lobby Home
            </button>
            <button
              id="mobile-tab-search"
              onClick={() => { setActiveTab("search"); setShowMobileNavbar(false); }}
              className="w-full text-left py-2.5 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-purple-950/30 text-neutral-700 dark:text-neutral-200"
            >
              Apartment Search
            </button>
            <button
              id="mobile-tab-map"
              onClick={() => { setActiveTab("map"); setShowMobileNavbar(false); }}
              className="w-full text-left py-2.5 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-purple-950/30 text-neutral-700 dark:text-neutral-200"
            >
              Interactive Map
            </button>
            <button
              id="mobile-tab-reco"
              onClick={() => { setActiveTab("recommend"); setShowMobileNavbar(false); }}
              className="w-full text-left py-2.5 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-purple-950/30 text-neutral-700 dark:text-neutral-200 flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI recommendations
            </button>
            {profile ? (
              <button
                id="mobile-tab-dash"
                onClick={() => { setActiveTab("dashboard"); setShowMobileNavbar(false); }}
                className="w-full text-left py-2.5 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-purple-950/30 text-neutral-750 dark:text-neutral-100 uppercase font-bold"
              >
                {profile.role} dashboard
              </button>
            ) : (
              <button
                id="mobile-tab-signin"
                onClick={() => { setShowAuthModal(true); setShowMobileNavbar(false); }}
                className="w-full text-left py-2.5 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-purple-950/30 text-brand-purple font-bold"
              >
                Sign In to Portal
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. DYNAMIC CONTENT VIEWER MAIN PANEL */}
      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 w-full">
        
        {/* HOMEPAGE VIEW LOBBY */}
        {activeTab === "home" && (
          <div className="space-y-16">
            
            {/* HERO SECTION DECK */}
            <div className="relative rounded-3xl overflow-hidden py-20 px-6 md:p-20 text-center space-y-8 bg-gradient-to-br from-white/95 to-neutral-50/90 dark:from-[#0e0c1f]/95 dark:to-[#090714]/90 border border-neutral-200/40 dark:border-purple-950/20 shadow-premium">
              
              {/* Backglow decorative blooms */}
              <div className="absolute top-[-10%] left-[20%] w-72 h-72 rounded-full bg-purple-500/10 blur-[130px] pointer-events-none" />
              <div className="absolute bottom-[-10%] right-[20%] w-72 h-72 rounded-full bg-blue-500/10 blur-[130px] pointer-events-none" />

              <div className="inline-flex px-4 py-1.5 items-center gap-2 rounded-full text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest bg-purple-500/10 dark:bg-purple-950/40 border border-purple-400/20 text-purple-600 dark:text-purple-300 mx-auto shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Next-Gen AI Rental Ecosystem
              </div>

              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight font-display text-neutral-900 dark:text-white max-w-3xl mx-auto leading-tight">
                Premium Long-Term Rentals <br/> Across Lagos State's Finest Zip Codes
              </h1>

              <p className="text-xs sm:text-sm text-neutral-550 dark:text-neutral-450 max-w-xl mx-auto leading-relaxed font-sans">
                Unlock high-end smart penthouses, premium villas, and modern duplexes in Lekki Phase 1, Ikoyi, Victoria Island, and Banana Island. Run drone-staged AI virtual walkthroughs instantly.
              </p>

              {/* Quick Search trigger action area */}
              <div className="max-w-2xl mx-auto bg-white/90 dark:bg-[#07050d]/80 p-2.5 rounded-2xl border border-neutral-200/50 dark:border-purple-800/25 shadow-premium flex flex-col sm:flex-row gap-2 backdrop-blur-md">
                <div className="flex-1 flex items-center gap-3 px-3.5 py-2 text-xs">
                  <Search className="w-4 h-4 text-purple-500/70" />
                  <input
                    id="hero-quick-search"
                    type="text"
                    placeholder="Search e.g. Ikoyi, Penthouse, Duplex, smart backup..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") setActiveTab("search"); }}
                    className="bg-transparent w-full text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                  />
                </div>
                
                <button
                  id="hero-quick-search-submit"
                  onClick={() => setActiveTab("search")}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-mono text-xs font-bold tracking-widest flex items-center justify-center gap-2 cursor-pointer glow-purple transition-all duration-300"
                >
                  Query Listings <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            {/* Incremental visual stats tickers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { count: "₦140M+", label: "Lease Volume managed", color: "from-purple-550 via-purple-500 to-indigo-500" },
                { count: "24/7", label: "Solar grid Redundancy", color: "from-emerald-500 via-emerald-450 to-teal-500" },
                { count: "98.9%", label: "Vibe Match accuracy", color: "from-blue-500 via-indigo-500 to-purple-500" },
                { count: "2.4K+", label: "Virtual walkthroughs", color: "from-amber-550 via-amber-500 to-orange-500" }
              ].map((metric, i) => (
                <div key={i} className="p-6 rounded-2xl bg-white/60 dark:bg-purple-950/5 border border-neutral-200/40 dark:border-purple-950/25 shadow-premium backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-purple-500/30">
                  <h4 className={`text-xl md:text-2xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r ${metric.color}`}>
                    {metric.count}
                  </h4>
                  <p className="text-[9px] text-neutral-450 dark:text-neutral-400 font-mono uppercase tracking-widest mt-2 font-semibold">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>

            {/* FEATURED APARTMENT GRID OVERVIEW */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-baseline justify-between gap-1">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold font-display text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">
                    Elite Apartments Available
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Verified real estate lease units located specifically in prime districts of Nigeria.
                  </p>
                </div>

                <button
                  id="lobby-view-all-listings"
                  onClick={() => setActiveTab("search")}
                  className="text-xs font-mono font-bold text-brand-purple hover:underline cursor-pointer flex items-center gap-1"
                >
                  Browse all listings <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {loadingProperties ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-neutral-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
                  <p className="text-xs font-mono">Syncing premium listings...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {properties.slice(0, 3).map((prop, idx) => (
                    <PropertyCard
                      key={prop.id}
                      property={prop}
                      onOpenDetails={(p) => setSelectedProperty(p)}
                      index={idx}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* TESTIMONIAL GLASS CARD SLIDES */}
            <div className="py-10 border-t border-neutral-200 dark:border-purple-950/40 text-center space-y-6">
              <h3 className="text-base font-bold font-display uppercase tracking-widest text-neutral-400">Tenant Reviews</h3>
              <div className="max-w-2xl mx-auto p-6 md:p-8 rounded-2xl glass-card border border-neutral-200 dark:border-purple-900/20 italic text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed font-sans relative">
                <Sparkles className="w-8 h-8 text-purple-500/20 absolute -top-4 left-4" />
                "Securing my Ikoyi penthouse on LuxeRent took less than 4 hours! The drone-staged simulated Tour gave me absolute perspective on spacing before my inspection flight arrived. Outstanding layout, fully professional and completely streamlined!"
                <div className="mt-4 text-xs font-mono font-bold text-neutral-500 uppercase not-italic">
                  - Dr. Chinedu Okafor (Vanguard Tech Ventures)
                </div>
              </div>
            </div>

          </div>
        )}

        {/* SEARCH & FILTERS DIRECTORY SCREEN */}
        {activeTab === "search" && (
          <div className="space-y-6">
            
            {/* Search inputs HUD banner */}
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-purple-950/5 border border-neutral-200/40 dark:border-purple-950/20 flex flex-col md:flex-row gap-3 items-center shadow-premium backdrop-blur-md">
              
              <div className="w-full md:flex-1 flex items-center gap-3 bg-neutral-100/50 dark:bg-[#07050d]/40 border border-neutral-200/50 dark:border-purple-900/20 p-3 rounded-xl text-xs transition-all focus-within:ring-1 focus-within:ring-purple-500/50">
                <Search className="w-4 h-4 text-purple-550" />
                <input
                  id="dir-search-input"
                  type="text"
                  placeholder="Query names, zip addresses, features (e.g. boys quarters, cinema)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent w-full text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-450 focus:outline-none"
                />
              </div>

              {/* Show hide filters dropdown panel */}
              <button
                id="dir-toggle-folders"
                onClick={() => setShowFiltersFolder(!showFiltersFolder)}
                className="w-full md:w-auto px-5 py-3 bg-white dark:bg-purple-950/20 hover:bg-neutral-50 dark:hover:bg-purple-950/35 border border-neutral-200 dark:border-purple-900/30 rounded-xl text-xs font-mono font-bold cursor-pointer flex items-center justify-center gap-2 text-neutral-600 dark:text-purple-300 transition-all duration-300 shadow-premium active:scale-95 select-none"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-555" /> Filter Parameters {showFiltersFolder ? <ChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform duration-300" /> : <ChevronDown className="w-3.5 h-3.5 transition-transform duration-300" />}
              </button>
            </div>

            {/* EXPANDABLE FILTER CABINET */}
            <AnimatePresence>
              {showFiltersFolder && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-6 rounded-2xl bg-white dark:bg-[#07050e] border border-neutral-250 dark:border-purple-900/20 grid grid-cols-1 sm:grid-cols-4 gap-4 z-10"
                >
                  
                  {/* Location selective filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-neutral-400 uppercase">State Location</label>
                    <select
                      id="filter-location"
                      value={filterLocation}
                      onChange={(e) => setFilterLocation(e.target.value)}
                      className="w-full bg-neutral-55 dark:bg-purple-950/20 border border-neutral-200/60 dark:border-purple-900/30 rounded-lg px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                    >
                      <option value="Lagos">Lagos State only</option>
                    </select>
                  </div>

                  {/* Property type filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-neutral-400 uppercase">Property Layout</label>
                    <select
                      id="filter-type"
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full bg-neutral-55 dark:bg-purple-950/20 border border-neutral-200/60 dark:border-purple-900/30 rounded-lg px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                    >
                      <option value="all">All Layouts</option>
                      <option value="apartment">Apartment</option>
                      <option value="penthouse">Penthouse</option>
                      <option value="duplex">Duplex</option>
                      <option value="villa">Diplomatic Villa</option>
                      <option value="studio">Studio</option>
                    </select>
                  </div>

                  {/* Bed Rooms Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-neutral-400 uppercase">Bedrooms</label>
                    <select
                      id="filter-beds"
                      value={filterBeds}
                      onChange={(e) => setFilterBeds(e.target.value)}
                      className="w-full bg-neutral-55 dark:bg-purple-950/20 border border-neutral-200/60 dark:border-purple-900/30 rounded-lg px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                    >
                      <option value="all">Any Room Size</option>
                      <option value="1">1 Bedroom</option>
                      <option value="2">2 Bedrooms</option>
                      <option value="3">3 Bedrooms</option>
                      <option value="4">4 Bedrooms</option>
                      <option value="5">5 Bedrooms</option>
                      <option value="6">6 Bedrooms</option>
                    </select>
                  </div>

                  {/* Yearly Budget Range Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-neutral-400 uppercase">
                      <span>Rent budget cap</span>
                      <span className="text-emerald-400 font-bold">{formatNaira(filterMaxPrice)}</span>
                    </div>
                    <input
                      id="filter-price-slider"
                      type="range"
                      min={1000000}
                      max={30000000}
                      step={500000}
                      value={filterMaxPrice}
                      onChange={(e) => setFilterMaxPrice(parseInt(e.target.value))}
                      className="w-full accent-brand-purple"
                    />
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

            {/* SEARCH LISTINGS RESULTS DISPLAY */}
            <div className="space-y-4">
              <h3 className="font-display text-base font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">
                Listings search matches ({filteredProperties.length} Units Found)
              </h3>

              {filteredProperties.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border-2 border-dashed border-neutral-250 dark:border-purple-950/40 text-neutral-400 flex flex-col items-center justify-center gap-2">
                  <p className="font-semibold text-sm">No rental matches fit your chosen filters</p>
                  <button
                    id="reset-filters"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterLocation("all");
                      setFilterType("all");
                      setFilterBeds("all");
                      setFilterMaxPrice(30000000);
                    }}
                    className="mt-2 px-3.5 py-2 cursor-pointer bg-neutral-100 hover:bg-neutral-200 dark:bg-purple-950/15 text-xs text-brand-purple border border-neutral-300 dark:border-purple-900/30 font-mono tracking-wide rounded-lg transition"
                  >
                    Reset Filter Parameters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProperties.map((prop, idx) => (
                    <PropertyCard
                      key={prop.id}
                      property={prop}
                      onOpenDetails={(p) => setSelectedProperty(p)}
                      index={idx}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* INTERACTIVE LEASE AND GPS RENTAL MAP */}
        {activeTab === "map" && (
          <RentalMapView
            properties={properties}
            onOpenDetails={(p) => setSelectedProperty(p)}
            onInitiateChat={(p) => {
              setSelectedProperty(p);
            }}
          />
        )}

        {/* AI RECOMEMNDATIONS MATCHES */}
        {activeTab === "recommend" && (
          <AIRecommendations
            properties={properties}
            onOpenDetails={(p) => setSelectedProperty(p)}
          />
        )}

        {/* SECURE DASHBOARDS DIRECTORY */}
        {activeTab === "dashboard" && profile && (
          <div className="space-y-6">
            
            {/* Logged profiles headers bar */}
            <div className="p-5 rounded-2xl bg-white dark:bg-purple-950/10 border border-neutral-200/50 dark:border-purple-900/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
              
              <div className="flex items-center gap-3">
                <img src={profile.avatarUrl} referrerPolicy="no-referrer" alt="Roster avatar check" className="w-12 h-12 rounded-full border border-purple-500/50" />
                <div>
                  <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-100">{profile.name}</h3>
                  <p className="text-xs text-neutral-400 capitalize tracking-wider font-mono">Profile Level: <span className="text-purple-400 font-bold">{profile.role}</span></p>
                </div>
              </div>

              {/* Sub headers action logouts */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-3 py-1 bg-purple-500/10 border border-purple-400/20 text-purple-300 rounded-lg">
                  Cloud Portal Mode Enabled
                </span>
                
                <button
                  id="dashboard-header-logout"
                  onClick={logout}
                  className="px-4 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-purple-950/20 border border-neutral-350 dark:border-purple-900/25 text-rose-400 text-xs font-bold font-mono tracking-wider rounded-lg cursor-pointer transition flex items-center gap-1.5"
                >
                  Sign Out <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            {/* Resolve Dashboard based on role */}
            {profile.role === "landlord" && (
              <LandlordDashboard
                properties={properties}
                onRefreshProperties={fetchAndRegisterProperties}
                onOpenDetails={(p) => setSelectedProperty(p)}
              />
            )}

            {profile.role === "tenant" && (
              <TenantDashboard
                properties={properties}
                onOpenDetails={(p) => setSelectedProperty(p)}
                activeChatRoom={tenantActiveChat}
                setActiveChatRoom={setTenantActiveChat}
              />
            )}

            {profile.role === "admin" && (
              <AdminDashboard
                properties={properties}
                onRefreshProperties={fetchAndRegisterProperties}
                onOpenDetails={(p) => setSelectedProperty(p)}
              />
            )}

          </div>
        )}

      </main>

      {/* 3. CORE AUTHENTICATION REGISTER MODAL */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl p-6 md:p-8 space-y-6 border border-neutral-202/60 dark:border-purple-900/30 text-neutral-800 dark:text-neutral-100"
            >
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-neutral-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r from-purple-400 to-blue-400">
                  {authFormTab === "signin" ? "Login to LuxeRent" : "Become Registered Member"}
                </h3>
                <button
                  id="auth-modal-close"
                  onClick={() => { setShowAuthModal(false); setAuthError(null); }}
                  className="p-1 rounded-full cursor-pointer hover:bg-neutral-100 dark:hover:bg-purple-950/30 text-neutral-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Toggle panels */}
              <div className="grid grid-cols-2 gap-2 bg-neutral-100 dark:bg-purple-950/20 p-1 rounded-xl border border-neutral-200/50 dark:border-purple-900/20 text-xs font-mono">
                <button
                  id="tab-signin-trigger"
                  type="button"
                  onClick={() => { setAuthFormTab("signin"); setAuthError(null); }}
                  className={`py-2 text-center rounded-lg cursor-pointer transition ${
                    authFormTab === "signin" ? "bg-white dark:bg-purple-900 text-brand-purple font-bold" : "text-neutral-500"
                  }`}
                >
                  Sign In
                </button>
                <button
                  id="tab-signup-trigger"
                  type="button"
                  onClick={() => { setAuthFormTab("signup"); setAuthError(null); }}
                  className={`py-2 text-center rounded-lg cursor-pointer transition ${
                    authFormTab === "signup" ? "bg-white dark:bg-purple-900 text-brand-purple font-bold" : "text-neutral-500"
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Feed errors */}
              {authError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-400/30 rounded-xl text-rose-400 text-xs font-mono space-y-2.5">
                  <div className="font-bold flex items-center gap-1">
                    <span className="text-red-500">⚠</span> System Notification
                  </div>
                  <p className="leading-relaxed text-left text-[11px] whitespace-pre-line">{authError}</p>
                  
                  {/* Proactive Help for Site Not Found Error */}
                  <div className="p-2 bg-amber-500/10 border border-amber-400/20 rounded-lg text-amber-400 text-[10px] space-y-1 text-left leading-normal">
                    <span className="font-bold block text-amber-500">💡 Seeing "Site Not Found" inside the Popup?</span>
                    <p>
                      This happens because **Firebase Hosting** is not yet enabled for project <code className="bg-neutral-800 px-1 rounded">luxerent-a8408</code>. To activate it:
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 mt-1 font-mono">
                      <li>Open the Firebase Console.</li>
                      <li>Go to <strong className="text-white">Build &gt; Hosting</strong>.</li>
                      <li>Click the <strong className="text-white">"Get Started"</strong> button.</li>
                    </ol>
                    <p className="text-[9px] text-neutral-400 mt-1">
                      No deployments are required; clicking "Get Started" registers the URL redirects instantly!
                    </p>
                  </div>
                  
                  <div className="pt-2.5 border-t border-rose-400/20 flex flex-col gap-1.5">
                    {/* Open in new tab button for pop-ups / iframe sandbox blocks */}
                    {(authError.includes("blocked or interrupted") || authError.includes("unauthorized") || authError.includes("failed") || authError.includes("blocked")) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.open(window.location.href, "_blank");
                          }
                        }}
                        className="w-full text-center py-1.5 bg-brand-purple text-white hover:bg-opacity-90 font-bold rounded-lg cursor-pointer transition text-[11px]"
                      >
                        Open App in a New Tab ↗
                      </button>
                    )}

                    {/* Go to Firebase Console if configuration issue */}
                    {(authError.includes("Firebase Console") || authError.includes("Authorized domains") || authError.includes("domain is not authorized")) && (
                      <a 
                        href="https://console.firebase.google.com/project/luxerent-a8408/authentication" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full text-center py-1.5 bg-rose-500/20 hover:bg-rose-500/35 text-white font-bold rounded-lg cursor-pointer transition text-[11px]"
                      >
                        Go to Firebase Console ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Google OAuth popup launcher trigger */}
              <button
                id="google-popup-trigger-submit"
                onClick={async () => {
                  setAuthError(null);
                  try {
                    await loginGoogle();
                    setShowAuthModal(false);
                  } catch (err: any) {
                    const errMsg = err?.message || String(err);
                    if (errMsg.includes("auth/configuration-not-found")) {
                      setAuthError(
                        "Google Authentication has not been configured yet for this Firebase project.\n\nTo resolve this:\n1. Open console.firebase.google.com\n2. Select project 'luxerent-a8408'\n3. Go to Build > Authentication > Sign-in method\n4. Add 'Google' provider under authorized sign-in techniques\n5. Save, refresh this page, and retry."
                      );
                    } else if (errMsg.includes("auth/unauthorized-domain") || errMsg.includes("unauthorized-domain")) {
                      const host = typeof window !== "undefined" ? window.location.hostname : "your app's domain";
                      setAuthError(
                        `This domain is not authorized in your Firebase Project.\n\nTo resolve this:\n1. Open console.firebase.google.com\n2. Select project 'luxerent-a8408'\n3. Go to Build > Authentication > Settings\n4. Click on the 'Authorized domains' tab\n5. Add the following domain: '${host}'\n6. Save, refresh this page, and try logging in again.`
                      );
                    } else if (
                      errMsg.includes("cancelled-popup-request") || 
                      errMsg.includes("popup-blocked") || 
                      errMsg.includes("Pending promise") || 
                      errMsg.includes("internal assertion") ||
                      errMsg.includes("cancelled")
                    ) {
                      setAuthError(
                        "Firebase Google Auth was blocked or interrupted.\n\nBecause this preview application runs inside a sandboxed Iframe, most browsers strictly block cookies and Auth popups due to cross-origin policies (third-party cookie partitioning).\n\nTo login securely using Google:\n1. Open this app in a separate, dedicated browser tab using the button below.\n2. In the new tab, Google Auth will bypass iframe blocks & work perfectly!"
                      );
                    } else {
                      setAuthError(`Google Auth failed: ${errMsg}`);
                    }
                  }
                }}
                className="w-full py-2.5 rounded-xl border border-neutral-300/40 dark:border-purple-900/30 bg-neutral-51 dark:bg-purple-955/20 hover:bg-neutral-100 cursor-pointer flex items-center justify-center gap-2 text-xs font-mono font-bold transition"
              >
                <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google Popup
              </button>

              <div className="relative flex items-center justify-center text-[10px] font-mono text-neutral-400 uppercase tracking-widest leading-none">
                <span className="absolute inset-x-0 h-px bg-neutral-200 dark:bg-purple-950/40" />
                <span className="relative bg-white dark:bg-zinc-950 px-3">or credentials matching</span>
              </div>

              {/* Form submit fields */}
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                
                {authFormTab === "signup" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-neutral-400">Your Full Name</label>
                      <input
                        id="reg-fullname"
                        type="text"
                        required
                        placeholder="e.g. Kolawole Benson"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-[#110e1a]/40 border border-neutral-300/40 dark:border-purple-900/30 rounded-xl px-3 py-2 text-xs text-neutral-800 dark:text-neutral-100 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-mono text-neutral-400">Membership Role</label>
                      <select
                        id="reg-role"
                        value={authRole}
                        onChange={(e) => setAuthRole(e.target.value as UserRole)}
                        className="w-full bg-neutral-100 dark:bg-[#110e1a]/40 border border-neutral-300/40 dark:border-purple-900/30 rounded-xl px-3 py-2 text-xs text-neutral-800 dark:text-neutral-100 focus:outline-none"
                      >
                        <option value="tenant">Resident Tenant (Leaser)</option>
                        <option value="landlord">Property Landlord (Owner/Agent)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-mono text-neutral-400">Phone Number (Optional)</label>
                      <input
                        id="reg-phone"
                        type="tel"
                        placeholder="e.g. +234 81 2345 6789"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-[#110e1a]/40 border border-neutral-300/40 dark:border-purple-900/30 rounded-xl px-3 py-2 text-xs text-neutral-800 dark:text-neutral-100 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-mono text-neutral-400">Email Address</label>
                  <input
                    id="auth-email-input"
                    type="email"
                    required
                    placeholder="e.g. kola.benson@gmail.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-[#110e1a]/40 border border-neutral-300/40 dark:border-purple-900/30 rounded-xl px-3 py-2 text-xs text-neutral-800 dark:text-neutral-100 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-neutral-400">Account Password</label>
                  <input
                    id="auth-pass-input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-[#110e1a]/40 border border-neutral-300/40 dark:border-purple-900/30 rounded-xl px-3 py-2 text-xs text-neutral-800 dark:text-neutral-100 focus:outline-none"
                  />
                </div>

                {authFormTab === "signin" && (
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <button
                      id="sim-forgot-password-btn"
                      type="button"
                      onClick={() => {
                        if (!authEmail) {
                          setAuthError("Please fill in your EMail Address above first to recover.");
                          return;
                        }
                        logPasswordResetRequest(authEmail, true);
                        setPasswordResetSentEmail(authEmail);
                        setAuthError(null);
                        setTimeout(() => setPasswordResetSentEmail(null), 5000);
                      }}
                      className="text-indigo-400 hover:underline cursor-pointer"
                    >
                      Forgot Password? (Simulate recovery)
                    </button>
                  </div>
                )}

                {passwordResetSentEmail && (
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono leading-relaxed">
                    ✓ Simulated reset trigger fired for {passwordResetSentEmail}. Site Admin notified!
                  </div>
                )}

                <button
                  id="auth-submit-btn"
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-mono text-xs font-bold tracking-widest cursor-pointer transition shadow-md glow-purple"
                >
                  {authFormTab === "signin" ? "LOG IN TO LUXERENT" : "JOIN PLATFORM"}
                </button>

              </form>

              <p className="text-[10px] text-neutral-400 text-center leading-normal">
                By interacting, you agree to our next-gen verified lease terms. Secure 256-bit cryptography applied automatically.
              </p>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. VERIFIED DETAILED LISTINGS BOTTOM DIALOG OVERLAY */}
      <AnimatePresence>
        {selectedProperty && (
          <PropertyDetailsModal
            property={selectedProperty}
            onClose={() => setSelectedProperty(null)}
            onOpenChat={(chat) => handleLaunchChat(chat)}
          />
        )}
      </AnimatePresence>

      {/* 5. FOOTER */}
      <footer className="py-8 bg-neutral-100 dark:bg-[#06040a] border-t border-neutral-200/40 dark:border-purple-950/40 text-center font-mono text-[10px] text-neutral-400 space-y-2 mt-auto">
        <div className="flex justify-center gap-4">
          <button id="footer-lobby" onClick={() => setActiveTab("home")} className="hover:text-purple-300 cursor-pointer">Lobby Home</button>
          <span>•</span>
          <button id="footer-search" onClick={() => setActiveTab("search")} className="hover:text-purple-300 cursor-pointer">Apartments</button>
          <span>•</span>
          <button id="footer-reco" onClick={() => setActiveTab("recommend")} className="hover:text-purple-300 cursor-pointer">AI Matcher</button>
        </div>
        <p>© {new Date().getFullYear()} LuxeRent Nigeria. High-fidelity architectural listings. All rights reserved.</p>
        <p className="text-[9px] text-[#4d4076]/70">Admin portal keys configured. Zero trust security policies active on Firestore.</p>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
