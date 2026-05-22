import { createServerFn } from "@tanstack/react-start";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Grace } from "../game/types";

interface GraceEditorUpdate {
  id: number;
  name?: string;
  region?: string;
  x: number;
  y: number;
}

interface GraceEditorSave {
  upserts: GraceEditorUpdate[];
  deleteIds: number[];
}

const dataPath = resolve(process.cwd(), "src/data/graces.json");

function validateSave(data: unknown): GraceEditorSave {
  if (!data || typeof data !== "object") throw new Error("Expected grace editor changes.");
  const save = data as Partial<GraceEditorSave>;
  if (!Array.isArray(save.upserts)) throw new Error("Expected an array of grace updates.");
  if (!Array.isArray(save.deleteIds)) throw new Error("Expected an array of grace deletions.");

  const deleteIds = save.deleteIds.map((id) => {
    if (!Number.isInteger(id)) throw new Error("Grace deletion is missing an id.");
    return id;
  });

  const upserts = save.upserts.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid grace update.");
    const update = item as Partial<GraceEditorUpdate>;
    const id = update.id;
    if (!Number.isInteger(id)) throw new Error("Grace update is missing an id.");
    if (update.name !== undefined && update.name.trim().length === 0) {
      throw new Error(`Grace ${id} is missing a name.`);
    }
    if (update.region !== undefined && update.region.trim().length === 0) {
      throw new Error(`Grace ${id} is missing a region.`);
    }
    if (typeof update.x !== "number" || update.x < 0 || update.x > 1) {
      throw new Error(`Invalid x coordinate for grace ${update.id}.`);
    }
    if (typeof update.y !== "number" || update.y < 0 || update.y > 1) {
      throw new Error(`Invalid y coordinate for grace ${update.id}.`);
    }
    return {
      id: id as number,
      ...(update.name !== undefined ? { name: update.name.trim() } : {}),
      ...(update.region !== undefined ? { region: update.region.trim() } : {}),
      x: Number(update.x.toFixed(5)),
      y: Number(update.y.toFixed(5)),
    };
  });

  return { upserts, deleteIds };
}

export const saveGracePositions = createServerFn({ method: "POST" })
  .inputValidator(validateSave)
  .handler(async ({ data }) => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("The grace editor is disabled in production.");
    }

    const graces = JSON.parse(await readFile(dataPath, "utf8")) as Grace[];
    const updates = new Map(data.upserts.map((update) => [update.id, update]));
    const existingIds = new Set(graces.map((grace) => grace.id));
    const deleteIds = new Set(data.deleteIds);
    let changed = 0;
    let deleted = 0;

    const nextGraces = graces
      .filter((grace) => {
        const shouldDelete = deleteIds.has(grace.id);
        deleted += shouldDelete ? 1 : 0;
        return !shouldDelete;
      })
      .map((grace) => {
        const update = updates.get(grace.id);
        if (!update) return grace;
        const nextGrace = {
          ...grace,
          name: update.name ?? grace.name,
          region: update.region ?? grace.region,
          x: update.x,
          y: update.y,
        };
        changed +=
          grace.name !== nextGrace.name ||
          grace.region !== nextGrace.region ||
          grace.x !== nextGrace.x ||
          grace.y !== nextGrace.y
            ? 1
            : 0;
        return nextGrace;
      });
    const additions = data.upserts
      .filter((update) => !existingIds.has(update.id))
      .map((update) => {
        if (!update.name || !update.region) {
          throw new Error(`New grace ${update.id} must include a name and region.`);
        }
        return {
          id: update.id,
          name: update.name,
          region: update.region,
          x: update.x,
          y: update.y,
        };
      });

    if (updates.size > 0 && changed === 0 && additions.length === 0 && deleted === 0) {
      return { changed, deleted };
    }

    nextGraces.push(...additions);
    nextGraces.sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name) || a.id - b.id);

    await writeFile(dataPath, `${JSON.stringify(nextGraces, null, 2)}\n`, "utf8");
    return { changed: changed + additions.length, deleted };
  });
