/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, Calendar, MessageSquare, Loader2, Send, 
  MapPin, User, Building, Phone, Clock, Info, CheckCircle
} from "lucide-react";
import { Property, Inquiry, ChatRoom, ChatMessage } from "../types";
import { useAuth } from "../context/AuthContext";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, doc, query, where, onSnapshot, getDocs, setDoc, updateDoc, addDoc } from "firebase/firestore";
import PropertyCard from "./PropertyCard";

interface TenantDashboardProps {
  properties: Property[];
  onOpenDetails: (property: Property) => void;
  activeChatRoom: ChatRoom | null;
  setActiveChatRoom: (room: ChatRoom | null) => void;
}

export default function TenantDashboard({ properties, onOpenDetails, activeChatRoom, setActiveChatRoom }: TenantDashboardProps) {
  const { profile, isDemo, toggleFavorite } = useAuth();
  
  // Tab panels within tenant deck
  const [tenantTab, setTenantTab] = useState<"favorites" | "inspections" | "chats">("favorites");

  // Linked inquiries state
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loadingInqs, setLoadingInqs] = useState<boolean>(true);

  // Chat parameters
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loadingChats, setLoadingChats] = useState<boolean>(true);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState<boolean>(false);
  const [msgInput, setMsgInput] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const tenantId = profile?.id || "";

  // Filter listings representing favorites
  const favoriteProperties = properties.filter(p => profile?.favorites?.includes(p.id));

  // 1. Fetch Tenant's Inspections & Booking Inquiries
  useEffect(() => {
    if (!tenantId) return;

    if (isDemo) {
      // Offline local sandbox retrieval
      const localInqs = JSON.parse(localStorage.getItem("luxerent_demo_inquiries") || "[]");
      const matched = localInqs.filter((n: Inquiry) => n.tenantId === tenantId);
      setInquiries(matched);
      setLoadingInqs(false);
    } else {
      setLoadingInqs(true);
      const q = query(collection(db, "inquiries"), where("tenantId", "==", tenantId));
      
      const unsubscribe = onSnapshot(q, (snap) => {
        const list: Inquiry[] = [];
        snap.forEach(docSnap => {
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
  }, [tenantId, tenantTab]);

  // 2. Fetch Tenant's Chatrooms
  useEffect(() => {
    if (!tenantId) return;

    const pullChats = () => {
      if (isDemo) {
        const localRooms = JSON.parse(localStorage.getItem("luxerent_demo_chats") || "[]");
        const matched = localRooms.filter((room: ChatRoom) => room.tenantId === tenantId);
        setChatRooms(matched);
        setLoadingChats(false);
      } else {
        setLoadingChats(true);
        const q = query(collection(db, "chats"), where("tenantId", "==", tenantId));
        
        const unsubscribe = onSnapshot(q, (snap) => {
          const list: ChatRoom[] = [];
          snap.forEach(docSnap => {
            list.push(docSnap.data() as ChatRoom);
          });
          setChatRooms(list.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
          
          // Re-sync currently selected active chatroom if present
          if (activeChatRoom) {
            const updatedActive = list.find(r => r.id === activeChatRoom.id);
            if (updatedActive) setActiveChatRoom(updatedActive);
          }

          setLoadingChats(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, "chats");
          setLoadingChats(false);
        });

        return unsubscribe;
      }
    };

    const unsub = pullChats();
    return () => { if (typeof unsub === "function") unsub(); };
  }, [tenantId, tenantTab]);

  // 3. Fetch Messages under active ChatRoom
  useEffect(() => {
    if (!activeChatRoom) {
      setActiveMessages([]);
      return;
    }

    setLoadingMsgs(true);

    if (isDemo) {
      const allMsgs = JSON.parse(localStorage.getItem(`luxerent_demo_messages_${activeChatRoom.id}`) || "[]");
      setActiveMessages(allMsgs);
      setLoadingMsgs(false);
      
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      const q = query(
        collection(db, "chats", activeChatRoom.id, "messages")
      );

      const unsubscribe = onSnapshot(q, (snap) => {
        const list: ChatMessage[] = [];
        snap.forEach(docSnap => {
          list.push(docSnap.data() as ChatMessage);
        });

        // Query doesn't force client sorting natively without indexes. Sort locally safely.
        const sorted = list.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
        setActiveMessages(sorted);
        setLoadingMsgs(false);

        // Scroll to base thread
        setTimeout(() => {
          scrollRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `chats/${activeChatRoom.id}/messages`);
        setLoadingMsgs(false);
      });

      return () => unsubscribe();
    }
  }, [activeChatRoom]);

  // Submit DM Chat Text Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatRoom || !msgInput.trim()) return;

    const draft = msgInput.trim();
    setMsgInput("");

    const msgId = `msg_${tenantId.substring(0, 4)}_${Date.now()}`;
    const payload: ChatMessage = {
      id: msgId,
      chatId: activeChatRoom.id,
      senderId: tenantId,
      senderName: profile?.name || "Tenant",
      text: draft,
      createdAt: new Date().toISOString()
    };

    try {
      if (isDemo) {
        const sessionKey = `luxerent_demo_messages_${activeChatRoom.id}`;
        const localMsgs = JSON.parse(localStorage.getItem(sessionKey) || "[]");
        localMsgs.push(payload);
        localStorage.setItem(sessionKey, JSON.stringify(localMsgs));
        setActiveMessages([...localMsgs]);

        // Trigger simulation reply 1.5 seconds later
        setTimeout(() => {
          const simReplyId = `msg_sim_${Date.now()}`;
          const simReplies = [
            `Hello there! Thank you for inquiring about ${activeChatRoom.propertyTitle}. Yes, the yearly fee stands and is slightly negotiable for upfront 2-year leases. Would you like to schedule an physical inspection for Saturday morning?`,
            `Excellent point! The smart generator provides fully automatic changeovers. Diesel levy is capped at \u20a650,000 monthly when active. Please submit your official inspection date proposal in the listings column!`,
            `Got your message. I amChief Aliyu. I am currently out of Lagos but my manager Mrs. Benson will meet you there to tour the space. Feel free to specify your premium timing.`,
            `Perfect. Yes, tenant screening is fully authorized. Please let me know once you submit your profile.`
          ];
          const chosenReply = simReplies[Math.floor(Math.random() * simReplies.length)];
          const replyPayload: ChatMessage = {
            id: simReplyId,
            chatId: activeChatRoom.id,
            senderId: activeChatRoom.landlordId,
            senderName: activeChatRoom.landlordName,
            text: chosenReply,
            createdAt: new Date().toISOString()
          };

          localMsgs.push(replyPayload);
          localStorage.setItem(sessionKey, JSON.stringify(localMsgs));
          setActiveMessages([...localMsgs]);
          
          // Update chat last message
          const allRooms = JSON.parse(localStorage.getItem("luxerent_demo_chats") || "[]");
          const idx = allRooms.findIndex((r: ChatRoom) => r.id === activeChatRoom.id);
          if (idx !== -1) {
            allRooms[idx].lastMessage = chosenReply;
            allRooms[idx].updatedAt = new Date().toISOString();
          }
          localStorage.setItem("luxerent_demo_chats", JSON.stringify(allRooms));
          setChatRooms(allRooms.filter((r: ChatRoom) => r.tenantId === tenantId));

        }, 1500);

      } else {
        // Render in live cloud
        const chatRef = doc(db, "chats", activeChatRoom.id);
        const msgRef = doc(db, "chats", activeChatRoom.id, "messages", msgId);
        
        await setDoc(msgRef, payload);
        await updateDoc(chatRef, {
          lastMessage: draft,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `chats/${activeChatRoom.id}/messages/${msgId}`);
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
      
      {/* 1. TABS PANEL TRIGGERS */}
      <div className="flex border-b border-neutral-200 dark:border-purple-950/40 gap-6 text-xs font-mono">
        <button
          id="tenant-tab-favs"
          onClick={() => setTenantTab("favorites")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            tenantTab === "favorites" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          <Heart className="w-3.5 h-3.5 text-rose-400" /> FAVOURITED APARTMENTS ({favoriteProperties.length})
        </button>
        <button
          id="tenant-tab-insps"
          onClick={() => setTenantTab("inspections")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            tenantTab === "inspections" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> MY INSPECTION LOGS ({inquiries.length})
        </button>
        <button
          id="tenant-tab-chats"
          onClick={() => setTenantTab("chats")}
          className={`pb-3 px-1 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            tenantTab === "chats" ? "border-brand-purple text-brand-purple font-bold" : "border-transparent text-neutral-500"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> LIVE MESSENGERS ({chatRooms.length})
        </button>
      </div>

      {/* 2. BODY CONTAINER SECTIONS */}
      <div className="pt-2">
        
        {tenantTab === "favorites" && (
          <div>
            {favoriteProperties.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border-2 border-dashed border-neutral-200 dark:border-purple-900/20 text-neutral-400 space-y-3">
                <Heart className="w-8 h-8 text-neutral-300 mx-auto" />
                <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">Your custom wishlist stands empty</p>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">Explore high-end duplexes, penthouses, or studios in Lagos and tap the heart icon to save.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {favoriteProperties.map((prop, idx) => (
                  <PropertyCard
                    key={prop.id}
                    property={prop}
                    onOpenDetails={onOpenDetails}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tenantTab === "inspections" && (
          <div className="space-y-4">
            <h3 className="font-display font-medium text-base text-neutral-800 dark:text-neutral-100">
              Track Tours and Rental Queries
            </h3>

            {loadingInqs ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                <p className="text-xs font-mono">Syncing inspection schedules...</p>
              </div>
            ) : inquiries.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border-2 border-dashed border-neutral-200 dark:border-purple-900/20 text-neutral-401 font-sans text-sm">
                No active tours booked yet. Select an elite property and hit 'Book Inspection'!
              </div>
            ) : (
              <div className="space-y-4">
                {inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    id={`tenant-inquiry-${inq.id}`}
                    className="p-5 rounded-2xl glass-card border border-neutral-200/50 dark:border-purple-900/30 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-neutral-100 dark:border-purple-950/40 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-850 dark:text-neutral-100">
                          {inq.propertyTitle}
                        </h4>
                        <p className="text-[10px] font-mono text-neutral-400 mt-0.5 uppercase tracking-wide">
                          Lead Proposal ID: {inq.id}
                        </p>
                      </div>

                      <span className={`px-2.5 py-0.5 font-mono text-[9px] rounded-md border tracking-wider uppercase ${
                        inq.status === "confirmed" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                          : inq.status === "responded"
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      }`}>
                        {inq.status}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed italic font-sans">
                      "{inq.message}"
                    </p>

                    {inq.type === "inspection" && (
                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-neutral-500 dark:text-purple-300 bg-neutral-100/50 dark:bg-purple-950/20 p-3 rounded-xl border border-neutral-200/30 dark:border-purple-900/25">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date: <strong>{inq.inspectionDate}</strong></span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Hour: <strong>{inq.inspectionTime}</strong></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tenantTab === "chats" && (
          <div className="grid grid-cols-1 md:grid-cols-3 border border-neutral-200 dark:border-purple-900/30 rounded-3xl bg-white dark:bg-neutral-950 overflow-hidden min-h-[480px]">
            
            {/* LEFT 1 COLUMN: Active chat rooms directory list */}
            <div className="border-r border-neutral-200 dark:border-purple-900/20 flex flex-col">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-900/40 border-b border-neutral-200 dark:border-purple-900/20 text-xs font-mono text-neutral-500">
                CHAT DIRECTORY
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-purple-950/40 max-h-[420px] hide-scrollbar">
                {loadingChats ? (
                  <div className="p-4 text-center text-xs text-neutral-400">Loading channels...</div>
                ) : chatRooms.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500 leading-normal">
                    No active direct messages. Use 'Chat Live' on any property screen!
                  </div>
                ) : (
                  chatRooms.map((room) => {
                    const isActive = activeChatRoom?.id === room.id;
                    return (
                      <button
                        key={room.id}
                        id={`chat-room-item-${room.id}`}
                        onClick={() => setActiveChatRoom(room)}
                        className={`w-full text-left p-4 transition-all block cursor-pointer ${
                          isActive 
                            ? "bg-purple-500/10 border-l-4 border-brand-purple" 
                            : "hover:bg-neutral-50 dark:hover:bg-purple-950/10 border-l-4 border-transparent"
                        }`}
                      >
                        <h4 className="text-xs font-bold text-neutral-801 dark:text-neutral-100 truncate">{room.propertyTitle}</h4>
                        <p className="text-[10px] text-neutral-500 dark:text-purple-300 truncate mt-0.5">Llord: {room.landlordName}</p>
                        <p className="text-[11px] text-neutral-400 truncate mt-2 font-sans italic">"{room.lastMessage}"</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT 2 COLUMNS: Chat feed area with custom scroller */}
            <div className="md:col-span-2 flex flex-col justify-between bg-neutral-50 dark:bg-neutral-900/25">
              {activeChatRoom ? (
                <>
                  {/* Active room indicator header */}
                  <div className="p-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-purple-905 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-100">{activeChatRoom.propertyTitle}</h4>
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">Leasing Landlord: {activeChatRoom.landlordName}</p>
                    </div>

                    <button
                      id="close-active-chat"
                      onClick={() => setActiveChatRoom(null)}
                      className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-purple-950/30 text-xs font-mono text-neutral-500 rounded border border-neutral-300/30 cursor-pointer"
                    >
                      Close Chat
                    </button>
                  </div>

                  {/* Messages dynamic viewport list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[340px] hide-scrollbar bg-white/20 dark:bg-zinc-950/20">
                    {loadingMsgs ? (
                      <div className="flex items-center justify-center p-8 text-xs text-neutral-400">Loading transcripts...</div>
                    ) : activeMessages.length === 0 ? (
                      <div className="p-8 text-center text-xs italic text-neutral-400 leading-normal">
                        Let's negotiate! Type your lease demands below.
                      </div>
                    ) : (
                      activeMessages.map((msg, idx) => {
                        const isMine = msg.senderId === tenantId;
                        return (
                          <div
                            key={idx}
                            className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                              isMine 
                                ? "self-end bg-brand-purple text-white ml-auto rounded-br-none" 
                                : "self-start bg-white dark:bg-purple-950/25 text-neutral-700 dark:text-neutral-300 border border-neutral-250/50 dark:border-purple-900/20 rounded-bl-none"
                            }`}
                          >
                            <div className="font-bold text-[9px] font-mono uppercase tracking-wide opacity-75 mb-1">
                              {isMine ? "You" : msg.senderName}
                            </div>
                            <p className="font-sans whitespace-pre-line">{msg.text}</p>
                          </div>
                        );
                      })
                    )}
                    <div ref={scrollRef} />
                  </div>

                  {/* Reply Input block */}
                  <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-purple-905 flex gap-2">
                    <input
                      id="chat-input-text-area"
                      type="text"
                      placeholder="e.g. Can we book 11am this Saturday? Is the diesel levy inclusive?"
                      value={msgInput}
                      onChange={(e) => setMsgInput(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-purple-900/30 rounded-xl text-xs text-neutral-750 dark:text-neutral-100 focus:outline-none"
                    />
                    <button
                      id="send-chat-msg-submit"
                      type="submit"
                      disabled={!msgInput.trim()}
                      className="p-3 cursor-pointer bg-brand-purple hover:bg-purple-500 rounded-xl text-white transition disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </>
              ) : (
                /* CHAT NOT ACTIVE PROMPT */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-400 gap-2.5">
                  <MessageSquare className="w-10 h-10 text-neutral-300" />
                  <div>
                    <h4 className="text-xs font-bold text-neutral-600 dark:text-neutral-400 font-mono tracking-wide uppercase">Conversations Panel</h4>
                    <p className="text-[11px] text-neutral-500 max-w-xs leading-normal mx-auto">Select an ongoing negotiation room from the left side directory list to commence smart terms chat.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
