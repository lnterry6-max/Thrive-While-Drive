import { useState, type ReactNode } from "react";
import {
  Award,
  Route,
  Users,
  LockKeyhole,
  Globe2,
  Compass,
} from "lucide-react";
import type { ProfileRecord } from "../lib/profile";
import ProfileImage from "./ProfileImage";
import EmptyState from "./EmptyState";
export default function ProfileView({
  profile,
  actions,
  children,
}: {
  profile: ProfileRecord;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const [tab, setTab] = useState("routes");
  const name = profile.display_name || profile.username || "A new explorer";
  return (
    <section className="stack profile-page">
      <div className="profile-card">
        <div className="profile-cover">
          <ProfileImage path={profile.banner_path} kind="banner" name={name} />
          <span className="cover-caption">A little room for possibility</span>
        </div>
        <div className="profile-identity">
          <div className="avatar">
            <ProfileImage
              path={profile.avatar_path}
              kind="avatar"
              name={name}
            />
          </div>
          <div className="profile-actions">{actions}</div>
          <div className="profile-name">
            <h1>{name}</h1>
            {profile.username && (
              <p className="username">@{profile.username}</p>
            )}
            <span className="visibility-label">
              {profile.visibility === "private" ? (
                <LockKeyhole size={13} />
              ) : (
                <Globe2 size={13} />
              )}{" "}
              {profile.visibility === "private"
                ? "Private profile"
                : "Public profile"}
            </span>
          </div>
          <p className="bio">
            {profile.bio ||
              "Every explorer has a story. Yours is just beginning."}
          </p>
          <div className="tag-grid">
            {profile.tags.map((tag) => (
              <span className="interest-badge" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      {children}
      <div className="profile-grid">
        <div className="panel">
          <div className="section-heading">
            <span className="eyebrow">YOUR EXPLORATION STORY</span>
            <Compass size={21} />
          </div>
          <h2>Good things take a little exploring.</h2>
          <p className="spaced">
            Drive recording is coming later. Your real distances, discoveries
            and milestones will appear here when it arrives.
          </p>
          <div className="stat-empty">
            <span>
              Distance explored<strong>Not recorded yet</strong>
            </span>
            <span>
              Places discovered<strong>Not recorded yet</strong>
            </span>
          </div>
        </div>
        <div className="panel quote-card">
          <span className="eyebrow">A GENTLE REMINDER</span>
          <h2>
            There’s no finish line
            <br />
            to curiosity.
          </h2>
          <p>
            Explore at your own pace. Plan while parked, and keep your attention
            on the road.
          </p>
        </div>
      </div>
      <div className="panel profile-collection">
        <div
          className="section-tabs"
          role="group"
          aria-label="Profile sections"
        >
          {[
            ["routes", "Routes"],
            ["achievements", "Achievements"],
            ["friends", "Friends"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "routes" ? (
          <EmptyState icon={Route} title="Your roads, your stories">
            Community publishing is on its way. No routes have been published
            here.
          </EmptyState>
        ) : tab === "achievements" ? (
          <EmptyState icon={Award} title="The best milestones are real ones">
            Achievements will arrive with verified exploration activity.
          </EmptyState>
        ) : (
          <EmptyState icon={Users} title="There’s room for good company">
            Friends and connection requests are coming in a later release.
          </EmptyState>
        )}
      </div>
    </section>
  );
}
