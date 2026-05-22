import { createFileRoute, redirect } from "@tanstack/react-router";
import { Plus, RotateCcw, Save, Search, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { GraceEditorMap, type EditableGrace } from "../components/GraceEditorMap";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import gracesData from "../data/graces.json";
import { saveGracePositions } from "../graces/editor-functions";
import type { Grace, Point } from "../game/types";

export const Route = createFileRoute("/grace-editor")({
  beforeLoad: () => {
    if (import.meta.env.PROD) throw redirect({ to: "/" });
  },
  component: GraceEditor,
});

type DraftGrace = Grace & { isNew?: true };
type SaveState = "idle" | "saving" | "saved" | "error";
type ConfirmAction = "reset-selected" | "reset-all" | "delete-selected" | null;

const graces = gracesData as Grace[];

function sameGrace(a: Grace, b: Grace) {
  return a.name === b.name && a.region === b.region && a.x === b.x && a.y === b.y;
}

function GraceEditor() {
  const [selectedId, setSelectedId] = useState(graces[0]?.id ?? 0);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<number, DraftGrace>>({});
  const [deleteIds, setDeleteIds] = useState<Set<number>>(() => new Set());
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [mapCenter, setMapCenter] = useState<Point>(() => ({
    x: graces[0]?.x ?? 0.5,
    y: graces[0]?.y ?? 0.5,
  }));
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const visibleBaseGraces = graces.filter((grace) => !deleteIds.has(grace.id));
  const newGraces = Object.values(drafts).filter((grace) => grace.isNew);
  const allGraces = useMemo(
    () => [...newGraces, ...visibleBaseGraces.map((grace) => drafts[grace.id] ?? grace)],
    [drafts, newGraces, visibleBaseGraces]
  );
  const selected = allGraces.find((grace) => grace.id === selectedId) ?? allGraces[0];
  const originalSelected = graces.find((grace) => grace.id === selected?.id);

  const changedExisting = graces
    .filter((grace) => !deleteIds.has(grace.id))
    .filter((grace) => drafts[grace.id] && !sameGrace(drafts[grace.id], grace));
  const readyNewGraces = newGraces.filter((grace) => grace.name.trim() && grace.region.trim());
  const saveCount = changedExisting.length + readyNewGraces.length + deleteIds.size;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allGraces;
    return allGraces.filter((grace) =>
      `${grace.name} ${grace.region}`.toLowerCase().includes(needle)
    );
  }, [allGraces, query]);
  const mapGraces: EditableGrace[] = useMemo(
    () =>
      allGraces.map((grace) => {
        const original = graces.find((item) => item.id === grace.id);
        return {
          ...grace,
          isChanged: !!grace.isNew || !!(original && !sameGrace(grace, original)),
          isSelected: grace.id === selected.id,
        };
      }),
    [allGraces, selected.id]
  );

  const setSelectedDraft = (patch: Partial<Grace>) => {
    if (!selected) return;
    setSaveState("idle");
    setMessage("");
    setDrafts((prev) => {
      const base = prev[selected.id] ?? selected;
      return {
        ...prev,
        [selected.id]: { ...base, ...patch },
      };
    });
  };

  const addGrace = () => {
    if (!selected) return;
    const id = Math.max(...graces.map((grace) => grace.id), Date.now()) + Object.keys(drafts).length + 1;
    const grace: DraftGrace = {
      id,
      name: "",
      region: "",
      x: Number(mapCenter.x.toFixed(5)),
      y: Number(mapCenter.y.toFixed(5)),
      isNew: true,
    };
    setSaveState("idle");
    setMessage("");
    setDrafts((prev) => ({ ...prev, [id]: grace }));
    setSelectedId(id);
    setQuery("");
  };

  const resetSelected = () => {
    if (!selected) return;
    setSaveState("idle");
    setMessage("");
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[selected.id];
      return next;
    });
    if (selected.isNew) setSelectedId(graces[0]?.id ?? 0);
  };

  const resetAll = () => {
    setSaveState("idle");
    setMessage("");
    setDrafts({});
    setDeleteIds(new Set());
    setSelectedId(graces[0]?.id ?? 0);
  };

  const deleteSelected = () => {
    if (!selected) return;
    setSaveState("idle");
    setMessage("");
    if (selected.isNew) {
      resetSelected();
      return;
    }
    setDeleteIds((prev) => new Set(prev).add(selected.id));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[selected.id];
      return next;
    });
    setSelectedId(visibleBaseGraces.find((grace) => grace.id !== selected.id)?.id ?? graces[0]?.id ?? 0);
  };

  const save = async () => {
    setSaveState("saving");
    setMessage("");
    try {
      const existingUpserts = changedExisting.map((grace) => ({
        id: grace.id,
        name: drafts[grace.id].name,
        region: drafts[grace.id].region,
        x: drafts[grace.id].x,
        y: drafts[grace.id].y,
      }));
      const additions = readyNewGraces.map((grace) => ({
        id: grace.id,
        name: grace.name,
        region: grace.region,
        x: grace.x,
        y: grace.y,
      }));
      const result = await saveGracePositions({
        data: { upserts: [...existingUpserts, ...additions], deleteIds: [...deleteIds] },
      });
      setSaveState("saved");
      setDrafts({});
      setDeleteIds(new Set());
      setMessage(`Wrote ${result.changed} and deleted ${result.deleted} in src/data/graces.json.`);
    } catch (err) {
      setSaveState("error");
      setMessage(err instanceof Error ? err.message : "Could not save grace changes.");
    }
  };

  if (!selected) return null;

  return (
    <TooltipProvider>
      <div className="grid h-dvh grid-cols-1 overflow-hidden bg-[var(--er-bg)] text-[var(--er-ink)] md:grid-cols-[360px_1fr]">
        <aside className="er-panel z-[1000] flex min-h-0 flex-col rounded-none border-y-0 border-l-0">
          <div className="border-b border-[var(--er-line)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--er-muted)]">
              Dev tool
            </p>
            <h1 className="font-display er-title mt-1 text-2xl leading-tight">
              Grace Editor
            </h1>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-[var(--er-line)] bg-black/30 px-3 py-2">
              <Search size={16} className="shrink-0 text-[var(--er-muted)]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--er-muted)]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search graces or regions"
              />
            </div>
            <button className="er-btn mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs" onClick={addGrace}>
              <Plus size={16} />
              New grace
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((grace) => {
              const original = graces.find((item) => item.id === grace.id);
              const isChanged = grace.isNew || (original && !sameGrace(grace, original));
              return (
                <button
                  key={grace.id}
                  className={`flex w-full items-center gap-3 border-b border-[var(--er-line)] px-4 py-3 text-left transition ${
                    grace.id === selected.id ? "bg-[rgba(201,162,39,0.16)]" : "bg-black/10 hover:bg-white/5"
                  }`}
                  onClick={() => {
                    setSelectedId(grace.id);
                    setFocusRequestId((id) => id + 1);
                  }}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isChanged ? "bg-[#63d297]" : "bg-[var(--er-line)]"}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[var(--er-ink)]">
                      {grace.name || "Untitled grace"}
                    </span>
                    <span className="block truncate text-xs text-[var(--er-muted)]">
                      {grace.region || "Region required"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--er-line)] p-4">
            <div className="mb-4 grid gap-2">
              <EditorInput
                label="Name"
                value={selected.name}
                onChange={(name) => setSelectedDraft({ name })}
              />
              <EditorInput
                label="Region"
                value={selected.region}
                onChange={(region) => setSelectedDraft({ region })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--er-muted)]">
              <Coordinate label={selected.isNew ? "Starting" : "Original"} point={originalSelected ?? selected} />
              <Coordinate label="Current" point={selected} />
            </div>
            <div className="mt-4 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <IconConfirmButton
                label="Undo"
                tooltip="Discard changes to selected grace"
                onClick={() => setConfirmAction("reset-selected")}
              >
                <Undo2 className="mx-auto" size={16} />
              </IconConfirmButton>
              <IconConfirmButton
                label="Reset"
                tooltip="Discard all unsaved editor changes"
                onClick={() => setConfirmAction("reset-all")}
              >
                <RotateCcw className="mx-auto" size={16} />
              </IconConfirmButton>
              <IconConfirmButton
                label="Delete"
                tooltip="Delete selected grace"
                onClick={() => setConfirmAction("delete-selected")}
              >
                <Trash2 className="mx-auto" size={16} />
              </IconConfirmButton>
              <button
                className="er-btn flex items-center gap-2 rounded-md px-4 py-2 text-xs"
                disabled={saveCount === 0 || saveState === "saving"}
                onClick={save}
              >
                <Save size={16} />
                {saveState === "saving" ? "Saving" : `Save ${saveCount}`}
              </button>
            </div>
            {message && (
              <p className={`mt-3 text-xs ${saveState === "error" ? "text-[#ff9d85]" : "text-[#9fe0b8]"}`}>
                {message}
              </p>
            )}
          </div>
        </aside>

        <main className="relative min-h-0">
          <GraceEditorMap
            graces={mapGraces}
            selectedId={selected.id}
            focusRequestId={focusRequestId}
            onCenterChange={setMapCenter}
            onSelect={setSelectedId}
            onMove={(id, point) => {
              const grace = allGraces.find((item) => item.id === id);
              if (!grace) return;
              setSelectedId(id);
              setSaveState("idle");
              setMessage("");
              setDrafts((prev) => ({
                ...prev,
                [id]: {
                  ...(prev[id] ?? grace),
                  x: Number(point.x.toFixed(5)),
                  y: Number(point.y.toFixed(5)),
                },
              }));
            }}
          />
        </main>
      </div>

      <ConfirmDialog
        action={confirmAction}
        selectedName={selected.name || "Untitled grace"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction === "reset-selected") resetSelected();
          if (confirmAction === "reset-all") resetAll();
          if (confirmAction === "delete-selected") deleteSelected();
          setConfirmAction(null);
        }}
      />
    </TooltipProvider>
  );
}

function IconConfirmButton({
  label,
  tooltip,
  onClick,
  children,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="er-btn flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[10px] leading-none" onClick={onClick} aria-label={tooltip}>
          {children}
          <span>{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        className="border border-[var(--er-line)] bg-[var(--er-panel)] text-[var(--er-ink)]"
        sideOffset={8}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function ConfirmDialog({
  action,
  selectedName,
  onOpenChange,
  onConfirm,
}: {
  action: ConfirmAction;
  selectedName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const copy = {
    "reset-selected": {
      title: "Discard selected changes?",
      body: `This will remove unsaved edits for ${selectedName}. Saved data on disk will not change until you press Save.`,
      confirm: "Discard",
    },
    "reset-all": {
      title: "Discard all unsaved changes?",
      body: "This clears every staged edit, new grace, and deletion in the editor.",
      confirm: "Discard all",
    },
    "delete-selected": {
      title: "Delete selected grace?",
      body: `${selectedName} will be staged for deletion. The JSON file changes only after you press Save.`,
      confirm: "Delete",
    },
  }[action ?? "reset-selected"];

  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <DialogContent className="border border-[var(--er-line)] bg-[var(--er-panel)] text-[var(--er-ink)] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-[var(--er-gold-bright)]">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-[var(--er-muted)]">
            {copy.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-[var(--er-line)] bg-black/20">
          <DialogClose asChild>
            <button className="cursor-pointer rounded-md border border-[var(--er-line)] px-4 py-2 text-sm text-[var(--er-ink)] transition hover:bg-white/10 hover:text-[#fff7e0]">
              Cancel
            </button>
          </DialogClose>
          <button className="er-btn rounded-md px-4 py-2 text-sm" onClick={onConfirm}>
            {copy.confirm}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-display text-[10px] uppercase text-[var(--er-gold-bright)]">
        {label}
      </span>
      <input
        className="mt-1 w-full rounded-md border border-[var(--er-line)] bg-black/30 px-3 py-2 text-sm outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Coordinate({ label, point }: { label: string; point: Point }) {
  return (
    <div className="rounded-md border border-[var(--er-line)] bg-black/25 p-2">
      <p className="font-display text-[10px] uppercase text-[var(--er-gold-bright)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-[11px]">
        {point.x.toFixed(5)}, {point.y.toFixed(5)}
      </p>
    </div>
  );
}
