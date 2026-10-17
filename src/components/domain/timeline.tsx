import {
  ArrowRightLeft, Camera, CameraOff, CircleDollarSign, ClipboardPlus, Clock, MessageSquare, Pencil, Percent, Plus, Trash2, Undo2, UserRound, type LucideIcon,
} from "lucide-react";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  created: ClipboardPlus, status: ArrowRightLeft, item_added: Plus, item_updated: Pencil, item_removed: Trash2, note: MessageSquare,
  photo: Camera, photo_removed: CameraOff, forecast: Clock, discount: Percent, responsible: UserRound, payment: CircleDollarSign,
  refund: Undo2, updated: Pencil,
};
const COLORS: Record<string, string> = {
  created: "text-brand-300 border-brand-500/40", status: "text-sky-300 border-sky-400/30", payment: "text-emerald-300 border-emerald-400/30",
  refund: "text-red-300 border-red-400/30", note: "text-ink-100 border-ink-600",
};

export type TimelineEvent = { id: string; kind: string; message: string; created_at: string; actor: string | null };

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <p className="text-sm text-ink-400">Nenhum registro.</p>;
  return (
    <ol className="relative space-y-4">
      {events.map((e, i) => {
        const Icon = ICONS[e.kind] ?? Pencil;
        return (
          <li key={e.id} className="relative flex gap-3">
            {i < events.length - 1 ? <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-ink-800" aria-hidden /> : null}
            <span className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-ink-900", COLORS[e.kind] ?? "border-ink-700 text-ink-400")}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn("text-sm", e.kind === "note" ? "rounded-lg border border-ink-800 bg-ink-850 px-3 py-2 text-ink-100" : "text-ink-100")}>{e.message}</p>
              <p className="mt-1 text-xs text-ink-500">{dateTime(e.created_at)}{e.actor ? ` · ${e.actor}` : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
