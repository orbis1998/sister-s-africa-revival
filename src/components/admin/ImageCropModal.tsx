import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void;
};

type CropRect = { x: number; y: number; w: number; h: number };

export function ImageCropModal({ file, open, onClose, onConfirm }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState("");
  const [crop, setCrop] = useState<CropRect | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; rect: CropRect } | null>(null);

  useEffect(() => {
    if (!file) {
      setSrc("");
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const pad = 0.08;
    const w = img.clientWidth * (1 - pad * 2);
    const h = img.clientHeight * (1 - pad * 2);
    setCrop({
      x: img.clientWidth * pad,
      y: img.clientHeight * pad,
      w,
      h,
    });
  }, []);

  function pointerPos(e: React.PointerEvent) {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const box = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - box.left, box.width)),
      y: Math.max(0, Math.min(e.clientY - box.top, box.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!imgRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = pointerPos(e);
    dragRef.current = { startX: x, startY: y, rect: { x, y, w: 0, h: 0 } };
    setCrop({ x, y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const { x, y } = pointerPos(e);
    const { startX, startY } = dragRef.current;
    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    setCrop({
      x: left,
      y: top,
      w: Math.abs(x - startX),
      h: Math.abs(y - startY),
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  }

  async function applyCrop() {
    const img = imgRef.current;
    if (!img || !crop || crop.w < 8 || crop.h < 8 || !file) return;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(crop.w * scaleX);
    canvas.height = Math.round(crop.h * scaleY);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.w * scaleX,
      crop.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const ext = file.name.split(".").pop() || "jpg";
        const cropped = new File([blob], file.name.replace(/\.[^.]+$/, "") + `-crop.${ext}`, {
          type: blob.type || file.type,
        });
        onConfirm(cropped);
        onClose();
      },
      file.type || "image/jpeg",
      0.92,
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Rogner l&apos;image</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Cliquez et faites glisser pour sélectionner la zone à conserver.
        </p>
        {src && (
          <div className="relative mx-auto max-h-[55vh] overflow-hidden rounded-xl border border-border bg-black/5">
            <img
              ref={imgRef}
              src={src}
              alt="Rogner"
              className="max-h-[55vh] w-full select-none object-contain"
              draggable={false}
              onLoad={onImageLoad}
            />
            <div
              className="absolute inset-0 touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {crop && crop.w > 0 && crop.h > 0 && (
                <div
                  className="pointer-events-none absolute border-2 border-copper bg-copper/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                  style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                />
              )}
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-hero" onClick={applyCrop} disabled={!crop || crop.w < 8}>
            Insérer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
