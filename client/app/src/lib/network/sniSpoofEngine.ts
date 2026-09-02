import { RED_VERSION } from '../version';

/**
 * RED v64.0.0 — SNI Domain Fronting & Zero-Rating Bypass Engine
 * 
 * Permite tunelizar tráfico de datos cifrados simulando el encabezado TLS SNI (Server Name Indication)
 * de portales cautivos de operadoras telefónicas exentos de cobro de datos (Zero-Rating Sites).
 */

export interface SniSpoofStats {
  requestsSent: number;
  bypassSuccessRate: number; // Percentage
  currentHostFront: string;
  bytesBypassed: number;
}

export class SniSpoofEngine {
  private static ZERO_RATING_TARGETS = [
    { provider: "Claro", sniHost: "recargas.claro.com", ipTarget: "104.18.22.14" },
    { provider: "Movistar", sniHost: "mi.movistar.com", ipTarget: "104.18.23.15" },
    { provider: "Tigo", sniHost: "atencion.tigo.com", ipTarget: "104.18.24.16" },
    { provider: "Universal Portal", sniHost: "portal.micelular.com", ipTarget: "104.18.25.17" }
  ];

  private static stats: SniSpoofStats = {
    requestsSent: 0,
    bypassSuccessRate: 100.0,
    currentHostFront: "recargas.claro.com (Zero-Rating Port)",
    bytesBypassed: 0
  };

  /**
   * Genera un payload HTTP con encabezados SNI alterados para Domain Fronting
   */
  public static createSpoofedFrontRequest(encryptedPayloadHex: string, targetSniIndex = 0): {
    headers: Record<string, string>;
    body: string;
    sniHost: string;
  } {
    const safeIdx = (typeof targetSniIndex === 'number' && isFinite(targetSniIndex))
      ? Math.abs(Math.floor(targetSniIndex))
      : 0;
    const target = this.ZERO_RATING_TARGETS[safeIdx % this.ZERO_RATING_TARGETS.length];
    this.stats.currentHostFront = `${target.sniHost} (${target.provider})`;
    const safeBody = typeof encryptedPayloadHex === 'string' ? encryptedPayloadHex : '';
    
    return {
      headers: {
        "Host": target.sniHost,
        "X-RED-ZeroRating-Tunnel": `v${RED_VERSION}`,
        "Content-Type": "application/x-red-noise-frame",
        "User-Agent": "Mozilla/5.0 (Mobile; Android 14; RED Mesh Node)"
      },
      body: safeBody,
      sniHost: target.sniHost
    };
  }

  /**
   * Transmite el paquete a través del túnel con spoofing SNI.
   *
   * BUG-14 Fix: Reemplaza el setTimeout simulado por un fetch() real al host
   * Zero-Rating con los headers de Domain Fronting. El éxito/fallo refleja la
   * respuesta real de la red, no un valor hardcodeado.
   *
   * Limitación arquitectónica documentada: Los navegadores no exponen el socket
   * TLS subyacente — el SNI real del ClientHello es controlado por el browser,
   * no por el header Host de HTTP. Por tanto, este método implementa Domain
   * Fronting a nivel de HTTP Host header (funciona en CDNs que lo soporten),
   * no SNI-level spoofing nativo. En entornos Capacitor/Android con proxy local,
   * el tunelado SNI real requiere una implementación nativa (NDK/JNI).
   */
  public static async transmitSniBypass(encryptedPayloadHex: string): Promise<{ success: boolean; latencyMs: number; provider: string; reason?: string }> {
    const safePayload = typeof encryptedPayloadHex === 'string' ? encryptedPayloadHex : '';
    const startTime = performance.now();
    this.stats.requestsSent++;
    this.stats.bytesBypassed += safePayload.length;

    const targetIdx = Math.abs(this.stats.requestsSent) % this.ZERO_RATING_TARGETS.length;
    const target = this.ZERO_RATING_TARGETS[targetIdx];
    this.stats.currentHostFront = `${target.sniHost} (${target.provider})`;

    const { headers, body } = this.createSpoofedFrontRequest(safePayload, targetIdx);

    try {
      const response = await fetch(`https://${target.sniHost}/red-tunnel`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (response.ok || response.status === 204) {
        return { success: true, latencyMs, provider: this.stats.currentHostFront };
      } else {
        return {
          success: false,
          latencyMs,
          provider: this.stats.currentHostFront,
          reason: `HTTP ${response.status} — Domain Fronting bloqueado o no soportado por CDN`,
        };
      }
    } catch (e: unknown) {
      const latencyMs = Math.round(performance.now() - startTime);
      const msg = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        latencyMs,
        provider: this.stats.currentHostFront,
        reason: `Error de red: ${msg}`,
      };
    }
  }

  public static getStats(): SniSpoofStats {
    return { ...this.stats };
  }

  public static resetStats(): void {
    this.stats = {
      requestsSent: 0,
      bypassSuccessRate: 100.0,
      currentHostFront: "recargas.claro.com (Zero-Rating Port)",
      bytesBypassed: 0
    };
  }
}
