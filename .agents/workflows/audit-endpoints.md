---
description: Auditoría proactiva y empírica de endpoints y modelos LLM (Groq, Nvidia NIM, Mistral, Ollama)
globs: ["client/app/src/lib/ai/**", "core/**"]
---

# Workflow: Auditoría Proactiva de Endpoints LLM (`/audit-endpoints`)

Este flujo de trabajo da cumplimiento estricto a la **Regla de Usuario 8: Empirismo de Endpoints**.
Valida empíricamente la vigencia y disponibilidad de cada modelo LLM configurado en el sistema antes de permitir su uso en producción o en cambios de código.

## Principios Operativos:
1. **Verificación Empírica Real:** Nunca asumir que un modelo sigue activo porque estaba configurado ayer. Los proveedores descontinúan checkpoints sin previo aviso.
2. **Sondeo de Bajo Impacto:** Cada prueba debe ejecutarse con una solicitud HTTP real enviando `max_tokens: 1` para consumir el mínimo ancho de banda y cuota.
3. **Erradicación Inmediata:** Todo modelo que devuelva `HTTP 404 Not Found` o `HTTP 410 Gone` debe ser purgado de inmediato y de forma quirúrgica de los archivos de configuración (`openai_compat_providers.py`, `aiSlice.ts`, catálogos locales).

---

## Pasos de Ejecución:

### Paso 1: Localizar Catálogos de Modelos
Identificar los archivos donde residen las listas de modelos y proveedores:
- `client/app/src/lib/ai/`
- Proveedores compatibles con OpenAI (Groq, Nvidia NIM, OpenRouter, Mistral, etc.).

### Paso 2: Ejecutar Sonda HTTP (max_tokens = 1)
Para cada modelo registrado, emitir una llamada de prueba:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "$PROVIDER_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "$MODEL_ID",
    "messages": [{"role": "user", "content": "ping"}],
    "max_tokens": 1
  }'
```

### Paso 3: Interpretar Códigos de Estado
- **`HTTP 200`**: Modelo operativo y saludable. Mantener en catálogo.
- **`HTTP 429`**: Rate limit temporal. Modelo activo pero saturado. Mantener con advertencia.
- **`HTTP 401 / 403`**: Error de autenticación en credenciales. Verificar variable de entorno.
- **`HTTP 404 / 410`**: **DESCONTINUADO / OBSOLETO.** Purgar inmediatamente del código fuente.

### Paso 4: Actualización y Pruebas de Regresión
1. Remover quirúrgicamente los IDs de modelos con error 404/410.
2. Si el modelo purgado era el default de un proveedor, reasignar el fallback al modelo LTS verificado más reciente.
3. Ejecutar `npx tsc --noEmit` en `client/app` para asegurar integridad de tipos.
