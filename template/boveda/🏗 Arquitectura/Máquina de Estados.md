# Máquina de Estados

**Propósito**: Catálogo centralizado de todos los estados del sistema, sus transiciones, triggers y feature responsable.

---

## Formato

Cada máquina de estados se documenta con el nombre de la tabla y columna que contiene el estado:

```
tabla.columna_estado:
  ESTADO_ORIGEN  ──[trigger / acción]──►  ESTADO_DESTINO  →  [Feature Doc](ruta)
```

## Estados del sistema

```
<!-- AUTO-GENERATED START -->
(Pendiente de documentar — ejecutar `node scripts/populate-vault.mjs` para completar)
<!-- AUTO-GENERATED END -->
```

---

## Cómo documentar

1. Identificar todas las columnas de tipo estado/enum en el esquema de BD (ver `📦 Datos/Esquema BD.md`)
2. Para cada columna, listar sus valores posibles
3. Identificar qué acción/trigger causa cada transición
4. Linkear al feature doc que contiene la lógica de esa transición

### Ejemplo

```
incidentes.estatus:
  sin_despachar  ──[despacho]──►  en_despacho  →  [[../🧩 Features/Despacho|Despacho]]
  en_despacho    ──[marcar en sitio]──►  en_sitio  →  [[../🧩 Features/Oficial|Oficial]]
  en_sitio       ──[reporte campo sin detención]──►  atendido  →  [[../🧩 Features/Reporte Campo|Reporte Campo]]
  en_sitio       ──[reporte campo con detención]──►  cerrado_detencion  →  [[../🧩 Features/Reporte Campo|Reporte Campo]]
```

Ver también: [[../../🗺 FLUJO GENERAL]] para el recorrido completo extremo a extremo.
