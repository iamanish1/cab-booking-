import { Star, Quote } from "lucide-react";
import { useInView } from "../hooks/useInView";
import "./Testimonials.css";

const REVIEWS = [
  { name: "Priya Sharma",  city: "Delhi",     avatar: "P", stars: 5, text: "I've been using EasyRide for 6 months and I'm genuinely impressed. The driver arrived in 4 minutes and the fare was exactly what was quoted — no surprises at all.", tag: "Regular Rider" },
  { name: "Karan Mehta",   city: "Noida",     avatar: "K", stars: 5, text: "The OTP verification makes me feel completely safe. I shared the code, the ride started instantly. Great app — very clean and intuitive design.", tag: "Daily Commuter" },
  { name: "Anjali Verma",  city: "Gurugram",  avatar: "A", stars: 5, text: "Booked a shared ride and split the cost with another passenger. Saved ₹80 on my daily commute. The live GPS tracking is incredibly smooth!", tag: "Shared Ride Fan" },
  { name: "Rohit Gupta",   city: "Delhi",     avatar: "R", stars: 5, text: "I travel late at night and safety is everything. EasyRide's real-time sharing and OTP gives me full peace of mind every single night.", tag: "Night Traveller" },
  { name: "Meera Nair",    city: "Faridabad", avatar: "M", stars: 5, text: "Support resolved my issue within minutes. The app rarely has problems but when it did, the team was incredible. Honestly 10/10.", tag: "Power User" },
  { name: "Deepak Singh",  city: "Noida",     avatar: "D", stars: 5, text: "UPI payment is flawless. I get my receipt instantly with zero extra charges. EasyRide is now my default cab app — deleted all the others.", tag: "Tech Enthusiast" },
];

function StarRow({ count }) {
  return (
    <div className="star-row">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} size={13} strokeWidth={0} fill={i <= count ? "#f59e0b" : "#2a2a2a"} />
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [ref, inView] = useInView();

  return (
    <section className="testimonials-section">
      <div className="section">
        <div ref={ref} className={`testi-header reveal${inView ? " visible" : ""}`}>
          <p className="section-eyebrow">Loved by Riders</p>
          <h2 className="section-heading">Real riders,<br />real experiences</h2>

          <div className="rating-banner">
            <div className="rb-left">
              <span className="rb-number">4.8</span>
              <div>
                <StarRow count={5} />
                <div className="rb-sub">Based on 12,400+ reviews</div>
              </div>
            </div>
            <div className="rb-divider" />
            <div className="rb-right">
              <div className="rb-stat"><span className="rb-stat-n">50K+</span><span className="rb-stat-l">Happy Riders</span></div>
              <div className="rb-stat-sep" />
              <div className="rb-stat"><span className="rb-stat-n">98%</span><span className="rb-stat-l">Recommend</span></div>
            </div>
          </div>
        </div>

        <div className={`reviews-grid stagger${inView ? " visible" : ""}`}>
          {REVIEWS.map((r) => (
            <div key={r.name} className="review-card">
              <div className="review-top">
                <StarRow count={r.stars} />
                <Quote size={16} className="review-quote-icon" />
              </div>
              <p className="review-text">{r.text}</p>
              <div className="review-author">
                <div className="review-av">{r.avatar}</div>
                <div className="review-author-info">
                  <div className="review-name">{r.name}</div>
                  <div className="review-city">{r.city} · {r.tag}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
