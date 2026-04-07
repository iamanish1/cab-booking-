import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Shield, Star, Users, Navigation, Phone } from "lucide-react";
import { useInView, useCounter } from "../hooks/useInView";
import "./Hero.css";

function StatItem({ value, suffix, label, start }) {
  const count = useCounter(value, 2000, start);
  return (
    <div className="hero-stat">
      <span className="hero-stat-num">{count.toLocaleString()}{suffix}</span>
      <span className="hero-stat-lbl">{label}</span>
    </div>
  );
}

export default function Hero() {
  const [statsRef, statsInView] = useInView();
  const [heroRef, heroInView] = useInView({ threshold: 0.05 });

  return (
    <section className="hero" ref={heroRef}>
      {/* Background elements */}
      <div className="hero-glow-1" />
      <div className="hero-glow-2" />
      <div className="hero-grid" />

      <div className="hero-inner">
        {/* Left column */}
        <div className={`hero-copy${heroInView ? " visible" : ""}`}>
          <div className="hero-badge">
            <span className="live-dot" />
            <span>Live in Delhi NCR · Expanding Soon</span>
          </div>

          <h1 className="hero-title">
            Your Ride,<br />
            <span className="text-gradient">Your Rules.</span>
          </h1>

          <p className="hero-desc">
            Book a cab in 30 seconds. Get matched with a verified nearby driver,
            track them live, and pay your way — no surprises, ever.
          </p>

          <div className="hero-actions">
            <a href="#download" className="btn btn-white">
              Download Free <ArrowRight size={16} />
            </a>
            <a href="#how-it-works" className="btn btn-ghost">
              See how it works
            </a>
          </div>

          <div className="hero-trust">
            <div className="trust-chip">
              <Shield size={13} strokeWidth={2.5} style={{ color: "#22c55e" }} />
              OTP verified
            </div>
            <div className="trust-chip">
              <Navigation size={13} strokeWidth={2.5} style={{ color: "#3b82f6" }} />
              Live GPS
            </div>
            <div className="trust-chip">
              <Star size={13} strokeWidth={2.5} style={{ color: "#f59e0b" }} fill="#f59e0b" />
              4.8 rated
            </div>
          </div>
        </div>

        {/* Phone mockup */}
        <div className={`hero-phone-wrap${heroInView ? " visible" : ""}`}>
          <div className="phone-glow" />
          <div className="phone-outer">
            <div className="phone-frame">
              <div className="phone-notch" />
              <div className="phone-screen">
                {/* Map area */}
                <div className="map-area">
                  <div className="map-roads">
                    <div className="road road-h" style={{ top: "30%" }} />
                    <div className="road road-h" style={{ top: "55%" }} />
                    <div className="road road-h" style={{ top: "75%" }} />
                    <div className="road road-v" style={{ left: "28%" }} />
                    <div className="road road-v" style={{ left: "58%" }} />
                  </div>
                  <div className="map-blocks">
                    <div className="block" style={{ top:"8%", left:"5%", width:42, height:28 }} />
                    <div className="block" style={{ top:"8%", left:"34%", width:60, height:20 }} />
                    <div className="block" style={{ top:"8%", left:"65%", width:44, height:28 }} />
                    <div className="block" style={{ top:"37%", left:"5%", width:36, height:32 }} />
                    <div className="block" style={{ top:"37%", left:"65%", width:50, height:24 }} />
                    <div className="block" style={{ top:"62%", left:"5%", width:48, height:28 }} />
                    <div className="block" style={{ top:"62%", left:"34%", width:52, height:22 }} />
                    <div className="block" style={{ top:"62%", left:"65%", width:38, height:30 }} />
                  </div>

                  {/* Route line */}
                  <svg className="route-svg" viewBox="0 0 200 280" fill="none">
                    <path
                      d="M 60 240 C 60 200, 140 180, 140 140 C 140 100, 80 80, 80 50"
                      stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5 4"
                      strokeLinecap="round" opacity="0.8"
                    />
                  </svg>

                  {/* Driver car */}
                  <div className="map-car">
                    <div className="car-pulse" />
                    <div className="car-icon">
                      <Navigation size={14} strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Pickup pin */}
                  <div className="map-pin pickup-pin">
                    <MapPin size={16} strokeWidth={2.5} />
                  </div>

                  {/* Drop pin */}
                  <div className="map-pin drop-pin">
                    <MapPin size={14} strokeWidth={2.5} />
                  </div>
                </div>

                {/* Driver card */}
                <div className="driver-card-mock">
                  <div className="dcm-status">
                    <span className="dcm-dot" />
                    <span>Driver on the way · 3 min</span>
                  </div>
                  <div className="dcm-row">
                    <div className="dcm-avatar">R</div>
                    <div className="dcm-info">
                      <div className="dcm-name">Rahul Kumar</div>
                      <div className="dcm-meta">
                        <Star size={10} fill="#f59e0b" stroke="none" />
                        <span>4.9</span>
                        <span className="dcm-dot-sep" />
                        <span>DL 01 AB 1234</span>
                      </div>
                    </div>
                    <div className="dcm-actions">
                      <div className="dcm-btn"><Phone size={12} /></div>
                      <div className="dcm-fare">₹120</div>
                    </div>
                  </div>
                  <div className="dcm-track-btn">
                    <Navigation size={12} />
                    Track Live
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <div className="float-badge badge-top-right">
            <Shield size={14} style={{ color: "#22c55e" }} />
            <span>OTP Verified</span>
          </div>
          <div className="float-badge badge-bottom-left">
            <Star size={12} fill="#f59e0b" stroke="none" />
            <span>4.8 / 5.0</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="hero-stats-row" ref={statsRef}>
        <StatItem value={50000} suffix="+" label="Happy Riders" start={statsInView} />
        <div className="stats-sep" />
        <StatItem value={3000} suffix="+" label="Active Drivers" start={statsInView} />
        <div className="stats-sep" />
        <StatItem value={98} suffix="%" label="On-time Rate" start={statsInView} />
        <div className="stats-sep" />
        <StatItem value={4} suffix=".8★" label="App Rating" start={statsInView} />
      </div>
    </section>
  );
}
