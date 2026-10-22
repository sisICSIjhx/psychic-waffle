# Spec Delta

## Purpose

Capturar el reporte de actividades con evidencia fotográfica FOR-ICSI-RMT-01 a partir del catálogo,
de modo que el técnico solo registre lo que cambia en cada ejecución: fotos, estados, observaciones y
conclusiones.

## ADDED Requirements

### Requirement: Acciones sobre cada foto

Cada foto de un borrador SHALL mostrar sobre la imagen una barra con Ampliar, Girar, Reemplazar,
Quitar y «Más acciones», visible al pasar el puntero y cuando uno de sus controles tiene el foco, con
nombres accesibles que incluyan el pie y contraste AA sobre cualquier foto. Sustituye a los botones
↑/↓ y a las listas de espacio y de alcance de la tarjeta («Alcances con descripción y evidencia»). En
solo lectura SHALL ofrecerse solo Ampliar.

#### Scenario: Barra al pasar el puntero

- **WHEN** el usuario pasa el puntero sobre la Ilustración 2.1.3 de un borrador
- **THEN** aparecen sobre la foto Ampliar, Girar, Reemplazar, Quitar y «Más acciones»

#### Scenario: Barra con el teclado

- **WHEN** el usuario llega con Tab a la Ilustración 2.1.3
- **THEN** la barra se muestra y cada botón recibe el foco en orden con un nombre como «Girar la Ilustración 2.1.3»

#### Scenario: Reporte emitido

- **WHEN** el usuario abre un reporte emitido
- **THEN** cada foto ofrece solo Ampliar y no puede arrastrarse

### Requirement: Reordenar fotos arrastrando

En un borrador, el usuario SHALL poder arrastrar una foto y soltarla antes o después de otra del mismo
alcance, con un indicador del lugar de inserción, y la numeración «Ilustración 2.n.m» SHALL
recalcularse al soltar. En la disposición antes/durante/después, soltarla en otra columna SHALL
cambiar también su espacio. Arrastrar una foto no SHALL iniciar una carga de archivos.

#### Scenario: Mover la tercera foto al primer lugar

- **WHEN** el usuario arrastra la Ilustración 2.2.3 y la suelta antes de la 2.2.1
- **THEN** la foto pasa a ser la Ilustración 2.2.1 y las demás se renumeran en orden

#### Scenario: Cambiar de espacio al soltar

- **WHEN** en la disposición antes/durante/después el usuario arrastra una foto de DURANTE y la suelta después de la primera foto de DESPUÉS
- **THEN** la foto queda en DESPUÉS en la segunda posición y su pie se recalcula

#### Scenario: Soltar sobre otro alcance

- **WHEN** el usuario arrastra una foto del alcance 2.1 sobre el alcance 2.2
- **THEN** el destino no la acepta y la foto conserva su alcance, su posición y su pie

#### Scenario: Reordenar no carga archivos

- **WHEN** el usuario suelta una foto arrastrada dentro de su alcance
- **THEN** no se sube ningún archivo ni aparece el avance de carga

### Requirement: Reordenar fotos con un clic

Toda acción de arrastre SHALL tener alternativa de un clic en «Más acciones»: Mover antes, Mover
después, Espacio (solo en la disposición antes/durante/después) y Mover a otro alcance, que agrega la
foto al final del alcance elegido. Las opciones sin efecto SHALL mostrarse deshabilitadas.

#### Scenario: Mover antes

- **WHEN** el usuario elige «Mover antes» en la Ilustración 2.1.2
- **THEN** la foto pasa a ser la Ilustración 2.1.1

#### Scenario: Primera foto del grupo

- **WHEN** el usuario abre «Más acciones» en la primera foto de su grupo
- **THEN** «Mover antes» aparece deshabilitada

#### Scenario: Mover a otro alcance

- **WHEN** el usuario elige «Mover a otro alcance» y después el alcance 2.3, que tiene 4 fotos
- **THEN** la foto queda como Ilustración 2.3.5 y las del alcance de origen se renumeran

### Requirement: Reordenar fotos con el teclado

El asa de cada foto SHALL permitir tomarla con Espacio o Enter, moverla con las flechas, soltarla con
Espacio o Enter y cancelar con Esc, que la devuelve a su posición. En la disposición
antes/durante/después, ← y → SHALL pasarla a la columna vecina. Cada movimiento SHALL anunciarse a los
lectores de pantalla con el pie resultante y la posición.

#### Scenario: Mover con flechas

- **WHEN** el usuario toma con Espacio el asa de la Ilustración 2.1.3 de un alcance con 6 fotos, pulsa ← dos veces y suelta con Espacio
- **THEN** la foto queda como Ilustración 2.1.1 y se anuncia «Ilustración 2.1.1, posición 1 de 6»

#### Scenario: Cancelar con Esc

- **WHEN** el usuario toma una foto, la mueve dos lugares y pulsa Esc
- **THEN** la foto vuelve a su posición y a su pie anteriores

### Requirement: Vista ampliada de las fotos

Ampliar SHALL abrir una vista de las fotos del alcance con la foto en su versión para el documento, el
pie, la descripción y la posición («3 de 12»), en el orden de numeración. SHALL pasar a la anterior y
a la siguiente con botones y con ← y →, salvo mientras se escribe la descripción, y cerrarse con Esc
devolviendo el foco a la foto mostrada. En solo lectura SHALL ofrecer solo la navegación.

#### Scenario: Abrir desde la tarjeta

- **WHEN** el usuario elige Ampliar en la Ilustración 2.1.3 de un alcance con 12 fotos
- **THEN** se abre la vista con esa foto, su pie, su descripción y «3 de 12»

#### Scenario: Pasar a la siguiente

- **WHEN** en la vista el usuario pulsa →
- **THEN** se muestra la Ilustración 2.1.4 con «4 de 12»

#### Scenario: Cerrar con Esc

- **WHEN** el usuario llega a la Ilustración 2.1.5 en la vista y pulsa Esc
- **THEN** la vista se cierra y el foco queda en Ampliar de la Ilustración 2.1.5

#### Scenario: Flechas al escribir

- **WHEN** el foco está en la descripción dentro de la vista y el usuario pulsa ←
- **THEN** el cursor se mueve en el texto y la vista no cambia de foto

### Requirement: Acciones en la vista ampliada

En un borrador, la vista ampliada SHALL ofrecer girar a la izquierda y a la derecha, editar la
descripción, Reemplazar, Mover a otro alcance y Quitar. Al quitar, SHALL mostrar la foto siguiente y
un «Deshacer» dentro de la propia vista durante el plazo de deshacer de «Quitar con deshacer».

#### Scenario: Quitar desde la vista

- **WHEN** el usuario quita la Ilustración 2.1.3 en la vista
- **THEN** la vista muestra la foto que ahora es la 2.1.3 (antes 2.1.4) y un «Deshacer» dentro de la vista

#### Scenario: Deshacer dentro de la vista

- **WHEN** el usuario elige ese «Deshacer» antes de que venza el plazo
- **THEN** la foto vuelve a su lugar con su pie y la vista la muestra

#### Scenario: Quitar la única foto

- **WHEN** el usuario quita en la vista la única foto del alcance
- **THEN** la vista se cierra, el foco va a «Agregar fotos» de ese alcance y la notificación con «Deshacer» queda visible

### Requirement: Reemplazar una foto

Reemplazar SHALL cargar una sola foto con los formatos y límites de «Carga de fotografías» y ponerla
en el lugar de la anterior, con su descripción y su espacio y sin giro. La anterior SHALL quitarse con
«Deshacer» («Se reemplazó la Ilustración 2.n.m»), que la restaura y descarta la nueva. Si el archivo se
rechaza, la anterior no SHALL cambiar.

#### Scenario: Reemplazo correcto

- **WHEN** el usuario reemplaza la Ilustración 2.1.2 por un JPEG válido
- **THEN** la foto nueva aparece como Ilustración 2.1.2 con la misma descripción y espacio, y se avisa con «Deshacer»

#### Scenario: Deshacer el reemplazo

- **WHEN** el usuario elige «Deshacer» en ese aviso
- **THEN** la foto anterior vuelve como Ilustración 2.1.2 y la nueva sale del reporte

#### Scenario: Archivo rechazado

- **WHEN** el usuario elige un PDF para reemplazar la Ilustración 2.1.2
- **THEN** se informa la causa con el nombre del archivo y la Ilustración 2.1.2 no cambia

#### Scenario: La anterior se quitó durante la carga

- **WHEN** la foto anterior se quitó mientras la nueva esperaba su carga
- **THEN** la nueva queda al final de su alcance y se avisa que la anterior ya no estaba

### Requirement: Girar una foto

Girar SHALL rotar la foto en pasos de 90° (a la derecha desde la barra; a la izquierda o a la derecha
en la vista ampliada) y guardarse con el autoguardado. El giro SHALL verse en la tarjeta y en la vista
sin deformar la foto ni salir de su marco, y conservarse al recargar, al aplicar el catálogo y en las
revisiones. Girar no SHALL modificar los archivos guardados de la foto.

#### Scenario: Girar dos veces

- **WHEN** el usuario gira dos veces a la derecha una foto horizontal y recarga el editor
- **THEN** la foto se muestra invertida (180°) en la tarjeta y en la vista

#### Scenario: Foto horizontal a 90°

- **WHEN** el usuario gira una vez una foto de 640 × 480 px
- **THEN** la tarjeta la muestra vertical y completa dentro de su marco

#### Scenario: Revisión de un reporte emitido

- **WHEN** se crea la revisión de un reporte emitido que tiene una foto girada 90°
- **THEN** la foto de la revisión conserva el giro de 90°

#### Scenario: Giro no válido

- **WHEN** un guardado envía para una foto un giro distinto de 0, 90, 180 o 270
- **THEN** el sistema rechaza el guardado sin aplicar ningún cambio de ese envío

#### Scenario: Guardado sin el giro

- **WHEN** un guardado no incluye el giro de una foto
- **THEN** la foto conserva el giro que tenía

### Requirement: Miniaturas en el editor

Las tarjetas SHALL mostrar una miniatura de 480 px de lado mayor como máximo, y la vista ampliada, la
versión para el documento. Una foto sin miniatura (cargada antes de este cambio) SHALL obtenerla la
primera vez que se pida. La miniatura SHALL borrarse con los demás archivos de la foto, solo cuando
ningún reporte los use.

#### Scenario: Foto nueva

- **WHEN** el usuario carga una foto de 4000 × 3000 px
- **THEN** la tarjeta muestra una imagen de 480 × 360 px y la vista ampliada una de 1600 × 1200 px

#### Scenario: Foto cargada antes

- **WHEN** se abre un borrador con fotos cargadas antes de este cambio
- **THEN** cada tarjeta recibe su miniatura, que se genera en ese momento y se conserva para las siguientes veces

#### Scenario: Archivos compartidos con el emitido

- **WHEN** se quita una foto de una revisión cuyos archivos usa también el reporte emitido
- **THEN** la miniatura y los demás archivos de esa foto se conservan para el reporte emitido
