import { Zap, MapPin, ShieldCheck, Tag, Users, CreditCard } from "lucide-react";
import { useInView } from "../hooks/useInView";
import "./Features.css";

const FEATURES = [
  { Icon: Zap,         title: "Instant Booking",    desc: "Book a ride in under 30 seconds. No calls, no waiting — just tap, confirm, and go.", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  { Icon: MapPin,      title: "Live GPS Tracking",   desc: "Watch your driver's exact position update in real time — from pickup to drop-off.",   color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  { Icon: ShieldCheck, title: "OTP Verified Rides",  desc: "Every trip starts with a one-time code. Your safety is baked right into the flow.",  color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  { Icon: Tag,         title: "Upfront Pricing",     desc: "See the full fare before you book. No surge surprises, no hidden charges — ever.",    color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  { Icon: Users,       title: "Shared & Personal",   desc: "Share the cost on a shared ride or book personal for privacy and full comfort.",       color: "#f472b6", bg: "rgba(244,114,182,0.1)" },
  { Icon: CreditCard,  title: "UPI & Cash",           desc: "Pay by UPI, digital wallet, or plain cash — whatever works for that journey.",        color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
];

export default function Features() {
  const [ref, inView] = useInView();

  return (
    <section className="features-section" id="features">
      <div className="section">
        <div ref={ref} className={`features-header reveal${inView ? " visible" : ""}`}>
          <p className="section-eyebrow">Why EasyRide</p>
          <h2 className="section-heading">Everything you need<br />in one ride app</h2>
          <p className="section-body">
            Designed from the ground up for Indian roads — fast, safe, and centred around you.
          </p>
        </div>

        <div className={`features-grid stagger${inView ? " visible" : ""}`}>
          {FEATURES.map(({ Icon, title, desc, color, bg }) => (
            <div key={title} className="feat-card">
              <div className="feat-icon-wrap" style={{ background: bg, color }}>
                <Icon size={22} strokeWidth={2} />
              </div>
              <h3 className="feat-title">{title}</h3>
              <p className="feat-desc">{desc}</p>
              <div className="feat-accent" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
