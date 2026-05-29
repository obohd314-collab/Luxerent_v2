/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, Loader2, ArrowRight, ArrowLeft, Play, Navigation, CheckCircle } from "lucide-react";
import { Property, VirtualTourData } from "../types";

interface VirtualTourModalProps {
  property: Property;
  onClose: () => void;
}

export default function VirtualTourModal({ property, onClose }: VirtualTourModalProps) {
  const [data, setData] = useState<VirtualTourData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    async function fetchVirtualTour() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch("/api/ai/virtual-tour", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property }),
        });

        if (!response.ok) {
          throw new Error("Unable to contact the virtual drone staging server. Please verify keys.");
        }

        const resData = await response.json();
        setData(resData);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Virtual tour service currently offline.");
      } finally {
        setLoading(false);
      }
    }

    fetchVirtualTour();
  }, [property]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      {/* Holographic Glowing Backdrop Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
        <div className="absolute top-[20%] left-[30%] w-96 h-96 rounded-full bg-purple-500 blur-[150px] animate-glow-blob" />
        <div className="absolute bottom-[20%] right-[30%] w-96 h-96 rounded-full bg-blue-500 blur-[150px] animate-glow-blob" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-neutral-900 border border-purple-500/30 text-white shadow-2xl glow-purple"
      >
        {/* Holographic header bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-purple-950/20 border-b border-purple-900/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400 animate-spin" />
            <h2 className="text-md font-display font-medium uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              AI Staged Walkthrough
            </h2>
          </div>
          <button
            id="close-vr-btn"
            onClick={onClose}
            className="p-1.5 rounded-full cursor-pointer hover:bg-white/10 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal content body */}
        <div className="p-6 md:p-8 min-h-[350px] flex flex-col justify-between">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
              <Loader2 className="w-12 h-12 text-brand-purple animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold tracking-wider text-purple-300">ENGAGING AI HOLODRONE STAGING...</p>
                <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                  Stitching high-fidelity interior design materials, mapping Nigerian architectural lighting and premium furniture options...
                </p>
              </div>
            </div>
          ) : error || !data ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-8">
              <p className="text-rose-400 font-mono text-sm uppercase">{error || "Process stalled"}</p>
              <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                We're currently simulating local interactive guides. You can still tour this property through standard media.
              </p>
              <button
                id="vr-retry-btn"
                onClick={onClose}
                className="mt-4 px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600 border border-purple-500/50 text-xs tracking-wider transition cursor-pointer"
              >
                Go Back to Listing
              </button>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              
              {/* Slides renderer */}
              <AnimatePresence mode="wait">
                {currentStep === 0 ? (
                  /* STEP 0: Introduction */
                  <motion.div
                    key="intro"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="inline-flex px-3 py-1 items-center gap-1.5 text-[10px] font-mono rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 tracking-wider">
                      <Play className="w-3 h-3 fill-current" /> DIGITAL HOVER ENTRY ACTIVE
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold font-display text-white">
                      Welcome to the Virtual Tour of: <br/>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                        {property.title}
                      </span>
                    </h3>
                    <p className="text-sm text-neutral-300 leading-relaxed font-sans mt-3">
                      {data.intro}
                    </p>
                    {/* Simulated visual radar */}
                    <div className="h-44 rounded-2xl border border-purple-900/30 bg-purple-950/10 overflow-hidden relative flex items-center justify-center">
                      <img src={property.images[0]} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />
                      <div className="relative text-center space-y-2 select-none">
                        <Navigation className="w-8 h-8 text-purple-400 mx-auto animate-bounce" />
                        <p className="text-xs font-mono text-purple-300 tracking-widest">3D DEPTH MAP RENDERING OVERLAY</p>
                        <p className="text-[10px] text-neutral-500">{property.address}, {property.location}</p>
                      </div>
                    </div>
                  </motion.div>
                ) : currentStep <= data.steps.length ? (
                  /* STEPS 1 to N: Zone walk cycles */
                  <motion.div
                    key={`step-${currentStep}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 font-mono text-[10px] rounded-full bg-purple-500/10 border border-purple-400/20 text-purple-300 tracking-widest">
                        ZONE {currentStep} OF {data.steps.length}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                        SIMULATED STAGE: ACTIVE
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-mono text-purple-400 tracking-wide">HIGHLIGHT AREA</p>
                      <h3 className="text-lg md:text-xl font-bold font-display text-white">
                        {data.steps[currentStep - 1].zone}
                      </h3>
                    </div>

                    <p className="text-xs md:text-sm text-neutral-300 leading-relaxed font-sans">
                      {data.steps[currentStep - 1].description}
                    </p>

                    {/* Staging details */}
                    <div className="p-4 rounded-xl bg-neutral-950/40 border border-purple-900/30 font-mono text-xs text-blue-300 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 animate-pulse text-purple-400" />
                      <span>
                        <strong className="text-purple-300">Designer Finish Highlight:</strong> {data.steps[currentStep - 1].highlight}
                      </span>
                    </div>

                    {/* Dynamic Graphic representation slide */}
                    <div className="h-44 rounded-2xl overflow-hidden relative border border-neutral-800">
                      <img 
                        src={property.images[Math.min(currentStep - 1, property.images.length - 1)]} 
                        alt="Walkthrough slide representation" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-neutral-300">Visual camera matching...</span>
                        <span className="text-emerald-400">FPS: 60/60</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* STEP N+1: Outro Call to Action */
                  <motion.div
                    key="outro"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4 text-center py-4"
                  >
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
                    <h3 className="text-lg md:text-xl font-bold font-display text-white">
                      VR Walkthrough Successfully Completed
                    </h3>
                    <p className="text-xs md:text-sm text-neutral-300 leading-relaxed max-w-md mx-auto font-sans">
                      {data.outro}
                    </p>
                    
                    <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        id="back-first-vr-btn"
                        onClick={() => setCurrentStep(1)}
                        className="px-4 py-2 cursor-pointer rounded-xl bg-neutral-800 hover:bg-neutral-700 transition font-mono text-xs tracking-wider"
                      >
                        RE-PLAY TOUR FROM START
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Controls */}
              <div className="pt-4 border-t border-purple-900/40 flex items-center justify-between">
                <button
                  id="vr-prev-btn"
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                  className="px-4 py-2 rounded-xl text-xs font-mono tracking-widest bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-neutral-800 cursor-pointer text-neutral-300 flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> BACK
                </button>

                <div className="flex gap-1.5">
                  {Array.from({ length: data.steps.length + 2 }).map((_, i) => (
                    <button
                      key={i}
                      id={`vr-nav-dot-${i}`}
                      onClick={() => setCurrentStep(i)}
                      className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
                        currentStep === i ? "bg-purple-400 w-4" : "bg-neutral-700"
                      }`}
                      aria-label={`Jump to stage ${i}`}
                    />
                  ))}
                </div>

                {currentStep < data.steps.length + 1 ? (
                  <button
                    id="vr-next-btn"
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    className="px-4 py-2 rounded-xl text-xs font-mono tracking-widest bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white flex items-center gap-1.5 cursor-pointer glow-purple transition"
                  >
                    NEXT <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    id="vr-finish-btn"
                    onClick={onClose}
                    className="px-5 py-2 rounded-xl text-xs font-mono tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer transition"
                  >
                    FINISH <CheckCircle className="w-4 h-4" />
                  </button>
                )}
              </div>

            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
