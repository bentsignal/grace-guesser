import type { ImageOverlay, Map as LeafletMap } from "leaflet";
import { MAP_IMAGES } from "../game/config";

type Leaflet = typeof import("leaflet");
type Bounds = [[number, number], [number, number]];

export function addProgressiveMapOverlay(L: Leaflet, map: LeafletMap, bounds: Bounds): ImageOverlay {
  const [firstImage, ...remainingImages] = MAP_IMAGES;
  const firstOverlay = L.imageOverlay(firstImage, bounds).addTo(map);
  let activeOverlay = firstOverlay;

  remainingImages.forEach((image) => {
    const nextOverlay = L.imageOverlay(image, bounds, { opacity: 0 });

    nextOverlay.once("load", () => {
      const previousOverlay = activeOverlay;
      activeOverlay = nextOverlay;
      nextOverlay.setOpacity(1);
      previousOverlay.remove();
    });
    nextOverlay.addTo(map);
  });

  return firstOverlay;
}
