import { useEffect, useRef, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Compass, Map as MapIcon, Users, BarChart3, UserRound, Navigation, ShieldCheck } from "lucide-react";
import Profile from "./Profile";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const tabs = [{path:"/",label:"Home",icon:Compass},{path:"/explore",label:"Explore",icon:MapIcon},{path:"/community",label:"Community",icon:Users},{path:"/statistics",label:"Stats",icon:BarChart3},{path:"/profile",label:"Profile",icon:UserRound}];
const styles = ["Scenic","Relaxing","Peaceful","Slow cruise","City exploration","Exciting"];
function Planner(){
 const [start,setStart]=useState("Current location"),[end,setEnd]=useState("Same as start"),[area,setArea]=useState(""),[minutes,setMinutes]=useState(30),[style,setStyle]=useState("Scenic");
 const [avoid,setAvoid]=useState({highways:true,traffic:true,intersections:false});
 return <section className="stack"><div className="eyebrow">PLAN YOUR NEXT DRIVE</div><h1>Find your next favorite road.</h1><p>Pick a place, choose your pace, and plan an exploration loop that brings you back.</p>
 <div className="panel stack">
 <label>Starting location<input value={start} onChange={e=>setStart(e.target.value)}/></label>
 <label>Ending location<input value={end} onChange={e=>setEnd(e.target.value)}/></label>
 <label>Explore a city or area<input placeholder="e.g. Boston, MA" value={area} onChange={e=>setArea(e.target.value)}/></label>
 <label>Time exploring<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{[15,30,45,60,90].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label>
 <label>Drive style<select value={style} onChange={e=>setStyle(e.target.value)}>{styles.map(s=><option key={s}>{s}</option>)}</select></label>
 <fieldset><legend>Road preferences</legend>{([["highways","Avoid highways"],["traffic","Avoid heavy traffic"],["intersections","Avoid complex intersections"]] as const).map(([key,label])=><label className="check" key={key}><input type="checkbox" checked={avoid[key]} onChange={e=>setAvoid({...avoid,[key]:e.target.checked})}/>{label}</label>)}</fieldset>
 <div className="summary"><strong>Your planned drive</strong><span>{area || "Select an exploration area"} · {minutes} minutes exploring · {style}</span><small>Outbound and return travel times will be added after a live routing provider is configured. This is not a navigable route yet.</small></div>
 <button disabled className="primary" title="Routing integration is not configured yet"><Navigation size={18}/> Generate route — coming soon</button>
 </div></section>;
}
function MapPreview(){
 const container=useRef<HTMLDivElement>(null);
 const [failed,setFailed]=useState(false);
 const style=import.meta.env.VITE_MAP_STYLE_URL;
 useEffect(()=>{
  if(!style||!container.current)return;
  let map: maplibregl.Map | undefined;
  try {
   map=new maplibregl.Map({container:container.current,style,center:[-71.078,42.776],zoom:10});
   map.on("error",()=>setFailed(true));
   map.addControl(new maplibregl.NavigationControl(),"top-right");
  } catch { setFailed(true); }
  return()=>map?.remove();
 },[style]);
 return <div className="map-panel">{style&&!failed?<div ref={container} className="map-canvas"/>:<div className="map-fallback"><MapIcon size={42}/><strong>{failed?"Map unavailable":"Map ready to connect"}</strong><p>{failed?"The map could not load. Check your map provider configuration and connection.":"Add VITE_MAP_STYLE_URL to display your map provider's licensed map tiles."}</p></div>}</div>;
}
function Home(){return <section className="stack"><span className="eyebrow">THRIVE WHILE YOU DRIVE</span><h1>A new way to explore.</h1><p>Discover comfortable drives, learn your surroundings, and find great routes shared by your community.</p><MapPreview/><div className="panel"><h2>Start exploring</h2><p>Your roads are waiting. Plan an exploration drive from anywhere.</p><NavLink className="primary link-button" to="/explore">Plan a drive <Navigation size={18}/></NavLink></div></section>}
function Placeholder({title,description}:{title:string,description:string}){return <section className="stack"><span className="eyebrow">COMING IN A LATER MILESTONE</span><h1>{title}</h1><p>{description}</p><div className="panel"><ShieldCheck size={30}/><h2>Built thoughtfully</h2><p>Real location and community features will launch with privacy, safety, and moderation controls.</p></div></section>}
export default function App(){return <div className="app"><header className="topbar"><div className="brand"><span className="brand-mark"><Compass size={23}/></span><span>Thrive<span className="muted"> While You Drive</span></span></div><span className="alpha">EARLY DEVELOPMENT</span></header><div className="layout"><aside className="sidebar"><nav>{tabs.map(({path,label,icon:Icon})=><NavLink end={path==="/"} key={path} to={path} className={({isActive})=>isActive?"nav-item active":"nav-item"}><Icon size={20}/>{label}</NavLink>)}</nav></aside><main><Routes><Route path="/" element={<Home/>}/><Route path="/explore" element={<Planner/>}/><Route path="/community" element={<Placeholder title="Routes worth sharing." description="Record, review, and share enjoyable routes with other drivers."/>}/><Route path="/statistics" element={<Placeholder title="Every road is a discovery." description="See where you've explored and track your progress across towns and cities."/>}/><Route path="/profile" element={<Profile/>}/></Routes></main></div><nav className="bottom-nav" aria-label="Main navigation">{tabs.map(({path,label,icon:Icon})=><NavLink end={path==="/"} key={path} to={path} className={({isActive})=>isActive?"bottom-item active":"bottom-item"}><Icon size={21}/><span>{label}</span></NavLink>)}</nav></div>}