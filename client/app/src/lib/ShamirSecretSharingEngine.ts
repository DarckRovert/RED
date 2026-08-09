/**
 * ShamirSecretSharingEngine.ts — RED Shamir's Secret Sharing (SSS 3-of-5) Engine
 * 
 * Implements polynomial secret splitting over Galois Field GF(2^8) with irreducible polynomial x^8 + x^4 + x^3 + x + 1.
 * Splits a 32-byte sovereign private key into 5 QR shares. Any 3 shares can mathematically reconstruct the key.
 */

export interface SecretShare {
    shareIndex: number; // 1..5
    shareHex: string;
}

export class ShamirSecretSharingEngine {
    // GF(2^8) tables
    private static gfLog = new Uint8Array(256);
    private static gfExp = new Uint8Array(512);

    static {
        let x = 1;
        for (let i = 0; i < 255; i++) {
            this.gfExp[i] = x;
            this.gfExp[i + 255] = x;
            this.gfLog[x] = i;
            x ^= (x << 1) ^ ((x & 0x80) ? 0x11B : 0);
        }
    }

    private static gfMul(a: number, b: number): number {
        if (a === 0 || b === 0) return 0;
        return this.gfExp[this.gfLog[a] + this.gfLog[b]];
    }

    private static gfDiv(a: number, b: number): number {
        if (b === 0) throw new Error("GF(2^8) Division by zero");
        if (a === 0) return 0;
        return this.gfExp[this.gfLog[a] - this.gfLog[b] + 255];
    }

    /**
     * Splits a 32-byte secret hex string into n (5) shares with threshold k (3)
     */
    public static splitSecret(secretHex: string, k = 3, n = 5): SecretShare[] {
        const secretBytes = this.hexToBytes(secretHex);
        const shares: Uint8Array[] = Array.from({ length: n }, () => new Uint8Array(secretBytes.length));

        for (let byteIdx = 0; byteIdx < secretBytes.length; byteIdx++) {
            const secretByte = secretBytes[byteIdx];
            // Generate random polynomial coefficients f(x) = secret + a1*x + a2*x^2 + ... + a(k-1)*x^(k-1)
            const coeffs = new Uint8Array(k);
            coeffs[0] = secretByte;
            crypto.getRandomValues(coeffs.subarray(1));

            // Evaluate polynomial at x = 1..n
            for (let x = 1; x <= n; x++) {
                let y = coeffs[0];
                let xPow = 1;
                for (let c = 1; c < k; c++) {
                    xPow = this.gfMul(xPow, x);
                    y ^= this.gfMul(coeffs[c], xPow);
                }
                shares[x - 1][byteIdx] = y;
            }
        }

        return shares.map((s, idx) => ({
            shareIndex: idx + 1,
            shareHex: this.bytesToHex(s)
        }));
    }

    /**
     * Reconstructs the 32-byte secret hex string using k (>= 3) shares via Lagrange Interpolation
     */
    public static combineShares(shares: SecretShare[]): string {
        if (shares.length < 3) {
            throw new Error("Insufficient shares for SSS 3-of-5 reconstruction");
        }

        const shareLength = this.hexToBytes(shares[0].shareHex).length;
        const secretBytes = new Uint8Array(shareLength);

        const xValues = shares.map(s => s.shareIndex);
        const yValues = shares.map(s => this.hexToBytes(s.shareHex));

        for (let byteIdx = 0; byteIdx < shareLength; byteIdx++) {
            let secretByte = 0;

            for (let i = 0; i < shares.length; i++) {
                const xi = xValues[i];
                const yi = yValues[i][byteIdx];
                let lagrangeCoeff = 1;

                for (let j = 0; j < shares.length; j++) {
                    if (i === j) continue;
                    const xj = xValues[j];
                    // Li(0) = prod(xj / (xj ^ xi))
                    const num = xj;
                    const den = xi ^ xj;
                    lagrangeCoeff = this.gfMul(lagrangeCoeff, this.gfDiv(num, den));
                }

                secretByte ^= this.gfMul(yi, lagrangeCoeff);
            }

            secretBytes[byteIdx] = secretByte;
        }

        return this.bytesToHex(secretBytes);
    }

    private static bytesToHex(bytes: Uint8Array): string {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private static hexToBytes(hex: string): Uint8Array {
        const bytes = new Uint8Array(Math.ceil(hex.length / 2));
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16) || 0;
        }
        return bytes;
    }
}
