import { useEffect, useRef, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import type { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
export default function MapPreview() {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const style = import.meta.env.VITE_MAP_STYLE_URL;
  useEffect(() => {
    if (!style || !container.current) return;
    let map: Map | undefined;
    let active = true;
    void import("maplibre-gl")
      .then(({ Map, NavigationControl }) => {
        if (!active || !container.current) return;
        map = new Map({
          container: container.current,
          style,
          center: [-71.078, 42.776],
          zoom: 10,
        });
        map.on("error", () => {
          if (active) setFailed(true);
        });
        map.addControl(new NavigationControl(), "top-right");
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      map?.remove();
    };
  }, [style]);
  return (
    <div className="map-panel">
      {style && !failed ? (
        <div ref={container} className="map-canvas" aria-label="Map preview" />
      ) : (
        <div className="map-fallback">
          <div className="map-contours" aria-hidden="true" />
          <span className="map-pin">
            <MapIcon size={28} />
          </span>
          <strong>
            {failed ? "Map unavailable" : "A little room for discovery"}
          </strong>
          <p>
            {failed
              ? "The map could not load. Please try again later."
              : "Live maps and routing are on the horizon. You can explore your drive preferences below."}
          </p>
          <span className="badge">Preview · no live routing</span>
        </div>
      )}
    </div>
  );
}
