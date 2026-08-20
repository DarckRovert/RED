# 💰 Especificación Económica y Respaldo de Valor del Token $RED
**Ecosistema:** RED Sovereign Mesh  
**Estándar:** DePIN (Decentralized Physical Infrastructure Networks) & ERC-20 EVM Bridge  
**Mecanismo de Consenso:** Proof-of-Relay (PoR) + Proof-of-Stake (PoS)

---

## 1. Fundamento de Valor Intrínseco en el Mundo Real

El token **$RED** no es un activo especulativo sin respaldo. Su valor intrínseco se deriva directamente de **tres recursos físicos medibles y escasos**:

1. **Energía y Batería:** El consumo eléctrico real que los dispositivos de los usuarios invierten al retransmitir paquetes ajenos mediante radio Bluetooth LE y Wi-Fi Direct.
2. **Capacidad de Radio y Ancho de Banda:** Los canales electromagnéticos locales que los nodos ponen a disposición de la comunidad para cruzar zonas sin internet o en apagón.
3. **Custodia y Almacenamiento Criptográfico (DTN):** Memoria de estado sólido (Flash/SSD) utilizada por nodos guardianes para almacenar y reenviar paquetes cuando los destinatarios están desconectados.

---

## 2. Los 5 Motores Económicos del Ecosistema

### A. Prueba de Retransmisión (Proof-of-Relay - PoR)
- **Implementación en Código:** [`TokenomicsEngine.ts`](file:///d:/PROYECTO%20RED/client/app/src/lib/TokenomicsEngine.ts) & [`MonetizationEngine.ts`](file:///d:/PROYECTO%20RED/client/app/src/lib/MonetizationEngine.ts).
- **Mecánica:** Cada vez que un paquete atraviesa un nodo intermedio (*Hop*), el nodo emisor firma una prueba criptográfica de retransmisión. Al acumularse, el nodo retransmisor recibe créditos **$RED** de forma proporcional al tamaño del paquete y la distancia de retransmisión.

### B. Vouchers Criptográficos Offline P2P (Dinero de Emergencia)
- **Implementación en Código:** [`TokenomicsEngine.ts#L22-L30`](file:///d:/PROYECTO%20RED/client/app/src/lib/TokenomicsEngine.ts#L22-L30).
- **Mecánica:** Durante un colapso del sistema bancario o un apagón eléctrico, los usuarios pueden emitir vales de pago firmados con sus claves maestras **Ed25519**.
- **Propiedad Clave:** La validez y autenticidad del voucher se verifica matemáticamente en la pantalla del receptor **100% fuera de línea** por Bluetooth. Los vales cuentan con prevención de doble gasto (*Double-Spend Protection*) basada en firmas encadenadas.

### C. Staking y Validación PoS (Seguridad de la Red)
- **Implementación en Código:** [`blockchain/src/consensus.rs`](file:///d:/PROYECTO%20RED/blockchain/src/consensus.rs) & [`blockchain/src/transaction.rs`](file:///d:/PROYECTO%20RED/blockchain/src/transaction.rs).
- **Mecánica:** Los nodos que participan en la validación del libro mayor depositan tokens en garantía (*Staking*).
- **Rendimiento:** Tasa anual de recompensa (**APY de hasta 14.8%**) por validar bloques honestamente.
- **Penalización (Slashing):** Si un nodo intenta firmar dos bloques en conflicto (*DoubleSign*) o desconectarse deliberadamente (*Downtime*), el protocolo confisca (*slashes*) su stake automáticamente.

### D. Pasarelas de Salida a Internet (Gateway Egress)
- **Mecánica:** Nodos equipados con conectividad satelital (Starlink) o fibra óptica que actúan como "puentes" hacia la internet global pueden tarificar la salida de paquetes en $RED, creando una demanda de compra constante por parte de los nodos desconectados.

### E. Puente Multicadena Web3 (EVM & MetaMask)
- **Implementación en Código:** [`Web3BridgeEngine.ts`](file:///d:/PROYECTO%20RED/client/app/src/lib/Web3BridgeEngine.ts).
- **Cadenas Soportadas:** Ethereum (1), Polygon (137), Arbitrum One (42161), Base (8453) y Sepolia (11155111).
- **Enlace de Identidad EIP-712:** Vincula la Identidad Soberana `did:red:<hash>` con la dirección `0x...` de MetaMask.
- **Liquidez:** Los créditos generados en la malla pueden canjearse por **USDC, USDT, ETH o MATIC** en exchanges descentralizados bajo una paridad objetivo inicial de referencia ($1 \text{ RED} \approx \$0.05 \text{ USD}$).

---

## 3. Resumen de Archivos del Núcleo Económico

| Módulo / Crate | Ruta del Archivo | Responsabilidad Principal |
| :--- | :--- | :--- |
| **Blockchain Rust** | [`blockchain/src/consensus.rs`](file:///d:/PROYECTO%20RED/blockchain/src/consensus.rs) | Consenso PoS, cálculo de pesos de validadores y Slashing |
| **Transacciones Rust** | [`blockchain/src/transaction.rs`](file:///d:/PROYECTO%20RED/blockchain/src/transaction.rs) | Tipos de transacción: `Stake`, `Unstake`, `RegisterIdentity` |
| **Motor de Tokenomics** | [`client/app/src/lib/TokenomicsEngine.ts`](file:///d:/PROYECTO%20RED/client/app/src/lib/TokenomicsEngine.ts) | Balance local, recompensas por retransmisión y Vouchers offline |
| **Puente Web3 EVM** | [`client/app/src/lib/Web3BridgeEngine.ts`](file:///d:/PROYECTO%20RED/client/app/src/lib/Web3BridgeEngine.ts) | Proveedor EIP-1193, firma EIP-712 y sincronización MetaMask |
| **Monetización Mesh** | [`client/app/src/lib/MonetizationEngine.ts`](file:///d:/PROYECTO%20RED/client/app/src/lib/MonetizationEngine.ts) | Medición de ancho de banda y cobro por salto de paquete |
