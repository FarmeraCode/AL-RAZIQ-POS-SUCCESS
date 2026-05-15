type DiscoveryResponse = {
  ok: true;
  name: string;
  ip: string;
  port: number;
  url: string;
  ts: number;
};

const DISCOVERY_PING = "WHERE_IS_POS_SERVER?";
const DEFAULT_DISCOVERY_PORT = 7331;

function withTimeout<T>(p: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function isCapacitorNative() {
  return typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Try to discover the desktop POS server over LAN.
 *
 * Notes:
 * - UDP is only available in the native Capacitor app (APK). Browsers can't do UDP.
 * - Requires the Capacitor UDP plugin at runtime.
 */
export async function discoverPosServerUrl(opts?: {
  discoveryPort?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  if (!isCapacitorNative()) return null;

  const discoveryPort = opts?.discoveryPort ?? DEFAULT_DISCOVERY_PORT;
  const timeoutMs = opts?.timeoutMs ?? 1800;

  let Udp: any;
  try {
    // dynamic import so web builds don't break
    const mod: any = await import("capacitor-udp-socket");
    Udp = mod?.UdpSocket || mod?.Udp || mod?.default?.UdpSocket || mod?.default?.Udp;
  } catch {
    return null;
  }

  if (!Udp?.create) return null;
  const sock = await Udp.create({ properties: { name: "pos-discovery", bufferSize: 4096 } });

  try {
    await Udp.bind({ socketId: sock.socketId, address: "0.0.0.0", port: 0 });
    await Udp.setBroadcast({ socketId: sock.socketId, enabled: true });

    const waitForResponse = withTimeout<DiscoveryResponse>(new Promise((resolve, reject) => {
      const sub = Udp.addListener("receive", (ev: any) => {
        try {
          const s = String(ev?.buffer || "");
          const parsed = JSON.parse(s) as DiscoveryResponse;
          if (parsed?.ok && parsed?.url) {
            sub.remove?.();
            resolve(parsed);
          }
        } catch {
          // ignore
        }
      });
      // safety
      setTimeout(() => { sub.remove?.(); reject(new Error("timeout")); }, timeoutMs);
    }), timeoutMs + 200);

    // broadcast ping (most routers allow 255.255.255.255 on the LAN)
    await Udp.send({
      socketId: sock.socketId,
      address: "255.255.255.255",
      port: discoveryPort,
      buffer: DISCOVERY_PING,
    });

    const res = await waitForResponse;
    return res.url;
  } catch {
    return null;
  } finally {
    try { await Udp.close({ socketId: sock.socketId }); } catch {}
  }
}

