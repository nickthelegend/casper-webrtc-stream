import { forwardRef } from "react";

export const StreamViewer = forwardRef<
  HTMLVideoElement,
  { paid: string; watching: number; suspended: boolean }
>(function StreamViewer({ paid, watching, suspended }, ref) {
  const cspr = Number(BigInt(paid || "0")) / 1e9;
  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border border-casper-border bg-black aspect-video">
        <video
          ref={ref}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {suspended && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <p className="text-casper-accent font-semibold">⏸ Stream suspended</p>
              <p className="text-gray-400 text-sm">awaiting payment…</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-sm mono">
        <span>💳 Paid: {cspr.toFixed(5)} CSPR</span>
        <span>⏱ Watching: {watching}s</span>
      </div>
    </div>
  );
});
