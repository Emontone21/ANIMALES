# Pruebas manuales

Recorrido de toda la app, paso a paso, para hacer en la web publicada (https://animales-blue.vercel.app). Lleva unos 45 minutos en un dispositivo; en los otros dos se repite marcando la casilla de cada uno.

- **Dispositivos:** Android con Chrome, iPhone con Safari y una computadora (cualquier navegador). Cada flujo tiene una casilla por dispositivo.
- **Cuentas:** dos, que en esta lista se llaman **familia** (publica un perro perdido) y **vecina** (lo encuentra y lo ve). Para probar de a una persona: familia en el celular y vecina en la computadora, o una en una ventana privada.
- **Marcas:**
  - **[SMTP]** necesita SMTP propio en Supabase. Sin eso, Supabase solo manda mails a las direcciones del equipo del proyecto (y pocos por hora).
  - **[Visión]** necesita el servicio de visión configurado (`config_app.vision_url`). Sin eso, ese paso se simula con el SQL que está ahí mismo.
- **Si algo falla:** anotá el número del paso, el dispositivo y una captura. Los problemas que ya se conocen están al final.

Tené a mano dos fotos parecidas de un mismo perro (o de dos perros parecidos) en cada celular.

## 1. Preparación · 3 min

**Cuentas.** Si no hay SMTP propio, creá las dos cuentas desde Supabase: **Authentication → Users → Add user → Create new user**, con **Auto Confirm User** marcado. Con SMTP propio, creálas desde la app: **Perfil → Crear cuenta** [SMTP].

**Familia, moderadora.** Para el paso 11, en el SQL Editor (reemplazá el email):

```sql
update perfiles set es_moderador = true
where id = (select id from auth.users where email = '<email de familia>');
```

Esperado:
- Al crear la cuenta desde la app, la casilla de términos es obligatoria y después dice que revises tu email.
- Al ingresar, Perfil muestra el nombre.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 2. Modo claro y oscuro · 2 min

Cuenta: ninguna.

1. **Perfil → Apariencia:** elegí **Oscuro**, después **Claro** y después **Automático**.
2. Con Automático, cambiá el modo del sistema del dispositivo.
3. Recargá la página.

Esperado:
- El cambio es inmediato, en el mapa también, y se mantiene al recargar.
- No hay destellos blancos al cambiar de pantalla en oscuro.
- Los textos se leen bien en los dos modos.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 3. Términos y perfil · 3 min

Cuenta: ninguna, después familia.

1. Sin cuenta: **Perfil → Términos y privacidad**. Se leen los dos borradores.
2. Ingresá con familia: **Perfil → Editar perfil**. Cambiá el nombre y elegí una foto: en el celular, **Sacar foto** abre la cámara y **Elegir de la galería** la galería. Guardá.
3. Probá un nombre de 1 letra.

Esperado:
- La foto y el nombre nuevos aparecen en Perfil.
- Con 1 letra no deja guardar.
- Los textos de error están en español.
- Arriba a la izquierda, **Volver** se toca fácil y lleva a Perfil.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 4. Publicar un perdido · 4 min

Cuenta: familia.

1. **Publicar → Perdí a mi animal**.
2. Sacá una foto con la cámara.
3. Completá Perro, nombre "Prueba Toby", tamaño, color, collar (tocá el texto "¿Tiene collar o chapita?": también cambia el interruptor), señas, "Hace 2 días" y un contacto.
4. En **¿Dónde lo vieron por última vez?**, **Usar mi ubicación**.
5. Tocá **Publicar** con el teclado abierto en algún campo.

Esperado:
- Lleva al detalle con el nombre primero, **Perdido desde el …**, la etiqueta naranja **Perdido**, **Lo buscan** con el contacto y el aviso contra estafas.
- En el mapa, Toby tiene su foto con anillo naranja y halo.
- El punto queda cerca de donde estás, pero no exacto (redondeado a unos 100 m).
- Si te moviste desde que abriste la app, **Usar mi ubicación** toma la posición nueva, no la de antes.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 5. Publicar un encontrado · 3 min

Cuenta: vecina.

1. **Publicar → Encontré un animal**.
2. Elegí de la galería la otra foto del perro.
3. Perro, color, "Hace 1 h".
4. **Elegir en el mapa:** mové el mapa con un dedo, acercá con dos dedos y probá girarlo.
5. **Publicar**.

Esperado:
- Lleva al detalle del encontrado, con el anillo oliva en el mapa.
- El mapa acerca y aleja con dos dedos, pero no gira ni se inclina.
- En Android, tirar hacia abajo el formulario no recarga la página.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 6. Mapa y Ver lista · 2 min

Cuenta: cualquiera.

1. En el mapa, tocá el marcador de Toby.
2. Chips **Perdidos** y **Encontrados**; **Más filtros** → especie y antigüedad.
3. En el celular: **Ver lista** (en la hoja **Cerca tuyo**). Cambiá un filtro ahí y volvé.

Esperado:
- Al tocar un marcador, su tarjeta pasa primera en **Cerca tuyo** y la tarjeta abre el detalle.
- Los filtros cambian el mapa.
- **Ver lista** muestra los casos con miniatura, etiqueta y distancia, y el filtro cambiado también se aplica en el mapa.
- En la computadora la lista está en el panel lateral, sin **Ver lista**.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 7. Editar un reporte · 2 min

Cuenta: familia.

1. En Toby: **Más opciones → Editar el reporte**.
2. Cambiá el color y el contacto. **Guardar cambios**.
3. Con vecina, en Toby: **Más opciones**.

Esperado:
- Vuelve al detalle con los datos nuevos.
- La foto, la ubicación y el tipo no se pueden cambiar.
- Vecina no ve **Editar** ni **Borrar**, solo **Denunciar**.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 8. Lo vi acá también · 2 min

Cuenta: vecina, después familia.

1. Vecina, en Toby: **Lo vi**. Foto, "Recién", **Usar mi ubicación**, una nota. **Registrar avistamiento**.
2. Familia: **Actividad → Novedades**.

Esperado:
- El historial suma "Lo vieron" con la foto y el mini mapa dibuja el recorrido.
- Familia tiene "Lo vieron de nuevo", con el punto de sin leer en la pestaña Actividad (puede tardar hasta un minuto).

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 9. Compartir y la vista previa en WhatsApp · 3 min

Cuenta: cualquiera.

1. En el detalle de Toby, el botón de compartir (arriba).
2. En la computadora: **Copiar el link** y **Mandar por WhatsApp**.
3. Mandate el link por WhatsApp (o Telegram) y mirá la vista previa antes de enviarlo.
4. Abrí el link recibido.

Esperado:
- **En el celular:** se abre la hoja del sistema con "Se perdió Prueba Toby, perro …. Si lo viste, avisá acá:" y el link.
- **En la computadora:** aparecen **Mandar por WhatsApp** y **Copiar el link**, con el link a la vista.
- **Vista previa:** la tarjeta dice "Se perdió Prueba Toby", tiene una descripción corta y la foto. No muestra el contacto ni la dirección.
- El link abre la app en el caso.
- Solo funciona con la URL de producción: las previews piden login de Vercel y los bots no entran.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 10. Mensajes · 4 min

Cuenta: vecina y familia.

1. Vecina, en Toby: **Escribirle a su familia**. Mandá un mensaje con el teclado abierto.
2. Familia: **Actividad → Mensajes**, abrí la conversación y contestá.
3. Vecina: tocá la pata del encabezado (abre el caso) y volvé con **Volver**.

Esperado:
- Los mensajes llegan en unos segundos.
- El campo de texto queda a la vista con el teclado abierto.
- Desde el caso, **Volver** regresa a la conversación.
- Familia recibe "Mensaje de …" en Novedades.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 11. Bloquear · 2 min

Cuenta: familia y vecina.

1. Familia, en la conversación: **Más opciones → Bloquear a …**.
2. Vecina intenta escribir.
3. Familia: **Perfil → Personas bloqueadas → Desbloquear**.

Esperado:
- Vecina ve "No podés escribir en esta conversación".
- Mientras está bloqueada, a familia no le llegan avisos de vecina (por ejemplo, si vecina vuelve a avisar que lo vio).
- Al desbloquear, se puede escribir de nuevo.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 12. Denunciar y moderar · 3 min

Cuenta: familia (moderadora, paso 1) y vecina.

1. Familia, en el encontrado de vecina: **Más opciones → Denunciar**. Elegí un motivo y tocá **Enviar denuncia**.
2. Familia: **Perfil → Panel de moderación**. La denuncia aparece; tocá **Ocultar publicación**.
3. Vecina: abrí su encontrado y mirá el mapa.
4. Familia: en el panel, **Volver a mostrar**.

Esperado:
- **Denunciar** queda como **Denuncia enviada**.
- Oculto: vecina ve "Esta publicación fue ocultada por moderación…", no hay botón de compartir y el caso no está en el mapa.
- Al mostrarlo vuelve al mapa.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 13. Coincidencias · 4 min · [Visión]

Cuenta: familia, después vecina.

**Con el servicio de visión:** a los pocos minutos de publicar el encontrado (paso 5), la coincidencia aparece sola.

**Sin el servicio:** simulala en el SQL Editor, con los ids de los dos casos (están en la URL del detalle, `/animal/<id>`):

```sql
insert into coincidencias (animal_origen, animal_candidato, similitud, distancia_m, horas_diferencia)
select least(a, b), greatest(a, b), 0.9, 300, 2
from (values ('<id del perdido>'::uuid, '<id del encontrado>'::uuid)) as v(a, b);
```

1. Familia: **Actividad → Novedades**, "Encontraron un animal parecido a Prueba Toby". Abrí el caso.
2. Vecina, en su encontrado: **Posibles coincidencias**.
3. Familia: **Es el mismo animal**.

Esperado:
- Familia ve las dos fotos, el porcentaje, la distancia y el tiempo.
- Vecina ve "Su familia está mirando las fotos…" y no puede confirmar.
- Al confirmar, el encontrado se une a Toby: abrir el encontrado lleva a Toby, que suma sus avistamientos.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 14. Resguardar un perdido · 3 min

Cuenta: vecina, después familia, después sin cuenta.

1. Vecina, en Toby: **Me lo llevé / está resguardado**.
2. Intentá enviar sin foto; después sacá una.
3. Dejá un contacto y, en **¿Dónde está ahora?**, **Usar mi ubicación**. Tocá **Marcar como resguardado**.
4. Familia y una ventana sin sesión: abrí Toby.

Esperado:
- Sin foto no deja enviar; el formulario avisa que la ubicación se muestra aproximada.
- Toby pasa a **Resguardado**.
- Familia ve el contacto de vecina en el historial y puede escribirle desde **Escribir**; sin sesión se ve "Alguien avisó que lo tiene", sin el contacto.
- El punto del resguardo en el mini mapa está redondeado.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 15. Reunido · 1 min

Cuenta: familia.

1. En Toby: **Se reunió con su familia** y **Confirmar**.

Esperado:
- El caso se cierra ("¡Volvió con su familia!") y deja de estar en los activos del mapa.
- Vecina recibe "¡Volvió con su familia!".
- Vecina no ve **Se volvió a escapar**: solo familia puede reabrir un perdido.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 16. Borrar un reporte · 2 min

Cuenta: familia.

1. En Toby: **Más opciones → Borrar el reporte**. Leé la confirmación y tocá **Borrar para siempre**.

Esperado:
- La confirmación dice cuántos avisos de otras personas se pierden.
- Al confirmar, vuelve al mapa y Toby ya no está, tampoco el encontrado unido.
- En Supabase (**Storage → fotos → carpeta de familia**) no quedan las fotos de Toby ni sus miniaturas.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 17. Recuperar la contraseña · 2 min · [SMTP]

Cuenta: vecina (o familia, si es del equipo de Supabase).

1. Sin sesión: **Ingresar → ¿Olvidaste tu contraseña?** con el email de la cuenta.
2. Abrí el link del mail en el mismo dispositivo y elegí una contraseña nueva de 8 caracteres o más.
3. Volvé a usar el mismo link.

Esperado:
- El mensaje es el mismo exista o no la cuenta.
- Con la contraseña nueva quedás adentro.
- Usado de nuevo, el link dice que ya no sirve y ofrece pedir otro.
- Si se piden varios seguidos: "Pediste varios links seguidos…", nunca "email inválido".

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 18. Borrar la cuenta · 2 min

Cuenta: vecina.

1. **Perfil → Borrar mi cuenta**. Leé las opciones, dejá la que viene marcada, marcá que entendés y confirmá.
2. Familia: buscá en **Actividad → Mensajes** la conversación con vecina.

Esperado:
- Vuelve al mapa sin sesión.
- Lo que vecina aportó a casos abiertos de otros queda sin su nombre ("una cuenta eliminada").
- La conversación con familia ya no está.
- No se puede volver a ingresar con esa cuenta.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## Al terminar

- Borrá a familia y a vecina si no las vas a usar más: **Perfil → Borrar mi cuenta**, o desde **Authentication → Users**.
- Si marcaste a familia como moderadora: `update perfiles set es_moderador = false where id = '<id>';`

## Problemas conocidos (no hace falta anotarlos)

Están en `docs/reportes/2026-10-19-revision.md`, con su propuesta:
- **Android:** el botón Atrás cierra la pantalla en vez de la hoja abierta (por ejemplo, el formulario de "Lo vi").
- **Teclado:** en el celular puede tapar la barra de abajo de un formulario mientras se escribe; se ve al cerrarlo.
- **Marcador:** tocar el marcador ya seleccionado lo deselecciona en vez de abrir el caso.
- **Fotos HEIC:** en Chrome no se ven; Safari de iPhone las convierte solo.
