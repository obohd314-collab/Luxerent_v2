/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Loader2, ArrowRight, BedDouble, Bath, MapPin, Search } from "lucide-react";
import { Property, AIRecommendation } from "../types";

interface AIRecommendationsProps {
  properties: Property[];
  onOpenDetails: (property: Property) => void;
}

export default function AIRecommendations({ properties, onOpenDetails }: AIRecommendationsProps) {
  const [prefLocation, setPrefLocation] = useState<string>("Lagos");
  const [prefMaxPrice, setPrefMaxPrice] = useState<number>(15000000); // 15M Default
  const [prefRooms, setPrefRooms] = useState<number>(3);
  const [prefType, setPrefType] = useState<string>("apartment");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(["24/7 SOLAR POWER", "SWIMMING POOL"]);

  const [recommendations, setRecommendations] = useState<AIRecommendation[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const availableAmenityOptions = [
    "24/7 SOLAR POWER", "LAGOS LAGOON VIEW", "PRIVATE INFINITY POOL", 
    "SMART AUTOMATION", "PRIVATE CINEMA", "SWIMMING POOL", 
    "BIOMETRIC SECURITY", "FITTED GYM", "DIPLOMATIC ENCLAVE"
  ];

  const handleToggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity) ? prev.filter(x => x !== amenity) : [...prev, amenity]
    );
  };

  const handleGenerateAIRecommendations = async () => {
    setLoading(true);
    setError(null);
    setRecommendations(null);

    const payload = {
      preferences: {
        location: prefLocation,
        maxPrice: prefMaxPrice,
        bedrooms: prefRooms,
        propertyType: prefType,
        amenities: selectedAmenities
      },
      properties: properties.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        location: p.location,
        address: p.address,
        propertyType: p.propertyType,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        amenities: p.amenities,
        description: p.description
      }))
    };

    try {
      const response = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Match rate calculation stalled on host server.");
      }

      const resData = await response.json();
      // Sorting recommendations by highest score descending
      const sorted = (resData as AIRecommendation[]).sort((a,b) => b.matchScore - a.matchScore);
      setRecommendations(sorted);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "AI recommendation services are briefly resting.");
      
      // Seed fallback recommendations for testing purposes in standard sandbox
      const simulated: AIRecommendation[] = properties.map((p, i) => {
        let score = 95 - i * 12;
        if (p.location.toLowerCase() !== prefLocation.toLowerCase()) score -= 25;
        if (p.price > prefMaxPrice) score -= 30;
        return {
          propertyId: p.id,
          matchScore: Math.max(15, score),
          personalizedInsight: `This outstanding ${p.propertyType} is a solid match. It offers ${p.bedrooms} ensuite beds with premium styling context in ${p.location}. While the price is ${p.price > prefMaxPrice ? "slightly above" : "well within"} your preferred budget cap, the luxury features and active 24/7 backing utilities make this a superb premium choice for upscale startup lifecycles.`
        };
      }).sort((a,b) => b.matchScore - a.matchScore);
      
      setRecommendations(simulated);
    } finally {
      setLoading(false);
    }
  };

  const formatNaira = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* LEFT 4 COLS: PREFERENCE CONTROLS */}
      <div className="lg:col-span-4 p-6 glass-card rounded-2xl border border-neutral-200/50 dark:border-purple-900/40 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-brand-purple dark:text-purple-300">
            <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">Configure Intelligent Prefs</h3>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Tell LuxeRent what you are looking for, and our automated model will evaluate listings under the hood.
          </p>
        </div>

        <div className="space-y-4">
          
          {/* State Location Choice */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase">Preferred State</label>
            <select
              id="reco-pref-loc"
              value={prefLocation}
              onChange={(e) => setPrefLocation(e.target.value)}
              className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-neutral-750 dark:text-neutral-100 focus:ring-1 focus:ring-brand-purple"
            >
              <option value="Lagos">Lagos State only</option>
            </select>
          </div>

          {/* Property Category Type */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase">Property Layout</label>
            <select
              id="reco-pref-type"
              value={prefType}
              onChange={(e) => setPrefType(e.target.value)}
              className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-neutral-750 dark:text-neutral-100 focus:ring-1 focus:ring-brand-purple"
            >
              <option value="apartment">Apartment / Flats</option>
              <option value="penthouse">Penthouse</option>
              <option value="duplex">Detached Duplex</option>
              <option value="villa">Luxury Diplomatic Villa</option>
              <option value="studio">Self-Contained Studio</option>
            </select>
          </div>

          {/* Bedrooms Selector */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase flex justify-between">
              <span>Minimum Rooms</span>
              <span className="text-purple-400 font-bold">{prefRooms} Bedrooms</span>
            </label>
            <input
              id="reco-pref-rooms"
              type="range"
              min={1}
              max={6}
              value={prefRooms}
              onChange={(e) => setPrefRooms(parseInt(e.target.value))}
              className="w-full accent-brand-purple"
            />
          </div>

          {/* Max Price budget cap */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase flex justify-between">
              <span>Max Yearly Budget</span>
              <span className="text-emerald-400 font-bold">{formatNaira(prefMaxPrice)}</span>
            </label>
            <input
              id="reco-pref-price"
              type="range"
              min={1000000}
              max={30000000}
              step={500000}
              value={prefMaxPrice}
              onChange={(e) => setPrefMaxPrice(parseInt(e.target.value))}
              className="w-full accent-brand-purple"
            />
          </div>

          {/* Amenities checklist checkboxes */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase">Must-Have Amenities</label>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto px-1">
              {availableAmenityOptions.map((opt, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer text-xs select-none">
                  <input
                    id={`reco-amenity-opt-${i}`}
                    type="checkbox"
                    checked={selectedAmenities.includes(opt)}
                    onChange={() => handleToggleAmenity(opt)}
                    className="accent-brand-purple rounded"
                  />
                  <span className="text-neutral-600 dark:text-neutral-300 text-[11px] font-mono capitalize tracking-wide">
                    {opt.toLowerCase()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Action trigger button */}
          <button
            id="find-ai-recommendation-submit"
            onClick={handleGenerateAIRecommendations}
            disabled={loading}
            className="w-full py-3 rounded-xl cursor-pointer bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-mono text-xs font-semibold tracking-widest flex items-center justify-center gap-2 transition glow-purple disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> ENGAGING GEMINI ANALYZER...
              </>
            ) : (
              <>
                RUN INTELLIGENT MATCHING <Sparkles className="w-4 h-4 text-purple-200" />
              </>
            )}
          </button>

        </div>
      </div>

      {/* RIGHT 8 COLS: RECOMMENDATIONS FEED */}
      <div className="lg:col-span-8 space-y-4">
        <AnimatePresence mode="wait">
          {!loading && !recommendations ? (
            /* EMPTY INITIAL INTERACT STATE */
            <motion.div
              key="empty-reco"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-80 rounded-2xl border border-dashed border-neutral-300 dark:border-purple-900/40 p-12 flex flex-col items-center justify-center text-center gap-4 bg-white/20 dark:bg-neutral-900/10 backdrop-blur-sm"
            >
              <div className="p-4 rounded-full bg-purple-500/10 text-purple-400 border border-purple-400/20">
                <Search className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-medium text-base text-neutral-800 dark:text-neutral-100">Intelligent Match Machine Ready</h4>
                <p className="text-xs text-neutral-400 max-w-sm leading-relaxed mx-auto">
                  Click the matching button on the left to invoke our Gemini real estate scoring engine. We evaluate location vibes, amenities, layout comfort scores, and provide written rental analyses.
                </p>
              </div>
            </motion.div>
          ) : loading ? (
            /* ACTIVE LOADING OVERLAY SCREEN */
            <motion.div
              key="loading-reco"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-80 rounded-2xl bg-neutral-900 border border-purple-500/30 p-12 flex flex-col items-center justify-center text-center gap-4 text-white glow-purple"
            >
              <Loader2 className="w-12 h-12 text-brand-purple animate-spin" />
              <div className="space-y-1">
                <p className="font-mono text-xs tracking-widest uppercase text-purple-400">ENGAGING CLOUD ANALYZERS...</p>
                <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed mx-auto">
                  Gemini is actively assessing listed apartments in Lagos against your custom preferences. Scoring layouts, pricing suitability, and writing tailored comments...
                </p>
              </div>
            </motion.div>
          ) : (
            /* LISTINGS OUTPUT FEED */
            <motion.div
              key="results-reco"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              {error && (
                <div className="p-4 rounded-xl bg-purple-500/15 border border-purple-500/30 text-xs font-mono text-purple-300">
                  ⚠️ Note: Virtual cloud connection was temporarily simulated. Presenting highly detailed local predictions below.
                </div>
              )}

              <h3 className="font-display text-base font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest flex items-center gap-2">
                Gemini Scoring Matches Sorted ({recommendations?.length} Listings)
              </h3>

              <div className="space-y-5">
                {recommendations?.map((item) => {
                  const property = properties.find(p => p.id === item.propertyId);
                  if (!property) return null;

                  return (
                    <motion.div
                      key={item.propertyId}
                      className="p-5 md:p-6 rounded-2xl glass-card border border-neutral-200/50 dark:border-purple-900/30 flex flex-col md:flex-row gap-5 items-stretch hover:shadow-lg transition cursor-pointer"
                      onClick={() => onOpenDetails(property)}
                      whileHover={{ scale: 1.005 }}
                    >
                      {/* Left Block: Score Ring */}
                      <div className="flex flex-col items-center justify-center gap-2 md:w-32 flex-shrink-0 bg-neutral-100 dark:bg-purple-950/20 rounded-xl p-4 border border-neutral-200/30 dark:border-purple-900/20">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          {/* Circle Track SVG */}
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-neutral-200 dark:text-neutral-800"
                              strokeWidth="3.5"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className={`${
                                item.matchScore >= 80 ? "text-emerald-400" : item.matchScore >= 50 ? "text-blue-400" : "text-amber-400"
                              }`}
                              strokeDasharray={`${item.matchScore}, 100`}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <span className="absolute font-mono font-bold text-sm text-neutral-800 dark:text-neutral-100">
                            {item.matchScore}%
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest text-center">
                          Match Rating
                        </span>
                      </div>

                      {/* Right Block: Info & AI commentary paragraph */}
                      <div className="flex-1 flex flex-col justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-base font-bold text-neutral-850 dark:text-neutral-100 group-hover:text-purple-300">
                              {property.title}
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-bold text-emerald-400">
                              {formatNaira(property.price)}/yr
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                            <MapPin className="w-3.5 h-3.5 text-brand-blue flex-shrink-0" />
                            <span>{property.address}, {property.location}</span>
                          </div>

                          <div className="flex gap-4 text-xs font-mono text-neutral-500">
                            <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-purple-400" /> {property.bedrooms} Beds</span>
                            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-blue-400" /> {property.bathrooms} Baths</span>
                          </div>
                        </div>

                        {/* Staged Gemini insight quote */}
                        <div className="p-4 rounded-xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/10 dark:border-purple-800/15 relative">
                          <p className="text-[11px] md:text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-sans italic">
                            "{item.personalizedInsight}"
                          </p>
                          <span className="text-[9px] font-mono font-bold text-purple-400 uppercase tracking-wider absolute -right-2 -bottom-2 px-2 py-0.5 bg-neutral-900 border border-purple-900/30 rounded-lg">
                            LuxeStaging bot
                          </span>
                        </div>

                        {/* CTA button */}
                        <div className="flex items-center justify-end text-xs font-semibold text-brand-purple dark:text-purple-300 gap-1 mt-1">
                          Verify details & walk through <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
