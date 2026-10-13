import { Link } from "react-router-dom";
import { Route, Users, ShieldCheck, ArrowUpRight } from "lucide-react";
import EmptyState from "../components/EmptyState";
import ScenicPhoto from "../components/ScenicPhoto";
export default function Community() {
  return (
    <section className="stack">
      <div className="page-intro">
        <div>
          <span className="eyebrow">GOOD ROADS. GOOD COMPANY.</span>
          <h1>Some things are better shared.</h1>
          <p>
            A future home for the roads you love and the people who find them.
          </p>
        </div>
        <span className="badge">Community preview</span>
      </div>
      <div className="community-hero">
        <ScenicPhoto />
        <div>
          <span className="eyebrow light">THE ROAD AHEAD</span>
          <h2>
            One day, your favorite detour
            <br />
            could be someone’s next discovery.
          </h2>
        </div>
      </div>
      <div className="panel">
        <div className="section-heading">
          <h2>Routes from the community</h2>
          <span className="badge">Coming later</span>
        </div>
        <EmptyState icon={Route} title="A fresh page for new adventures">
          No community routes yet. Route publishing, real distances, durations
          and reviews will arrive with the tools to record and verify them.
        </EmptyState>
        <div className="center">
          <Link className="button" to="/explore">
            Explore the planner <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
      <div className="feature-row">
        <div>
          <Users size={24} />
          <h3>A welcoming place</h3>
          <p>New drivers, weekend explorers and everyone in between.</p>
        </div>
        <div>
          <ShieldCheck size={24} />
          <h3>Thoughtful sharing</h3>
          <p>
            Privacy and moderation will come before public route publishing.
          </p>
        </div>
      </div>
    </section>
  );
}
