---
name: youmindag
description: Carga contexto arquitectónico del proyecto vía YouMindAG (bóveda + grafo + historial). Usar ANTES de explorar código, buscar símbolos, entender un módulo o empezar una tarea de implementación. Triggers - explorar codebase, entender módulo, buscar referencias de un símbolo, empezar feature, contexto del proyecto.
---

# Protocolo YouMindAG

Este proyecto tiene un sistema de contexto instalado. En lugar de explorar con grep/find/cat, usa:

1. **Contexto de un módulo** (bóveda + grafo + historial en un solo comando):
   ```bash
   npx youmindag architect <modulo>        # resumen curado
   npx youmindag architect <modulo> --full # sin truncar
   npx youmindag architect                 # listar módulos disponibles
   ```

2. **Buscar referencias de un símbolo** (en vez de grep):
   ```bash
   npx youmindag references <simbolo>
   ```

3. **Diagnóstico** cuando algo no cuadra (bóveda stale, grafo viejo):
   ```bash
   npx youmindag doctor
   ```

4. **Después de editar código**: mantener el grafo sincronizado y registrar decisiones:
   ```bash
   npx graphify update
   node scripts/session-checkpoint.mjs --decision "qué se decidió y por qué"
   ```

Reglas completas del proyecto: leer `AGENTS.md`. La documentación de negocio vive en el directorio `boveda*/` (fuente de verdad para features, BD y convenciones).
