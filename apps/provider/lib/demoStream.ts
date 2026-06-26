/**
 * Synthetic video feed for machines without a camera (e.g. a Mac mini).
 *
 * Renders an animated canvas — moving ball, live clock, frame counter — and
 * exposes it as a MediaStream via captureStream(). The motion + ticking clock
 * make it obvious the frames are *live* (proving the WebRTC pipeline), not a
 * frozen image.
 */
export function createDemoStream(label = "casper-webrtc-stream"): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available for demo feed");

  let frame = 0;
  let raf = 0;
  const draw = () => {
    frame++;
    const t = frame / 30;
    const hue = frame % 360;

    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, `hsl(${hue}, 65%, 12%)`);
    g.addColorStop(1, `hsl(${(hue + 70) % 360}, 65%, 22%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // bouncing ball — unmistakable proof of live motion
    const x = canvas.width / 2 + Math.sin(t) * 420;
    const y = canvas.height / 2 + Math.cos(t * 1.3) * 220;
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath();
    ctx.arc(x, y, 44, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px system-ui, sans-serif";
    ctx.fillText(`👻 ${label}`, 60, 110);
    ctx.font = "32px ui-monospace, monospace";
    ctx.fillText(new Date().toISOString(), 60, canvas.height - 130);
    ctx.fillText(`DEMO FEED · frame ${frame}`, 60, canvas.height - 80);

    raf = requestAnimationFrame(draw);
  };
  draw();

  const stream = (canvas as HTMLCanvasElement & {
    captureStream(fps?: number): MediaStream;
  }).captureStream(30);

  // stop the RAF loop once the track is stopped (provider.stop())
  stream.getVideoTracks()[0]?.addEventListener("ended", () => cancelAnimationFrame(raf));
  return stream;
}

/**
 * Stream a same-origin video file (e.g. /bbb.mp4) on a loop as the broadcast.
 * The file must be same-origin or captureStream() taints and fails — keep it in
 * the app's public/ folder.
 */
export async function createVideoFileStream(src: string): Promise<MediaStream> {
  const video = document.createElement("video");
  video.src = src;
  video.loop = true;
  video.muted = true; // browsers require muted for programmatic autoplay
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  await video.play(); // the Start-Stream click is the required user gesture
  if (video.readyState < 2) {
    await new Promise<void>((res) =>
      video.addEventListener("loadeddata", () => res(), { once: true }),
    );
  }
  return (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
}
