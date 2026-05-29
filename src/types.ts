/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "tenant" | "landlord" | "admin";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
  favorites?: string[]; // Array of favorited property IDs
}

export type PropertyType = "apartment" | "penthouse" | "villa" | "duplex" | "studio";
export type PropertyStatus = "available" | "rented";

export interface Property {
  id: string;
  title: string;
  description: string;
  price: number; // Annually (\u20a6)
  location: string; // Lagos, Abuja, Port Harcourt, Ibadan, etc.
  address: string;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  images: string[];
  videoTourUrl?: string;
  status: PropertyStatus;
  landlordId: string;
  landlordName: string;
  landlordPhone?: string;
  isApproved: boolean; // Moderation flag
  views: number;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  isFurnished?: boolean;
}

export type InquiryType = "message" | "inspection";
export type InquiryStatus = "pending" | "responded" | "confirmed";

export interface Inquiry {
  id: string;
  propertyId: string;
  propertyTitle: string;
  landlordId: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  message: string;
  type: InquiryType;
  inspectionDate?: string;
  inspectionTime?: string;
  status: InquiryStatus;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  propertyId: string;
  propertyTitle: string;
  landlordId: string;
  landlordName: string;
  tenantId: string;
  tenantName: string;
  lastMessage: string;
  updatedAt: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatId?: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface RecommendationPreferences {
  location: string;
  maxPrice: number;
  bedrooms: number;
  propertyType: string;
  amenities: string[];
}

export interface AIRecommendation {
  propertyId: string;
  matchScore: number;
  personalizedInsight: string;
}

export interface VirtualTourData {
  intro: string;
  steps: {
    zone: string;
    description: string;
    highlight: string;
  }[];
  outro: string;
}

export type NotificationCategory = 
  | "registration" 
  | "auth" 
  | "password_reset" 
  | "listing" 
  | "booking" 
  | "payment" 
  | "report" 
  | "suspicious" 
  | "admin_change" 
  | "upload";

export interface AdminNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  userEmail?: string;
  userName?: string;
  timestamp: string;
  isRead: boolean;
  metadata?: Record<string, any>;
}

