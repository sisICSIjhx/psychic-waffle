## Motivo

La etapa 4 del plan de seguimiento (`docs/PLAN_SEGUIMIENTO_CENTROS_COSTO.md`) lleva al sistema lo
que faltaba del Excel: los datos del contrato y de sus órdenes de compra, la carta de finalización,
el enlace del programa anual y la cobranza por mes. Ya existen el inicio de sesión con roles
(etapa 1) y las plantillas por centro de costo (etapa 2), de modo que los montos pueden cargarse
sin quedar a la vista de quien no debe verlos.

## Alcance

- Pantalla «Contrato y cobranza» (`/cobranza?centro=&anio=`) por centro de costo.
- Datos del contrato y de cada orden de compra (también las adicionales) según los conceptos de
  los bloques `contrato` y `ordenes_compra` de la plantilla del centro.
- Carta de finalización (fecha y enlace) con aviso cuando el contrato del centro ya terminó y falta.
- Enlace de SharePoint del programa anual.
- Cobranza mensual: estimación, prefactura, factura, cobrado y monto cobrado.
- Capacidades nuevas por rol, comprobadas en el servidor, que además exigen sesión.

## Capacidades

- Nueva: `contrato-cobranza`.

## Impacto

Migración 0025 (cinco tablas, dos funciones `api_*`), repositorio, ruta y destino del menú nuevos,
y cuatro capacidades en `src/lib/dominio/permisos.ts`. Las alertas automáticas restantes y los
enlaces resueltos contra SharePoint corresponden a la etapa 6; el concentrado, a la etapa 5.
