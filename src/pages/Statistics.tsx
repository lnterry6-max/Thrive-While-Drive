import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
export default function Statistics() {
  return (
    <section className="stack">
      <span className="eyebrow">EVERY ROAD HAS A STORY</span>
      <h1>
        Make memories.
        <br />
        The miles can wait.
      </h1>
      <p>
        Your exploration story will grow with you. Recording and verified
        statistics are coming in a later release.
      </p>
      <div className="panel">
        <EmptyState icon={Compass} title="Your journey is yours to write">
          Thrive isn’t recording your drives or location. When tracking is
          available, this space will show your real progress—with your
          permission.
        </EmptyState>
        <div className="center">
          <Link className="button primary" to="/explore">
            Plan a little discovery
          </Link>
        </div>
      </div>
    </section>
  );
}
