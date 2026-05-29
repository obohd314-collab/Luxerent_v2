/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  ShieldAlert, Check, X, Shield, RefreshCw, Users, FileText, 
  TrendingUp, Map, DollarSign, Loader2, Award, UserCog, UserCheck,
  Bell, Settings, Activity, Wrench, AlertTriangle, ShieldCheck
} from "lucide-react";
import { Property, UserProfile, UserRole, AdminNotification } from "../types";
import { useAuth } from "../context/AuthContext";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, doc, updateDoc, deleteDoc, getDocs, onSnapshot, query, setDoc } from "firebase/firestore";
import { logAdminChangeSetting } from "../lib/notifications";

interface AdminDashboardProps {
  properties: Property[];
  onRefreshProperties: () => void;
  onOpenDetails: (property: Property) => void;
}

export default function AdminDashboard({ properties, onRefreshProperties, onOpenDetails }: AdminDashboardProps) {
  const { profile, isDemo } = useAuth();
  
  // Tab selector within admin portal
  const [adminTab, setAdminTab] = useState<"approvals" | "users" | "analytics" | "notifications" | "settings">("notifications");

  // Roster profiles list
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [submittingUser, setSubmittingUser] = useState<string | null>(null);

  // Administrative Notifications state
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(true);

  // Administrative customizable settings simulation states
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [allowInstantLeases, setAllowInstantLeases] = useState<boolean>(true);
  const [maxPropertiesPerLandlord, setMaxPropertiesPerLandlord] = useState<number>(10);
  const [nigerianTaxRate, setNigerianTaxRate] = useState<number>(7.5);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<boolean>(false);

  // Load and listen to admin notifications
  useEffect(() => {
    setLoadingNotifications(true);
    
    const loadLocalNotifs = () => {
      const items = JSON.parse(localStorage.getItem("luxerent_demo_notifications") || "[]") as AdminNotification[];
      setNotifications(items);
      setLoadingNotifications(false);
    };

    if (isDemo) {
      loadLocalNotifs();
      
      const unsubscribeEvent = (e: Event) => {
        loadLocalNotifs();
      };
      
      window.addEventListener("luxerent_notifications_updated", unsubscribeEvent);
      return () => {
        window.removeEventListener("luxerent_notifications_updated", unsubscribeEvent);
      };
    } else {
      // Stream live notifications from Firestore
      const unsubscribe = onSnapshot(collection(db, "notifications"), (snap) => {
        const list: AdminNotification[] = [];
        snap.forEach(docSnap => {
          list.push(docSnap.data() as AdminNotification);
        });
        setNotifications(list.sort((a,b) => b.timestamp.localeCompare(a.timestamp)));
        setLoadingNotifications(false);
      }, (err) => {
        console.warn("Notifications Firestore read error, shifting to local: ", err);
        loadLocalNotifs();
      });

      return () => unsubscribe();
    }
  }, [isDemo, adminTab]);

  // Statistics calculation
  const totalListings = properties.length;
  const approvedCount = properties.filter(p => p.isApproved).length;
  const pendingCount = properties.filter(p => !p.isApproved).length;
  const cumulativeValue = properties.reduce((acc, curr) => acc + curr.price, 0);

  // Load all users from DB
  useEffect(() => {
    if (isDemo) {
      // Offline fallback users simulation loaded from persistent profiles
      const seedUsers: UserProfile[] = [
        { id: "demo_tenant_1", name: "Burna Dev (Elite Tenant)", email: "tenant@luxerent.com", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=tenant", role: "tenant", createdAt: new Date().toISOString(), favorites: [] },
        { id: "demo_landlord_1", name: "Chief Aliyu (Elite Landlord)", email: "landlord@luxerent.com", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=landlord", role: "landlord", createdAt: new Date().toISOString(), favorites: [] },
        { id: "demo_admin_1", name: "Ademola Oboh (Admin Specialist)", email: "obohd314@gmail.com", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin", role: "admin", createdAt: new Date().toISOString(), favorites: [] }
      ];
      setUsers(seedUsers);
      setLoadingUsers(false);
    } else {
      setLoadingUsers(true);
      const unsubscribe = onSnapshot(collection(db, "users"), (snap) => {
        const list: UserProfile[] = [];
        snap.forEach(docSnap => {
          list.push(docSnap.data() as UserProfile);
        });
        setUsers(list.sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
        setLoadingUsers(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, "users");
        setLoadingUsers(false);
      });

      return () => unsubscribe();
    }
  }, [adminTab]);

  // Admin approves listings (flips isApproved = true)
  const handleApproveListing = async (propId: string) => {
    try {
      if (isDemo) {
        const localListings = JSON.parse(localStorage.getItem("luxerent_demo_properties") || "[]");
        const idx = localListings.findIndex((p: Property) => p.id === propId);
        if (idx !== -1) {
          localListings[idx].isApproved = true;
          localStorage.setItem("luxerent_demo_properties", JSON.stringify(localListings));
        }
      } else {
        const docRef = doc(db, "properties", propId);
        await updateDoc(docRef, { isApproved: true });
      }
      onRefreshProperties();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `properties/${propId}`);
    }
  };

  // Admin suspends/rejects a listing
  const handleRejectListing = async (propId: string) => {
    try {
      if (isDemo) {
        const localListings = JSON.parse(localStorage.getItem("luxerent_demo_properties") || "[]");
        const idx = localListings.findIndex((p: Property) => p.id === propId);
        if (idx !== -1) {
          localListings[idx].isApproved = false;
          localStorage.setItem("luxerent_demo_properties", JSON.stringify(localListings));
        }
      } else {
        const docRef = doc(db, "properties", propId);
        await updateDoc(docRef, { isApproved: false });
      }
      onRefreshProperties();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `properties/${propId}`);
    }
  };

  // Toggle user profiles roles (e.g. Tenant -> Landlord -> Admin)
  const handleToggleUserRole = async (targetUser: UserProfile) => {
    setSubmittingUser(targetUser.id);
    let nextRole: UserRole = "landlord";
    if (targetUser.role === "landlord") nextRole = "admin";
    if (targetUser.role === "admin") nextRole = "tenant";

    try {
      if (isDemo) {
        // Trigger simulated toggle update in user array state
        const updated = users.map(u => u.id === targetUser.id ? { ...u, role: nextRole } : u);
        setUsers(updated);
      } else {
        const docRef = doc(db, "users", targetUser.id);
        await updateDoc(docRef, { role: nextRole });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
    } finally {
      setSubmittingUser(null);
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
    <div className="space-y-6">
      
      {/* 1. SECTOR GAUGES STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200/50 dark:border-purple-900/30">
          <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Total Properties</p>
          <div className="mt-1 flex items-baseline justify-between">
            <h4 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{totalListings} Units</h4>
            <span className="text-[10px] font-mono text-green-400 font-bold">100% active</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200/50 dark:border-purple-900/30">
          <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Vetted Approvals</p>
          <div className="mt-1 flex items-baseline justify-between">
            <h4 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{approvedCount} Listed</h4>
            <span className="text-[10px] font-mono text-purple-400">{pendingCount} Pending</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200/50 dark:border-purple-900/30">
          <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Global Users</p>
          <div className="mt-1 flex items-baseline justify-between">
            <h4 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{users.length} Users</h4>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200/50 dark:border-purple-900/30">
          <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Portfolio Volume</p>
          <div className="mt-1 flex items-baseline justify-between">
            <h4 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">{formatNaira(cumulativeValue)}</h4>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

      </div>

      {/* 2. ADMIN DECKS TABS COORDINATORS */}
      <div className="flex border-b border-neutral-200 dark:border-purple-950/40 gap-6 text-xs font-mono">
        <button
          id="admin-tab-approvals"
          onClick={() => setAdminTab("approvals")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            adminTab === "approvals" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> LISTINGS MODERATION ({properties.length})
        </button>
        <button
          id="admin-tab-users"
          onClick={() => setAdminTab("users")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            adminTab === "users" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          <Users className="w-3.5 h-3.5 text-blue-400" /> ACCOUNTS REGISTRY ({users.length})
        </button>
        <button
          id="admin-tab-analytics"
          onClick={() => setAdminTab("analytics")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            adminTab === "analytics" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> DATA ANALYTICS
        </button>
        <button
          id="admin-tab-notifications"
          onClick={() => setAdminTab("notifications")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            adminTab === "notifications" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> AUDIT ALERTS ({notifications.length})
        </button>
        <button
          id="admin-tab-settings"
          onClick={() => setAdminTab("settings")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            adminTab === "settings" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-purple-400" /> SITE SETTINGS
        </button>
      </div>

      {/* 3. CONDITIONAL MODULE CORES */}
      <div className="pt-2">

        {adminTab === "approvals" && (
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-base text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">
              System Wide Listings Vetting Pool 
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {properties.length === 0 ? (
                <div className="col-span-2 p-12 text-center rounded-2xl bg-neutral-100 text-neutral-400 font-mono text-xs">
                  Critical list integrity warning: No properties found.
                </div>
              ) : (
                properties.map((prop) => (
                  <div
                    key={prop.id}
                    id={`admin-approval-item-${prop.id}`}
                    className="p-4 rounded-xl glass-card border border-neutral-200/50 dark:border-purple-900/30 flex gap-4 hover:shadow hover:border-purple-500/30 transition cursor-pointer"
                    onClick={() => onOpenDetails(prop)}
                  >
                    <div className="w-20 aspect-square bg-neutral-900 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={prop.images[0]} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-100 line-clamp-1">{prop.title}</h4>
                        <span className={`px-2 py-0.5 text-[8px] font-mono tracking-wider rounded border flex-shrink-0 uppercase ${
                          prop.isApproved 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                            : "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse"
                        }`}>
                          {prop.isApproved ? "Approved" : "Pending Vetting"}
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-400 font-mono truncate">Publisher: {prop.landlordName}</p>
                      <p className="text-xs font-mono font-bold text-emerald-400">{formatNaira(prop.price)}</p>

                      <div className="pt-2 border-t border-neutral-100 dark:border-purple-950/40 flex justify-end gap-2 text-xs font-mono">
                        {prop.isApproved ? (
                          <button
                            id={`sus-prop-${prop.id}`}
                            onClick={(e) => { e.stopPropagation(); handleRejectListing(prop.id); }}
                            className="px-2.5 py-1.5 cursor-pointer rounded bg-neutral-100 hover:bg-neutral-205 text-rose-400 border border-neutral-300 dark:border-purple-900/30 text-[9px]"
                          >
                            Suspend Units
                          </button>
                        ) : (
                          <button
                            id={`approve-prop-${prop.id}`}
                            onClick={(e) => { e.stopPropagation(); handleApproveListing(prop.id); }}
                            className="px-2.5 py-1.5 cursor-pointer rounded bg-emerald-600 hover:bg-emerald-540 text-white font-bold text-[9px] flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Approve Listing
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {adminTab === "users" && (
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-base text-neutral-200 uppercase tracking-widest">
              Security Authenticated Users Directory
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200/50 dark:border-purple-900/30">
              <table className="w-full text-left border-collapse bg-white dark:bg-neutral-950/40 font-mono text-xs">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-purple-950/40 text-neutral-400">
                    <th className="p-4">USER PROFILE / EMAIL</th>
                    <th className="p-4">MEMBERSHIP ROLE</th>
                    <th className="p-4">MEMBER SINCE</th>
                    <th className="p-4 text-right">SYSTEM ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-purple-950/40">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-neutral-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-1" /> Load profile directories...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-neutral-500">
                        No users configured.
                      </td>
                    </tr>
                  ) : (
                    users.map((member) => (
                      <tr key={member.id} className="hover:bg-neutral-50 dark:hover:bg-purple-950/10 text-neutral-700 dark:text-neutral-300">
                        <td className="p-4 flex items-center gap-3">
                          <img src={member.avatarUrl} alt="Avatar member" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full bg-neutral-100" />
                          <div>
                            <p className="font-bold text-neutral-800 dark:text-neutral-100">{member.name}</p>
                            <p className="text-[10px] text-neutral-400">{member.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1.5 rounded-md border text-[10px] uppercase font-bold tracking-wider ${
                            member.role === "admin" 
                              ? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
                              : member.role === "landlord" 
                              ? "bg-blue-500/10 border-blue-505/20 text-blue-400" 
                              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          }`}>
                            {member.role === "admin" ? "🎖️ " : ""}{member.role}
                          </span>
                        </td>
                        <td className="p-4 text-[10px] text-neutral-400">
                          {new Date(member.createdAt).toDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            id={`role-trigger-${member.id}`}
                            onClick={() => handleToggleUserRole(member)}
                            disabled={submittingUser === member.id}
                            className="px-3 py-1.5 cursor-pointer rounded-lg bg-neutral-100 dark:bg-purple-950/20 border border-neutral-250 dark:border-purple-800/30 text-[10px] hover:bg-brand-purple hover:text-white transition flex items-center gap-1 justify-end ml-auto disabled:opacity-50"
                          >
                            <UserCog className="w-3.5 h-3.5 text-purple-400" /> Toggle Role
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {adminTab === "analytics" && (
          <div className="p-6 rounded-2xl glass-card border border-neutral-200/50 dark:border-purple-900/30 space-y-6">
            <h3 className="font-display font-semibold text-base text-neutral-810 dark:text-neutral-100 uppercase tracking-widest">
              LuxeRent Analytical Yield Dashboard (FINANCES)
            </h3>

            {/* Simulated Yield breakdown charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="p-5 rounded-xl bg-neutral-100/50 dark:bg-purple-950/10 border border-neutral-200/50 dark:border-purple-900/20 space-y-3">
                <p className="text-xs font-mono text-neutral-400">LAGOS STATE YIELD VALUE</p>
                <div className="flex items-center justify-between text-2xl font-bold font-display text-neutral-800 dark:text-white">
                  <span>\u20a632.5M</span>
                  <span className="text-xs font-mono text-emerald-400">62% of share</span>
                </div>
                {/* Micro visual progress bar */}
                <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-purple rounded-full" style={{ width: "62%" }} />
                </div>
              </div>

              <div className="p-5 rounded-xl bg-neutral-100/50 dark:bg-purple-950/10 border border-neutral-200/50 dark:border-purple-900/20 space-y-3">
                <p className="text-xs font-mono text-neutral-400">ABUJA FCT YIELD VALUE</p>
                <div className="flex items-center justify-between text-2xl font-bold font-display text-neutral-800 dark:text-white">
                  <span>\u20a618.0M</span>
                  <span className="text-xs font-mono text-blue-400">31% of share</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-blue rounded-full" style={{ width: "31%" }} />
                </div>
              </div>

              <div className="p-5 rounded-xl bg-neutral-100/50 dark:bg-purple-950/10 border border-neutral-200/50 dark:border-purple-900/20 space-y-3">
                <p className="text-xs font-mono text-neutral-400">RIVERS PORT HARCOURT</p>
                <div className="flex items-center justify-between text-2xl font-bold font-display text-neutral-800 dark:text-white">
                  <span>\u20a64.5M</span>
                  <span className="text-xs font-mono text-amber-400">7% of share</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: "7%" }} />
                </div>
              </div>

            </div>

            {/* Platform rules reminder alerts */}
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 flex gap-3 text-xs text-neutral-400 leading-relaxed font-sans mt-4">
              <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-neutral-200 block mb-0.5">Global Administration Privileges Active</strong>
                As a system administrator logged under `obohd314@gmail.com`, you are authorized to vet listing uploads, modify legal properties data streams directly in Firestore, toggle user roles, and override state parameters in compliance with security guidelines.
              </div>
            </div>

          </div>
        )}

        {adminTab === "notifications" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-base text-neutral-800 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-rose-500 animate-pulse" /> SECURITY & PLATFORM AUDIT SPACE
                </h3>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">Real-time administrator system alert feeds</p>
              </div>
              <button
                id="clear-simulated-notifs-btn"
                type="button"
                onClick={() => {
                  localStorage.removeItem("luxerent_demo_notifications");
                  setNotifications([]);
                }}
                className="px-2.5 py-1.5 cursor-pointer bg-neutral-150 hover:bg-neutral-200 dark:bg-purple-950/20 dark:hover:bg-purple-900/40 border border-neutral-250 dark:border-purple-800/30 text-[10px] font-mono rounded-lg transition"
              >
                Clear Audit Trail
              </button>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {loadingNotifications ? (
                <div className="p-8 text-center text-xs font-mono text-neutral-400">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-purple-400" /> Connecting to real-time notification socket channel...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center rounded-2xl bg-neutral-100 dark:bg-purple-950/5 border border-dashed border-neutral-300 dark:border-purple-900/10 text-neutral-400 text-xs font-mono">
                  No alerts currently registered. Simulate active user logins ($login), registrations, listings, complaints or payment declines to populate log.
                </div>
              ) : (
                notifications.map((notif) => {
                  let badgeColor = "bg-purple-500/10 border-purple-500/20 text-purple-400";
                  if (notif.category === "suspicious") {
                    badgeColor = "bg-rose-600/10 border-rose-600/25 text-rose-500 font-bold";
                  } else if (notif.category === "payment") {
                    badgeColor = notif.title.toLowerCase().includes("fail") || notif.title.toLowerCase().includes("decline")
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-450 animate-pulse"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                  } else if (notif.category === "report") {
                    badgeColor = "bg-amber-500/10 border-amber-500/20 text-text-amber-500 animate-pulse font-bold";
                  } else if (notif.category === "registration") {
                    badgeColor = "bg-sky-500/10 border-sky-500/20 text-sky-400";
                  } else if (notif.category === "password_reset") {
                    badgeColor = "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
                  }

                  return (
                    <div
                      key={notif.id}
                      className="p-4 rounded-xl border border-neutral-200/60 dark:border-purple-950/30 bg-white dark:bg-zinc-950/40 transition hover:border-purple-500/25"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[8.5px] font-mono tracking-wider rounded border uppercase ${badgeColor}`}>
                            {notif.category}
                          </span>
                          <h4 className="text-xs font-mono font-bold text-neutral-850 dark:text-neutral-100">{notif.title}</h4>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {new Date(notif.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="mt-2 text-xs font-mono text-neutral-600 dark:text-neutral-350 leading-relaxed bg-neutral-50 dark:bg-zinc-950/30 p-2.5 rounded-lg border border-neutral-250/20 dark:border-purple-900/10">
                        {notif.description}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-neutral-400">
                        {notif.userName && <span>Operator: <strong>{notif.userName}</strong></span>}
                        {notif.userEmail && <span>Account: <strong className="text-purple-300">{notif.userEmail}</strong></span>}
                        {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                          <span className="text-neutral-550">Params: {JSON.stringify(notif.metadata)}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {adminTab === "settings" && (
          <div className="p-6 rounded-2xl glass-card border border-neutral-200/50 dark:border-purple-900/30 space-y-6 animate-fadeIn">
            <div>
              <h3 className="font-display font-semibold text-base text-neutral-800 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                <Wrench className="w-4 h-4 text-purple-400" /> LuxeRent Directory Options
              </h3>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">Toggle and modify overall directory permissions and fee rates</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                logAdminChangeSetting(
                  profile?.email || "obohd314@gmail.com",
                  `Maintenance: ${maintenanceMode ? "ENABLED BOUND" : "DISABLED LIMIT"}, Fast Escrow checkout: ${allowInstantLeases ? "ACTIVE" : "INACTIVE"}, Limit/Landlord: ${maxPropertiesPerLandlord}, Tax Rate: ${nigerianTaxRate}%`,
                  isDemo
                );
                setSettingsSaveSuccess(true);
                setTimeout(() => setSettingsSaveSuccess(false), 4500);
              }}
              className="space-y-4 max-w-lg font-mono text-xs"
            >
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-purple-950/40 bg-zinc-50 dark:bg-zinc-950/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-neutral-805 dark:text-neutral-200">Director Maintenance Lock</p>
                    <p className="text-[10px] text-neutral-450 leading-relaxed mt-0.5">Locks listing modification access system-wide</p>
                  </div>
                  <input
                    id="setting-maint-mode"
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-purple-950/20">
                  <div>
                    <p className="font-bold text-neutral-805 dark:text-neutral-200">Instant Escrow Checkout API</p>
                    <p className="text-[10px] text-neutral-450 leading-relaxed mt-0.5">Enable direct payment leasing for tenants</p>
                  </div>
                  <input
                    id="setting-instant-leases"
                    type="checkbox"
                    checked={allowInstantLeases}
                    onChange={(e) => setAllowInstantLeases(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1.5 pt-4 border-t border-neutral-200 dark:border-purple-950/20">
                  <label className="font-bold text-neutral-805 dark:text-neutral-200">Max Properties Directory Quota</label>
                  <input
                    id="setting-max-listing-quota"
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={maxPropertiesPerLandlord}
                    onChange={(e) => setMaxPropertiesPerLandlord(Number(e.target.value))}
                    className="max-w-[120px] bg-neutral-100 dark:bg-[#110e1a]/80 border border-neutral-300/40 dark:border-purple-900/30 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-100 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 pt-4 border-t border-neutral-200 dark:border-purple-950/20">
                  <label className="font-bold text-neutral-805 dark:text-neutral-200">Nigerian Spot Rental Surcharge Tax Rate (%)</label>
                  <input
                    id="setting-tax-rate"
                    type="number"
                    step="0.05"
                    required
                    min={0}
                    max={30}
                    value={nigerianTaxRate}
                    onChange={(e) => setNigerianTaxRate(Number(e.target.value))}
                    className="max-w-[120px] bg-neutral-100 dark:bg-[#110e1a]/80 border border-neutral-300/40 dark:border-purple-900/30 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-100 focus:outline-none"
                  />
                </div>
              </div>

              {settingsSaveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 rounded-xl flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-450" />
                  <span>Administrative updates applied instantly and logged in system audit trail!</span>
                </div>
              )}

              <button
                id="save-admin-settings-btn"
                type="submit"
                className="px-4 py-2 cursor-pointer bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-405 text-white rounded-xl font-bold tracking-wider hover:opacity-90 transition shadow-md"
              >
                COMMIT SYSTEM CHANGE
              </button>
            </form>
          </div>
        )}

      </div>

    </div>
  );
}
