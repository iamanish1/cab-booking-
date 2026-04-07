import { MapPin, Navigation, ShieldCheck, Star, Phone, Banknote } from "lucide-react";
import { useInView } from "../hooks/useInView";
import "./AppScreenshots.css";

function BookScreen() {
  return (
    <div className="ss-screen">
      <div className="ss-topbar">
        <span className="ss-topbar-title">Book a Ride</span>
      </div>
      <div className="ss-map-bg">
        <div className="ss-map-grid" />
        <div className="ss-map-road-h" style={{ top: "40%" }} />
        <div className="ss-map-road-h" style={{ top: "65%" }} />
        <div className="ss-map-road-v" style={{ left: "35%" }} />
        <div className="ss-map-pin" style={{ top: "36%", left: "31%" }}>
          <MapPin size={18} color="#22c55e" strokeWidth={2.5} />
        </div>
        <div className="ss-map-pin" style={{ top: "16%", left: "62%" }}>
          <MapPin size={14} color="#ef4444" strokeWidth={2.5} />
        </div>
        <svg className="ss-route" viewBox="0 0 180 200" fill="none">
          <path d="M 60 160 C 60 120, 130 100, 130 60" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="ss-card">
        <div className="ss-dest-row">
          <MapPin size={12} color="#6b7280" />
          <span className="ss-dest-text">Drop your destination</span>
        </div>
        <div className="ss-types">
          <div className="ss-type-pill active">Personal</div>
          <div className="ss-type-pill">Shared</div>
        </div>
        <div className="ss-book-btn">Book Now · ₹150</div>
      </div>
    </div>
  );
}

function TrackScreen() {
  return (
    <div className="ss-screen">
      <div className="ss-topbar">
        <span className="ss-topbar-title">Track Driver</span>
      </div>
      <div className="ss-map-bg">
        <div className="ss-map-grid" />
        <div className="ss-map-road-h" style={{ top: "45%" }} />
        <div className="ss-map-road-v" style={{ left: "40%" }} />
        <div className="ss-car-wrap">
          <div className="ss-car-ring" />
          <div className="ss-car-dot"><Navigation size={12} color="#fff" strokeWidth={2.5} /></div>
        </div>
        <div className="ss-map-pin" style={{ top: "28%", left: "58%" }}>
          <MapPin size={14} color="#22c55e" strokeWidth={2.5} />
        </div>
        <div className="ss-eta-chip">
          <Navigation size={10} strokeWidth={2.5} />
          ETA 3 min
        </div>
      </div>
      <div className="ss-card">
        <div className="ss-status-row">
          <span className="ss-green-dot" />
          <span className="ss-status-text">Driver is on the way</span>
        </div>
        <div className="ss-driver-row">
          <div className="ss-driver-av">A</div>
          <div className="ss-driver-info">
            <div className="ss-driver-name">Amit S.</div>
            <div className="ss-driver-meta">
              <Star size={9} fill="#f59e0b" stroke="none" /> 4.8 · DL02CD5678
            </div>
          </div>
          <div className="ss-call-chip"><Phone size={11} /></div>
        </div>
      </div>
    </div>
  );
}

function OtpScreen() {
  return (
    <div className="ss-screen ss-otp-screen">
      <div className="ss-topbar">
        <span className="ss-topbar-title">Your OTP</span>
      </div>
      <div className="ss-otp-body">
        <div className="ss-otp-icon-wrap">
          <ShieldCheck size={28} color="#22c55e" strokeWidth={1.8} />
        </div>
        <div className="ss-otp-label">Your Ride OTP</div>
        <div className="ss-otp-sub">Share this with your driver</div>
        <div className="ss-otp-digits">
          {["7","3","4","2"].map((d, i) => (
            <div key={i} className="ss-otp-digit">{d}</div>
          ))}
        </div>
        <div className="ss-pay-row">
          <Banknote size={12} color="#6b7280" />
          <span className="ss-pay-label">Total Fare</span>
          <span className="ss-pay-amount">₹150</span>
        </div>
        <div className="ss-pay-methods">
          <div className="ss-pay-chip active">UPI</div>
          <div className="ss-pay-chip">Cash</div>
        </div>
      </div>
    </div>
  );
}

const SCREENS = [
  { label: "Book a Ride",      color: "#3b82f6", Component: BookScreen  },
  { label: "Track Your Driver", color: "#22c55e", Component: TrackScreen },
  { label: "OTP & Payment",    color: "#a78bfa", Component: OtpScreen   },
];

export default function AppScreenshots() {
  const [ref, inView] = useInView();

  return (
    <section className="screenshots-section">
      <div className="section">
        <div ref={ref} className={`ss-header reveal${inView ? " visible" : ""}`}>
          <p className="section-eyebrow">App Preview</p>
          <h2 className="section-heading">See EasyRide in action</h2>
          <p className="section-body">
            A beautifully clean experience — book, track, and pay from a single screen.
          </p>
        </div>

        <div className={`ss-phones-row stagger${inView ? " visible" : ""}`}>
          {SCREENS.map(({ label, color, Component }) => (
            <div key={label} className="ss-phone-item">
              <div className="ss-phone-outer" style={{ borderColor: `${color}30` }}>
                <div className="ss-notch" />
                <Component />
              </div>
              <div className="ss-phone-label" style={{ color }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
