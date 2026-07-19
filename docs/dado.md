# Sistema de Dados — Análisis y especificación para reinventarlo

> Documento de referencia. Primera parte: cómo funciona HOY (as-is).
> Segunda parte: qué está mal y el diseño objetivo (to-be) para reimplementarlo
> sin romper la API pública ni la UI.

---

## 1. Qué es

Módulo de "tiradas con recompensa": el jugador (o el DM dentro de una partida)
elige una **recompensa configurada** (`dados_recompensas`), paga un costo en oro
(opcional), tira uno o varios dados y recibe oro y/o ítems según el tipo de
recompensa. Todo el azar se resuelve **en el servidor**; el cliente solo anima.

Dos contextos de uso:

| Contexto | Página | Endpoint de tirada | Quién paga | Quién recibe |
|---|---|---|---|---|
| Personal | `/dado` (`app/dado/page.tsx`) | `POST /api/dados/roll` | el usuario (oro real vía `modifyGold`) | el usuario |
| Partida (DM) | sala DM (`app/components/sala-dm.tsx`) | `POST /api/partidas/[id]/dados/roll` | nadie (`hideCost`) | el personaje participante elegido |

El mismo componente `DiceModule` sirve para ambos: acepta `rollApiUrl`,
`extraBody` (p. ej. `personaje_id`), `hideCost` y `onRollComplete`.

## 2. Mapa de archivos

| Archivo | Rol |
|---|---|
| `lib/types/dados.ts` | Tipos compartidos + `rollDie()` (el RNG: `Math.floor(Math.random()*max)+1`) |
| `app/api/dados/config/route.ts` | GET recompensas activas para el jugador (mapea snake_case→camelCase) |
| `app/api/dados/roll/route.ts` | Tirada personal: cobra oro, resuelve, acredita, guarda `dados_historial` |
| `app/api/partidas/[id]/dados/roll/route.ts` | Tirada en partida (admin/DM): resuelve, entrega vía `asignarItem`/RPC `modificar_oro`, guarda `partidas_eventos` |
| `app/api/dados/admin/route.ts` | CRUD admin de recompensas (GET/POST/PUT/DELETE) |
| `app/admin/dados-tab.tsx` | UI admin (910 líneas): formularios por tipo + preview con `DiceModule` |
| `app/components/dice-module.tsx` | UI del jugador: selector de recompensa, botón tirar, resultados |
| `app/components/dice-visual.tsx` | SVG del dado (una forma por tipo d4–d20) + número del resultado |
| `app/globals.css` (~584–602) | Animaciones `.dice-idle` (balanceo infinito) y `.dice-rolling` (1 s) |
| `lib/goldService.ts` | `modifyGold()` → RPC `modificar_oro` (lanza con "Oro insuficiente") |
| `lib/asignarItem.ts` | Entrega de ítem a la bolsa de un personaje (solo en contexto partida) |

Migraciones (historia del esquema): `042_dados_recompensas.sql` (base),
`043_dados_seed_prueba.sql` (seed), `044_dados_lut.sql` (tipos `lut`/`subtabla`),
`046_subtabla_oro.sql` (oro en subtablas), `048_dados_item_cantidad.sql`
(rangos de cantidad de ítems), `049_partidas_eventos.sql` (feed de sala).

## 3. Modelo de datos

```
dados_recompensas            -- la "carta" configurable que el jugador elige
├─ tipo: item_fijo | sublista | oro_dados | lut | subtabla
├─ tipo_dado: d4|d6|d8|d10|d12|d20   (lut/subtabla fuerzan d20)
├─ costo_oro, activo, orden
├─ objeto_id                 -- solo item_fijo
└─ cantidad_dados, multiplicador_oro  -- solo oro_dados

dados_sublista_items         -- tipo=sublista: rangos valor_min–valor_max → objeto
dados_lut_caras              -- tipo=lut: una fila por cara del d20 (UNIQUE recompensa+cara)
│  ├─ tipo: oro | item | subtabla | nada
│  ├─ (oro)   cantidad_dados=ORO_MIN, multiplicador_oro=ORO_MAX  ⚠ nombres mienten
│  ├─ (item)  objeto_id, cantidad_min, cantidad_max
│  └─ (subtabla) subtabla_id → dados_recompensas(tipo=subtabla)
dados_subtabla_caras         -- tipo=subtabla: cara → nada | item(cantidad_min/max) | oro(oro_min/max)
dados_historial              -- log por usuario (RLS: cada uno ve el suyo)
partidas_eventos             -- feed de sala: evento tipo='dado_tirado' con metadata
```

Claves del esquema:

- **`subtabla` es una recompensa** más en `dados_recompensas`, pero se filtra de
  la UI del jugador; solo existe para que una cara LUT apunte a ella.
- ⚠ En `dados_lut_caras` con `tipo='oro'`, las columnas `cantidad_dados` y
  `multiplicador_oro` se **reutilizan** como `oro_min`/`oro_max`. La columna
  `tipo_dado_oro` existe pero **siempre se escribe NULL** (la idea original
  "tirar N dados y multiplicar" quedó reducida a un rango plano min–max).
- RLS: lectura pública de configs activas; el servidor escribe con service role.

## 4. Tipos de recompensa y resolución

Todo servidor. `rollDie(tipo)` = entero uniforme 1..caras.

| Tipo | Dados tirados | Resultado |
|---|---|---|
| `item_fijo` | 1 × `tipo_dado` (decorativo) | siempre `objeto_id` ×1 |
| `sublista` | 1 × `tipo_dado` | busca rango `valor_min ≤ r ≤ valor_max` en sublista → ítem ×1; sin match → error 500 |
| `oro_dados` | `cantidad_dados` × `tipo_dado` | `suma × multiplicador_oro` de oro |
| `lut` | `cantidad` tiradas de d20 (1–10) | por cada tirada, la cara decide: nada / ítem (cantidad aleatoria min–max) / oro (aleatorio oro_min–oro_max) / subtabla → **segunda tirada d20** contra `dados_subtabla_caras` |
| `subtabla` | — | nunca se tira directo; solo como salto desde una cara LUT |

Respuesta de `POST roll` (`RollResult`):

```ts
{ resultados: number[],                    // caras (legacy: solo la 1ª en LUT)
  tipoResultado: 'item'|'oro'|'nada'|'subtabla',
  objeto?: {id,nombre,icono}, cantidadOro?: number,
  lutResultados?: LutCaraResult[],         // detalle por tirada en LUT
  cantidad?: number }
```

Los campos sueltos de arriba son **compatibilidad legacy** (copia del primer
`lutResultados[0]`); la UI moderna lee `lutResultados`.

### Orden de operaciones en la tirada personal (`/api/dados/roll`)

1. Auth Bearer (`getUserFromRequest`), validar body (`recompensa_id`, `cantidad` 1–10).
2. Cargar recompensa activa + sublista; caras LUT en query aparte.
3. **Cobrar TODO el costo por adelantado** (`modifyGold` negativo; si lanza
   "Oro insuficiente" → 400).
4. Resolver tirada(s); el oro ganado se acredita al momento (`modifyGold`
   positivo), **cada tirada inserta su fila en `dados_historial`**.
5. Responder con el detalle.

### Diferencias del clon de partida (`/api/partidas/[id]/dados/roll`)

- `requireAdmin` + partida `en_progreso` + personaje participante.
- No cobra costo. Oro vía RPC `modificar_oro` con `p_admin_id` y concepto
  `partida_sala:<id>`; ítems vía `asignarItem` (bolsa real del personaje).
- Persiste en `partidas_eventos` (feed de la sala), no en `dados_historial`.
- ⚠ **Ignora `cantidad_min/max` de ítems**: entrega siempre 1.

## 5. UI

- **`DiceModule`**: carga `/api/dados/config`, filtra `tipo !== 'subtabla'`,
  pinta selector de recompensas, input de cantidad (solo LUT), botón Tirar.
  Al tirar: `fetch` + `setTimeout(1000)` fijo para dejar terminar la animación,
  luego pinta resultados y dispara `FantasyAlert` con el resumen.
- **`DiceVisual`**: SVG plano por tipo (triángulo d4, cuadrado d6, rombo d8,
  pentágono "d10", pentágono d12, hexágono d20) en dorado sobre `--card`; el
  número aparece centrado al terminar. Clases CSS: `.dice-idle` (balanceo
  2.8 s infinito) y `.dice-rolling` (giro 1 s, sincronizado a mano con el
  `setTimeout` del módulo).
- Para `oro_dados` renderiza N dados; para LUT multi-tirada renderiza **uno
  solo** (los `resultados` legacy solo traen la primera cara) y el detalle va
  en la lista de `lutResultados`.

## 6. Admin

`app/admin/dados-tab.tsx` + `app/api/dados/admin`. CRUD completo; `lut` y
`subtabla` fuerzan `tipo_dado='d20'`. Actualización de hijos (sublista/caras)
por **delete + re-insert**. En el POST/PUT admin, las caras de oro LUT viajan
como `oroMin/oroMax` y se guardan en `cantidad_dados`/`multiplicador_oro`
(ver ⚠ de esquema). El tab incluye un preview funcional con `<DiceModule/>`.

---

## 7. Problemas detectados (por qué reinventarlo)

Ordenados por gravedad:

1. **Ítems fantasma en la tirada personal**: `/api/dados/roll` registra el ítem
   en `dados_historial` y lo muestra en la UI, pero **nunca lo entrega** (no
   hay `asignarItem` ni escritura en bolsa; el jugador no elige personaje).
   El oro sí es real. Decidir: o se entrega de verdad (pedir personaje) o se
   declara "solo cosmético" — hoy es ambiguo y parece bug.
2. **Lógica duplicada y divergente**: la resolución completa (LUT + legacy)
   está copiada en las dos rutas de roll (~300 líneas c/u). Ya divergieron:
   la de partida ignora `cantidad_min/max` de ítems. Toda corrección hay que
   hacerla dos veces.
3. **Sin atomicidad**: cobro, premio e historial son llamadas independientes.
   Un fallo a mitad (p. ej. tras cobrar 10 tiradas LUT) deja oro cobrado sin
   premio ni registro. No hay transacción ni RPC que agrupe.
4. **Columnas que mienten** (`dados_lut_caras.tipo='oro'`): `cantidad_dados`
   es oro_min y `multiplicador_oro` es oro_max; `tipo_dado_oro` siempre NULL.
   El `LutCaraResult.oroDetalle` arrastra el cadáver (`formula`, `dados`,
   `multiplicador` fingidos).
5. **N+1 en el loop de tiradas**: por cada tirada LUT hay hasta 3 queries
   (objeto, subtabla, insert historial) en serie; 10 tiradas ≈ 30+ round-trips.
6. **Payload legacy duplicado**: `resultados/tipoResultado/objeto/cantidadOro`
   son una copia del primer `lutResultados[0]`; la visual multi-tirada LUT solo
   anima un dado por eso.
7. Menores: animación sincronizada por `setTimeout(1000)` mágico (existe en 2
   sitios); validación `cantidad` 1–10 duplicada; mapeos snake→camel repetidos
   en config/admin; `DICE_LABEL` muerto en `dados-tab.tsx`;
   `Math.random` (suficiente para juego, no criptográfico — decisión, no bug).

## 8. Diseño objetivo (to-be)

Principio: **un solo motor puro + efectos inyectados**. La diferencia entre
"tirada personal" y "tirada en partida" no es la resolución, es quién paga y
cómo se entrega. Separar eso elimina la duplicación entera.

### 8.1 Motor puro — `lib/dice/engine.ts`

```ts
// Sin I/O. Config completa + RNG → plan de premios. Testeable con RNG fijo.
type DiceOutcome =
  | { kind: 'nada'; cara: number }
  | { kind: 'oro';  cara: number; cantidad: number }
  | { kind: 'item'; cara: number; objetoId: number; cantidad: number }
  | { kind: 'subtabla'; cara: number; subCara: number; subtablaId: number;
      premio: DiceOutcome };            // premio anidado ya resuelto

function resolveRoll(config: RewardConfig, cantidad: number,
                     rng: () => number = Math.random): DiceOutcome[]
```

- `RewardConfig` = recompensa + caras ya cargadas (una sola query con joins).
- El motor NO toca la base: devuelve outcomes; quien llama los aplica.
- Un test con RNG determinista cubre los 5 tipos (hoy no hay ningún test).

### 8.2 Aplicadores de efectos — `lib/dice/apply.ts`

```ts
type DiceAwarder = {
  chargeGold(total: number): Promise<void>;   // lanza si no alcanza
  awardGold(cantidad: number): Promise<void>;
  awardItem(objetoId: number, cantidad: number): Promise<ItemInfo>;
  log(outcome: DiceOutcome): Promise<void>;   // historial o partidas_eventos
};
```

- **Awarder personal**: `chargeGold`→`modifyGold(-)`, `awardGold`→`modifyGold(+)`,
  `awardItem`→ entrega real a la bolsa (resuelve el problema #1; si se decide
  que siga cosmético, este método solo registra — la decisión queda en UN sitio),
  `log`→`dados_historial` (insert en batch al final, no por tirada).
- **Awarder partida**: RPC `modificar_oro` con admin, `asignarItem` (ya
  respetando `cantidad`), `log`→`partidas_eventos`.
- Las dos rutas quedan en ~40 líneas: auth + validación + cargar config +
  `resolveRoll` + aplicar outcomes + responder.

Atomicidad (problema #3): mínimo viable = cobrar al final junto con los
premios en una RPC `dados_ejecutar_tirada(usuario, costo_total, premios jsonb)`
que haga todo en una transacción plpgsql (el proyecto ya usa este patrón:
`comprar_en_tienda`, `modificar_oro`). El motor sigue en TS; la RPC solo
aplica efectos ya resueltos.

### 8.3 Esquema — corregir sin romper

Migración nueva (no editar las viejas):

```sql
ALTER TABLE dados_lut_caras
  RENAME COLUMN cantidad_dados TO oro_min;      -- decir la verdad
ALTER TABLE dados_lut_caras
  RENAME COLUMN multiplicador_oro TO oro_max;
ALTER TABLE dados_lut_caras DROP COLUMN tipo_dado_oro;  -- nunca usado
```

y actualizar los 3 puntos que las leen/escriben (roll personal, roll partida,
admin). Si se quiere recuperar la idea "NdX × multiplicador" para el oro,
añadir columnas nuevas con ese nombre — no reciclar.

### 8.4 API y UI — contrato estable

- `GET /api/dados/config` y el shape de `RollResult` **no cambian** (la UI y
  el admin actual siguen funcionando). `lutResultados` pasa a derivarse de
  `DiceOutcome[]` con un mapper único.
- Opcional (arregla #6): en LUT devolver todas las caras en `resultados` para
  que `DiceModule` anime N dados; el campo ya es `number[]`, cambio solo en
  la UI que hoy asume longitud 1 fuera de `oro_dados`.
- `DiceVisual` y las animaciones CSS se conservan tal cual (funcionan y son
  autocontenidas). Sustituir los dos `setTimeout(1000)` por una constante
  `DICE_ROLL_ANIM_MS` exportada junto al componente.

### 8.5 Orden de implementación sugerido

1. `lib/dice/engine.ts` + test determinista (motor puro, cero riesgo).
2. `lib/dice/apply.ts` con los dos awarders; migrar `/api/dados/roll` y
   verificar contra la UI existente.
3. Migrar `/api/partidas/[id]/dados/roll` (de paso hereda `cantidad_min/max`).
4. Decidir e implementar la entrega real de ítems en tirada personal.
5. Migración SQL de renombres + RPC transaccional.
6. Limpieza: mapeos compartidos config/admin, constante de animación,
   borrar `DICE_LABEL`.

Cada paso deja el sistema funcionando; se puede parar en cualquiera.
