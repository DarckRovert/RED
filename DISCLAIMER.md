# AVISO LEGAL Y DESCARGO DE RESPONSABILIDAD TÁCTICA / LEGAL DISCLAIMER

**PROYECTO RED (RED Sovereign Mesh OS)**  
*Versión Canónica: v125.0.0 (Septiembre 2026)*  
*Copyright (C) 2026 Rodrigo Alejandro Vega Rojas (alias "DarckRovert") / RED Sovereign Mesh Team*  
*Licencia: GNU Affero General Public License v3.0 (AGPL-3.0)*  
*Identificador Criptográfico SHA-256 del Contrato: `c5b290df628f80424564c7e75fef2e255f013d5cf5990264101e0ce5e9d997f6`*

---

## 1. Cláusula de Provisión "Tal Cual" (AS-IS) y Renuncia Total de Garantías

EL SOFTWARE RED (SOVEREIGN TACTICAL MESH OS), SUS BINARIOS COMPILADOS, CÓDIGO FUENTE, FIRMWARE ASOCIADO (ESP32-S3, STM32, SEMTECH LORA SX1262), ARQUITECTURAS NEUROMÓRFICAS Y PROTOCOLOS DE COMUNICACIÓN SE ENTREGAN **"TAL CUAL" ("AS IS") Y "SEGÚN DISPONIBILIDAD" ("AS AVAILABLE")**, SIN GARANTÍAS DE NINGÚN TIPO, YA SEAN EXPRESAS, IMPLÍCITAS, LEGALES O EXTRACONTRACTUALES.

DE MANERA EXPRESA Y CON EL MÁXIMO ALCANCE PERMITIDO POR LA LEY APLICABLE, SE RENUNCIA A TODA GARANTÍA IMPLÍCITA DE:
1. COMERCIABILIDAD Y CALIDAD SATISFACTORIA.
2. ADECUACIÓN O IDONEIDAD PARA UN PROPÓSITO GENERAL, TÁCTICO, MÉDICO O MILITAR PARTICULAR.
3. DISPONIBILIDAD ININTERRUMPIDA, LATENCIA CERO O AUSENCIA DE FALLOS, ERRORES, BUGS O VULNERABILIDADES DE SEGURIDAD.
4. NO INFRACCIÓN DE DERECHOS DE PROPIEDAD INTELECTUAL DE TERCEROS EN CUALQUIER JURISDICCIÓN.

EL USO DE ESTE SOFTWARE SE REALIZA **BAJO EL EXCLUSIVO CRITERIO, RIESGO Y RESPONSABILIDAD DEL USUARIO U OPERADOR DEL NODO**.

---

## 2. Limitación Absoluta de Responsabilidad Civil, Penal y Daños

EN LA MÁXIMA MEDIDA PERMITIDA POR EL DERECHO INTERNACIONAL Y LAS LEYES LOCALES (INCLUYENDO LA LEGISLACIÓN DE LA REPÚBLICA DEL PERÚ), EN NINGÚN CASO EL AUTOR PRINCIPAL, DESARROLLADOR, TITULAR DEL COPYRIGHT (**RODRIGO ALEJANDRO VEGA ROJAS / DARCKROVERT**), COLABORADORES, CONTRIBUYENTES O DISTRIBUIDORES SERÁN RESPONSABLES ANTE EL USUARIO O TERCEROS POR:

1. **Pérdida de vidas humanas, lesiones corporales, amputaciones, incapacidad permanente o daños a la salud** derivados directa o indirectamente del uso o imposibilidad de uso del software durante situaciones de emergencia extrema, desastres naturales, búsqueda y rescate (SAR), colapsos de infraestructura, conflictos bélicos o incidentes tácticos.
2. **Pérdida, corrupción, alteración, intercepción o divulgación de datos**, fallos en el enrutamiento de paquetes en malla (Flood Routing, TDMA, Slotted Gossip, DTN Store-and-Forward), particiones de red o falta de cobertura radioeléctrica.
3. **Pérdidas económicas, lucro cesante, interrupción de actividades comerciales o industriales**, multas gubernamentales, sanciones de telecomunicaciones, decomiso de equipos o daños cibernéticos.

---

## 3. No-Sustitución de Servicios Oficiales de Emergencia (911 / 112 / SAMU / INDECI)

> [!WARNING]
> **ESTE SOFTWARE NO ES UN SERVICIO PÚBLICO DE TELECOMUNICACIONES REGULADO NI UN SISTEMA HOMOLOGADO DE BÚSQUEDA Y RESCATE (COSPAS-SARSAT / SOLAS / GMDSS).**

- RED OS es una herramienta comunitaria experimental de resiliencia ad-hoc y comunicaciones fuera de línea (Off-Grid).
- **NO REEMPLAZA NI SUSTITUYE** a los organismos de socorro gubernamentales y servicios de emergencia oficiales (en Perú: Policía Nacional 105, Bomberos 116, SAMU 106, INDECI 115; o equivalentes internacionales 911 / 112).
- La propagación de paquetes a través de radioenlaces LoRa, Bluetooth Low Energy o Wi-Fi Direct es intrínsecamente probabilística y depende de la física ambiental: topografía, densidad de vegetación, obstáculos de concreto, saturación electromagnética y estado de batería. **NO EXISTE GARANTÍA DE ENTREGA DE MENSAJES SOS NI DE LOCALIZACIÓN DE VÍCTIMAS.**
- En situaciones de riesgo inminente para la vida humana, los operadores deben agotar de manera prioritaria los canales oficiales de auxilio público y autoridades de defensa civil.

---

## 4. Uso del Espectro Radioeléctrico, Bandas ISM y Transceptores LoRa/RF

El usuario u operador de hardware transmisor (módems Semtech SX1262, microcontroladores ESP32-S3, balizas BLE y transceptores RF) es el **único responsable legal y regulatorio** de:
1. Operar estrictamente dentro de las bandas ISM no licenciadas autorizadas en su país de despliegue (ej. 915 MHz en Región ITU 2 - América / Perú MTC; 868 MHz en Región ITU 1 - Europa CE RED; 433 MHz donde sea legal).
2. Respetar los límites máximos de Potencia Radiada Aparente / Efectiva (ERP/EIRP en dBm).
3. Respetar los porcentajes máximos de Ciclo de Trabajo (*Duty Cycle*, ej. 1% en sub-bandas europeas) y las regulaciones de salto de frecuencia (FHSS).
4. Evitar cualquier interferencia perjudicial a frecuencias militares, aeronáuticas, marítimas o de servicios esenciales.

El autor de RED OS provee el código como herramienta de software puro y no asume responsabilidad alguna por el uso indebido de hardware o emisiones RF que infrinjan normativas de telecomunicaciones (MTC, FCC Part 15, CE RED).

---

## 5. Descargo Clínico y Protocolo TCCC / MARCH Heurístico

> [!CAUTION]
> **LOS MÓDULOS DE TRIAGE TÁCTICO (MARCH / PAWS) Y CRONOMETRAJE DE TORNIQUETES SON HERRAMIENTAS HEURÍSTICAS DE SIMULACIÓN Y REFERENCIA EDUCATIVA.**

1. El submódulo `InsularTcccInteroceptionEngine` y la guía táctica MARCH (Massive Bleeding, Airway, Respiration, Circulation, Hypothermia) **NO CONSTITUYEN UN DISPOSITIVO MÉDICO CERTIFICADO** ni reemplazan la formación médica profesional ni los protocolos clínicos regulados.
2. Este software no ha sido evaluado, certificado ni autorizado por la FDA (Food and Drug Administration), EMA (European Medicines Agency), DIGEMID (Dirección General de Medicamentos, Insumos y Drogas del Perú) ni ningún organismo de homologación sanitaria.
3. Los temporizadores de isquemia de torniquete y estimaciones fisiológicas son aproximaciones algorítmicas. El operador asume total responsabilidad por cualquier intervención de primeros auxilios y sus resultados clínicos en el terreno.

---

## 6. Descargo Radiológico CBRN por Sensores Ópticos CMOS

1. La función de telemetría radiológica en `CbrnRadiationEngine` (detección de impactos de fotones ionizantes mediante pixeles centelleantes en el sensor de cámara CMOS en oscuridad) constituye una **aproximación heurística y experimental de contingencia**.
2. **NO ES UN DOSÍMETRO CALIBRADO, NI UN TUBO GEIGER-MÜLLER, NI UN MEDIDOR DE ESTADO SÓLIDO HOMOLOGADO.**
3. Bajo ninguna circunstancia el usuario debe basar su ingreso, permanencia o evacuación de zonas con sospecha de contaminación radiactiva o amenaza nuclear en las lecturas de este software. La radiación ionizante severa puede saturar o destruir los semiconductores del teléfono sin generar alertas precisas.

---

## 7. Doctrina de Inmunidad de Mero Conducto (*Mere Conduit*) para Nodos DTN en Malla

RED implementa un protocolo distribuido de enrutamiento y almacenamiento temporal (DTN Store-and-Forward / Flood Routing). Cada nodo conectado puede retransmitir paquetes de terceros de forma automática:
1. Los paquetes viajan protegidos con cifrado de extremo a extremo (E2EE) post-cuántico (ML-KEM-768 + X25519 + AES-256-GCM); el nodo repetidor intermediario **carece de claves para descifrar, inspeccionar o conocer el contenido** del payload.
2. La retransmisión es un proceso técnico estrictamente automatizado, sin intervención editorial, filtrado ni selección de remitentes o destinatarios por parte del operador del repetidor.
3. De conformidad con la doctrina de **Mero Conducto (*Mere Conduit*)** establecida en el Derecho Internacional y Comparado (US DMCA 17 U.S.C. § 512(a), US CDA 47 U.S.C. § 230, Directiva de Comercio Electrónico UE 2000/31/CE Artículo 12, y legislaciones análogas de la Sociedad de la Información), **los operadores de nodos no son legalmente responsables del contenido, datos o infracciones transmitidas en tránsito por terceros a través de sus radios o memorias intermedias**.

---

## 8. Naturaleza No Financiera de Créditos RED y Vouchers P2P

1. Los créditos RED, algoritmos de incentivo de retransmisión (Proof-of-Relay) y vales criptográficos fuera de línea (Offline Vouchers) son unidades métricas de contabilidad comunitaria y herramientas para el **trueque de recursos entre pares (P2P Barter)**.
2. **NO CONSTITUYEN MONEDA DE CURSO LEGAL, DEPÓSITOS BANCARIOS, TÍTULOS VALORES, INSTRUMENTOS DE INVERSIÓN NI DINERO ELECTRÓNICO REGULADO** conforme a la legislación financiera aplicable (SBS en Perú, SEC/CFTC en EE.UU., MiCA en la Unión Europea).
3. Los desarrolladores no administran fondos, no ofrecen garantías de liquidez, no custodian divisas ni operan casas de cambio fiduciarias.

---

## 9. Protocolo de Coacción (*Duress Wipe* / Zeroize) y Pérdida Irreversible de Datos

1. RED implementa mecanismos anti-forenses de seguridad física extrema (`DuressWipeEngine`).
2. En caso de activación del PIN de coacción o comando de emergencia, el sistema ejecuta una sobrescritura destructiva criptográfica (patrón multinivel DoD 5220.22-M con ruido aleatorio CSPRNG).
3. **LA DESTRUCCIÓN ES INSTANTÁNEA, TOTAL E IRREVERSIBLE.** Ni el usuario ni el desarrollador pueden recuperar identidades, claves privadas ni datos tras una purga. El usuario asume el 100% de la responsabilidad por la pérdida de datos derivada de la activación voluntaria o involuntaria de este protocolo.

---

## 10. Cero Conocimiento (*Zero-Knowledge*) y Custodia Criptográfica

1. RED opera bajo una arquitectura soberana *Local-First*: el sistema no cuenta con servidores centrales de recolección de metadatos ni bases de datos corporativas en la nube.
2. El usuario es el **único y exclusivo custodio** de sus claves privadas (Ed25519 / ML-KEM-768), semillas mnemónicas BIP-39 y fragmentos de secreto Shamir (SSS). Si el usuario extravía sus factores de autenticación, no existe ningún mecanismo técnico para recuperarlos.

---

## 11. Control de Exportación Criptográfica

El software contiene criptografía de clave pública de grado militar y algoritmos post-cuánticos estandarizados por el NIST (FIPS 203 ML-KEM). El código fuente es público y libre bajo licencia AGPL-3.0. No obstante, el usuario es responsable de verificar que la importación y uso de criptografía fuerte no vulnere las leyes de su país de residencia o jurisdicción operativa.

---

## 12. Ley Aplicable, Arbitraje y Divisibilidad (*Severability*)

1. Este documento y cualquier relación jurídica derivada del software se interpretarán de conformidad con las leyes de la República del Perú y los principios generales del derecho internacional privado en materia de software de código abierto.
2. Si cualquier disposición de este descargo fuere declarada nula, inoponible o inválida por un tribunal competente, dicha nulidad no afectará la validez de las cláusulas restantes, las cuales permanecerán en pleno vigor y efecto.
3. El uso, compilación, instalación o ejecución de cualquier componente de RED OS constituye la **aceptación expresa, voluntaria, informada e incondicional** de la totalidad de las cláusulas aquí estipuladas.

---

*RED — Sovereign Tactical Mesh OS © 2026. Documento Canónico v125.0.0.*
