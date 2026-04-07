import { Smartphone, Star, Download as DownloadIcon, Zap, Shield, Clock, ArrowRight } from "lucide-react";
import { useInView, useCounter } from "../hooks/useInView";
import "./Download.css";

const BADGES = [
  { label: "App Store", sub: "Download on the", icon: "apple" },
  { label: "Google Play", sub: "Get it on", icon: "android" },
];

const QUICK_STATS = [
  { Icon: Star,      value: "4.8★", label: "Rating"      },
  { Icon: Zap,       value: "<4min", label: "Avg Pickup"  },
  { Icon: Shield,    value: "100%",  label: "Safe Rides"  },
  { Icon: Clock,     value: "24/7",  label: "Available"   },
];

function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function AndroidIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.523 15.341c-.23 0-.416-.186-.416-.416V9.402c0-.23.186-.416.416-.416s.416.186.416.416v5.523c0 .23-.186.416-.416.416zm-11.046 0c-.23 0-.416-.186-.416-.416V9.402c0-.23.186-.416.416-.416s.416.186.416.416v5.523c0 .23-.186.416-.416.416zm1.461 2.503c0 .459.373.832.832.832h.832v2.492c0 .459.373.832.832.832s.832-.373.832-.832v-2.492h1.664v2.492c0 .459.373.832.832.832s.832-.373.832-.832v-2.492h.832c.459 0 .832-.373.832-.832V9.219H7.938zm3.94-11.668l.786-1.401a.164.164 0 0 0-.286-.162l-.795 1.416A5.285 5.285 0 0 0 12 5.754c-.757 0-1.476.165-2.123.461L9.082 4.8a.164.164 0 0 0-.286.162l.786 1.4A5.285 5.285 0 0 0 6.75 9.219h10.5c0-1.397-.684-2.637-1.732-3.457zM10.5 7.875a.375.375 0 1 1 0-.75.375.375 0 0 1 0 .75zm3 0a.375.375 0 1 1 0-.75.375.375 0 0 1 0 .75z"/>
    </svg>
  );
}

export default function Download() {
  const [ref, inView]       = useInView();
  const [statsRef, statsIn] = useInView();
  const downloads           = useCounter(500000, 2200, statsIn);

  return (
    <section id="download" className="download-section">
      <div className="dl-glow-left" />
      <div className="dl-glow-right" />

      <div className="section">
        <div ref={ref} className={`dl-inner reveal${inView ? " visible" : ""}`}>

          {/* Left: text + badges */}
          <div className="dl-left">
            <div className="dl-eyebrow">
              <DownloadIcon size={14} />
              Free to Download
            </div>
            <h2 className="dl-heading">
              Start your first ride<br />
              <span className="dl-heading-accent">in under 60 seconds</span>
            </h2>
            <p className="dl-body">
              No sign-up fees. No hidden charges. Download EasyRide, set your pickup, and your driver arrives fast — every time.
            </p>

            <div className="dl-badges">
              <a href="#" className="dl-badge">
                <AppleIcon />
                <div className="dl-badge-text">
                  <span className="dl-badge-sub">Download on the</span>
                  <span className="dl-badge-main">App Store</span>
                </div>
              </a>
              <a href="#" className="dl-badge">
                <AndroidIcon />
                <div className="dl-badge-text">
                  <span className="dl-badge-sub">Get it on</span>
                  <span className="dl-badge-main">Google Play</span>
                </div>
              </a>
            </div>

            <div ref={statsRef} className={`dl-quick-stats stagger${statsIn ? " visible" : ""}`}>
              {QUICK_STATS.map(({ Icon, value, label }) => (
                <div key={label} className="dl-qs-item">
                  <Icon size={15} className="dl-qs-icon" />
                  <span className="dl-qs-value">{value}</span>
                  <span className="dl-qs-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: phone + floating cards */}
          <div className="dl-right">
            <div className="dl-phone-wrap">
              <div className="dl-phone">
                <div className="dl-phone-notch" />

                {/* Success screen */}
                <div className="dl-phone-screen">
                  <div className="dl-ps-top">
                    <div className="dl-ps-back" />
                    <div className="dl-ps-title">Ride Confirmed</div>
                  </div>
                  <div className="dl-ps-success-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  </div>
                  <div className="dl-ps-great">Driver on the way!</div>
                  <div className="dl-ps-eta">Arriving in <strong>4 min</strong></div>

                  <div className="dl-ps-driver-card">
                    <div className="dl-ps-av">R</div>
                    <div className="dl-ps-dinfo">
                      <div className="dl-ps-dname">Rajesh K.</div>
                      <div className="dl-ps-dmeta">
                        <Star size={10} fill="#f59e0b" stroke="none" />
                        &nbsp;4.9 · Swift Dzire · DL-8C-AB-1234
                      </div>
                    </div>
                    <div className="dl-ps-call">
                      <Smartphone size={13} />
                    </div>
                  </div>

                  <div className="dl-ps-fare-row">
                    <span className="dl-ps-fare-label">Estimated Fare</span>
                    <span className="dl-ps-fare-value">₹186</span>
                  </div>

                  <div className="dl-ps-track-btn">Track on Map</div>
                </div>
              </div>

              {/* Floating badge: downloads */}
              <div className="dl-float-badge dl-float-top">
                <div className="dl-fb-icon-wrap">
                  <DownloadIcon size={14} color="#22c55e" />
                </div>
                <div>
                  <div className="dl-fb-value">{downloads >= 500000 ? "500K+" : `${(downloads / 1000).toFixed(0)}K+`}</div>
                  <div className="dl-fb-label">Downloads</div>
                </div>
              </div>

              {/* Floating badge: safe rides */}
              <div className="dl-float-badge dl-float-bottom">
                <div className="dl-fb-icon-wrap dl-fb-icon-blue">
                  <Shield size={14} color="#3b82f6" />
                </div>
                <div>
                  <div className="dl-fb-value">100%</div>
                  <div className="dl-fb-label">Safe Rides</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
