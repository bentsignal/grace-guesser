import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { MAP_HEIGHT, MAP_WIDTH } from "../game/config";
import type { Grace, Point } from "../game/types";
import { addProgressiveMapOverlay } from "./mapOverlay";

export interface EditableGrace extends Grace {
  isChanged: boolean;
  isSelected: boolean;
}

interface GraceEditorMapProps {
  graces: EditableGrace[];
  selectedId: number;
  focusRequestId: number;
  onCenterChange: (p: Point) => void;
  onSelect: (id: number) => void;
  onMove: (id: number, p: Point) => void;
}

const toLatLng = (p: Point): [number, number] => [(1 - p.y) * MAP_HEIGHT, p.x * MAP_WIDTH];
const fromLatLng = (lat: number, lng: number): Point => ({
  x: Math.min(1, Math.max(0, lng / MAP_WIDTH)),
  y: Math.min(1, Math.max(0, 1 - lat / MAP_HEIGHT)),
});

function markerHtml(grace: EditableGrace) {
  const classes = [
    "er-editor-marker",
    grace.isChanged ? "er-editor-marker-changed" : "",
    grace.isSelected ? "er-editor-marker-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<div class="${classes}"></div>`;
}

export function GraceEditorMap({
  graces,
  selectedId,
  focusRequestId,
  onCenterChange,
  onSelect,
  onMove,
}: GraceEditorMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onMove);
  const onCenterChangeRef = useRef(onCenterChange);
  const previousFocusRequestIdRef = useRef(focusRequestId);
  const [ready, setReady] = useState(false);

  selectedIdRef.current = selectedId;
  onSelectRef.current = onSelect;
  onMoveRef.current = onMove;
  onCenterChangeRef.current = onCenterChange;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = await import("leaflet");
      if (disposed || !elRef.current) return;
      LRef.current = L;

      const bounds: [[number, number], [number, number]] = [
        [0, 0],
        [MAP_HEIGHT, MAP_WIDTH],
      ];
      const map = L.map(elRef.current, {
        crs: L.CRS.Simple,
        minZoom: -3,
        maxZoom: 2,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.25,
        maxBoundsViscosity: 1,
      });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      addProgressiveMapOverlay(L, map, bounds);
      map.setMaxBounds(bounds);
      map.fitBounds(bounds);
      map.setMinZoom(map.getBoundsZoom(bounds));

      const updateMarkerScale = () => {
        const scale = Math.max(0.52, Math.min(1.45, 0.78 + map.getZoom() * 0.16));
        elRef.current?.style.setProperty("--er-editor-marker-scale", String(scale));
      };
      const updateCenter = () => {
        const center = map.getCenter();
        onCenterChangeRef.current(fromLatLng(center.lat, center.lng));
      };
      map.on("zoomend", updateMarkerScale);
      map.on("moveend", updateCenter);
      updateMarkerScale();
      updateCenter();

      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        onMoveRef.current(selectedIdRef.current, fromLatLng(event.latlng.lat, event.latlng.lng));
      });

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    const visibleIds = new Set(graces.map((grace) => grace.id));
    markersRef.current.forEach((marker, id) => {
      if (!visibleIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    graces.forEach((grace) => {
      const icon = L.divIcon({
        className: "",
        html: markerHtml(grace),
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const latLng = toLatLng(grace);
      let marker = markersRef.current.get(grace.id);

      if (!marker) {
        marker = L.marker(latLng, {
          icon,
          draggable: true,
          keyboard: false,
          zIndexOffset: grace.isSelected ? 1000 : 0,
        }).addTo(map);
        marker.on("click", (event) => {
          event.originalEvent.stopPropagation();
          onSelectRef.current(grace.id);
        });
        marker.on("dragstart", () => onSelectRef.current(grace.id));
        marker.on("dragend", () => {
          const next = marker?.getLatLng();
          if (next) onMoveRef.current(grace.id, fromLatLng(next.lat, next.lng));
        });
        marker.bindTooltip(grace.name || "Untitled grace", {
          direction: "top",
          className: "er-tip",
          offset: [0, -12],
        });
        markersRef.current.set(grace.id, marker);
      } else {
        marker.setLatLng(latLng);
        marker.setIcon(icon);
        marker.setTooltipContent(grace.name || "Untitled grace");
        marker.setZIndexOffset(grace.isSelected ? 1000 : 0);
      }

      if (grace.isSelected) {
        marker.openTooltip();
      } else {
        marker.closeTooltip();
      }
    });
  }, [graces, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const selectedGrace = graces.find((grace) => grace.id === selectedId);
    if (!map || !ready || !selectedGrace || previousFocusRequestIdRef.current === focusRequestId) return;

    previousFocusRequestIdRef.current = focusRequestId;
    map.panTo(toLatLng(selectedGrace), { animate: true, duration: 0.35 });
  }, [focusRequestId, graces, ready, selectedId]);

  return <div ref={elRef} className="h-full w-full" />;
}
