export const DC_LABEL = "casper-pay";
export function encodeDC(msg) {
    return JSON.stringify(msg);
}
export function decodeDC(data) {
    try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed.type === "string")
            return parsed;
        return null;
    }
    catch {
        return null;
    }
}
export const dc = {
    paymentRequest(segmentIndex, requirements) {
        return { type: "segment_payment_request", segmentIndex, requirements };
    },
    paymentProof(segmentIndex, payload) {
        return { type: "segment_payment_proof", segmentIndex, payload };
    },
    confirmed(segmentIndex, txHash) {
        return { type: "segment_confirmed", segmentIndex, txHash };
    },
    rejected(segmentIndex, reason) {
        return { type: "segment_rejected", segmentIndex, reason };
    },
    key(segmentIndex, key) {
        return { type: "segment_key", segmentIndex, key };
    },
    suspended(reason) {
        return { type: "stream_suspended", reason };
    },
    resumed() {
        return { type: "stream_resumed" };
    },
};
//# sourceMappingURL=DataChannelProtocol.js.map