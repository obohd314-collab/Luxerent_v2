/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, MapPin, BedDouble, Bath, Heart, 
  MessageSquare, Sparkles, Loader2, Send, ChevronLeft, ChevronRight, Play, Info, HelpCircle,
  CheckCircle, CreditCard, AlertTriangle
} from "lucide-react";
import { Property, ChatRoom } from "../types";
import { useAuth } from "../context/AuthContext";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, doc, setDoc, getDocs, query, where } from "firebase/firestore";
import VirtualTourModal from "./VirtualTourModal";
import { 
  logPaymentEvent, 
  logReportOrComplaint, 
  logSuspiciousActivity 
} from "../lib/notifications";

interface PropertyDetailsModalProps {
  property: Property;
  onClose: () => void;
  onOpenChat: (chat: ChatRoom) => void;
}

export default function PropertyDetailsModal({ property, onClose, onOpenChat }: PropertyDetailsModalProps) {
  const { profile, toggleFavorite, isDemo } = useAuth();
  const [activeImage, setActiveImage] = useState<number>(0);
  const [isFavorite, setIsFavorite] = useState<boolean>(profile?.favorites?.includes(property.id) || false);
  
  const getLandlordPhone = (name: string) => {
    if (property.landlordPhone) return property.landlordPhone;
    if (name.includes("Aliyu")) return "+234 803 318 4099";
    if (name.includes("Funmi")) return "+234 812 455 1902";
    if (name.includes("Emeka")) return "+234 805 771 2891";
    return "+234 803 450 1192";
  };

  // Tab panels: basic vs virtualVR vs map/places
  const [activeTab, setActiveTab] = useState<"details" | "nearby" | "aichat">("details");
  const [showVRStaging, setShowVRStaging] = useState<boolean>(false);

  // Simulated Payment & Escrow integration
  const [showPaymentSimulation, setShowPaymentSimulation] = useState<boolean>(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState<boolean>(false);
  const [paymentSuccessStatus, setPaymentSuccessStatus] = useState<"completed" | "failed" | null>(null);

  // Admin Reports & Complaints ticketing
  const [showReportForm, setShowReportForm] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);

  // States for Gemini property helper chatbot
  const [leaseChatInput, setLeaseChatInput] = useState<string>("");
  const [leaseChatHistory, setLeaseChatHistory] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: `Hello! I'm LuxeRent Bot, your premium property assistant. Ask me anything about this listing, location highlights, or rental laws in Nigeria!` }
  ]);
  const [isAILoading, setIsAILoading] = useState<boolean>(false);

  const formatNaira = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }).format(value);
  };

  // Simulated Landmarks in Nigeria for the location
  const getNearbyLandmarks = (loc: string) => {
    if (loc.toLowerCase().includes("lagos")) {
      return [
        { name: "The Lekki Coliseum (Events & Cinema)", distance: "1.2 km", category: "Entertainment" },
        { name: "Zenith Bank HQ & ATM Centre", distance: "0.8 km", category: "Finance" },
        { name: "British International High School", distance: "2.5 km", category: "Education" },
        { name: "Lagos Lagoon Coast walk", distance: "0.5 km", category: "Nature" },
        { name: "Evercare Specialist Hospital Ltd", distance: "3.1 km", category: "Health" }
      ];
    } else if (loc.toLowerCase().includes("abuja")) {
      return [
        { name: "Millennium Park & Gardens", distance: "3.0 km", category: "Nature" },
        { name: "Access Bank Diplomatic Office", distance: "1.1 km", category: "Finance" },
        { name: "Transcorp Hilton Dinner Lounge", distance: "2.1 km", category: "Dining" },
        { name: "National Hospital Abuja", distance: "4.5 km", category: "Health" },
        { name: "The Turkish International School", distance: "5.0 km", category: "Education" }
      ];
    } else {
      return [
        { name: "GRA Phase II Sports Boulevard", distance: "1.0 km", category: "Sports" },
        { name: "Port Harcourt Pleasure Park", distance: "2.8 km", category: "Leisure" },
        { name: "University of Port Harcourt Teaching Clinic", distance: "6.2 km", category: "Health" },
        { name: "Genesis Deluxe Cinemas & Mall", distance: "1.7 km", category: "Shopping" }
      ];
    }
  };

  const landmarks = getNearbyLandmarks(property.location);

  // Toggle favorite trigger
  const handleFav = async () => {
    setIsFavorite(!isFavorite);
    await toggleFavorite(property.id);
  };

  // Inquiry submission code removed per requirements (contact details are now direct and premium-pay gated)

  // Initialize and launch a Chatroom with the landlord
  const handleStartChatChan = async () => {
    if (!profile) {
      alert("Authentication required for live direct messaging.");
      return;
    }

    if (profile.id === property.landlordId) {
      alert("You are the landlord of this listing!");
      return;
    }

    const chatId = `chat_${profile.id.substring(0, 5)}_${property.landlordId.substring(0, 5)}_${property.id.substring(0, 5)}`;
    const newChat: ChatRoom = {
      id: chatId,
      propertyId: property.id,
      propertyTitle: property.title,
      landlordId: property.landlordId,
      landlordName: property.landlordName,
      tenantId: profile.id,
      tenantName: profile.name,
      lastMessage: "Conversation established via property listings portal.",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    try {
      if (isDemo) {
        const localRooms = JSON.parse(localStorage.getItem("luxerent_demo_chats") || "[]");
        if (!localRooms.some((room: ChatRoom) => room.id === chatId)) {
          localRooms.push(newChat);
          localStorage.setItem("luxerent_demo_chats", JSON.stringify(localRooms));
        }
      } else {
        const chatRef = doc(db, "chats", chatId);
        await setDoc(chatRef, newChat);
      }
      onOpenChat(newChat);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${chatId}`);
    }
  };

  // Submit chatbot details to Express server
  const handleQueryLeaseBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaseChatInput.trim() || isAILoading) return;

    const userMsg = leaseChatInput;
    setLeaseChatInput("");
    setLeaseChatHistory(prev => [...prev, { role: "user", text: userMsg }]);
    setIsAILoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          property,
          history: leaseChatHistory
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to establish lease bot communications.");
      }

      const resData = await response.json();
      setLeaseChatHistory(prev => [...prev, { role: "bot", text: resData.reply }]);
    } catch (err: any) {
      setLeaseChatHistory(prev => [...prev, { 
        role: "bot", 
        text: `Sorry! The AI Lease Agent is currently resting. To rent this property, please click 'Book Inspection' or 'Direct Message Landlord' directly in the right hand column!` 
      }]);
    } finally {
      setIsAILoading(false);
    }
  };

  const nextImg = () => setActiveImage(prev => (prev === property.images.length - 1 ? 0 : prev + 1));
  const prevImg = () => setActiveImage(prev => (prev === 0 ? property.images.length - 1 : prev - 1));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-5xl bg-neutral-50 dark:bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-8 max-h-[90vh] border border-neutral-200/50 dark:border-purple-900/40 text-neutral-800 dark:text-neutral-100"
      >
        {/* Header toolbar */}
        <div className="flex items-center justify-between p-5 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md border-b border-neutral-200/40 dark:border-purple-950/40">
          <div>
            <h2 className="text-md font-bold text-neutral-800 dark:text-neutral-100 font-display line-clamp-1">
              {property.title}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              <MapPin className="w-3.5 h-3.5 text-brand-blue" />
              <span>{property.address}, {property.location}</span>
            </div>
          </div>
          <button
            id="modal-close-main"
            onClick={onClose}
            className="p-1.5 rounded-full cursor-pointer hover:bg-neutral-200/50 dark:hover:bg-purple-950/40 text-neutral-500 dark:text-neutral-400"
          >
            <X className="w-5.5 h-5.5" />
          </button>
        </div>

        {/* Modal Scroll area */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200/50 dark:divide-purple-950/40">
          
          {/* LEFT 3 COLS: Media Gallery & Specific Tabs */}
          <div className="lg:col-span-3 p-6 flex flex-col gap-6">
            
            {/* Visual Slider Container */}
            <div className="aspect-[16/9] rounded-2xl overflow-hidden relative group bg-neutral-950">
              <img
                src={property.images[activeImage]}
                alt={`Image of ${property.title}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover select-none"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 flex items-center justify-between text-white text-xs">
                <span>File {activeImage + 1} of {property.images.length}</span>
                <span className="font-mono">{property.propertyType.toUpperCase()} GALLERY</span>
              </div>

              {property.images.length > 1 && (
                <>
                  <button
                    id="prev-img-car"
                    onClick={prevImg}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full cursor-pointer bg-black/65 hover:bg-black/80 text-white transition-opacity opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    id="next-img-car"
                    onClick={nextImg}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full cursor-pointer bg-black/65 hover:bg-black/80 text-white transition-opacity opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Micro thumbnail strip */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 hide-scrollbar">
              {property.images.map((img, i) => (
                <button
                  key={i}
                  id={`thumbs-img-${i}`}
                  onClick={() => setActiveImage(i)}
                  className={`w-20 aspect-[4/3] rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border-2 transition-all ${
                    activeImage === i ? "border-brand-purple scale-105" : "border-transparent opacity-60"
                  }`}
                >
                  <img src={img} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Action buttons triggers */}
            <div className="flex flex-wrap gap-3">
              <button
                id="vr-launch-btn"
                onClick={() => setShowVRStaging(true)}
                className="flex-1 py-3 px-4 rounded-xl cursor-pointer bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-500/40 text-purple-300 font-display text-sm font-semibold tracking-wider flex items-center justify-center gap-2 glow-purple"
              >
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" /> Launch Virtual Tour (AI Staged)
              </button>
              
              <button
                id="fav-btn-modal"
                onClick={handleFav}
                className={`py-3 px-5 rounded-xl border cursor-pointer flex items-center gap-2 transition ${
                  isFavorite 
                    ? "bg-rose-500/20 border-rose-400/40 text-rose-300" 
                    : "bg-neutral-100 dark:bg-purple-950/20 border-neutral-300 dark:border-purple-900/30 text-neutral-600 dark:text-neutral-300 hover:bg-rose-500/10"
                }`}
              >
                <Heart className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} /> Saved
              </button>
            </div>

            {/* Tab navigation headers */}
            <div className="border-b border-neutral-200 dark:border-purple-950/40 flex gap-4 text-xs font-mono">
              <button
                id="tab-details"
                onClick={() => setActiveTab("details")}
                className={`pb-2.5 px-1 border-b-2 cursor-pointer transition-all ${
                  activeTab === "details" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
                }`}
              >
                SPECIFICATIONS
              </button>
              <button
                id="tab-nearby"
                onClick={() => setActiveTab("nearby")}
                className={`pb-2.5 px-1 border-b-2 cursor-pointer transition-all ${
                  activeTab === "nearby" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
                }`}
              >
                NEARBY PLACES
              </button>
              <button
                id="tab-aichat"
                onClick={() => setActiveTab("aichat")}
                className={`pb-2.5 px-1 border-b-2 cursor-pointer transition-all flex items-center gap-1 ${
                  activeTab === "aichat" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI ASSISTANT
              </button>
            </div>

            {/* TABS CONTENT BLOCK */}
            <div className="flex-1">
              {activeTab === "details" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs font-mono text-neutral-500 dark:text-neutral-300">
                    <span className="flex items-center gap-1">
                      <BedDouble className="w-4 h-4 text-purple-400" /> {property.bedrooms} Beds
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="w-4 h-4 text-blue-400" /> {property.bathrooms} Bathrooms
                    </span>
                    <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg capitalize">
                      {property.propertyType}
                    </span>
                  </div>

                  <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed font-sans">
                    {property.description}
                  </p>

                  <div className="pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Verified Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map((amenity, idx) => (
                        <span key={idx} className="px-3 py-1 bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200/50 dark:border-purple-900/40 rounded-lg text-xs font-mono text-neutral-700 dark:text-neutral-300 lowercase first-letter:uppercase">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* HTML5 video tour stream */}
                  {property.videoTourUrl && (
                    <div className="pt-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                        <Play className="w-4 h-4 text-blue-400" /> Walkthrough Video Tour
                      </h4>
                      <div className="aspect-video bg-neutral-900 rounded-xl overflow-hidden relative border border-neutral-800">
                        <video 
                          id="property-walkthrough-video"
                          controls 
                          preload="none"
                          poster={property.images[0]}
                          className="w-full h-full"
                        >
                          <source src={property.videoTourUrl} type="video/mp4" />
                          Lease Staging video player not supported on your browser.
                        </video>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "nearby" && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-500/10 border border-blue-400/20 text-blue-300 rounded-xl text-xs flex items-start gap-2">
                    <Info className="w-4 h-4 flex-shrink-0 text-blue-400 mt-0.5" />
                    <p className="leading-relaxed">
                      LuxeRent calculates premium Nigerian spot proximity ratings based on the listed address: 
                      <strong> {property.address}</strong>. Perfect matching for work commute and security convenience.
                    </p>
                  </div>

                  <div className="divide-y divide-neutral-200/50 dark:divide-purple-950/40">
                    {landmarks.map((spot, i) => (
                      <div key={i} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{spot.name}</p>
                          <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">{spot.category}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-neutral-100 dark:bg-purple-950/30 text-xs font-mono text-neutral-600 dark:text-purple-300 border border-neutral-200/30 dark:border-purple-900/20">
                          {spot.distance}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "aichat" && (
                <div className="flex flex-col h-[380px] border border-neutral-200 dark:border-purple-900/30 rounded-2xl bg-white dark:bg-neutral-950 overflow-hidden">
                  <div className="p-3 bg-neutral-100 dark:bg-purple-950/20 border-b border-neutral-200 dark:border-purple-900/30 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-neutral-700 dark:text-purple-300">LuxeRent Bot (AI Property Specialist)</span>
                  </div>

                  {/* Chat logs */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col hide-scrollbar">
                    {leaseChatHistory.map((item, idx) => (
                      <div key={idx} className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        item.role === "user"
                          ? "self-end bg-brand-purple text-white rounded-br-none"
                          : "self-start bg-neutral-100 dark:bg-purple-950/30 text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-purple-900/20 rounded-bl-none"
                      }`}>
                        {item.text}
                      </div>
                    ))}

                    {isAILoading && (
                      <div className="self-start flex items-center gap-2 p-3 bg-neutral-100 dark:bg-purple-950/20 text-neutral-400 rounded-2xl text-xs font-mono">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                        <span>Bot is typing...</span>
                      </div>
                    )}
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleQueryLeaseBot} className="p-2 border-t border-neutral-200 dark:border-purple-900/30 bg-neutral-50 dark:bg-neutral-900 flex gap-2">
                    <input
                      id="ai-bot-input-field"
                      type="text"
                      placeholder="Ask about deposits, landlord response time, or area vibes..."
                      value={leaseChatInput}
                      onChange={(e) => setLeaseChatInput(e.target.value)}
                      className="flex-1 bg-transparent px-3 py-2 text-xs text-neutral-700 dark:text-neutral-100 focus:outline-none"
                    />
                    <button
                      id="ai-bot-send-btn"
                      type="submit"
                      disabled={isAILoading || !leaseChatInput.trim()}
                      className="p-2 cursor-pointer bg-brand-purple hover:bg-purple-500 rounded-xl text-white transition disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT 2 COLS: Rent, Inspection Booking & Contacts Column */}
          <div className="lg:col-span-2 p-6 bg-white dark:bg-neutral-900/40 flex flex-col gap-6 justify-between">
            <div className="space-y-6">
              
              {/* Box displaying the Rent Price */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 space-y-3">
                <div>
                  <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Yearly Rental Fee</p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <h3 className="text-2xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">
                      {formatNaira(property.price)}
                    </h3>
                    <span className="text-xs text-neutral-500">/ per annum</span>
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-mono text-neutral-400 flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-405" /> Serviced, excludes power & diesel levy.
                </div>
              </div>

              {/* Present landlord agent info Directly */}
              <div className="p-4 rounded-xl border border-neutral-200/50 dark:border-purple-950/40 bg-white dark:bg-zinc-950/40 transition-all duration-300">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest">Leasing Agent</p>
                      <p className="text-sm font-bold text-neutral-750 dark:text-neutral-200 mt-0.5">{property.landlordName}</p>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 bg-brand-blue/10 border border-brand-blue/20 text-brand-blue rounded font-bold">
                      VERIFIED AGENT
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 flex flex-col gap-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Direct Phone:</span>
                      <a 
                        href={`tel:${getLandlordPhone(property.landlordName)}`} 
                        className="font-bold text-emerald-400 hover:underline flex items-center gap-1 animate-pulse"
                      >
                        {getLandlordPhone(property.landlordName)}
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1 border-t border-emerald-500/10 pt-1">
                      <span>Status:</span>
                      <span className="text-emerald-400 font-bold">Available</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Reports & Complaints Widget */}
            <div className="pt-3 border-t border-dotted border-neutral-200 dark:border-purple-950/40 mt-4">
              {!showReportForm ? (
                <button
                  id="open-report-form-btn"
                  type="button"
                  onClick={() => setShowReportForm(true)}
                  className="w-full text-center text-[10px] text-rose-500 hover:underline flex items-center justify-center gap-1 cursor-pointer font-mono"
                >
                  <AlertTriangle className="w-3 h-3" /> Report this listing or agent to admin
                </button>
              ) : (
                <div className="space-y-2 font-mono text-[11px] p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                  <p className="font-bold text-rose-450 flex items-center gap-1 text-[10px]">Raise Complaint ticket</p>
                  {reportSubmitted ? (
                    <p className="text-[10px] text-emerald-400">Incident ticket forwarded directly to system administration team.</p>
                  ) : (
                    <div className="space-y-2">
                      <input
                        id="report-reason-input"
                        type="text"
                        required
                        placeholder="e.g. Inaccurate pricing, fake photos..."
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none text-neutral-700 dark:text-neutral-100 focus:border-rose-400"
                      />
                      <div className="flex gap-2">
                        <button
                          id="submit-report-ticket-btn"
                          type="button"
                          onClick={() => {
                            if (!reportReason.trim()) return;
                            logReportOrComplaint(property.id, "property", reportReason, profile?.name || "Anonymous", profile?.email || "anonymous@luxerent.com", isDemo);
                            setReportSubmitted(true);
                          }}
                          className="px-2.5 py-1.5 cursor-pointer bg-rose-600 rounded-md text-white text-[9px] font-bold"
                        >
                          Submit Report
                        </button>
                        <button
                          id="cancel-report-btn"
                          type="button"
                          onClick={() => setShowReportForm(false)}
                          className="px-2.5 py-1.5 cursor-pointer bg-neutral-200 dark:bg-purple-900 text-neutral-600 dark:text-neutral-200 rounded-md text-[9px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick footer info inside details */}
            <p className="text-[10px] text-neutral-500 text-center leading-relaxed mt-6">
              Property ID: {property.id} <br/>
              Premium security monitored listings. Certified Legal Redundancy checks applied.
            </p>
          </div>

        </div>
      </motion.div>

      {/* RENDER ACTIVE VIRTUAL TOUR DIALOG */}
      <AnimatePresence>
        {showVRStaging && (
          <VirtualTourModal property={property} onClose={() => setShowVRStaging(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
