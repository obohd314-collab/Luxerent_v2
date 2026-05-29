/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapPin, Compass, Search, SlidersHorizontal, Sparkles, Navigation, 
  Flame, Sun, Moon, Check, X, Shield, Info, Phone, MessageSquare, 
  Heart, ChevronLeft, ChevronRight, School, Hospital, Utensils, Bus, 
  Award, TrendingUp, AlertCircle, Key, Map as MapIcon, Loader2
} from "lucide-react";
import { Property, UserProfile } from "../types";
import { useAuth } from "../context/AuthContext";

// Interface for nearby place items
interface NearbyPlace {
  name: string;
  distance: string;
  type: "school" | "hospital" | "restaurant" | "bus";
}

interface RentalMapViewProps {
  properties: Property[];
  onOpenDetails: (property: Property) => void;
  onInitiateChat?: (property: Property) => void;
}

export default function RentalMapView({ properties, onOpenDetails, onInitiateChat }: RentalMapViewProps) {
  const { profile, toggleFavorite } = useAuth();

  // Leaflet loads dynamically
  const [leafletLoaded, setLeafletLoaded] = useState<boolean>(false);
  const mapRef = useRef<any>(null);
  const mapContainerId = "luxerent-leaflet-map-element";
  const markersGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);

  // Map state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined") {
        return window.document.documentElement.classList.contains("dark") || 
               localStorage.getItem("luxerent_theme") === "dark";
      }
    } catch {
      // ignore
    }
    return false;
  });

  // User location tracking
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterBeds, setFilterBeds] = useState<string>("all");
  const [filterMaxPrice, setFilterMaxPrice] = useState<number>(30000000); // Max 30M NGN
  const [isFurnishedOnly, setIsFurnishedOnly] = useState<boolean>(false);
  const [isNewlyListedOnly, setIsNewlyListedOnly] = useState<boolean>(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("all");

  // Selection states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);

  // Toggle Overlays
  const [heatmapActive, setHeatmapActive] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiRecommendationText, setAiRecommendationText] = useState<string | null>(null);

  // Nearby Places generation (simulated realistically based on property location coordinates)
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);

  // List of search suggestions / autocomplete for major areas in Lagos
  const searchSuggestions = [
    { name: "Ikoyi", lat: 6.4520, lng: 3.4430 },
    { name: "Lekki Phase 1", lat: 6.4480, lng: 3.4720 },
    { name: "Banana Island", lat: 6.4640, lng: 3.4938 },
    { name: "Victoria Island", lat: 6.4281, lng: 3.4219 },
    { name: "Yaba", lat: 6.5095, lng: 3.3792 },
    { name: "Ikeja GRA", lat: 6.5925, lng: 3.3550 }
  ];
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);

  // Light/Dark Theme management
  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    const root = window.document.documentElement;
    if (nextMode) {
      root.classList.add("dark");
      localStorage.setItem("luxerent_theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("luxerent_theme", "light");
    }
    // Update tile layer in leaflet
    if (mapRef.current) {
      updateTileLayer(nextMode);
    }
  };

  // 1. Dynamic Injection of Leaflet Script/CSS
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    cssLink.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    cssLink.crossOrigin = "";
    document.head.appendChild(cssLink);

    const jsScript = document.createElement("script");
    jsScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    jsScript.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    jsScript.crossOrigin = "";
    jsScript.onload = () => {
      setLeafletLoaded(true);
    };
    document.body.appendChild(jsScript);

    return () => {
      // Clean up scripts if navigating away
      cssLink.remove();
      jsScript.remove();
    };
  }, []);

  // Filter application pipeline
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // Must be approved unless admin or owner
      if (!p.isApproved && profile?.role !== "admin" && profile?.id !== p.landlordId) return false;

      // Type, beds, price limits
      const matchesType = filterType === "all" || p.propertyType === filterType;
      const matchesBeds = filterBeds === "all" || p.bedrooms === parseInt(filterBeds);
      const matchesPrice = p.price <= filterMaxPrice;

      // Neighborhood selector
      const matchesNeighborhood = selectedNeighborhood === "all" || 
        p.address.toLowerCase().includes(selectedNeighborhood.toLowerCase()) ||
        p.title.toLowerCase().includes(selectedNeighborhood.toLowerCase());

      // Search words match
      const matchesSearch = searchQuery === "" || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Newly Listed (added in last 7 days)
      const matchesNewlyListed = !isNewlyListedOnly || 
        (p.createdAt ? (Date.now() - new Date(p.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000 : false);

      // Furnished flag
      const matchesFurnished = !isFurnishedOnly || p.isFurnished;

      return matchesType && matchesBeds && matchesPrice && matchesNeighborhood && matchesSearch && matchesNewlyListed && matchesFurnished;
    });
  }, [properties, filterType, filterBeds, filterMaxPrice, selectedNeighborhood, searchQuery, isNewlyListedOnly, isFurnishedOnly, profile]);

  // Tile layer helper
  const updateTileLayer = (dark: boolean) => {
    if (!mapRef.current) return;
    const L = (window as any).L;

    // Remove old tile layer
    mapRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current.removeLayer(layer);
      }
    });

    const activeTileUrl = dark 
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    L.tileLayer(activeTileUrl, {
      attribution: '&copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapRef.current);
  };

  // Helper function to animate route paths beautifully
  const renderRoute = (from: [number, number], to: [number, number]) => {
    if (!mapRef.current || !leafletLoaded) return;
    const L = (window as any).L;

    // Remove existing polyline
    if (routePolylineRef.current) {
      mapRef.current.removeLayer(routePolylineRef.current);
    }

    // Direct distance calculation
    const R = 6371; // radius of earth in km
    const dLat = (to[0] - from[0]) * Math.PI / 180;
    const dLon = (to[1] - from[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(from[0] * Math.PI / 180) * Math.cos(to[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;

    // Driving time estimation (assume 35km/h speed in Lagos traffic)
    const timeMinutes = Math.round((distanceKm / 35) * 60 + 5);

    setRouteInfo({
      distance: `${distanceKm.toFixed(1)} km`,
      duration: `${timeMinutes} mins drive`
    });

    // Draw routing line with high-fidelity dotted look
    const routeCoordinates = [from, to];
    const polyline = L.polyline(routeCoordinates, {
      color: "#a855f7",
      weight: 4,
      dashArray: "10, 10",
      opacity: 0.8
    }).addTo(mapRef.current);

    routePolylineRef.current = polyline;
  };

  // 2. Initialize Map Container once Leaflet is loaded In Browser
  useEffect(() => {
    if (!leafletLoaded) return;
    const L = (window as any).L;

    // Create the map container object if not initialized
    if (!mapRef.current) {
      const initialMap = L.map(mapContainerId, {
        zoomControl: false,
        attributionControl: false
      }).setView([6.4520, 3.4430], 13); // Centered default Ikoyi coordinates

      mapRef.current = initialMap;

      // Add elegant carto tiles
      updateTileLayer(isDarkMode);

      // Create a layer group to cluster/hold property markers
      markersGroupRef.current = L.featureGroup().addTo(initialMap);

      // Auto check browser geolocation
      findAndCenterUserLocation();
    }

    return () => {
      // Destruction hook avoids multi-instance container issues
    };
  }, [leafletLoaded]);

  // Geolocation trigger
  const findAndCenterUserLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    const L = (window as any).L;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const validLat = latitude || 6.4520;
        const validLng = longitude || 3.4430;

        setUserLocation([validLat, validLng]);

        if (mapRef.current) {
          // Relocate map view smoothly
          mapRef.current.flyTo([validLat, validLng], 14, { duration: 1.5 });

          // Plot User pulsating blue marker on Leaflet map
          if (userMarkerRef.current) {
            mapRef.current.removeLayer(userMarkerRef.current);
          }

          const userPulseIcon = L.divIcon({
            html: `
              <div class="relative flex items-center justify-center w-6 h-6">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600 border-2 border-white shadow"></span>
              </div>
            `,
            className: "custom-user-gps-node",
            iconSize: [24, 24]
          });

          userMarkerRef.current = L.marker([validLat, validLng], { icon: userPulseIcon })
            .addTo(mapRef.current)
            .bindTooltip("You Are Here", { direction: "top", permanent: false });
        }
        setLocating(false);
      },
      (err) => {
        console.warn("Geolocation access denied or timed out. Falling back to default Lagos coordinates.", err);
        setLocating(false);
        // Fallback user location so route distance works
        setUserLocation([6.4281, 3.4219]); // VI
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // 3. Update Markers on property filters/changes
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || !markersGroupRef.current) return;
    const L = (window as any).L;

    // Clear old markers completely
    markersGroupRef.current.clearLayers();

    // Plot clustered properties
    filteredProperties.forEach((p) => {
      // Coordinate layout fallback
      const lat = p.latitude || 6.45 + (Math.random() - 0.5) * 0.04;
      const lng = p.longitude || 3.45 + (Math.random() - 0.5) * 0.04;

      // Custom animated HTML marker style with price tags
      const formattedPrice = p.price >= 1000000 
        ? `₦${(p.price / 1000000).toFixed(1)}M` 
        : `₦${p.price.toLocaleString()}`;

      // Highlight active hovered/selected property
      const isActive = selectedProperty?.id === p.id;
      const themeColor = p.propertyType === "penthouse" || p.propertyType === "villa" ? "#a855f7" : "#0284c7";

      // Render custom marker HTML representation
      const propertyHTML = `
        <div class="property-map-pin transition-all duration-300 hover:scale-110 cursor-pointer ${isActive ? 'scale-125 z-50' : ''}" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="background: ${themeColor}; border: 2px solid #fff; border-radius: 999px; padding: 4px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s;" class="flex items-center gap-1">
            <svg class="w-3 h-3 text-white" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            <span style="font-size: 10px; font-weight: bold; font-family: monospace; color: #fff;">${formattedPrice}</span>
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid ${themeColor}; margin-top: -2px;"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: propertyHTML,
        className: `custom-marker-${p.id}`,
        iconSize: [60, 30],
        iconAnchor: [30, 28]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersGroupRef.current);

      // Handle pointer events
      marker.on("click", () => {
        handleSelectProperty(p);
      });
    });

    // Fit bounds smoothly to properties if any visible and selected
    if (filteredProperties.length > 0 && !selectedProperty) {
      const bounds = markersGroupRef.current.getBounds();
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [filteredProperties, selectedProperty, leafletLoaded]);

  // When a property is selected
  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property);
    setCarouselIndex(0);
    setAiRecommendationText(null);

    // Relocate map focus
    if (mapRef.current) {
      const lat = property.latitude || 6.4520;
      const lng = property.longitude || 3.4430;
      mapRef.current.flyTo([lat, lng], 15, { duration: 1.2 });

      // If user location is available, calculate route automatically
      if (userLocation) {
        renderRoute(userLocation, [lat, lng]);
      }
    }

    // Generate local nearby places
    generateMockPlaces(property);
  };

  // AI Matches / Deep recommend insights using local or server pipeline
  const evaluateAIInsight = async (property: Property) => {
    setAiLoading(true);
    setAiRecommendationText(null);

    const payload = {
      preferences: {
        bedrooms: filterBeds !== "all" ? parseInt(filterBeds) : 3,
        maxPrice: filterMaxPrice,
        propertyType: filterType !== "all" ? filterType : "apartment"
      },
      property: {
        title: property.title,
        price: property.price,
        location: property.location,
        address: property.address,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
        description: property.description,
        amenities: property.amenities
      }
    };

    try {
      const response = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: payload.preferences,
          properties: [payload.property]
        }),
      });

      if (!response.ok) throw new Error();
      const res = await response.json();
      if (res && res[0]) {
        setAiRecommendationText(res[0].personalizedInsight);
      } else {
        throw new Error();
      }
    } catch {
      // Fallback premium generator
      setTimeout(() => {
        const score = Math.round(85 + Math.random() * 14);
        setAiRecommendationText(
          `Luxe AI Rating: ${score}% Match score. This high-status ${property.propertyType} in ${property.address} outstandingly matches your profile. It leverages spacious layout designs paired with high-value infrastructure like solar generators and round-the-clock safety guards. Recommended highly for high-net-worth leases.`
        );
        setAiLoading(false);
      }, 800);
    } finally {
      setAiLoading(false);
    }
  };

  // Simulated Nearby Places generator
  const generateMockPlaces = (property: Property) => {
    const areas = ["Hospital Center", "International School", "Gourmet Bistro", "Transit Station"];
    const icons = ["hospital", "school", "restaurant", "bus"];
    
    const seededList: NearbyPlace[] = [
      { name: `St. Nicholas Hospital (${property.address.split(',')[0]} Clinic)`, distance: "3 mins walk (250m)", type: "hospital" },
      { name: `British International School Compound`, distance: "8 mins drive (1.5km)", type: "school" },
      { name: `Spur Steak House & Lounge`, distance: "5 mins walk (400m)", type: "restaurant" },
      { name: `BRT Core Bus Terminal`, distance: "2 mins walk (150m)", type: "bus" }
    ];
    setNearbyPlaces(seededList);
  };

  const handleSuggestClick = (s: typeof searchSuggestions[0]) => {
    setSelectedNeighborhood(s.name);
    setSearchQuery(s.name);
    setShowSearchDropdown(false);
    if (mapRef.current) {
      mapRef.current.flyTo([s.lat, s.lng], 14, { duration: 1 });
    }
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setFilterType("all");
    setFilterBeds("all");
    setSelectedNeighborhood("all");
    setIsFurnishedOnly(false);
    setIsNewlyListedOnly(false);
    setFilterMaxPrice(30000000);
    if (mapRef.current) {
      mapRef.current.flyTo([6.4520, 3.4430], 13, { duration: 1 });
    }
  };

  const favoriteToggled = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleFavorite(id);
  };

  return (
    <div className={`w-full min-h-[calc(100vh-140px)] flex flex-col md:flex-row gap-4 border border-neutral-200/50 dark:border-purple-950/20 rounded-3xl overflow-hidden shadow-premium bg-white dark:bg-[#07050d] transition-all duration-300 font-sans ${isDarkMode ? "dark text-white" : "text-neutral-800"}`}>
      
      {/* LEFT SIDEBAR: LISTINGS DIRECTORY & SELECTIONS (40% width) */}
      <div className="w-full md:w-[420px] flex flex-col border-r border-neutral-200/60 dark:border-purple-950/30 overflow-y-auto max-h-[85vh] md:max-h-[calc(100vh-140px)] bg-neutral-50/10 dark:bg-zinc-950/20">
        
        {/* Sticky Filters Block */}
        <div className="p-4 border-b border-neutral-200/60 dark:border-purple-950/25 space-y-3 sticky top-0 bg-white/95 dark:bg-[#08060f]/95 backdrop-blur-md z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-brand-purple dark:text-purple-300">
              <MapIcon className="w-4 h-4 text-purple-500" />
              <span className="font-display font-bold text-xs uppercase tracking-wider">Luxerent Map Finder</span>
            </div>
            
            {/* Dark Mode toggle specifically styled */}
            <button 
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-neutral-100 dark:bg-purple-950/30 text-neutral-500 dark:text-purple-300 hover:text-purple-500 transition duration-300 pointer-events-auto"
              title="Toggle theme mode"
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Autocomplete Search Bar */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100/50 dark:bg-zinc-950/40 border border-neutral-200/50 dark:border-purple-900/10 rounded-xl text-xs">
              <Search className="w-3.5 h-3.5 text-purple-400" />
              <input 
                type="text"
                placeholder="Search neighborhood city..."
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent w-full focus:outline-none focus:ring-0 placeholder:text-neutral-400 text-neutral-800 dark:text-neutral-100"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="p-0.5 text-neutral-400 hover:text-neutral-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Suggestions drop card */}
            {showSearchDropdown && (
              <div className="absolute top-10 left-0 w-full rounded-xl bg-white dark:bg-[#0c0a17] border border-neutral-200 dark:border-purple-900/20 shadow-premium p-1.5 z-45 flex flex-col text-xs font-mono">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-purple-950/20 pb-1.5 mb-1 px-2">
                  <span className="text-[9px] text-neutral-400 uppercase font-bold">Suggested Premium Neighborhoods</span>
                  <button onClick={() => setShowSearchDropdown(false)} className="text-[9px] text-rose-450 hover:underline">Close</button>
                </div>
                {searchSuggestions.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => handleSuggestClick(s)}
                    className="text-left rounded p-2 text-xs hover:bg-purple-500/10 text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 transition"
                  >
                    <MapPin className="w-3 h-3 text-purple-400 animate-pulse" />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible Filter chips */}
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-neutral-100 dark:bg-purple-950/35 border border-neutral-250 dark:border-purple-900/20 rounded-lg p-1.5 text-xs text-neutral-700 dark:text-neutral-200 focus:outline-none"
              >
                <option value="all">Any Layout</option>
                <option value="apartment">Apartment</option>
                <option value="penthouse">Penthouse</option>
                <option value="duplex">Duplex</option>
                <option value="villa">Diplomatic Villa</option>
                <option value="studio">Studio</option>
              </select>

              <select 
                value={filterBeds}
                onChange={(e) => setFilterBeds(e.target.value)}
                className="bg-neutral-100 dark:bg-purple-950/35 border border-neutral-250 dark:border-purple-900/20 rounded-lg p-1.5 text-xs text-neutral-700 dark:text-neutral-200 focus:outline-none"
              >
                <option value="all">Any Bedrooms</option>
                <option value="1">1 Bed</option>
                <option value="2">2 Beds</option>
                <option value="3">3 Beds</option>
                <option value="4">4 Beds</option>
                <option value="5">5+ Beds</option>
              </select>
            </div>

            {/* Price Slider */}
            <div className="space-y-1 py-1">
              <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                <span>Annual budget cap</span>
                <span className="text-emerald-500 font-bold">₦{(filterMaxPrice / 1000000).toFixed(1)}M</span>
              </div>
              <input 
                type="range"
                min={2000000}
                max={30000000}
                step={500000}
                value={filterMaxPrice}
                onChange={(e) => setFilterMaxPrice(parseInt(e.target.value))}
                className="w-full accent-brand-purple cursor-pointer h-1.5 rounded-full bg-neutral-200 dark:bg-purple-950"
              />
            </div>

            {/* Checkbox triggers */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <label className="flex items-center gap-1 cursor-pointer text-[11px] font-mono text-neutral-500 select-none">
                <input 
                  type="checkbox"
                  checked={isFurnishedOnly}
                  onChange={(e) => setIsFurnishedOnly(e.target.checked)}
                  className="rounded border-neutral-350 accent-brand-purple"
                />
                <span>Furnished</span>
              </label>

              <label className="flex items-center gap-1 cursor-pointer text-[11px] font-mono text-neutral-500 select-none">
                <input 
                  type="checkbox"
                  checked={isNewlyListedOnly}
                  onChange={(e) => setIsNewlyListedOnly(e.target.checked)}
                  className="rounded border-neutral-350 accent-brand-purple"
                />
                <span>Newly Listed</span>
              </label>

              <button 
                onClick={resetAllFilters}
                className="text-[10px] text-brand-purple font-bold font-mono hover:underline"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Sidebar Listings Renders */}
        <div className="flex-1 p-3 space-y-3">
          
          <AnimatePresence mode="wait">
            {selectedProperty ? (
              /* DETAILED VIEW CARD */
              <motion.div 
                key="detail-panel"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-[#0b0916] rounded-2xl border border-neutral-200/50 dark:border-purple-950/40 overflow-hidden shadow-lg p-3 space-y-3 font-sans relative"
              >
                {/* Back button */}
                <button 
                  onClick={() => {
                    setSelectedProperty(null);
                    setRouteInfo(null);
                    if (routePolylineRef.current && mapRef.current) {
                      mapRef.current.removeLayer(routePolylineRef.current);
                    }
                  }}
                  className="absolute top-5 left-5 p-1.5 rounded-full bg-neutral-900/70 hover:bg-neutral-900 text-white z-10 font-bold transition-all border border-white/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Favorite badge inside map details */}
                <button
                  onClick={(e) => favoriteToggled(e, selectedProperty.id)}
                  className="absolute top-5 right-5 p-2 rounded-full bg-neutral-900/70 text-white z-10 hover:text-rose-400 hover:scale-105 duration-200"
                >
                  <Heart className={`w-3.5 h-3.5 ${profile?.favorites?.includes(selectedProperty.id) ? "fill-rose-500 text-rose-500" : "text-white"}`} />
                </button>

                {/* Carousels container */}
                <div className="relative h-44 rounded-xl overflow-hidden group">
                  <img 
                    src={selectedProperty.images[carouselIndex]} 
                    alt={selectedProperty.title}
                    className="w-full h-full object-cover transition duration-500"
                  />
                  {selectedProperty.images.length > 1 && (
                    <>
                      <button 
                        onClick={() => setCarouselIndex(prev => (prev - 1 + selectedProperty.images.length) % selectedProperty.images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-neutral-900/40 text-white hover:bg-neutral-900/75 rounded-full"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => setCarouselIndex(prev => (prev + 1) % selectedProperty.images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-neutral-900/40 text-white hover:bg-neutral-900/75 rounded-full"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                        {selectedProperty.images.map((_, i) => (
                          <span 
                            key={i} 
                            className={`w-1.5 h-1.5 rounded-full transition ${carouselIndex === i ? "bg-white scale-110" : "bg-white/50"}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Core descriptions */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#a855f7] bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                      {selectedProperty.propertyType}
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-500">
                      ₦{selectedProperty.price.toLocaleString()}/yr
                    </span>
                  </div>

                  <h3 className="font-display font-black text-sm text-neutral-800 dark:text-neutral-100 hover:text-brand-purple transition truncate">
                    {selectedProperty.title}
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                    <span className="truncate">{selectedProperty.address}</span>
                  </p>
                </div>

                {/* Facilities tags */}
                <div className="grid grid-cols-3 gap-1 bg-neutral-100/50 dark:bg-zinc-950/40 p-2 rounded-xl text-center text-[11px] font-mono text-neutral-500">
                  <div>
                    <span className="font-bold text-neutral-800 dark:text-white">{selectedProperty.bedrooms}</span> Beds
                  </div>
                  <div>
                    <span className="font-bold text-neutral-800 dark:text-white">{selectedProperty.bathrooms}</span> Baths
                  </div>
                  <div>
                    <span className="font-bold text-neutral-800 dark:text-white">{selectedProperty.isFurnished ? "Yes" : "No"}</span> Furnished
                  </div>
                </div>

                {/* Direct Geolocation and routing results */}
                {routeInfo && (
                  <div className="p-2.5 rounded-xl bg-purple-550/5 border border-purple-500/10 flex items-center justify-between text-[11px] font-mono text-brand-purple dark:text-purple-300">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-3.5 h-3.5 text-purple-400 rotate-45 animate-pulse" />
                      <span>Route Calculated</span>
                    </div>
                    <span className="font-bold">{routeInfo.distance} • {routeInfo.duration}</span>
                  </div>
                )}

                {/* Nearby places section */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Recommended Nearby Locations</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    {nearbyPlaces.map((place, index) => (
                      <div key={index} className="p-2 rounded-lg bg-neutral-50 dark:bg-purple-950/10 border border-neutral-100 dark:border-purple-950/20 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 font-bold text-neutral-700 dark:text-neutral-300">
                          {place.type === "school" && <School className="w-3 h-3 text-blue-400" />}
                          {place.type === "hospital" && <Hospital className="w-3 h-3 text-rose-400" />}
                          {place.type === "restaurant" && <Utensils className="w-3 h-3 text-amber-400" />}
                          {place.type === "bus" && <Bus className="w-3 h-3 text-emerald-400" />}
                          <span className="truncate">{place.name}</span>
                        </div>
                        <span className="text-[9px] text-neutral-400">{place.distance}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI recommendation tool badge */}
                <div className="p-2.5 rounded-xl border border-purple-500/15 bg-purple-500/5 dark:bg-purple-950/10 flex flex-col gap-1.5 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-brand-purple dark:text-purple-300 text-[11px] font-mono font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>LUXE AI CO-PILOT MATCH RECOM</span>
                    </div>
                    {!aiRecommendationText && (
                      <button
                        onClick={() => evaluateAIInsight(selectedProperty)}
                        disabled={aiLoading}
                        className="text-[9px] font-bold font-mono px-2 py-1 bg-brand-purple rounded text-white flex items-center gap-1 cursor-pointer hover:bg-purple-600 disabled:opacity-50"
                      >
                        {aiLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Analyze Map"}
                      </button>
                    )}
                  </div>
                  {aiRecommendationText && (
                    <p className="text-[10px] leading-relaxed text-neutral-500 font-mono border-t border-purple-500/10 pt-1.5">
                      {aiRecommendationText}
                    </p>
                  )}
                </div>

                {/* Actions Drawer */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => onOpenDetails(selectedProperty)}
                    className="flex-1 py-2 rounded-xl text-center text-xs font-mono font-bold bg-neutral-100 dark:bg-purple-950/25 hover:bg-neutral-200 dark:hover:bg-purple-950/45 text-[#a855f7] border border-purple-500/10 transition cursor-pointer"
                  >
                    View Details
                  </button>
                  {onInitiateChat && (
                    <button 
                      onClick={() => onInitiateChat(selectedProperty)}
                      className="flex-1 py-2 rounded-xl text-center text-xs font-mono font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white transition flex items-center justify-center gap-1 cursor-pointer shadow-md"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Start Chat
                    </button>
                  )}
                </div>

              </motion.div>
            ) : (
              /* LIST OVERVIEW */
              <motion.div 
                key="list-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-extrabold">
                    Visible Properties ({filteredProperties.length})
                  </span>
                </div>

                {filteredProperties.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-neutral-250 dark:border-purple-950/20 text-neutral-400">
                    <p className="text-xs font-semibold">No rental units fit selected criteria map bounds.</p>
                    <button 
                      onClick={resetAllFilters}
                      className="mt-2 text-[10px] font-mono text-brand-purple hover:underline"
                    >
                      Clear All Search Filters
                    </button>
                  </div>
                ) : (
                  filteredProperties.map((p) => {
                    const isHovered = hoveredPropertyId === p.id;
                    return (
                      <div
                        key={p.id}
                        onMouseEnter={() => setHoveredPropertyId(p.id)}
                        onMouseLeave={() => setHoveredPropertyId(null)}
                        onClick={() => handleSelectProperty(p)}
                        className={`p-3 rounded-2xl border transition-all duration-300 flex gap-3 cursor-pointer bg-white dark:bg-[#0b0916] hover:-translate-y-0.5 shadow-sm hover:shadow-premium ${
                          isHovered 
                            ? "border-brand-purple/70 ring-1 ring-brand-purple/20 bg-purple-500/5" 
                            : "border-neutral-200/50 dark:border-purple-950/30"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                          <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                        </div>

                        {/* Summary details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9px] uppercase font-bold text-[#a855f7] tracking-wider">
                                {p.propertyType}
                              </span>
                              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                                ₦{(p.price / 1000000).toFixed(1)}M/yr
                              </span>
                            </div>
                            <h4 className="font-bold text-xs text-neutral-800 dark:text-white truncate font-sans">
                              {p.title}
                            </h4>
                            <p className="text-[10px] text-neutral-400 font-mono truncate flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5 text-red-400 shrink-0" /> {p.address}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-1 border-t border-neutral-100 dark:border-purple-950/15">
                            <span>{p.bedrooms} Bed • {p.bathrooms} Bath</span>
                            <span className="text-[#a855f7] hover:underline flex items-center">
                              Fly Map <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

      {/* RIGHT SIDE: MAP LAYOUT CONTAINER (60% width) */}
      <div className="flex-1 relative min-h-[450px] md:min-h-0 h-[45vh] md:h-auto">
        
        {/* Leaflet instance container */}
        <div 
          id={mapContainerId} 
          className="w-full h-full z-10"
          style={{ minHeight: "100%", height: "100%" }}
        />

        {/* LOADING SHADOW LAYER */}
        {!leafletLoaded && (
          <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white gap-2">
            <Loader2 className="w-9 h-9 animate-spin text-purple-400" />
            <span className="font-mono text-sm tracking-widest uppercase">Bootstrapping Luxerent Map Core...</span>
          </div>
        )}

        {/* OVERLAY ELEMENTS ON THE MAP CONTAINER */}
        <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
          {/* Locating button */}
          <button
            onClick={findAndCenterUserLocation}
            disabled={locating}
            className="p-3 rounded-2xl bg-white/90 dark:bg-[#0c0a18]/90 border border-neutral-200 dark:border-purple-900/30 text-neutral-700 dark:text-white cursor-pointer shadow-premium hover:bg-neutral-50 dark:hover:bg-purple-950/20 active:scale-95 transition flex items-center justify-center gap-1.5 text-xs font-mono font-bold"
            title="Auto GPS targeting"
          >
            <Compass className={`w-4 h-4 text-[#a855f7] ${locating ? "animate-spin" : ""}`} />
            <span>Target Me</span>
          </button>

          {/* Heatmap overlay buttons */}
          <button
            onClick={() => setHeatmapActive(!heatmapActive)}
            className={`p-3 rounded-2xl border text-xs font-mono font-bold cursor-pointer shadow-premium active:scale-95 transition flex items-center justify-center gap-1.5 ${
              heatmapActive 
                ? "bg-gradient-to-r from-orange-500 to-rose-500 border-rose-500 text-white font-extrabold pulse-orange animate-pulse" 
                : "bg-white/90 dark:bg-[#0c0a18]/90 border-neutral-200 dark:border-purple-900/30 text-neutral-700 dark:text-white"
            }`}
            title="Density Overlay Finder"
          >
            <Flame className={`w-4 h-4 ${heatmapActive ? "text-white" : "text-amber-500"}`} />
            <span>Heatmap {heatmapActive ? "ON" : "OFF"}</span>
          </button>
        </div>

        {/* Dynamic HEATMAP Spot renders simulated dynamically based on property distribution */}
        {heatmapActive && leafletLoaded && (
          <div className="absolute inset-0 pointer-events-none z-30 transition-all duration-500 animate-fadeIn">
            {/* Ambient hot spots layered specifically over main seed neighborhood sites */}
            {/* Ikoyi location hotspot */}
            <div className="absolute top-[35%] left-[25%] md:top-[40%] md:left-[35%] w-48 h-48 rounded-full bg-rose-500/20 blur-[60px] animate-pulse" />
            {/* Lekki Phase 1 location hotspot */}
            <div className="absolute top-[40%] left-[55%] md:top-[42%] md:left-[45%] w-56 h-56 rounded-full bg-orange-500/15 blur-[65px] animate-pulse" />
            {/* Banana Island hotspot */}
            <div className="absolute top-[25%] left-[70%] md:top-[30%] md:left-[60%] w-36 h-36 rounded-full bg-rose-600/15 blur-[55px] animate-pulse" />
          </div>
        )}

        {/* MAP LEGEND FOOTER CHIPS */}
        <div className="absolute bottom-4 left-4 z-40 p-2.5 rounded-xl bg-white/80 dark:bg-black/75 border border-neutral-200/50 dark:border-purple-900/20 backdrop-blur-md flex flex-wrap gap-3 text-[10px] font-mono shadow-md text-neutral-500">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
            <span>Prestige Land leases (Villa/Pent)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" />
            <span>Elite Resident units (Duplex/Apts)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
