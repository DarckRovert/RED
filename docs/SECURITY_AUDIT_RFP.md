# 🛡️ Solicitud de Propuesta de Auditoría Criptográfica (Security Audit RFP) — RED v63.0.0

**Para:** Firmas Auditoras de Criptografía y Ciberseguridad de Sistemas Distribuidos (*Trail of Bits*, *NCC Group*, *OpenZeppelin Security*, *Cure53*).  
**De:** Equipo de Desarrollo de RED (Red Criptográfica Soberana Off-Grid & P2P Mesh).  
**Fecha de Emisión:** Agosto 2026  
**Versión del Repositorio:** `v63.0.0` (`main` branch)  
**Contacto Confidencial:** `security@red-mesh.org`

---

## 1. 🎯 Objetivo del Compromiso

Contratar una auditoría de código fuente independiente y exhaustiva para evaluar la solidez matemática, la resistencia a ataques de canal lateral, la corrección de protocolos post-cuánticos y la resiliencia del almacenamiento cifrado en el ecosistema **RED v63.0.0**.

---

## 2. 📂 Alcance Técnico de la Auditoría (In-Scope Codebase)

| Módulo / Crate | Ruta en Repositorio | Líneas de Código (SLOC) | Primitivos Criptográficos Clave |
|---|---|---|---|
| **Criptografía Núcleo** | `core/src/crypto/` | ~3,200 | ML-KEM-768 (FIPS 203), X25519, ChaCha20-Poly1305, HKDF, BLAKE3 |
| **Double Ratchet & PFS** | `core/src/crypto/ratchet.rs` | ~450 | Trinquete simétrico y Diffie-Hellman, avance de cadenas |
| **Pruebas de Conocimiento Cero** | `core/src/crypto/zk_proofs.rs` | ~380 | Árboles de Merkle, compromisos criptográficos, nullifiers |
| **Bóveda & Gestión de Claves** | `core/src/identity/` | ~850 | Argon2id KDF, Zeroize de memoria, rotación de claves |
| **Red Malla & Enrutamiento Cebolla** | `core/src/network/onion.rs` | ~600 | Paquetes cebolla de 3 saltos, protección AAD |
| **Blockchain PoS & Consenso** | `blockchain/src/` | ~2,100 | Árbol de Merkle de bloques, selección determinista de líderes |
| **Puente Móvil FFI / JNI** | `red_mobile/src/` | ~1,800 | Aislamiento de memoria FFI Rust $\leftrightarrow$ Android/iOS |

---

## 3. 🧪 Vectores de Ataque Críticos a Evaluar (Threat Model)

Los auditores deberán evaluar activamente los siguientes vectores de amenaza:

1. **Ataques de Temporización (Timing Attacks & Constant-Time Guarantees):**
   - Verificar que todas las operaciones de comparación de claves, cálculo de firmas y validación de MACs usen `subtle::ConstantTimeEq`.
2. **Ataques de Canal Lateral & Manejo de Memoria (Side-Channel & Zeroize):**
   - Asegurar que los secretos efímeros y claves privadas se limpien inmediatamente de la memoria RAM tras su uso (`zeroize::ZeroizeOnDrop`).
3. **Resistencia contra Replay & Maleabilidad de Paquetes:**
   - Confirmar que ningún atacante intermediario (MitM) pueda alterar cabeceras de transporte o reinyectar tramas pasadas sin invalidar la autenticación Poly1305.
4. **Cumplimiento Estricto de NIST FIPS 203:**
   - Validar que el encapsulado y desencapsulado de **ML-KEM-768** genere secretos compartidos matemáticamente idénticos y resistentes a perturbaciones cuánticas.
5. **Secreto Perfecto hacia Adelante (PFS) y Auto-Recuperación (PCS):**
   - Validar que el compromiso de una clave de sesión actual no permita descifrar mensajes históricos ni comprometa turnos futuros tras el siguiente salto DH.
6. **Resiliencia de la Bóveda ante Coacción (Panic Wipe & Decoy Vault):**
   - Verificar que la derivación de clave con Argon2id no deje trazas recuperables en disco (Sled DB) tras la activación de un PIN de pánico.

---

## 4. 📅 Cronograma Propuesto & Entregables

- **Semanas 1-2:** Revisión estática de código, verificación de modelos formales ProVerif y pruebas de fuzzing con `cargo-fuzz`.
- **Semana 3:** Simulación de ataques de red, análisis de penetración P2P y validación de constantes criptográficas.
- **Semana 4:** Entrega del **Informe Preliminar de Vulnerabilidades**.
- **Ventana de Remediación (1-2 semanas):** Aplicación de parches por el equipo de ingeniería de RED.
- **Informe Final:** Publicación del reporte final de auditoría con certificación de corrección.

---

## 📋 Cuestionario de Evaluación para las Firmas Auditoras

Las firmas interesadas deben responder al contacto confidencial adjuntando:
1. Experiencia previa auditando implementaciones en Rust de criptografía post-cuántica y protocolos tipo Signal/Noise.
2. Metodología para auditoría de código libre de `unsafe` en entornos móviles embebidos.
3. Estimación de costo (rango en USD) y fecha más temprana de inicio.
