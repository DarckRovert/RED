---
description: Enseñar una regla o convención permanente al Gravity AI Local
---

Usa este workflow cuando el usuario defina en la interfaz principal una convención (ej: "siempre usa TypeScript en frontend") y quieras que el modelo local de apoyo la recuerde en todas sus sesiones futuras. 

// turbo-all
1. **Delegar Aprendizaje**
   Llamamos al Auditor local en modo silencioso y ejecutamos el comando `!aprende <regla>`. Reemplaza `<REGLA_A_APRENDER>` por el texto de la regla en cuestión.
   ```bash
   python ask_deepseek.py "!aprende <REGLA_A_APRENDER>"
   ```

2. **Verificar Aprendizaje**
   El comando responderá "Regla aprendida y persistida." si se guardó con éxito en `_knowledge.json`. Infórmale al usuario que su IA local ahora comparte ese conocimiento.
