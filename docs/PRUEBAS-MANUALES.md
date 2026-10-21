# Pruebas manuales

Recorrido de toda la app, paso a paso, para hacer en la web publicada (https://animales-blue.vercel.app). Lleva unos 85 minutos en un dispositivo; en los otros dos se repite marcando la casilla de cada uno.

- **Dispositivos:** Android con Chrome, iPhone con Safari y una computadora (cualquier navegador). Cada flujo tiene una casilla por dispositivo.
- **Cuentas:** dos, que en esta lista se llaman **familia** (publica un perro perdido) y **vecina** (lo encuentra y lo ve). Para probar de a una persona: familia en el celular y vecina en la computadora, o una en una ventana privada.
- **Marcas:**
  - **[SMTP]** necesita SMTP propio en Supabase. Sin eso, Supabase solo manda mails a las direcciones del equipo del proyecto (y pocos por hora).
  - **[Captcha]** necesita el captcha configurado: la clave del sitio de Cloudflare Turnstile en Vercel (`EXPO_PUBLIC_TURNSTILE_SITE_KEY`) y la secreta en Supabase. Sin eso, ingresar y registrarse no muestran la comprobación.
  - **[Visión]** necesita el reconocimiento con IA configurado: la función `reconocer` desplegada y su dirección en `config_app.vision_url`. Sin eso, ese paso se simula con el SQL que está ahí mismo.
- **Si algo falla:** anotá el número del paso, el dispositivo y una captura. Los problemas que ya se conocen están al final.

Tené a mano dos fotos parecidas de un mismo perro (o de dos perros parecidos) en cada celular.

## 1. Preparación · 3 min

**Cuentas.** Si no hay SMTP propio, creá las dos cuentas desde Supabase: **Authentication → Users → Add user → Create new user**, con **Auto Confirm User** marcado. Con SMTP propio, creálas desde la app: **Perfil → Crear cuenta** [SMTP].

**Familia, moderadora.** Para los pasos 14, 15 y 23, en el SQL Editor (reemplazá el email):

```sql
update perfiles set es_moderador = true
where id = (select id from auth.users where email = '<email de familia>');
```

Esperado:
- Al crear la cuenta desde la app, la casilla de términos es obligatoria y después dice que revises tu email.
- El mail llega en español: "Confirmá tu cuenta en Spot", con el botón verde **Confirmar mi cuenta** [SMTP].
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

## 9. Escribirle a quien lo vio · 2 min

Cuenta: familia, después vecina.

1. Familia, en Toby: bajá al **Historial**. En el aviso de vecina (el del paso 8) tocá **Escribirle** y mandá un mensaje.
2. Familia: buscá **Escribirle** en "Se perdió acá" y en tus propios avisos.
3. Vecina, en Toby: buscá **Escribirle** en el Historial.
4. Vecina: **Actividad → Mensajes**.

Esperado:
- **Escribirle** abre una conversación con vecina sobre Toby; si ya había una, la retoma.
- No aparece en los avisos propios ni en los de una cuenta eliminada.
- Vecina no ve **Escribirle** en el Historial (solo quien publicó el caso puede usarlo), pero le llega el mensaje y lo puede contestar.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 10. Atrás con una hoja abierta · 4 min

Cuenta: familia; una ventana privada sin cuenta para el caso 7. Se prueba sobre todo en **Android · Chrome** con el botón Atrás del sistema; en la computadora, con la flecha Atrás del navegador, y en iPhone, deslizando desde el borde izquierdo. Volvé a recorrer estos 8 casos cada vez que se actualice Expo o Expo Router: Atrás depende de cómo Expo Router usa el historial del navegador (`src/lib/historialHojas.ts`).

1. Desde **Ver lista**, abrí un caso de vecina, tocá **Lo vi** y después Atrás. Atrás otra vez.
2. **Lo vi**, cerrá con la **X** y tocá Atrás una sola vez.
3. Computadora: **Lo vi** y **Escape**; después Atrás una vez.
4. **Más opciones → Denunciar** y Atrás.
5. **Lo vi → Elegir en el mapa** y Atrás. Volvé a **Elegir en el mapa** y **Confirmar ubicación**.
6. Completá **Lo vi** y tocá **Registrar avistamiento**. Después Atrás una vez.
7. Sin cuenta, en un caso: **Lo vi → Ingresar**. Atrás, y Atrás otra vez.
8. Familia, en Toby: **Más opciones → Editar el reporte**. Atrás, y Atrás otra vez.

Esperado:
- 1: el primer Atrás cierra la hoja y deja el caso a la vista; el segundo vuelve a la lista.
- 2, 3 y 6: un solo Atrás vuelve a la lista. Ninguna hoja se cierra con Atrás "de más".
- 4: Atrás cierra Denunciar y no vuelve a aparecer Más opciones; otro Atrás vuelve a la lista.
- 5: Atrás cierra solo el selector y **Lo vi** sigue abierto con la foto elegida.
- 7: el primer Atrás vuelve al caso sin ninguna hoja abierta; el segundo, a la lista.
- 8: el primer Atrás vuelve a Toby; el segundo, a donde estabas antes.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 11. Compartir y la vista previa en WhatsApp · 3 min

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
- **Primera carga** (abrilo desde WhatsApp en el celular, que no comparte la caché del navegador): desde el primer instante se ve "Spot" con un indicador sobre el fondo de la app, nunca una pantalla blanca ni negra. Después aparecen la foto, los datos y las acciones del caso. El mini mapa llega al final, y la tipografía puede cambiar un momento después (antes se ve con la del sistema).
- Solo funciona con la URL de producción: las previews piden login de Vercel y los bots no entran.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 12. Mensajes · 4 min

Cuenta: vecina y familia.

1. Vecina, en Toby: **Escribirle a su familia** (retoma la conversación del paso 9). Mandá un mensaje con el teclado abierto.
2. Familia: **Actividad → Mensajes**, abrí la conversación y contestá.
3. Vecina: tocá la pata del encabezado (abre el caso) y volvé con **Volver**.

Esperado:
- Los mensajes llegan en unos segundos, sin perder los anteriores.
- En la computadora, en las herramientas del navegador (**Red**), cada 4 s el pedido a `mensajes_detalle` trae solo lo nuevo (`created_at=gte.…`), no toda la conversación.
- El campo de texto queda a la vista con el teclado abierto.
- Desde el caso, **Volver** regresa a la conversación.
- Familia recibe "Mensaje de …" en Novedades.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 13. Bloquear · 2 min

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

## 14. Denunciar y moderar · 3 min

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

## 15. Una publicación oculta · 3 min

Cuenta: familia (moderadora) y vecina; una ventana privada sin cuenta.

1. Vecina, en Toby: **Más opciones → Denunciar**, elegí un motivo y enviá la denuncia.
2. Familia: copiá el link de Toby con **Compartir**. Después, en **Perfil → Panel de moderación**, tocá **Ocultar publicación** en la denuncia de Toby.
3. Sin cuenta, en la ventana privada: abrí el link de Toby.
4. Vecina: abrí el link de Toby, buscá a Toby en el mapa y abrí **Actividad → Mensajes →** la conversación sobre Toby. Mandá un mensaje.
5. Familia: abrí Toby.
6. Familia: en el panel, **Volver a mostrar**. Vecina vuelve a abrir el link y la conversación.

Esperado:
- 3 y 4: "Esta publicación no está disponible." con **Volver al mapa**, el mismo texto que con un link que no existe. Toby no está en el mapa ni en la lista.
- 4: la conversación se sigue leyendo. En lugar de la tarjeta del caso dice "Publicación no disponible" con el aviso "Esta publicación fue ocultada por moderación. Nunca pagues ni compartas datos de tu tarjeta.", y el mensaje se manda.
- 5: familia ve a Toby completo, con el aviso de que está oculto.
- 6: todo vuelve: el caso, su historial, el mapa y la tarjeta en la conversación.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 16. Coincidencias · 4 min · [Visión]

Cuenta: familia, después vecina.

**Con el reconocimiento con IA:** a los pocos minutos de publicar el encontrado (paso 5), la coincidencia aparece sola, si Claude ve el mismo animal en las dos fotos.

**Sin el reconocimiento:** simulala en el SQL Editor, con los ids de los dos casos (están en la URL del detalle, `/animal/<id>`):

```sql
insert into coincidencias (animal_origen, animal_candidato, similitud, distancia_m, horas_diferencia, confianza, motivo, origen)
select least(a, b), greatest(a, b), 0.9, 300, 2, 90, 'Mismo collar rojo y mancha blanca en el pecho', 'ia'
from (values ('<id del perdido>'::uuid, '<id del encontrado>'::uuid)) as v(a, b);
```

1. Familia: **Actividad → Novedades**, "Encontraron un animal parecido a Prueba Toby". Abrí el caso.
2. Vecina, en su encontrado: **Posibles coincidencias**.
3. Familia: **Es el mismo animal**.

Esperado:
- Familia ve las dos fotos, el motivo ("Mismo collar rojo y mancha blanca en el pecho.") y, debajo, la distancia y el tiempo. Sin porcentaje.
- Vecina ve "Su familia está mirando las fotos…" y no puede confirmar.
- Al confirmar, el encontrado se une a Toby: abrir el encontrado lleva a Toby, que suma sus avistamientos.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 17. Resguardar un perdido · 3 min

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

Antes de seguir con el 18, hacé el **25 (mapa en grande)**: Toby tiene ahora todos los tipos de punto.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 18. Reunido · 1 min

Cuenta: familia.

1. En Toby: **Se reunió con su familia** y **Confirmar**.

Esperado:
- El caso se cierra ("¡Volvió con su familia!") y deja de estar en los activos del mapa.
- El contacto que mostraba la familia ya no aparece en el caso. Si la familia lo reabre, lo puede volver a cargar al editarlo.
- Vecina recibe "¡Volvió con su familia!".
- Vecina no ve **Se volvió a escapar**: solo familia puede reabrir un perdido.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 19. Borrar un reporte · 2 min

Cuenta: familia.

1. En Toby: **Más opciones → Borrar el reporte**. Leé la confirmación y tocá **Borrar para siempre**.

Esperado:
- La confirmación dice cuántos avisos de otras personas se pierden.
- Al confirmar, vuelve al mapa y Toby ya no está, tampoco el encontrado unido.
- En Supabase (**Storage → fotos → carpeta de familia**) no quedan las fotos de Toby ni sus miniaturas.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 20. Recuperar la contraseña · 2 min · [SMTP]

Cuenta: vecina (o familia, si es del equipo de Supabase).

1. Sin sesión: **Ingresar → ¿Olvidaste tu contraseña?** con el email de la cuenta.
2. Abrí el link del mail en el mismo dispositivo y elegí una contraseña nueva de 8 caracteres o más.
3. Volvé a usar el mismo link.

Esperado:
- El mensaje es el mismo exista o no la cuenta.
- El mail llega en español: "Elegí una contraseña nueva para Spot", y se ve bien en Gmail del celular.
- Con la contraseña nueva quedás adentro.
- Usado de nuevo, el link dice que ya no sirve y ofrece pedir otro.
- Si se piden varios seguidos: "Pediste varios links seguidos…", nunca "email inválido".

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 21. Hoja "Cerca tuyo" plegable · 3 min

Cuenta: ninguna. En el celular; en la computadora, con la ventana angosta (menos de 600 px) y el mouse.

1. En el mapa, arrastrá la manija de **Cerca tuyo** hacia abajo.
2. Mirá el botón de **Mi ubicación** y los créditos del mapa (abajo a la izquierda).
3. Recargá la página.
4. Arrastrá la barra hacia arriba. Después tocala, y tocala otra vez.
5. Con la hoja plegada, tocá un marcador.
6. Con lector de pantalla (TalkBack o VoiceOver), recorré la barra.
7. Computadora: ensanchá la ventana a más de 1024 px.

Esperado:
- Plegada queda solo la barra, con la manija, **Cerca tuyo** y la cantidad ("7 casos"), y el mapa usa todo el alto.
- Arrastrar la hoja no mueve el mapa, ni la página, ni recarga (Chrome de Android).
- Mi ubicación baja junto con la hoja y los créditos bajan cuando se suelta.
- Al recargar sigue como la dejaste.
- Un arrastre corto vuelve a su lugar; un gesto rápido cambia de posición aunque sea corto.
- Tocar la barra (no **Ver lista**) pliega o despliega.
- Al tocar un marcador con la hoja plegada, se despliega con esa tarjeta primera.
- El lector dice "Ocultar casos, botón, expandido" o "Mostrar casos, botón, contraído".
- En pantallas anchas no hay hoja: el panel lateral queda igual.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 22. Instalar la app · 4 min

Cuenta: ninguna.

1. **Android · Chrome** (y computadora con Chrome o Edge): usá la app medio minuto (Chrome no la ofrece apenas se abre), andá a **Perfil → Instalar la app** e instalala.
2. Abrila desde la pantalla de inicio (o desde el escritorio) y andá a **Perfil**.
3. **iPhone · Safari:** **Perfil → Instalar la app**. Seguí los pasos de la hoja y abrila desde la pantalla de inicio.
4. Mandate el link del sitio por WhatsApp, abrilo desde WhatsApp (Android) o desde Instagram, y andá a **Perfil → Instalar la app**. Tocá **Copiar el link**.

Esperado:
- En Android y en la computadora se abre la ventana del navegador para instalar, con el nombre Spot y su ícono (el pin con la huella).
- En iPhone, la hoja muestra los tres pasos con el ícono de Compartir dibujado, y Atrás o **Entendido** la cierran.
- Ya instalada, se abre sin la barra del navegador y en **Perfil** no aparece **Instalar la app**. Después de instalar en Chrome, tampoco aparece en el navegador.
- En el navegador de WhatsApp o Instagram, explica que hay que abrir el link en Chrome o Safari y copia el link del sitio.
- Firefox de computadora y Safari de Mac no muestran el botón.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 23. Reportar un error · 5 min

Cuenta: ninguna, vecina y familia (moderadora, paso 1).

1. **Sin cuenta** (ventana privada): entrá a un caso, después a **Perfil → Reportar un error**. Tocá **Mandar el reporte** vacío; después escribí qué pasó y un email en el contacto, y mandalo.
2. **Vecina:** desde el mapa, **Perfil → Reportar un error**. Elegí una captura, escribí qué pasó y qué estabas haciendo, y mandalo.
3. **Familia:** **Actividad**. Tocá el aviso del reporte nuevo.
4. En **Moderación → Errores**: mirá los dos reportes, tocá **Ver la captura**, escribí una nota y tocá **Marcar como resuelto** en el de vecina.
5. **Vecina:** **Actividad**.
6. **Vecina:** mandá reportes hasta pasar 5 en la misma hora.

Esperado:
- Vacío dice "Contá qué pasó con al menos 10 caracteres.".
- Sin cuenta pide un contacto opcional, con el aviso de que solo lo ven los moderadores, y no ofrece captura. Con cuenta es al revés.
- El formulario muestra lo que se suma solo: la pantalla anterior, el navegador y sistema, el tamaño de pantalla y la versión (con el commit del deploy).
- Al mandarlo, Perfil dice "Gracias…"; con cuenta, que le avisamos en Actividad.
- A familia le llega un aviso por cada reporte, que abre **Moderación → Errores**.
- En el panel están todos los datos, la captura se ve, y el resuelto pasa a **Resueltos** con quién, cuándo y la nota.
- A vecina le llega "Resolvimos el error que reportaste" con la nota.
- El sexto reporte de la hora dice "Ya mandaste 5 reportes en la última hora. Probá de nuevo más tarde.".
- En Supabase, **Storage → capturas** es privado: la captura no se abre con un link público.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 24. Borrar la cuenta · 2 min

Cuenta: vecina.

1. **Perfil → Borrar mi cuenta**. Leé las opciones, dejá la que viene marcada, marcá que entendés y confirmá.
2. Familia: buscá en **Actividad → Mensajes** la conversación con vecina.
3. Familia: en **Moderación → Errores**, mirá los reportes de vecina (flujo 23).

Esperado:
- Vuelve al mapa sin sesión.
- Lo que vecina aportó a casos abiertos de otros queda sin su nombre ("una cuenta eliminada").
- La conversación con familia ya no está.
- Sus reportes de errores siguen, como "una cuenta eliminada" y sin captura; en **Storage → capturas** su carpeta quedó vacía.
- No se puede volver a ingresar con esa cuenta.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 25. Mapa en grande del recorrido · 4 min

Cuenta: ninguna (alcanza una ventana sin sesión). Se hace con Toby resguardado, entre el 17 y el 18: tiene el punto donde se perdió, los avisos de vecina y el resguardo.

1. En el detalle de Toby, tocá el mini mapa de **Visto por última vez**. En la computadora, llegá con Tab y abrilo con Enter.
2. Mové el mapa con un dedo; acercá con dos dedos, con doble toque y, en la computadora, con la rueda del mouse.
3. Tocá **Anterior** hasta el primer punto y **Siguiente** hasta el último.
4. Tocá un punto en el mapa.
5. Tocá **Mi ubicación**.
6. Volvé con Atrás: el botón del navegador, el gesto de Atrás en Android o, en iPhone, deslizando desde el borde izquierdo. Abrilo otra vez y volvé con el botón redondo de Volver.
7. Repetí los pasos 1 y 3 en modo oscuro (**Perfil → Apariencia**).
8. Con lector de pantalla (TalkBack o VoiceOver), llegá al mini mapa y recorré los puntos con **Anterior** y **Siguiente**.

Esperado:
- El mini mapa tiene un botón chico de agrandar abajo a la derecha; en la computadora, cursor de mano y anillo de foco.
- Se abre con todos los puntos a la vista, numerados del más viejo (1) al más nuevo, y la tarjeta muestra el último ("3 de 3", según cuántos avisos haya).
- El mapa se mueve y se acerca, pero nunca gira ni se inclina; arrastrarlo no mueve ni recarga la página (Chrome de Android).
- Anterior y Siguiente centran el mapa en cada punto y se apagan en las puntas. La tarjeta cambia: qué pasó ("Lo vio …", "Se perdió acá"), la fecha, la nota y la foto.
- Donde se perdió Toby y el resguardo de vecina se ven como una zona redonda translúcida, no como un punto, y su tarjeta dice "Ubicación aproximada, unos 100 m a la redonda.".
- Tocar un punto lo elige (se agranda y su borde se marca) y cambia la tarjeta, sin mover el mapa.
- Mi ubicación pide permiso y va hasta tu posición; sin permiso, avisa "No pudimos acceder a tu ubicación…".
- Atrás y Volver llevan al detalle de Toby.
- En oscuro, el mapa y la tarjeta usan la paleta oscura y los números se leen.
- El lector anuncia "Ver el mapa en grande, botón" y, al pasar de punto, lee el punto nuevo.
- En la computadora, el mapa ocupa todo al lado del riel y la tarjeta va abajo a la izquierda.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 26. Reconocimiento con la API de Claude · 8 min · [Visión]

Cuenta: familia (moderadora) en la computadora; vecina en un celular. Requiere las migraciones 0018 a 0020 y la función `reconocer` desplegada (pasos en `docs/reportes/2026-10-20-reconocimiento-ia.md` y `docs/reportes/2026-10-21-ajuste-reconocimiento.md`). Hacen falta dos fotos del mismo perro (de otro ángulo o en otro lugar) y una foto sin animal (una pared, una calle).

1. Familia: **Perfil → Panel de moderación → Reconocimiento**. Mirá el estado, las llamadas de hoy, el costo del mes y los errores.
2. Familia: publicá un perdido con la primera foto del perro.
3. Vecina: publicá un encontrado con la segunda foto, a pocas cuadras.
4. Familia: esperá un minuto y abrí el perdido. Mirá **Posibles coincidencias** y **Actividad**.
5. Vecina: publicá un encontrado con la foto sin animal.
6. Familia, en el SQL Editor:
   ```sql
   select created_at, tipo, resultado, tokens_entrada, tokens_salida, costo_usd, detalle
   from llamadas_ia order by created_at desc limit 5;
   select confianza as probabilidad_mismo, veredicto, motivo from comparaciones_ia order by created_at desc limit 5;
   ```
   Y en **Storage → fotos**, en la carpeta de quien publicó: cada foto tiene al lado su `.miniatura.jpg` y su `.mediana.jpg`.
7. **Interruptor:** en el SQL Editor, `update config_app set valor = 'false' where clave = 'ia_activa';`. Vecina publica otra foto. Después, `update config_app set valor = 'true' where clave = 'ia_activa';` y esperá 2 minutos.
8. **Sin crédito (simulado):** `update config_app set valor = 'sin_credito' where clave = 'ia_pausa';`. Familia: volvé a **Reconocimiento** y tocá **Reactivar**.
9. En Supabase: **Edge Functions → reconocer → Logs**. Y en la consola de Anthropic, **Usage** del día.

Esperado:
- El estado dice **Configurado**. No aparecen la URL de la función ni el secreto. Los textos dicen "inteligencia artificial" o "IA", nunca la marca.
- En menos de un minuto, Toby tiene una coincidencia con el motivo (por ejemplo "Misma mancha blanca en el pecho y la oreja izquierda caída.") en vez de un porcentaje, y la familia recibe "Encontraron un animal parecido a…". Si la IA no los ve parecidos, no aparece: probá con fotos más claras.
- Ninguna coincidencia tiene veredicto "distinto": en `comparaciones_ia`, los "distinto" tienen probabilidad menor que 50 y los "mismo", 50 o más.
- La foto sin animal no genera coincidencias: en `llamadas_ia` tiene solo una llamada (`describir`), sin `comparar`.
- Si una llamada falla, `detalle` dice el tipo y el texto del error de la API (y el id del pedido), sin claves, URLs, emails ni teléfonos.
- Si una respuesta se pasó de largo, la llamada queda `ok` y `detalle` dice qué se recortó (por ejemplo "C1 motivo: 163 > 140"); el motivo que se ve en la app termina en "…".
- Cada foto con candidatos suma 2 llamadas (describir y comparar); el costo estimado del mes sube muy poco ("Menos de US$ 0,01" las primeras).
- Con el interruptor apagado, el estado dice **Apagado**, la foto queda en **Fotos pendientes** y no se agrega ninguna llamada. Al prenderlo, se procesa sola en los 2 minutos siguientes.
- Con la pausa, el estado dice **Pausado: sin crédito**, "Procesar pendientes ahora" está apagado y aparece **Reactivar**. Al tocarlo, vuelve a **Configurado**.
- En los registros de la función no aparece ninguna clave. El uso en la consola de Anthropic se parece al costo estimado.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## 27. Spot y el piloto · 8 min · [Captcha]

Cuenta: vecina, sin sesión.

1. Abrí la web en una pestaña nueva.
2. **Perfil → Ingresar**. Esperá la comprobación de seguridad, arriba de **Ingresar**, e ingresá con email.
3. Cerrá sesión e ingresá con una contraseña equivocada dos veces seguidas, y después con la correcta.
4. Mirá **Crear cuenta** y **¿Olvidaste tu contraseña?**.
5. Mandate el link de la web por WhatsApp y abrilo desde ahí (navegador de WhatsApp). Repetí el paso 2. Lo mismo desde Instagram.
6. Con la sesión de familia: publicá un encontrado con el color "negro 099 123 456" y compartilo por WhatsApp.

Esperado:
- La pestaña dice "Spot · Animales perdidos y encontrados en Montevideo", con el ícono del pin y la huella; la pantalla de carga dice "Spot".
- La comprobación de Cloudflare aparece en el esquema de la app (claro u oscuro). Casi siempre se completa sola en unos segundos; a veces pide tocar una casilla.
- Cada intento de ingresar pide una comprobación nueva: la tercera vez, con la contraseña correcta, entra. Con Google no aparece.
- En los navegadores de WhatsApp e Instagram también se completa y deja ingresar.
- Si no carga (sin conexión o bloqueada): "No pudimos cargar la comprobación de seguridad…" y **Reintentar**.
- La vista previa y el texto de compartir dicen "Perro encontrado", sin el color ni el número.

- [ ] Android · Chrome
- [ ] iPhone · Safari
- [ ] Computadora

## Al terminar

- Borrá a familia y a vecina si no las vas a usar más: **Perfil → Borrar mi cuenta**, o desde **Authentication → Users**.
- Si marcaste a familia como moderadora: `update perfiles set es_moderador = false where id = '<id>';`

## Problemas conocidos (no hace falta anotarlos)

Están en `docs/reportes/2026-10-19-revision.md`, con su propuesta:
- **Teclado:** en el celular puede tapar la barra de abajo de un formulario mientras se escribe; se ve al cerrarlo.
- **Marcador:** tocar el marcador ya seleccionado lo deselecciona en vez de abrir el caso.
- **Fotos HEIC:** en Chrome no se ven; Safari de iPhone las convierte solo.
