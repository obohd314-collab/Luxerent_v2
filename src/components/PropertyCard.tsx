/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { Heart, MapPin, BedDouble, Bath, Eye, Send } from "lucide-react";
import { Property } from "../types";
import { useAuth } from "../context/AuthContext";

interface PropertyCardProps {
  key?: string | number | React.Key;
  property: Property;
  onOpenDetails: (property: Property) => void;
  index: number;
}

export default function PropertyCard({ property, onOpenDetails, index }: PropertyCardProps) {
  const { profile, toggleFavorite } = useAuth();
  const isFavorited = profile?.favorites?.includes(property.id) || false;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(property.id);
  };

  // Helper to format prices into a beautiful clean Naira format
  const formatNaira = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <motion.div
      id={`property-card-${property.id}`}
      initial={{ opacity: 0, y: 35 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 15, delay: index * 0.08 }}
      whileHover={{ y: -8, transition: { duration: 0.25 } }}
      className="group relative overflow-hidden rounded-2xl glass-card transition-all duration-300 w-full flex flex-col cursor-pointer border border-neutral-200/40 dark:border-purple-950/20 shadow-premium hover:border-purple-500/30"
      onClick={() => onOpenDetails(property)}
    >
      {/* Property Visual Header Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-200 dark:bg-neutral-900">
        <img
          src={property.images[0] || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800"}
          alt={property.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Backdrop overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-60 group-hover:opacity-75 transition-opacity duration-300" />

        {/* Badges on Property Card */}
        <div className="absolute top-4 left-4 flex gap-2">
          <span className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-widest rounded-lg backdrop-blur-md text-white border ${
            property.status === "available" 
              ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300 shadow-sm" 
              : "bg-neutral-500/30 border-neutral-300/20 text-neutral-300"
          }`}>
            {property.status === "available" ? "For Lease" : "Occupied"}
          </span>
          <span className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-widest rounded-lg backdrop-blur-md bg-purple-500/20 border border-purple-400/30 text-purple-200 shadow-sm">
            {property.propertyType}
          </span>
        </div>

        {/* Favoriting button */}
        <button
          id={`fav-btn-${property.id}`}
          onClick={handleFavoriteClick}
          className={`absolute top-4 right-4 p-2.5 rounded-xl backdrop-blur-md border cursor-pointer transition-all duration-300 hover:scale-105 ${
            isFavorited 
              ? "bg-rose-500/25 border-rose-450/40 text-rose-400" 
              : "bg-black/25 border-neutral-200/20 text-neutral-300 hover:text-white"
          }`}
        >
          <Heart className="w-3.5 h-3.5" fill={isFavorited ? "currentColor" : "none"} />
        </button>

        {/* Overlay views and bottom title highlights */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-300 font-mono">
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span>{property.views} Views</span>
          </div>
          <span className="text-xs font-mono font-bold bg-neutral-900/70 backdrop-blur-md px-3 py-1 rounded-lg border border-neutral-800/45 text-amber-400 shadow-sm">
            {formatNaira(property.price)}<span className="text-[9px] text-neutral-400">/yr</span>
          </span>
        </div>
      </div>

      {/* Property Details Body Container */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-neutral-850 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-300 tracking-tight line-clamp-1 transition-colors duration-300 font-display">
            {property.title}
          </h3>
          
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
            <span className="line-clamp-1 text-[11px] font-medium">{property.address}, {property.location}</span>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed h-8">
            {property.description}
          </p>
        </div>

        {/* Room features and Button CTA */}
        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-purple-950/20 flex items-center justify-between">
          <div className="flex gap-4.5 text-xs font-mono text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5 text-purple-450" />
              <span>{property.bedrooms} Bed</span>
            </div>
            <div className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5 text-blue-400" />
              <span>{property.bathrooms} Bath</span>
            </div>
          </div>

          <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-300 duration-300 flex items-center gap-1 group-hover:translate-x-1">
            EXPLORE RENT <Send className="w-3 h-3 text-purple-500" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}
