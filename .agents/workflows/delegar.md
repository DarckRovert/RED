---
description: Delegar una tarea técnica agresiva al Auditor Senior Local V4
---

Este flujo de trabajo es el modo en el que **Antigravity** aprovecha el Gravity Server para realizar un trabajo de Coder duro (ej. escribir módulos enteros) usando el backend de GPU local del humano.

// turbo-all
1. **Verificar el Ecosistema**
   Evalúa en qué motor está corriendo el Gravity y qué memoria tiene.
   ```bash
   python ask_deepseek.py "!info"
   ```

2. **Delegar por Pipe Directo (Ej. Auditoría de Archivos)**
   Si necesitas que la IA local revise un bloque de código completo (o un error largo), asumes el perfil Coder temporal y se lo mandas por pipe:
   ```bash
   python ask_deepseek.py "!modo coder"
   cat EL_ARCHIVO_CON_PROBLEMAS.py | python ask_deepseek.py "Escribe el fix completo para los errores en este archivo. Sin excusas ni markdown excesivo."
   ```

3. **Restaurar el Perfil (Opcional)**
   Si usaste `!modo coder`, asegúrate de restaurar el comportamiento si sigues interactuando.
   ```bash
   python ask_deepseek.py "!modo auditor"
   ```

4. **Incorporar la Solución**
   Lee la salida de consola, corrígela o adáptala si notases alguna deficiencia del modelo local, e impleméntalo para el usuario.
