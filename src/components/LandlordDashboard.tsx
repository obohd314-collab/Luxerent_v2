/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Building2, Plus, Edit2, Trash2, Eye, MessageSquare, Check, X, 
  MapPin, Loader2, DollarSign, Bed, CheckSquare, RefreshCw, Upload, Image, ShieldAlert
} from "lucide-react";
import { Property, Inquiry, PropertyType } from "../types";
import { useAuth } from "../context/AuthContext";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { logNewListing, logFileUploadEvent } from "../lib/notifications";
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";

interface LandlordDashboardProps {
  properties: Property[];
  onRefreshProperties: () => void;
  onOpenDetails: (property: Property) => void;
}

export default function LandlordDashboard({ properties, onRefreshProperties, onOpenDetails }: LandlordDashboardProps) {
  const { profile, isDemo } = useAuth();
  
  // Tab within landlord panel
  const [panelTab, setPanelTab] = useState<"listings" | "add" | "inquiries">("listings");

  // Inquiries specific to this landlord
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loadingInqs, setLoadingInqs] = useState<boolean>(true);

  // Listing editor form states (adding / editing)
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState<string>("");
  const [formDesc, setFormDesc] = useState<string>("");
  const [formPrice, setFormPrice] = useState<number>(5000000); // 5M NGN
  const [formLocation, setFormLocation] = useState<string>("Lagos");
  const [formAddress, setFormAddress] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("");
  const [formType, setFormType] = useState<PropertyType>("apartment");
  const [formBeds, setFormBeds] = useState<number>(2);
  const [formBaths, setFormBaths] = useState<number>(2);
  const [formAmenities, setFormAmenities] = useState<string[]>(["24/7 SOLAR POWER", "BIOMETRIC SECURITY"]);
  const [formImages, setFormImages] = useState<string[]>([
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200"
  ]);
  const [imgInput, setImgInput] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [formLatitude, setFormLatitude] = useState<string>("6.4520");
  const [formLongitude, setFormLongitude] = useState<string>("3.4430");
  const [formIsFurnished, setFormIsFurnished] = useState<boolean>(true);

  // Synchronously auto-fill realistic Lagos coordinates based on Address keywords
  useEffect(() => {
    if (!formAddress) return;
    const addr = formAddress.toLowerCase();
    if (addr.includes("ikoyi") || addr.includes("bourdillon")) {
      setFormLatitude("6.4520");
      setFormLongitude("3.4430");
    } else if (addr.includes("lekki phase 1") || addr.includes("admiralty")) {
      setFormLatitude("6.4480");
      setFormLongitude("3.4720");
    } else if (addr.includes("banana")) {
      setFormLatitude("6.4640");
      setFormLongitude("3.4938");
    } else if (addr.includes("oniru") || addr.includes("lekki")) {
      setFormLatitude("6.4350");
      setFormLongitude("3.4470");
    } else if (addr.includes("yaba")) {
      setFormLatitude("6.5095");
      setFormLongitude("3.3792");
    } else if (addr.includes("ikeja") || addr.includes("gra")) {
      setFormLatitude("6.5925");
      setFormLongitude("3.3550");
    }
  }, [formAddress]);

  const filterAmenityOptions = [
    "24/7 SOLAR POWER", "LAGOS LAGOON VIEW", "PRIVATE INFINITY POOL", 
    "SMART AUTOMATION", "PRIVATE CINEMA", "SWIMMING POOL", 
    "BIOMETRIC SECURITY", "FITTED GYM", "DIPLOMATIC ENCLAVE"
  ];

  // Landlord specific properties filter
  const landlordId = profile?.id || "";
  const landlordListings = properties.filter(p => p.landlordId === landlordId);

  // Cumulative metrics
  const totalViews = landlordListings.reduce((acc, curr) => acc + curr.views, 0);
  const activeCount = landlordListings.filter(p => p.status === "available").length;

  useEffect(() => {
    if (!landlordId) return;

    if (isDemo) {
      // Pull simulated inquiries from local storage
      const localInqs = JSON.parse(localStorage.getItem("luxerent_demo_inquiries") || "[]");
      const filtered = localInqs.filter((inq: Inquiry) => inq.landlordId === landlordId);
      setInquiries(filtered);
      setLoadingInqs(false);
    } else {
      setLoadingInqs(true);
      const q = query(collection(db, "inquiries"), where("landlordId", "==", landlordId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Inquiry[] = [];
        snapshot.forEach(docSnap => {
          list.push(docSnap.data() as Inquiry);
        });
        setInquiries(list.sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
        setLoadingInqs(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, "inquiries");
        setLoadingInqs(false);
      });

      return () => unsubscribe();
    }
  }, [landlordId, panelTab]);

  // Handle Form Adds & Updates
  const handleSaveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    const listingId = isEditing && editingId ? editingId : `prop_${profile.id.substring(0, 5)}_${Date.now()}`;
    
    const payload: Property = {
      id: listingId,
      title: formTitle,
      description: formDesc,
      price: formPrice,
      location: formLocation,
      address: formAddress,
      landlordPhone: formPhone,
      propertyType: formType,
      bedrooms: formBeds,
      bathrooms: formBaths,
      amenities: formAmenities,
      images: formImages.length > 0 ? formImages : ["https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800"],
      videoTourUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      status: "available",
      landlordId: profile.id,
      landlordName: profile.name,
      isApproved: isEditing ? (landlordListings.find(l => l.id === editingId)?.isApproved ?? true) : true, // Moderation flag, default approved for testing
      views: isEditing ? (landlordListings.find(l => l.id === editingId)?.views ?? 0) : 0,
      createdAt: isEditing ? (landlordListings.find(l => l.id === editingId)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
      latitude: parseFloat(formLatitude) || 6.4520,
      longitude: parseFloat(formLongitude) || 3.4430,
      isFurnished: formIsFurnished
    };

    try {
      if (isDemo) {
        const localListings = JSON.parse(localStorage.getItem("luxerent_demo_properties") || "[]");
        if (isEditing) {
          const idx = localListings.findIndex((p: Property) => p.id === editingId);
          if (idx !== -1) localListings[idx] = payload;
        } else {
          localListings.push(payload);
        }
        localStorage.setItem("luxerent_demo_properties", JSON.stringify(localListings));
      } else {
        const docRef = doc(db, "properties", listingId);
        await setDoc(docRef, payload);
      }

      if (!isEditing) {
        logNewListing(payload.title, payload.price, payload.location, profile?.name || "Agent", profile?.email || "", isDemo);
        payload.images.forEach((imgUrl, i) => {
          logFileUploadEvent(`listing_image_${i + 1}.png`, 430 + Math.random() * 450, profile?.email || "", profile?.name || "Agent", isDemo);
        });
      }

      // Reset states
      setIsEditing(false);
      setEditingId(null);
      setFormTitle("");
      setFormDesc("");
      setFormAddress("");
      setFormPhone("");
      setFormImages(["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200"]);
      setFormLatitude("6.4520");
      setFormLongitude("3.4430");
      setFormIsFurnished(true);
      
      onRefreshProperties();
      setPanelTab("listings");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `properties/${listingId}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Launch editing form values
  const handleStartEdit = (property: Property) => {
    setIsEditing(true);
    setEditingId(property.id);
    setFormTitle(property.title);
    setFormDesc(property.description);
    setFormPrice(property.price);
    setFormLocation(property.location);
    setFormAddress(property.address);
    setFormPhone(property.landlordPhone || "");
    setFormType(property.propertyType);
    setFormBeds(property.bedrooms);
    setFormBaths(property.bathrooms);
    setFormAmenities(property.amenities);
    setFormImages(property.images);
    setFormLatitude(property.latitude !== undefined ? property.latitude.toString() : "6.4520");
    setFormLongitude(property.longitude !== undefined ? property.longitude.toString() : "3.4430");
    setFormIsFurnished(property.isFurnished !== undefined ? property.isFurnished : true);
    
    setPanelTab("add");
  };

  // Delete Listing completely
  const handleDeleteListing = async (propertyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you certain you want to permanently delete this listing?")) return;

    try {
      if (isDemo) {
        let localListings = JSON.parse(localStorage.getItem("luxerent_demo_properties") || "[]");
        localListings = localListings.filter((p: Property) => p.id !== propertyId);
        localStorage.setItem("luxerent_demo_properties", JSON.stringify(localListings));
      } else {
        const docRef = doc(db, "properties", propertyId);
        await deleteDoc(docRef);
      }
      onRefreshProperties();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `properties/${propertyId}`);
    }
  };

  // Toggle Rented status badge
  const handleToggleRentedStatus = async (property: Property, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetStatus = property.status === "available" ? "rented" : "available";
    const updated = { status: targetStatus };

    try {
      if (isDemo) {
        const localListings = JSON.parse(localStorage.getItem("luxerent_demo_properties") || "[]");
        const idx = localListings.findIndex((p: Property) => p.id === property.id);
        if (idx !== -1) {
          localListings[idx].status = targetStatus;
          localStorage.setItem("luxerent_demo_properties", JSON.stringify(localListings));
        }
      } else {
        const docRef = doc(db, "properties", property.id);
        await updateDoc(docRef, updated);
      }
      onRefreshProperties();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `properties/${property.id}`);
    }
  };

  // Landlord inquiries action toggles
  const handleInquiryActionStatus = async (inq: Inquiry, target: "responded" | "confirmed") => {
    const updated = { status: target };

    try {
      if (isDemo) {
        const localInqs = JSON.parse(localStorage.getItem("luxerent_demo_inquiries") || "[]");
        const idx = localInqs.findIndex((n: Inquiry) => n.id === inq.id);
        if (idx !== -1) {
          localInqs[idx].status = target;
          localStorage.setItem("luxerent_demo_inquiries", JSON.stringify(localInqs));
        }
        
        // Refresh local array state
        const filtered = localInqs.filter((n: Inquiry) => n.landlordId === landlordId);
        setInquiries(filtered);
      } else {
        const docRef = doc(db, "inquiries", inq.id);
        await updateDoc(docRef, updated);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inquiries/${inq.id}`);
    }
  };

  const handlePushImage = () => {
    if (!imgInput.trim()) return;
    setFormImages(prev => [...prev, imgInput.trim()]);
    const parsedName = imgInput.trim().split("/").pop() || "uploaded_image.jpg";
    logFileUploadEvent(parsedName.split("?")[0], 120 + Math.random() * 250, profile?.email || "", profile?.name || "Agent", isDemo);
    setImgInput("");
  };

  const handlePopImage = (idx: number) => {
    setFormImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleToggleAmenity = (opt: string) => {
    setFormAmenities(prev =>
      prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
    );
  };

  const formatNaira = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. METRICS DIALS DASH */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-purple-950/20 border border-neutral-200/50 dark:border-purple-900/30 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-mono text-neutral-400 uppercase">My Active Listings</p>
            <h4 className="text-2xl font-bold font-display text-neutral-800 dark:text-neutral-100">{activeCount} / {landlordListings.length}</h4>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-brand-blue border border-blue-400/20">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-purple-950/20 border border-neutral-200/50 dark:border-purple-900/30 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-mono text-neutral-400 uppercase">Interactive Views</p>
            <h4 className="text-2xl font-bold font-display text-neutral-800 dark:text-neutral-100">{totalViews}</h4>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-brand-purple border border-purple-400/20">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-purple-950/20 border border-neutral-200/50 dark:border-purple-900/30 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-mono text-neutral-400 uppercase">Inquiries Received</p>
            <h4 className="text-2xl font-bold font-display text-neutral-800 dark:text-neutral-100">{inquiries.length} Leases</h4>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-400/20">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. TAB CONTROL PORTAL */}
      <div className="flex border-b border-neutral-200 dark:border-purple-950/40 gap-6 text-xs font-mono">
        <button
          id="landlord-tab-listings"
          onClick={() => { setPanelTab("listings"); setIsEditing(false); }}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer ${
            panelTab === "listings" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          MY PROPERTIES ({landlordListings.length})
        </button>
        <button
          id="landlord-tab-add"
          onClick={() => setPanelTab("add")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            panelTab === "add" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          <Plus className="w-3.5 h-3.5" /> {isEditing ? "EDIT PROPERTY" : "ADD NEW RENTAL"}
        </button>
        <button
          id="landlord-tab-inquiries"
          onClick={() => setPanelTab("inquiries")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer ${
            panelTab === "inquiries" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          TENANT INQUIRIES ({inquiries.length})
        </button>
      </div>

      {/* 3. CONDITIONAL BODY CONTENT PANELS */}
      <div className="pt-2">
        {panelTab === "listings" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {landlordListings.length === 0 ? (
              <div className="col-span-2 p-12 text-center rounded-2xl border-2 border-dashed border-neutral-200 dark:border-purple-900/20 text-neutral-400 space-y-3">
                <Building2 className="w-8 h-8 text-neutral-300 mx-auto" />
                <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">No properties registered on your agent profile</p>
                <button
                  id="landlord-launch-add-prompt"
                  onClick={() => setPanelTab("add")}
                  className="px-4 py-2 bg-brand-purple hover:bg-purple-600 rounded-xl font-mono text-xs text-white transition cursor-pointer shadow-sm glow-purple"
                >
                  Post First Property Listing
                </button>
              </div>
            ) : (
              landlordListings.map((prop) => (
                <div
                  key={prop.id}
                  id={`landlord-prop-card-${prop.id}`}
                  className="p-4 rounded-2xl glass-card border border-neutral-200/40 dark:border-purple-900/30 flex gap-4 hover:shadow-md transition cursor-pointer items-start"
                  onClick={() => onOpenDetails(prop)}
                >
                  <div className="w-24 aspect-square rounded-xl overflow-hidden flex-shrink-0 bg-neutral-900">
                    <img src={prop.images[0]} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-100 line-clamp-1">{prop.title}</h4>
                      
                      {/* Editor / Deleter triggers */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          id={`landlord-edit-trigger-${prop.id}`}
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(prop); }}
                          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-purple-900/30 text-blue-400 transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`landlord-del-trigger-${prop.id}`}
                          onClick={(e) => handleDeleteListing(prop.id, e)}
                          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-purple-900/30 text-rose-400 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-400 flex items-center gap-1"><MapPin className="w-3 h-3 text-brand-blue" /> {prop.address}</p>
                    <p className="font-mono text-xs text-emerald-400 font-bold">{formatNaira(prop.price)} <span className="text-[9px] text-neutral-400">/ per year</span></p>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 dark:border-purple-900/30">
                      <span className={`px-2 py-0.5 text-[9px] font-mono tracking-wide rounded-md border ${
                        prop.status === "available" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                          : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      }`}>
                        {prop.status.toUpperCase()}
                      </span>

                      {/* Toggle availability status button */}
                      <button
                        id={`status-toggle-${prop.id}`}
                        onClick={(e) => handleToggleRentedStatus(prop, e)}
                        className="px-2 py-1 cursor-pointer rounded bg-neutral-100 dark:bg-purple-900/40 border border-neutral-200 dark:border-purple-800/30 font-mono text-[9px] text-neutral-600 dark:text-purple-300 transition hover:bg-brand-purple hover:text-white"
                      >
                        {prop.status === "available" ? "Mark Rented" : "Mark Available"}
                      </button>
                    </div>

                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {panelTab === "add" && (
          <form onSubmit={handleSaveListing} className="p-6 rounded-2xl glass-card border border-neutral-250 dark:border-purple-900/30 space-y-5">
            <h3 className="font-display font-medium text-base text-neutral-800 dark:text-neutral-100">
              {isEditing ? `Modify Listing details: [ID: ${editingId?.substring(0, 5)}]` : "Add New Premium Rental Listing"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Header Input */}
              <div className="md:col-span-4 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Listing Headline Title</label>
                <input
                  id="landlord-add-title"
                  type="text"
                  required
                  placeholder="e.g. Paramount 4-Bedroom Smart Duplex Lekki"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                />
              </div>

              {/* Annual Price */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Yearly Rent price (\u20a6)</label>
                <input
                  id="landlord-add-price"
                  type="number"
                  required
                  min={100}
                  value={formPrice}
                  onChange={(e) => setFormPrice(parseInt(e.target.value))}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                />
              </div>

              {/* Description long textarea */}
              <div className="md:col-span-6 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Detailed Description</label>
                <textarea
                  id="landlord-add-desc"
                  rows={4}
                  required
                  placeholder="Describe architectural heights, finishes, electricity and grid backups, parking capacities, security, water plants..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100 resize-none"
                />
              </div>

              {/* State location */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-mono text-neutral-400">State Location</label>
                <select
                  id="landlord-add-location"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                >
                  <option value="Lagos">Lagos State only</option>
                </select>
              </div>

              {/* Landlord Contact Phone */}
              <div className="md:col-span-4 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Landlord Phone (Unlocked For Paid Renters)</label>
                <input
                  id="landlord-add-phone"
                  type="text"
                  required
                  placeholder="e.g. +234 812 345 6789"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                />
              </div>

              {/* Physical Address */}
              <div className="md:col-span-6 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Physical Location Address (Adding 'Ikoyi', 'Lekki', or 'Yaba' auto-fills coordinates!)</label>
                <input
                  id="landlord-add-address"
                  type="text"
                  required
                  placeholder="e.g. Bourdillon Road, Ikoyi"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                />
              </div>

              {/* Coordinates configuration */}
              <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Map Latitude (Lagos: 6.4 to 6.6)</label>
                <input
                  id="landlord-add-latitude"
                  type="number"
                  step="0.0001"
                  required
                  placeholder="e.g. 6.4520"
                  value={formLatitude}
                  onChange={(e) => setFormLatitude(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                />
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Map Longitude (Lagos: 3.3 to 3.5)</label>
                <input
                  id="landlord-add-longitude"
                  type="number"
                  step="0.0001"
                  required
                  placeholder="e.g. 3.4430"
                  value={formLongitude}
                  onChange={(e) => setFormLongitude(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                />
              </div>

              <div className="md:col-span-6 flex items-center gap-2 py-1 select-none">
                <input
                  id="landlord-add-furnished"
                  type="checkbox"
                  checked={formIsFurnished}
                  onChange={(e) => setFormIsFurnished(e.target.checked)}
                  className="rounded border-neutral-300 dark:border-purple-900/40 accent-brand-purple h-4 w-4 cursor-pointer"
                />
                <label htmlFor="landlord-add-furnished" className="text-xs font-mono text-neutral-400 cursor-pointer">
                  This property is fully-furnished
                </label>
              </div>

              {/* Category */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Property Layout</label>
                <select
                  id="landlord-add-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as PropertyType)}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                >
                  <option value="apartment">Apartment</option>
                  <option value="penthouse">Penthouse</option>
                  <option value="duplex">Duplex</option>
                  <option value="villa">Diplomatic Villa</option>
                  <option value="studio font-mono">Smart Studio</option>
                </select>
              </div>

              {/* Bedrooms */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Bedrooms</label>
                <input
                  id="landlord-add-beds"
                  type="number"
                  min={1}
                  max={20}
                  value={formBeds}
                  onChange={(e) => setFormBeds(parseInt(e.target.value))}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                />
              </div>

              {/* Bathrooms */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-mono text-neutral-400">Bathrooms</label>
                <input
                  id="landlord-add-baths"
                  type="number"
                  min={1}
                  max={20}
                  value={formBaths}
                  onChange={(e) => setFormBaths(parseInt(e.target.value))}
                  className="w-full bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                />
              </div>

              {/* Add multiple images url block */}
              <div className="md:col-span-6 space-y-2 pt-2 border-t border-dotted border-neutral-200 dark:border-purple-900/40">
                <label className="text-xs font-mono text-neutral-400 flex items-center gap-1">
                  <Image className="w-3.5 h-3.5 text-purple-400" /> Image Galleries (At least 1 high-res image URL required)
                </label>
                
                <div className="flex gap-2">
                  <input
                    id="landlord-image-url-feed"
                    type="text"
                    placeholder="Paste modern unsplash link or image address..."
                    value={imgInput}
                    onChange={(e) => setImgInput(e.target.value)}
                    className="flex-1 bg-neutral-100 dark:bg-purple-950/20 border border-neutral-200 dark:border-purple-900/20 rounded-xl px-3 py-2 text-xs focus:outline-none text-neutral-700 dark:text-neutral-100"
                  />
                  <button
                    id="plus-img-btn"
                    type="button"
                    onClick={handlePushImage}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-white text-xs font-mono cursor-pointer transition flex items-center gap-1"
                  >
                    ADD <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* List of active images */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {formImages.map((img, i) => (
                    <div key={i} className="relative w-16 h-12 rounded-lg overflow-hidden group border border-neutral-200 dark:border-purple-905">
                      <img src={img} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      <button
                        id={`btn-del-img-${i}`}
                        type="button"
                        onClick={() => handlePopImage(i)}
                        className="absolute inset-0 bg-red-650/80 cursor-pointer text-white text-[9px] opacity-0 group-hover:opacity-100 transition flex items-center justify-center font-bold"
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amenities checkboxes */}
              <div className="md:col-span-6 space-y-2 pt-2 border-t border-dotted border-neutral-200 dark:border-purple-900/40">
                <label className="text-xs font-mono text-neutral-400 uppercase">Select Amenities</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filterAmenityOptions.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer text-xs select-none p-2 bg-neutral-100/50 dark:bg-purple-950/10 border border-neutral-200/30 dark:border-purple-900/20 rounded-lg">
                      <input
                        id={`landlord-add-amenity-${i}`}
                        type="checkbox"
                        checked={formAmenities.includes(opt)}
                        onChange={() => handleToggleAmenity(opt)}
                        className="accent-brand-purple"
                      />
                      <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 capitalize tracking-wide">
                        {opt.toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

            </div>

            {/* Form triggers */}
            <div className="pt-4 flex justify-end gap-3 border-t border-neutral-200 dark:border-purple-950/40">
              <button
                id="landlord-add-cancel"
                type="button"
                onClick={() => { setPanelTab("listings"); setIsEditing(false); }}
                className="px-5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-205 border border-neutral-300 dark:border-neutral-800 text-xs font-mono tracking-widest cursor-pointer text-neutral-500 dark:text-neutral-300 transition"
              >
                CANCEL
              </button>
              <button
                id="landlord-add-submit"
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-mono text-xs font-bold tracking-widest cursor-pointer flex items-center gap-1.5 transition shadow-md glow-purple disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> SUBMITTING...
                  </>
                ) : (
                  <>
                    {isEditing ? "SAVE CHANGES" : "PUBLISH LISTING"} <Check className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

          </form>
        )}

        {panelTab === "inquiries" && (
          <div className="space-y-4">
            <h3 className="font-display font-medium text-base text-neutral-800 dark:text-neutral-100">
              Active Tenant Tour & Booking Proposals ({inquiries.length})
            </h3>

            {loadingInqs ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                <p className="text-xs font-mono">Syncing tenant inquiries...</p>
              </div>
            ) : inquiries.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border-2 border-dashed border-neutral-200 dark:border-purple-900/20 text-neutral-400 font-sans text-sm">
                No active target inquiries logged on your properties yet.
              </div>
            ) : (
              <div className="space-y-4">
                {inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    id={`landlord-inquiry-${inq.id}`}
                    className="p-5 rounded-2xl glass-card border border-neutral-200/50 dark:border-purple-900/30 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 dark:border-purple-950/40 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                          {inq.tenantName} ({inq.tenantEmail})
                        </h4>
                        <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-purple-400" /> Inquiring Property: <strong>{inq.propertyTitle}</strong>
                        </p>
                      </div>

                      <span className={`px-2.5 py-0.5 font-mono text-[9px] rounded-md border tracking-wider ${
                        inq.status === "confirmed" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                          : inq.status === "responded" 
                          ? "bg-blue-500/10 border-blue-505/20 text-blue-400" 
                          : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      }`}>
                        {inq.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 font-sans italic leading-relaxed">
                        "{inq.message}"
                      </p>

                      {inq.type === "inspection" && (
                        <div className="p-3 bg-neutral-100/50 dark:bg-purple-950/20 border border-neutral-200/30 dark:border-purple-900/20 rounded-xl flex items-center gap-4 font-mono text-[10px] text-purple-300">
                          <span>📅 Proposed Date: <strong>{inq.inspectionDate}</strong></span>
                          <span>⏰ Proposed Hour: <strong>{inq.inspectionTime}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons controls */}
                    {inq.status === "pending" && (
                      <div className="pt-2 border-t border-neutral-100 dark:border-purple-950/40 flex justify-end gap-2 text-xs font-mono">
                        <button
                          id={`reject-inq-${inq.id}`}
                          onClick={() => handleInquiryActionStatus(inq, "responded")}
                          className="px-3 py-1.5 cursor-pointer rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-500 transition border border-neutral-300 text-[10px]"
                        >
                          Mark Responded
                        </button>
                        <button
                          id={`accept-inq-${inq.id}`}
                          onClick={() => handleInquiryActionStatus(inq, "confirmed")}
                          className="px-3 py-1.5 cursor-pointer rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition text-[10px] flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Approve Inspection
                        </button>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
