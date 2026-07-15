# Flujo General

**Propósito**: Recorrido completo de un dato de principio a fin, con cada etapa linkeada a su feature doc, ruta, tabla BD y estado de máquina.

---

## Formato

Cada etapa del flujo sigue este formato:

```
Etapa (estado_máquina)
  → [Feature Doc](ruta/al/doc.md)  |  /ruta/app  |  tabla.estado = 'VALOR'
```

## Flujo principal

```
<!-- AUTO-GENERATED START -->
(Pendiente de documentar — ejecutar `node scripts/populate-vault.mjs` para completar)
<!-- AUTO-GENERATED END -->
```

---

## Cómo documentar

1. Identificar el punto de entrada del sistema (ej: creación de incidente, registro de usuario)
2. Seguir cada transición de estado hasta el cierre o archivo
3. Para cada etapa, linkear:
   - **Feature doc**: archivo en `🧩 Features/` con la lógica de ese paso
   - **Ruta**: URL donde ocurre la acción
   - **Tabla/estado**: registro en BD que cambia
4. Usar [[wiki links]] para navegación rápida entre docs

Ver también: [[🏗 Arquitectura/Máquina de Estados]] para el catálogo completo de estados.
