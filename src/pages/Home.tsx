import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Compass,
  Leaf,
  ShieldCheck,
  Mountain,
  Wind,
  Sun,
} from "lucide-react";
import ScenicPhoto from "../components/ScenicPhoto";
export default function Home() {
  return (
    <div className="stack home-page">
      <section className="hero">
        <ScenicPhoto eager className="hero-photo" />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="eyebrow light">
            <span className="small-line" /> A LITTLE CURIOSITY GOES A LONG WAY
          </span>
          <h1>
            Take the road
            <br />
            that feels like <em>you.</em>
          </h1>
          <p>
            Less rush. More wonder. Make room for a peaceful drive and discover
            a little more along the way.
          </p>
          <Link className="button cream-button" to="/explore">
            Plan Your Drive <ArrowUpRight size={20} />
          </Link>
        </div>
        <div className="hero-foot">
          <span>
            <Compass size={17} /> Made for the journey
          </span>
          <span>Rocky Mountain National Park · Photo by David Moum</span>
        </div>
      </section>
      <section className="welcome-row">
        <div>
          <span className="eyebrow">WELCOME TO A DIFFERENT KIND OF DRIVE</span>
          <h2>
            A change of scenery.
            <br />A change of pace.
          </h2>
        </div>
        <p>
          Thrive is a space to discover unfamiliar roads, grow your confidence,
          and enjoy the world beyond your usual route. Start with a plan that
          suits you.
        </p>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
            <h2>What kind of day is it?</h2>
          </div>
          <span className="section-note">Ideas for your next plan</span>
        </div>
        <div className="inspiration-grid">
          {[
            {
              title: "The scenic way",
              icon: Mountain,
              style: "Scenic",
              minutes: 45,
              text: "Leave a little room for a beautiful view.",
              tone: "forest",
            },
            {
              title: "A quieter moment",
              icon: Wind,
              style: "Relaxing",
              minutes: 30,
              text: "Slow the pace. Let the everyday fade.",
              tone: "sage",
            },
            {
              title: "A small adventure",
              icon: Sun,
              style: "City exploration",
              minutes: 15,
              text: "See a familiar place with fresh eyes.",
              tone: "sand",
            },
          ].map(({ title, icon: Icon, style, minutes, text, tone }) => (
            <Link
              className={`inspiration-card ${tone}`}
              key={title}
              to={`/explore?style=${encodeURIComponent(style)}&minutes=${minutes}`}
            >
              <span className="inspiration-icon">
                <Icon size={30} />
              </span>
              <span className="eyebrow">{minutes} MINUTE PLAN</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="card-action">
                Make it your own <ArrowUpRight size={19} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="journey-strip">
        <span className="icon-tile">
          <Leaf size={28} />
        </span>
        <div>
          <h2>Every explorer starts somewhere.</h2>
          <p>
            Create your profile, find your interests, and make Thrive your own.
          </p>
        </div>
        <Link to="/profile" className="button">
          Find your place <ArrowRight size={18} />
        </Link>
      </section>
      <p className="safety-note">
        <ShieldCheck size={18} /> Plan while parked. Live routing and navigation
        are not available yet.
      </p>
    </div>
  );
}
