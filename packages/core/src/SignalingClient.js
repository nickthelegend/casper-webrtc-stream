export class SignalingClient {
    url;
    room;
    role;
    ws;
    handlers = new Set();
    queue = [];
    peerId;
    constructor(url, room, role, peerId) {
        this.url = url;
        this.room = room;
        this.role = role;
        this.peerId = peerId ?? crypto.randomUUID();
    }
    connect() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(this.url);
            this.ws = ws;
            ws.onopen = () => {
                this.raw({ type: "join", room: this.room, from: this.peerId, payload: { role: this.role } });
                for (const m of this.queue)
                    this.raw(m);
                this.queue = [];
                resolve();
            };
            ws.onerror = (e) => reject(e);
            ws.onmessage = (ev) => {
                let msg = null;
                try {
                    msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
                }
                catch {
                    return;
                }
                if (!msg)
                    return;
                // heartbeat: reply to server pings, never surface them
                if (msg.type === "ping") {
                    this.raw({ type: "pong", room: this.room, from: this.peerId });
                    return;
                }
                // ignore our own echoes
                if (msg.from && msg.from === this.peerId)
                    return;
                for (const h of this.handlers)
                    h(msg);
            };
        });
    }
    onMessage(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    send(type, payload, to) {
        this.raw({ type, room: this.room, from: this.peerId, to, payload });
    }
    raw(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
        else {
            this.queue.push(msg);
        }
    }
    close() {
        this.send("leave", {});
        this.ws?.close();
        this.handlers.clear();
    }
}
//# sourceMappingURL=SignalingClient.js.map