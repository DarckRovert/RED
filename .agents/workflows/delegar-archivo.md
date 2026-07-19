---
description: Delegar la auditoría de un archivo específico al Gravity AI Local
---

Este flujo de trabajo permite a Antigravity enviar de forma automatizada un archivo entero para que el agente local lo inspeccione en busca de vulnerabilidades, deudas técnicas o refactorización, usando su memoria sin consumir cuota de la nube.

// turbo-all
1. **Ejecutar Auditoría Directa al Archivo**
   Inyectamos el archivo mediante el inyector del pipe y le pedimos al modelo local que emita una revisión minuciosa. Reemplaza `<RUTA_DEL_ARCHIVO>` con la ruta real.
   ```bash
   cat "<RUTA_DEL_ARCHIVO>" | python ask_deepseek.py "!modo auditor" "Audita este archivo buscando bugs y vulnerabilidades ocultas. Presenta un informe estructurado."
   ```

2. **Presentar Hallazgos**
   Antigravity leerá el output resultante en consola y se lo presentará al usuario para decidir los próximos pasos (ej: aplicar fix, descartar error falso positivo).
