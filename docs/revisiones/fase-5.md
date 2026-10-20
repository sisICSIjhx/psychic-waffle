# Revisión con Codex — Fase 5 (captura de reportes)

Cambio OpenSpec: `reportes-mantenimiento-for-icsi-rmt-01`. Rama: `feat/reportes-rmt-01`.

Ejecución: `scripts/revision-codex.ps1` en un directorio vacío, sandbox de solo lectura, con
`design.md`, `tasks.md` y la spec de captura de reportes como contexto. Ninguna ronda tocó
`insumos/`, `storage/` ni `.env*`.

## Ronda 1 (commit 87bf537)

| Severidad | Hallazgo                                                                        | Resolución                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Alta      | Navegar antes del autoguardado podía perder cambios y la acción relativa fallar | Corregido: la página intercepta la navegación interna y guarda antes; las acciones van a la URL del reporte; con prueba y verificación en el navegador |
| Alta      | El DOCX podía registrarse con una versión posterior a la que se generó          | Corregido en `0010`: el registro exige la versión; si cambió, se descarta y se genera de nuevo; con prueba                                             |
| Media     | La fecha no se validaba contra la semana, quincena o día del reporte            | Corregido: `rangoDelPeriodo` en el dominio y el campo de fecha limitado a ese rango; con pruebas                                                       |
| Media     | Se podía escribir mientras cambiaba el estado y perder lo escrito               | Corregido: el editor queda de solo lectura durante el cambio de estado o la aplicación del catálogo                                                    |
| Media     | La fecha de hoy se calculaba en UTC                                             | Corregido: `fechaEnZona` con America/Mexico_City en captura, planeación y panel                                                                        |
| Media     | «Cambiar» en un título legítimo se tomaba como relleno                          | Corregido: solo «(Cambiar)» o un valor que diga únicamente «Cambiar»; con prueba                                                                       |

## Ronda 2 (commit 43dadf6, última permitida)

| Severidad | Hallazgo                                                                     | Resolución                                                                                                  |
| --------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Alta      | Un reintento podía borrar un DOCX que otra descarga ya había registrado      | Corregido: cada intento usa una ruta exclusiva y solo se borra si la base confirma que no quedó registrado  |
| Media     | El registro aceptaba documentos sin versión                                  | Corregido en `0011`: la versión es obligatoria y entera; con prueba que llama a la función SQL directamente |
| Media     | «Cambiar» acompañado de otro texto pasaba en contrato, usuario, sitio o tipo | Corregido: detección amplia en esos campos y estrecha solo en el título; con pruebas                        |

## Validación de la fase

- `npm run check`: 0 errores y 0 advertencias. `npm run lint`: sin observaciones.
- `npm run test`: todas las pruebas aprobadas, entre ellas el recorrido completo del servicio (crear,
  cargar fotos con un PDF rechazado, emitir, descargar el DOCX, revisión y registro con versión),
  dominio de captura (prellenado, rangos de semana, quincena y día, relleno) y componentes del
  editor en Chromium (renumeración de fotos, antes/durante/después, confirmación de la tabla,
  conflicto de versión y guardado antes de navegar).
- Navegador con la base local: captura de la partida 7 de Cerritos, autoguardado, conflicto entre dos
  pestañas, estados, revisión, descarga del DOCX y aplicación de los cambios del catálogo.
