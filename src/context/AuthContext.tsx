/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType, getDocWithTimeout } from "../lib/firebase";
import { UserProfile, UserRole } from "../types";
import { 
  logRegistration, 
  logLogin, 
  logLogout, 
  logSuspiciousActivity 
} from "../lib/notifications";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  signupEmail: (email: string, name: string, role: UserRole, phone?: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  toggleFavorite: (propertyId: string) => Promise<void>;
  setDemoProfile: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(false);

  // Sync user profile from Firestore or local storage on state change
  const syncProfile = async (firebaseUser: FirebaseUser) => {
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDocWithTimeout(userDocRef, 1800);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data() as UserProfile;
        setProfile(data);
        logLogin(data.email, data.name, false);
      } else {
        // Create matching firestore user doc on first sign in
        const newProfile: UserProfile = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || "Client User",
          email: firebaseUser.email || "",
          avatarUrl: firebaseUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${firebaseUser.uid}`,
          role: firebaseUser.email === "obohd314@gmail.com" ? "admin" : "tenant",
          createdAt: new Date().toISOString(),
          favorites: []
        };
        await setDoc(userDocRef, newProfile);
        setProfile(newProfile);
        logRegistration(newProfile.email, newProfile.name, false);
        logLogin(newProfile.email, newProfile.name, false);
      }
      setIsDemo(false);
    } catch (err) {
      console.warn("Could not sync with firestore cloud, using local fallback profile:", err);
      // Construct fallback profile locally
      const fallback: UserProfile = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || "Client User",
        email: firebaseUser.email || "",
        avatarUrl: firebaseUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${firebaseUser.uid}`,
        role: firebaseUser.email === "obohd314@gmail.com" ? "admin" : "tenant",
        createdAt: new Date().toISOString(),
        favorites: []
      };
      setProfile(fallback);
      setIsDemo(true);
      logLogin(fallback.email, fallback.name, true);
    }
  };

  useEffect(() => {
    // Check if we have persistent demo credentials first
    const localDemo = localStorage.getItem("luxerent_demo_profile");
    if (localDemo) {
      const parsed = JSON.parse(localDemo) as UserProfile;
      setProfile(parsed);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        await syncProfile(currentUser);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 1. Google Auth Popup
  const loginGoogle = async () => {
    // To prevent browser popup blockers from triggering, we call signInWithPopup 
    // synchronously on the immediate interaction thread, delaying state updates
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      setLoading(true);
      if (result.user) {
        setUser(result.user);
        await syncProfile(result.user);
      }
    } catch (err: any) {
      console.error("Google Auth popup failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 2. Email Sign In
  const loginEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (result.user) {
        setUser(result.user);
        await syncProfile(result.user);
      }
    } catch (err: any) {
      console.warn("Firebase Auth Error, matching email directly for local premium sandbox:", err);
      logSuspiciousActivity("Failed Login Attempt", `Unresolved login credential error for email: ${email}`, email, true);
      
      // Fallback: If Firebase failed/unconfigured, create seamless simulation
      let simulatedRole: UserRole = "tenant";
      if (email.includes("landlord")) simulatedRole = "landlord";
      if (email.includes("admin") || email === "obohd314@gmail.com") simulatedRole = "admin";
      
      const cleanName = email.split("@")[0];
      const simProfile: UserProfile = {
        id: `demo_${cleanName}`,
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        email: email,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanName}`,
        role: simulatedRole,
        createdAt: new Date().toISOString(),
        favorites: []
      };
      
      localStorage.setItem("luxerent_demo_profile", JSON.stringify(simProfile));
      setProfile(simProfile);
      setIsDemo(true);
      logLogin(simProfile.email, simProfile.name, true);
    } finally {
      setLoading(false);
    }
  };

  // 3. Email Sign Up
  const signupEmail = async (email: string, name: string, role: UserRole, phone?: string) => {
    setLoading(true);
    try {
      // Setup mock password for simple signups to streamline Firebase Auth
      const dummyPassword = "Pass_Rent_Secure_101";
      const result = await createUserWithEmailAndPassword(auth, email, dummyPassword);
      if (result.user) {
        await updateProfile(result.user, { displayName: name });
        setUser(result.user);
        
        // Write profile document explicitly
        const userDocRef = doc(db, "users", result.user.uid);
        const newProfile: UserProfile = {
          id: result.user.uid,
          name,
          email,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${result.user.uid}`,
          role: email === "obohd314@gmail.com" ? "admin" : role,
          phone,
          createdAt: new Date().toISOString(),
          favorites: []
        };
        await setDoc(userDocRef, newProfile);
        setProfile(newProfile);
        setIsDemo(false);
      }
    } catch (err) {
      console.warn("Error creating cloud profile, using Sandbox Simulator creation:", err);
      // Local Sandbox creation
      const simProfile: UserProfile = {
        id: `demo_${name.toLowerCase().replace(/\s/g, "_")}`,
        name,
        email,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`,
        role: email === "obohd314@gmail.com" ? "admin" : role,
        phone,
        createdAt: new Date().toISOString(),
        favorites: []
      };
      localStorage.setItem("luxerent_demo_profile", JSON.stringify(simProfile));
      setProfile(simProfile);
      setIsDemo(true);
      logRegistration(email, name, true);
      logLogin(email, name, true);
    } finally {
      setLoading(false);
    }
  };

  // 4. Update Profile Info
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...data };
    setProfile(updated);

    if (isDemo) {
      localStorage.setItem("luxerent_demo_profile", JSON.stringify(updated));
    } else if (user) {
      const userRef = doc(db, "users", user.uid);
      try {
        await updateDoc(userRef, data as any);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  // 5. Toggle favorite property
  const toggleFavorite = async (propertyId: string) => {
    if (!profile) return;
    const currentFavs = profile.favorites || [];
    const updatedFavs = currentFavs.includes(propertyId)
      ? currentFavs.filter(id => id !== propertyId)
      : [...currentFavs, propertyId];
    
    await updateUserProfile({ favorites: updatedFavs });
  };

  // 6. Direct fast switch helper for quick portal overview evaluation
  const setDemoProfile = (role: UserRole) => {
    const defaultProfile: UserProfile = {
      id: `sandbox_${role}_99`,
      name: role === "admin" ? "Ademola Oboh (Admin Specialist)" : role === "landlord" ? "Chief Aliyu (Elite Landlord)" : "Burna Dev (Elite Tenant)",
      email: role === "admin" ? "obohd314@gmail.com" : `${role}@luxerent.com`,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${role}`,
      role: role,
      createdAt: new Date().toISOString(),
      favorites: ["prop_lekki_duplex"]
    };
    
    localStorage.setItem("luxerent_demo_profile", JSON.stringify(defaultProfile));
    setProfile(defaultProfile);
    setIsDemo(true);
  };

  // 7. Logout Session
  const logout = async () => {
    setLoading(true);
    const oldProfile = profile;
    localStorage.removeItem("luxerent_demo_profile");
    try {
      if (oldProfile) {
        logLogout(oldProfile.email, oldProfile.name, isDemo);
      }
      await signOut(auth);
    } catch (err) {
      console.error("Firebase Signout failed: ", err);
    } finally {
      setUser(null);
      setProfile(null);
      setIsDemo(false);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isDemo,
      loginGoogle,
      loginEmail,
      signupEmail,
      updateUserProfile,
      logout,
      toggleFavorite,
      setDemoProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
