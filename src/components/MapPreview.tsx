import { useEffect, useRef, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { routeBounds, type Place, type PlannedRoute } from "../lib/routePlanner";
import "maplibre-gl/dist/maplibre-gl.css";

const FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export default function MapPreview({
  route = null,
  focus = null,
}: {
  route?: PlannedRoute | null;
  focus?: Place | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const currentMap = useRef<Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const style = import.meta.env.VITE_MAP_STYLE_URL?.trim() || FREE_MAP_STYLE;

  useEffect(() => {
    if (!container.current) return;
    let map: Map | undefined;
    let active = true;
    void import("maplibre-gl")
      .then(({ Map, NavigationControl }) => {
        if (!active || !container.current) return;
        map = new Map({
          container: container.current,
          style,
          center: [-97, 39],
          zoom: 3.7,
        });
        currentMap.current = map;
        map.on("load", () => {
          if (active) setLoaded(true);
        });
        map.on("error", () => {
          if (active) setFailed(true);
        });
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      currentMap.current = null;
      map?.remove();
    };
  }, [style]);

  useEffect(() => {
    const map = currentMap.current;
    if (!map || !loaded || failed) return;
    const coordinates = route?.coordinates ?? [];
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates,
      },
    };
    const source = map.getSource("planned-route") as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource("planned-route", { type: "geojson", data });
      map.addLayer({
        id: "planned-route-outline",
        type: "line",
        source: "planned-route",
        paint: { "line-color": "#fffefa", "line-width": 9, "line-opacity": 0.85 },
      });
      map.addLayer({
        id: "planned-route-line",
        type: "line",
        source: "planned-route",
        paint: { "line-color": "#28745d", "line-width": 5, "line-opacity": 0.98 },
      });
    }
    const bounds = routeBounds(coordinates);
    if (bounds) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
    } else if (focus) {
      map.easeTo({
        center: [focus.longitude, focus.latitude],
        zoom: 11,
        duration: 0,
      });
    }
  }, [loaded, failed, route, focus]);

  return (
    <div className="map-panel map-live-panel">
      {!failed ? (
        <>
          <div
            ref={container}
            className="map-canvas"
            role="img"
            aria-label={route ? "Map with planned driving route" : "Interactive OpenStreetMap road map"}
          />
          <span className="map-live-badge">Real map · OpenStreetMap</span>
        </>
      ) : (
        <div className="map-fallback">
          <div className="map-contours" aria-hidden="true" />
          <span className="map-pin"><MapIcon size={28} /></span>
          <strong>Map unavailable</strong>
          <p>The road map could not load. Check your connection or try again later.</p>
          <span className="badge">No location tracking</span>
        </div>
      )}
    </div>
  );
}
