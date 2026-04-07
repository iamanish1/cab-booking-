import { Smartphone, MapPin, UserCheck, CheckCircle } from "lucide-react";
import { useInView } from "../hooks/useInView";
import "./HowItWorks.css";

const STEPS = [
  {
    num: "01",
    Icon: Smartphone,
    title: "Download the App",
    desc: "Get EasyRide free on Android or iOS. Create your account in under a minute with just your phone number.",
    color: "#22c55e",
  },
  {
    num: "02",
    Icon: MapPin,
    title: "Set Your Destination",
    desc: "Your GPS auto-fills the pickup. Search or pin-drop your destination anywhere on the live map.",
    color: "#3b82f6",
  },
  {
    num: "03",
    Icon: UserCheck,
    title: "Driver Matched Instantly",
    desc: "Our system finds the nearest verified driver in seconds. See their name, rating, vehicle, and ETA.",
    color: "#a78bfa",
  },
  {
    num: "04",
    Icon: CheckCircle,
    title: "Ride, Verify & Pay",
    desc: "Verify with OTP to start the ride. Enjoy a safe trip and pay by UPI or cash on arrival.",
    color: "#f59e0b",
  },
];

export default function HowItWorks() {
  const [ref, inView] = useInView();

  return (
    <section id="how-it-works">
      <div className="section">
        <div ref={ref} className={`hiw-header reveal${inView ? " visible" : ""}`}>
          <p className="section-eyebrow">Simple Process</p>
          <h2 className="section-heading">From tap to destination<br />in 4 easy steps</h2>
          <p className="section-body">
            No learning curve. No complexity. Just open the app and ride.
          </p>
        </div>

        <div className={`steps-container stagger${inView ? " visible" : ""}`}>
          {STEPS.map(({ num, Icon, title, desc, color }, i) => (
            <div key={num} className="step-item">
              <div className="step-left">
                <div className="step-number-wrap">
                  <div className="step-number" style={{ color }}>{num}</div>
                  {i < STEPS.length - 1 && <div className="step-connector" />}
                </div>
              </div>
              <div className="step-content">
                <div className="step-icon-ring" style={{ background: `${color}15`, borderColor: `${color}30`, color }}>
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div className="step-text">
                  <h3 className="step-title">{title}</h3>
                  <p className="step-desc">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
