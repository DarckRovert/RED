# 📖 Glosario de Términos - RED

Referencia rápida de términos técnicos utilizados en el proyecto RED.

---

## A

### AEAD (Authenticated Encryption with Associated Data)
Esquema de cifrado que proporciona confidencialidad, integridad y autenticación en una sola operación. RED usa ChaCha20-Poly1305.

### Anonimato
Propiedad que garantiza que la identidad del emisor/receptor de un mensaje no puede ser determinada por un observador externo.

### Adversario Global
Modelo de amenaza donde el atacante puede observar todo el tráfico de red simultáneamente.

---

## B

### BLAKE3
Función hash criptográfica moderna y rápida. Produce hashes de 256 bits. Usada en RED para hashing general y KDF.

### Blockchain
Estructura de datos distribuida e inmutable. En RED, se usa exclusivamente para registrar identidades, no mensajes.

### Bootstrap Node
Nodo conocido que ayuda a nuevos participantes a conectarse a la red P2P.

---

## C

### ChaCha20-Poly1305
Algoritmo de cifrado autenticado (AEAD). ChaCha20 proporciona cifrado de flujo, Poly1305 proporciona autenticación.

### Clave Efímera
Clave criptográfica generada para un solo uso o sesión, luego descartada.

### Consenso
Mecanismo por el cual los nodos de la red acuerdan el estado del sistema. RED usa Proof of Stake.

### CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
Generador de números aleatorios seguro para uso criptográfico.

---

## D

### Deniabilidad
Propiedad que permite a un usuario negar haber enviado un mensaje, ya que no hay prueba criptográfica vinculante.

### DHT (Distributed Hash Table)
Estructura de datos distribuida que permite búsqueda eficiente en redes P2P.

### Diffie-Hellman (DH)
Protocolo de intercambio de claves que permite a dos partes establecer un secreto compartido sobre un canal inseguro.

### Double Ratchet
Protocolo criptográfico que proporciona forward secrecy y break-in recovery. Combina ratchet DH con ratchet de cadena.

### Dummy Traffic
Tráfico falso generado para ocultar patrones de comunicación real.

---

## E

### E2E (End-to-End Encryption)
Cifrado donde solo el emisor y receptor pueden leer el mensaje. Ningún intermediario tiene acceso al contenido.

### Ed25519
Esquema de firma digital basado en curva elíptica Edwards25519. Rápido y seguro.

---

## F

### Forward Secrecy (FS)
Propiedad que garantiza que el compromiso de claves actuales no compromete mensajes pasados.

### Fuzzing
Técnica de testing que envía datos aleatorios o malformados para encontrar vulnerabilidades.

---

## G

### Gossip Protocol
Protocolo de propagación de información donde cada nodo comparte datos con un subconjunto aleatorio de peers.

### Grafo d-Regular
Grafo donde cada nodo tiene exactamente d conexiones. RED usa d=8.

---

## H

### Hash
Función que convierte datos de cualquier tamaño en un valor de tamaño fijo. Debe ser unidireccional y resistente a colisiones.

### HKDF (HMAC-based Key Derivation Function)
Función para derivar múltiples claves a partir de un secreto inicial.

### HMAC (Hash-based Message Authentication Code)
Código de autenticación de mensajes basado en hash.

---

## I

### Identity Hash
Hash único que identifica a un usuario sin revelar su clave pública directamente.

### IND-CPA (Indistinguishability under Chosen Plaintext Attack)
Propiedad de seguridad donde un adversario no puede distinguir entre cifrados de dos mensajes elegidos.

---

## K

### KDF (Key Derivation Function)
Función que deriva una o más claves criptográficas a partir de un valor secreto.

### Key Rotation
Proceso de reemplazar claves criptográficas periódicamente para limitar el impacto de un compromiso.

---

## L

### Latencia
Tiempo que tarda un mensaje en llegar del emisor al receptor.

### libp2p
Biblioteca modular para construir aplicaciones P2P. Usada en RED para networking.

---

## M

### Merkle Tree
Estructura de datos en árbol donde cada nodo hoja contiene un hash de datos, y cada nodo interno contiene el hash de sus hijos.

### Metadatos
Información sobre la comunicación (quién, cuándo, con quién) distinta del contenido del mensaje.

### Mixing
Técnica para ocultar la correlación entre mensajes entrantes y salientes en un nodo.

---

## N

### Nonce
Número usado una sola vez. Esencial para la seguridad de muchos esquemas criptográficos.

### Nodo
Participante en la red P2P que retransmite mensajes y/o valida transacciones.

---

## O

### Onion Routing
Técnica donde los mensajes se cifran en múltiples capas, cada una removida por un nodo intermedio.

---

## P

### P2P (Peer-to-Peer)
Arquitectura de red donde los participantes se comunican directamente sin servidor central.

### Padding
Datos añadidos a un mensaje para ocultar su tamaño real.

### Peer
Otro nodo en la red P2P con el que se mantiene conexión.

### Post-Quantum
Criptografía diseñada para resistir ataques de computadoras cuánticas.

### Proof of Stake (PoS)
Mecanismo de consenso donde los validadores son seleccionados proporcionalmente a su stake (tokens bloqueados).

---

## R

### Ratchet
Mecanismo criptográfico que avanza en una dirección, derivando nuevas claves de las anteriores.

### Replay Attack
Ataque donde un mensaje válido es retransmitido maliciosamente.

### ROM (Random Oracle Model)
Modelo teórico donde las funciones hash se comportan como oráculos aleatorios.

---

## S

### Sender Keys
Protocolo para mensajería grupal eficiente donde cada miembro tiene una clave de envío.

### Session
Estado criptográfico compartido entre dos usuarios para comunicación cifrada.

### Slashing
Penalización (pérdida de stake) por comportamiento malicioso en sistemas PoS.

### Staking
Bloqueo de tokens como garantía para participar como validador.

### Sybil Attack
Ataque donde un adversario crea múltiples identidades falsas para ganar influencia.

---

## T

### TLA+
Lenguaje de especificación formal para modelar y verificar sistemas concurrentes.

### Timing Attack
Ataque de canal lateral que explota variaciones en tiempo de ejecución.

### Transaction
Operación atómica registrada en la blockchain (ej. registro de identidad).

---

## U

### Unlinkability
Propiedad donde dos acciones no pueden ser vinculadas al mismo usuario.

---

## V

### Validator
Nodo que participa en el consenso y puede proponer/validar bloques.

---

## X

### X25519
Protocolo de intercambio de claves Diffie-Hellman usando Curve25519.

### X3DH (Extended Triple Diffie-Hellman)
Protocolo de establecimiento de sesión usado por Signal. RED usa una versión simplificada.

---

## Z

### Zero-Knowledge Proof (ZKP)
Prueba criptográfica que demuestra conocimiento de un secreto sin revelarlo.

### Zeroize
Borrado seguro de datos sensibles de la memoria.

---

## Símbolos Matemáticos

| Símbolo | Significado |
|---------|-------------|
| `∥` | Concatenación |
| `⊕` | XOR |
| `←$` | Muestreo aleatorio |
| `H(x)` | Hash de x |
| `E(k,m)` | Cifrado de m con clave k |
| `D(k,c)` | Descifrado de c con clave k |
| `ε(λ)` | Función negligible en λ |
| `𝕌` | Conjunto de usuarios |
| `𝕄` | Conjunto de mensajes |
| `𝕋` | Línea temporal |

---

## Referencias

- [Signal Protocol Documentation](https://signal.org/docs/)
- [Tor Project Glossary](https://tb-manual.torproject.org/glossary/)
- [Cryptography Engineering](https://www.schneier.com/books/cryptography-engineering/)
