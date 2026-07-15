# Contribuir a YouMindAG

Gracias por el interés en mejorar YouMindAG. Esta guía explica cómo está organizado el proyecto y qué se espera de un PR para que se acepte sin fricción.

## Antes de empezar

- Node.js >= 18
- Haber leído el [README](./README.md) para entender qué hace la herramienta

```bash
git clone https://github.com/CESARBR2025/youmindag.git
cd youmindag
npm install
```

No hay build step: `bin/run.mjs` y todo `lib/` son ES modules planos, se ejecutan directo.

## Estructura del proyecto

```
bin/run.mjs          ← entrypoint del CLI, despacha subcomandos
lib/
├── commands/         ← un archivo por familia de comandos (db, dev, trace, watch, sync, misc)
├── utils.mjs         ← helpers compartidos (colores de consola, kebabCase, pascalCase...)
├── fs-helpers.mjs    ← lectura/escritura de archivos, dry-run
├── detect.mjs        ← detección de stack/DB del proyecto destino
├── vault.mjs         ← lectura/escritura de la bóveda de conocimiento
├── graphify.mjs       ← integración con @sentropic/graphify
├── agents.mjs        ← merge de AGENTS.md y context-map
├── gitignore.mjs     ← entradas de .gitignore
└── populate.mjs      ← poblado de la bóveda (Capa 1, factual)
template/             ← lo que se copia al proyecto destino (boveda/, scripts/, AGENTS.md)
test/                 ← un archivo de test por módulo de lib/, usando node:test
```

## Cómo agregar o modificar un comando

Cada comando vive en su propio archivo dentro de `lib/commands/`, exporta una función `cmdX`, y se registra en `bin/run.mjs` así:

```js
// 1. lib/commands/miComando.mjs
export function cmdMiComando(args) {
  // lógica del comando
}

// 2. bin/run.mjs
import { cmdMiComando } from '../lib/commands/miComando.mjs'
// ...
if (subcommand === 'mi-comando') {
  cmdMiComando(args)
}
```

No metas lógica nueva directo en `bin/run.mjs` más allá del dispatch — ese archivo ya es grande y la modularización a `lib/commands/` es la razón por la que existe el gate de verificación (ver más abajo).

## El gate obligatorio: `npm run verify`

```bash
npm run verify   # = npm run lint && npm test
```

Esto existe porque en v2.9.0–2.9.2 la modularización de comandos dejó **46 imports faltantes** repartidos en 7 archivos, invisibles hasta correr ESLint (`no-undef`). Desde v2.9.3, `prepublishOnly` corre `verify` automáticamente antes de cualquier `npm publish` — no se puede publicar con ese tipo de bug otra vez sin saltárselo a propósito.

**Todo PR debe pasar `npm run verify` en verde antes de pedir review.** Si tu cambio agrega una función nueva exportada, agrega también su test correspondiente en `test/` — el patrón es un archivo de test por módulo, usando `describe`/`it` de `node:test`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { miFuncion } from '../lib/miModulo.mjs'

describe('miFuncion', () => {
  it('hace lo que debería en el caso normal', () => {
    assert.strictEqual(miFuncion('x'), 'y')
  })
})
```

## Verificación contra un proyecto real

Los cambios en `lib/commands/` o `template/` no solo se validan con `npm run verify` — se prueban corriendo el comando contra un proyecto Node real, no solo leyendo el código:

```bash
cd /ruta/a/un/proyecto/de/prueba
node /ruta/a/tu/checkout/youmindag/bin/run.mjs <comando>
```

Si tu PR toca el flujo de instalación (`npx youmindag` sin subcomando), pruébalo en un proyecto limpio y en uno que ya tenga `boveda/` instalada (flujo de actualización).

## Convenciones de commit

Mensajes cortos y descriptivos, en el formato usado en el historial del repo:

```
v2.9.3: Add prepublishOnly gate — auto-runs lint+test before npm publish
```

Si tu cambio no ameríta un bump de versión (docs, typos, refactor interno sin cambio de comportamiento), no hace falta el prefijo `vX.Y.Z:`.

## Reportar un bug

Abre un [issue](https://github.com/CESARBR2025/youmindag/issues) con:

- Versión de YouMindAG (`npx youmindag --version` o revisa `package.json`)
- Comando exacto que corriste
- Qué esperabas vs. qué pasó
- Si es posible, el tipo de proyecto donde ocurrió (stack, gestor de paquetes)

## Proponer una feature

Abre un issue describiendo el caso de uso antes de escribir código — así evitamos PRs grandes que no encajan con la dirección del proyecto. Si ya tienes una implementación en mente, decirlo en el issue también ahorra tiempo.

## Checklist antes de abrir el PR

- [ ] `npm run verify` pasa en verde
- [ ] Si agregaste una función exportada nueva, tiene test
- [ ] Si tocaste `lib/commands/` o `template/`, lo probaste contra un proyecto real
- [ ] El PR describe qué problema resuelve, no solo qué archivos cambiaste

## Licencia

Al contribuir aceptas que tu código se distribuya bajo la misma licencia MIT del proyecto.
