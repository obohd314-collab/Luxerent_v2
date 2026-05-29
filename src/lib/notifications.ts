/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { AdminNotification, NotificationCategory } from "../types";

// Constant for local storage key for consistent sandbox simulations
const DEMO_NOTIFICATIONS_KEY = "luxerent_demo_notifications";

export async function createAdminNotification(
  category: NotificationCategory,
  title: string,
  description: string,
  userEmail?: string,
  userName?: string,
  metadata?: Record<string, any>,
  isDemoMode: boolean = false
) {
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const notification: AdminNotification = {
    id: notificationId,
    category,
    title,
    description,
    userEmail: userEmail || auth.currentUser?.email || undefined,
    userName: userName || auth.currentUser?.displayName || undefined,
    timestamp: new Date().toISOString(),
    isRead: false,
    metadata: metadata || {}
  };

  // 1. Always append to localStorage for offline/sandbox mode so demo users can inspect activities immediately
  try {
    const existingNotifications = JSON.parse(localStorage.getItem(DEMO_NOTIFICATIONS_KEY) || "[]") as AdminNotification[];
    const updated = [notification, ...existingNotifications].slice(0, 100);
    localStorage.setItem(DEMO_NOTIFICATIONS_KEY, JSON.stringify(updated));
    
    // Dispatch custom window event so reactive views can update instantly across contexts
    window.dispatchEvent(new CustomEvent("luxerent_notifications_updated", { detail: notification }));
  } catch (err) {
    console.warn("Could not save notification to LocalStorage: ", err);
  }

  // 2. Also attempt cloud sync if we are not in strict demo mode and have an active firebase user
  if (!isDemoMode) {
    try {
      const docRef = doc(db, "notifications", notificationId);
      await setDoc(docRef, notification);
    } catch (err) {
      console.warn("Could not push notification to Firestore. Safe local offline state preserved.", err);
    }
  }
}

// TRIGGERS FOR SPECIFIED MANDATORY ACTIVITIES:

// 1. New user registration
export const logRegistration = (email: string, name: string, isDemo?: boolean) => 
  createAdminNotification("registration", "New User Registered", `User "${name}" signed up with email ${email}`, email, name, {}, isDemo);

// 2. User login / logout
export const logLogin = (email: string, name: string, isDemo?: boolean) => 
  createAdminNotification("auth", "User Session Started", `User "${name}" successfully logged into the system`, email, name, {}, isDemo);

export const logLogout = (email: string, name: string, isDemo?: boolean) => 
  createAdminNotification("auth", "User Session Ended", `User "${name}" signed out of their session`, email, name, {}, isDemo);

// 3. Password reset requests
export const logPasswordResetRequest = (email: string, isDemo?: boolean) => 
  createAdminNotification("password_reset", "Password Reset Request", `A password recovery payload was requested for ${email}`, email, undefined, {}, isDemo);

// 4. New property/rental listing created
export const logNewListing = (title: string, price: number, location: string, landlordName: string, landlordEmail: string, isDemo?: boolean) => 
  createAdminNotification(
    "listing", 
    "New Rental Property Added", 
    `"${title}" at ${location} registered at ${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(price)}/yr`, 
    landlordEmail, 
    landlordName, 
    { title, price, location }, 
    isDemo
  );

// 5. New bookings or rent requests
export const logNewBooking = (propertyTitle: string, tenantName: string, tenantEmail: string, type: string, isDemo?: boolean) => 
  createAdminNotification(
    "booking", 
    "New Rental/Inspection Request", 
    `Tenant "${tenantName}" requested an inspection/booking for "${propertyTitle}" (${type})`, 
    tenantEmail, 
    tenantName, 
    { propertyTitle, type }, 
    isDemo
  );

// 6. Payments completed or failed
export const logPaymentEvent = (propertyTitle: string, amount: number, status: "completed" | "failed", tenantName: string, tenantEmail: string, isDemo?: boolean) => 
  createAdminNotification(
    "payment", 
    `Payment ${status === "completed" ? "Verified" : "Declined"}`, 
    `Rental payment of ${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount)} for "${propertyTitle}" ${status}`, 
    tenantEmail, 
    tenantName, 
    { propertyTitle, amount, status }, 
    isDemo
  );

// 7. Reports or complaints
export const logReportOrComplaint = (reportedId: string, itemType: "property" | "user", reason: string, reporterName: string, reporterEmail: string, isDemo?: boolean) => 
  createAdminNotification(
    "report", 
    "Complaint Ticket Raised", 
    `Incident on ${itemType} #${reportedId}: "${reason}" by reporter ${reporterName}`, 
    reporterEmail, 
    reporterName, 
    { reportedId, itemType, reason }, 
    isDemo
  );

// 8. Suspicious activities or multiple failed logins
export const logSuspiciousActivity = (reason: string, details: string, email?: string, isDemo?: boolean) => 
  createAdminNotification(
    "suspicious", 
    "Security Alert triggered", 
    `SUSPICIOUS: ${reason}. Details: ${details}`, 
    email, 
    undefined, 
    { reason, details }, 
    isDemo
  );

// 9. Admin changes/settings updates
export const logAdminChangeSetting = (adminEmail: string, changeDetail: string, isDemo?: boolean) => 
  createAdminNotification(
    "admin_change", 
    "System Policy Configured", 
    `Admin settings modified: ${changeDetail}`, 
    adminEmail, 
    "Administrator Console", 
    { changeDetail }, 
    isDemo
  );

// 10. File uploads/images added
export const logFileUploadEvent = (fileName: string, fileSizeKb: number, uploaderEmail: string, uploaderName: string, isDemo?: boolean) => 
  createAdminNotification(
    "upload", 
    "Content Asset Processed", 
    `Media file "${fileName}" (${fileSizeKb.toFixed(0)} KB) added into cloud storage`, 
    uploaderEmail, 
    uploaderName, 
    { fileName, fileSizeKb }, 
    isDemo
  );
