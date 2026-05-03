import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useEffect } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  fullHeight?: boolean;
}

export const BottomSheet = ({ open, onClose, title, children, fullHeight = false }: BottomSheetProps) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80]"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            className="fixed left-0 right-0 bottom-0 z-[81] flex flex-col"
            style={{
              maxHeight: fullHeight ? "92vh" : "85vh",
              minHeight: fullHeight ? "92vh" : "auto",
              background: "rgba(10,10,20,0.96)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              borderTop: "1px solid var(--border-glass-top)",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: "var(--safe-bottom)",
              boxShadow: "0 -12px 48px rgba(0,0,0,0.6)",
            }}
          >
            <div className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing">
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
            </div>
            {title && (
              <div className="px-5 py-2 t-section" style={{ fontSize: 16 }}>{title}</div>
            )}
            <div className="overflow-y-auto px-5 pb-5 flex-1">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
