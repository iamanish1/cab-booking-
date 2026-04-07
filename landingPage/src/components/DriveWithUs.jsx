import { Wallet, Clock, TrendingUp, ShieldCheck, Star, ArrowRight } from "lucide-react";
import { useInView, useCounter } from "../hooks/useInView";
import "./DriveWithUs.css";

const PERKS = [
  { Icon: Wallet,      title: "Daily Payouts",   desc: "Withdraw your earnings every single day. No waiting, no bank delays." },
  { Icon: Clock,       title: "Flexible Hours",  desc: "Drive whenever you want. No fixed shifts, no boss, no pressure." },
  { Icon: TrendingUp,  title: "Surge Bonuses",   desc: "Earn more during peak hours with automatic fare multipliers." },
  { Icon: ShieldCheck, title: "Fully Insured",   desc: "Every ride is covered under our comprehensive driver protection plan." },
];

function EarningsCard({ start }) {
  const earned = useCounter(38400, 2200, start);

  return (
    <div className="earnings-card">
      <div className="ec-header">
        <div className="ec-avatar">S</div>
        <div className="ec-info">
          <div className="ec-name">Suresh M.</div>
          <div className="ec-meta">Delhi · 3 years driving</div>
        </div>
        <div className="ec-rating">
          <Star size={13} fill="#f59e0b" stroke="none" />
          4.9
        </div>
      </div>

      <div className="ec-earnings-block">
        <div className="ec-earn-label">This Month</div>
        <div className="ec-earn-value">₹{earned.toLocaleString()}</div>
        <div className="ec-bar-track">
          <div className="ec-bar-fill" style={{ width: start ? "82%" : "0%" }} />
        </div>
        <div className="ec-bar-meta">82% of ₹47,000 goal</div>
      </div>

      <div className="ec-stats">
        <div className="ec-stat"><span className="ec-stat-n">247</span><span className="ec-stat-l">Rides</span></div>
        <div className="ec-stat-sep" />
        <div className="ec-stat"><span className="ec-stat-n">18</span><span className="ec-stat-l">Days Active</span></div>
        <div className="ec-stat-sep" />
        <div className="ec-stat"><span className="ec-stat-n">₹155</span><span className="ec-stat-l">Avg / Ride</span></div>
      </div>

      <div className="ec-quote">
        "EasyRide gives me the freedom to work on my terms. Best decision I ever made!"
      </div>
    </div>
  );
}

export default function DriveWithUs() {
  const [leftRef, leftInView]   = useInView();
  const [rightRef, rightInView] = useInView();

  return (
    <section id="drive" className="drive-section">
      <div className="drive-wrapper">
        <div ref={leftRef} className={`drive-left reveal-left${leftInView ? " visible" : ""}`}>
          <p className="section-eyebrow">For Drivers</p>
          <h2 className="section-heading">Turn your car<br />into real income</h2>
          <p className="section-body">
            Join thousands of drivers already earning with EasyRide.
            Set your own schedule, choose your rides, and get paid daily.
          </p>

          <div className="drive-perks">
            {PERKS.map(({ Icon, title, desc }) => (
              <div key={title} className="perk-row">
                <div className="perk-icon-wrap">
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div>
                  <div className="perk-title">{title}</div>
                  <div className="perk-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <a href="#download" className="btn btn-white" style={{ marginTop: 36, alignSelf: "flex-start" }}>
            Download Driver App <ArrowRight size={16} />
          </a>
        </div>

        <div ref={rightRef} className={`drive-right reveal-right${rightInView ? " visible" : ""}`}>
          <EarningsCard start={rightInView} />
        </div>
      </div>
    </section>
  );
}
