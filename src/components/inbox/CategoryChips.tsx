import { CATEGORIES, type Category } from "@/data/mailCategories";

/**
 * Category chips. Multi-select; zero selected means all.
 *
 * "Needs reply" sits behind a divider because it is a different axis — folding
 * it into the category set would force a false choice at classification time.
 */
export const CategoryChips = ({
  counts,
  selected,
  onToggle,
  needsReplyCount,
  needsReplyOn,
  onToggleNeedsReply,
}: {
  counts: Record<string, number>;
  selected: Set<Category>;
  onToggle: (c: Category) => void;
  needsReplyCount: number;
  needsReplyOn: boolean;
  onToggleNeedsReply: () => void;
}) => (
  <div className="mb-chips" role="group" aria-label="Filter by category">
    {CATEGORIES.map((c) => (
      <button
        key={c.key}
        type="button"
        className="mb-chip"
        data-on={selected.has(c.key) ? "true" : undefined}
        aria-pressed={selected.has(c.key)}
        onClick={() => onToggle(c.key)}
      >
        <span className="mb-dot" style={{ background: c.color }} aria-hidden />
        <span>{c.label}</span>
        <span className="mb-chipnum">{counts[c.key] ?? 0}</span>
      </button>
    ))}

    <span className="mb-divider" aria-hidden />

    <button
      type="button"
      className="mb-chip"
      data-on={needsReplyOn ? "true" : undefined}
      aria-pressed={needsReplyOn}
      onClick={onToggleNeedsReply}
    >
      <span>Needs reply</span>
      <span className="mb-chipnum">{needsReplyCount}</span>
    </button>
  </div>
);
