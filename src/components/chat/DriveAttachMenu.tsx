import { useState } from "react";
import { FileSpreadsheet, FileText, Paperclip, Presentation, HardDrive } from "lucide-react";
import { openDrivePicker, pickerConfigured } from "@/lib/drivePicker";

/**
 * The attach menu. Upload stays the fallback for things that aren't in Drive;
 * a Drive reference costs no storage, has no size ceiling and stays current.
 *
 * Drive options are disabled — with the reason stated — when the org has no
 * Google connection or no Drive folder. A disabled control that explains itself
 * is better than one that fails after the click.
 */
export const DriveAttachMenu = ({
  driveReady,
  onPicked,
  onPasteRequest,
  onCreate,
  onUpload,
}: {
  driveReady: boolean;
  onPicked: (files: { id: string; name: string; mimeType: string; url: string }[]) => void;
  onPasteRequest: () => void;
  onCreate: (type: "document" | "spreadsheet" | "presentation") => void;
  onUpload?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const disabledReason = !driveReady
    ? "Connect Google and set this organization's Drive folder in Connect first."
    : null;

  const pickFromDrive = async () => {
    setOpen(false);
    if (!pickerConfigured()) {
      onPasteRequest();
      return;
    }
    try {
      const files = await openDrivePicker();
      if (files?.length) onPicked(files);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const item = (label: string, icon: React.ReactNode, onClick: () => void, gated = true) => (
    <button
      type="button"
      className="vd-menu-item"
      disabled={gated && !!disabledReason}
      title={gated ? disabledReason ?? undefined : undefined}
      onClick={() => {
        setOpen(false);
        onClick();
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="vd-attach">
      <button
        type="button"
        className="vd-attach-btn"
        aria-expanded={open}
        aria-label="Attach"
        onClick={() => setOpen((o) => !o)}
      >
        <Paperclip size={15} strokeWidth={1.75} aria-hidden />
      </button>

      {open ? (
        <div className="vd-menu" role="menu">
          {onUpload
            ? item("Upload a file", <Paperclip size={14} strokeWidth={1.75} aria-hidden />, onUpload, false)
            : null}
          {item("Attach from Drive", <HardDrive size={14} strokeWidth={1.75} aria-hidden />, pickFromDrive)}
          {item("New Doc", <FileText size={14} strokeWidth={1.75} aria-hidden />, () => onCreate("document"))}
          {item("New Sheet", <FileSpreadsheet size={14} strokeWidth={1.75} aria-hidden />, () => onCreate("spreadsheet"))}
          {item("New Slides", <Presentation size={14} strokeWidth={1.75} aria-hidden />, () => onCreate("presentation"))}
          {disabledReason ? <p className="vd-menu-note">{disabledReason}</p> : null}
        </div>
      ) : null}

      {err ? <p className="vd-menu-note">{err}</p> : null}
    </div>
  );
};

export default DriveAttachMenu;
