/**
 * Los flujos de docs/PRUEBAS-MANUALES.md que no necesitan cámara, mail real,
 * Google ni un teléfono de verdad, de punta a punta: la web armada contra el
 * proyecto de Supabase de pruebas, con dos personas en dos navegadores.
 *
 * Familia publica a su perro perdido y es moderadora; vecina lo ve, lo
 * resguarda y le escribe. Las pruebas van en orden y comparten lo que crean
 * (los casos, la conversación): si una falla, las siguientes no corren.
 */
import { LIMITES_REPORTE } from '../src/features/errores/reporte';
import { t } from '../src/i18n/es-UY';
import { contraste } from '../src/lib/contraste';
import type { DatosCompartir } from '../src/types/dominio';
import {
  abrirIngresar,
  boton,
  campo,
  completarIngreso,
  elegirFoto,
  empiezaCon,
  esperarFoto,
  hoja,
  idDeLaConversacion,
  idDelCasoNuevo,
  ingresar,
  mandarMensaje,
  opcion,
  type Persona,
  simularPushDelNavegador,
  tarjeta,
  texto,
  titulo,
  usarMiUbicacion,
} from './ayudas';
import { SITIO } from './entorno';
import { expect, test } from './fixtures';

/** Los textos de cada corrida: únicos, para no confundirse con otros datos del proyecto de pruebas. */
function textosDe(sufijo: string) {
  return {
    toby: {
      nombre: `Toby ${sufijo}`,
      color: 'marrón con manchas blancas',
      senas: `Oreja izquierda caída (prueba ${sufijo})`,
      contacto: `Escribime por la app (prueba ${sufijo})`,
    },
    encontrado: {
      color: `negro y blanco ${sufijo}`,
      colorNuevo: `gris con collar rojo ${sufijo}`,
    },
    notaLoVi: `Iba hacia la rambla (prueba ${sufijo})`,
    mensajeFamilia: `¡Gracias por avisar! ¿Dónde lo viste? (${sufijo})`,
    respuestaVecina: `En la esquina de mi casa, hace un rato (${sufijo})`,
    contactoResguardo: `Escribime por la app, lo tengo yo (${sufijo})`,
    notaReunido: `Volvió solo a casa (prueba ${sufijo})`,
    denuncia: `Denuncia de prueba ${sufijo}`,
    nombreNuevo: `Familia ${sufijo} editada`,
    quePaso: `Toqué Lo vi y no pasó nada (prueba ${sufijo})`,
    queHacias: `Quería avisar que vi un perro (prueba ${sufijo})`,
    notaResolucion: `Ya está arreglado (prueba ${sufijo})`,
  };
}

test.describe.serial('Spot de punta a punta', () => {
  let familia: Persona;
  let vecina: Persona;
  let textos: ReturnType<typeof textosDe>;
  /** Lo que crean las pruebas y usan las siguientes. */
  const ids = { toby: '', encontrado: '', conversacion: '' };
  const urlToby = () => `/animal/${ids.toby}`;
  const urlEncontrado = () => `/animal/${ids.encontrado}`;

  test.beforeAll(async ({ navegador, cuentas }) => {
    familia = { cuenta: cuentas.familia, pagina: await navegador.nuevaPagina('familia') };
    vecina = { cuenta: cuentas.vecina, pagina: await navegador.nuevaPagina('vecina') };
    textos = textosDe(cuentas.familia.sufijo);
  });

  test('las dos ingresan con email y contraseña', async () => {
    await ingresar(familia.pagina, familia.cuenta);
    await ingresar(vecina.pagina, vecina.cuenta);
    // Solo la familia es moderadora (la marca global-setup.ts).
    await expect(boton(familia.pagina, t.moderacion.abrirPanel)).toBeVisible();
    await expect(boton(vecina.pagina, t.moderacion.abrirPanel)).toHaveCount(0);
  });

  test('la familia publica a su perro perdido, con foto, ubicación y contacto', async () => {
    const p = familia.pagina;
    const { tipos } = t.publicar;
    // Para la prueba siguiente: el push del navegador, simulado desde esta carga.
    await simularPushDelNavegador(p.context());
    await p.goto('/publicar');
    await boton(p, `${tipos.perdido.titulo}. ${tipos.perdido.detalle}`).click();
    await expect(opcion(p, tipos.perdido.titulo)).toHaveAttribute('aria-checked', 'true');

    // Sin foto ni ubicación no deja publicar.
    await boton(p, t.publicar.publicar).click();
    await expect(texto(p, t.publicar.fotoObligatoria)).toBeVisible();
    await expect(texto(p, t.publicar.ubicacionFaltante)).toBeVisible();

    await elegirFoto(p, boton(p, t.publicar.elegirGaleria));
    await expect(p.getByRole('img', { name: t.publicar.foto, exact: true })).toBeVisible();
    await opcion(p, t.especie.perro).click();
    await campo(p, t.publicar.nombre).fill(textos.toby.nombre);
    await opcion(p, t.tamanio.mediano).click();
    await campo(p, t.publicar.color).fill(textos.toby.color);
    // Tocar el texto también cambia el interruptor.
    await texto(p, t.publicar.collar).click();
    await expect(p.getByRole('switch', { name: t.publicar.collar })).toBeChecked();
    await campo(p, t.publicar.senas).fill(textos.toby.senas);
    await opcion(p, t.publicar.cuandoPerdidoOpciones.hace2d).click();
    await usarMiUbicacion(p);
    await campo(p, t.publicar.contactoFamilia).fill(textos.toby.contacto);
    await boton(p, t.publicar.publicar).click();

    ids.toby = await idDelCasoNuevo(p);
    await expect(titulo(p, textos.toby.nombre)).toBeVisible();
    await expect(texto(p, t.tipoReporte.perdido)).toBeVisible();
    await expect(texto(p, empiezaCon(t.animal.perdidoDesde('')))).toBeVisible();
    await expect(texto(p, t.animal.loBuscan)).toBeVisible();
    await expect(texto(p, textos.toby.contacto)).toBeVisible();
    await expect(texto(p, t.animal.avisoEstafa)).toBeVisible();
    await expect(texto(p, t.animal.conCollar)).toBeVisible();
    // El historial empieza en "Se perdió acá"; la foto subió y se ve.
    await expect(texto(p, t.tipoAvistamiento.perdido)).toBeVisible();
    await esperarFoto(p.getByRole('img', { name: textos.toby.nombre, exact: true }).first());
  });

  test('después de publicar, la app ofrece las notificaciones del celular; Perfil las apaga', async () => {
    const p = familia.pagina;
    // Sigue en el caso recién publicado: la pregunta está arriba.
    await expect(texto(p, t.celular.pregunta)).toBeVisible();
    const guardado = p.waitForResponse((r) =>
      r.url().includes('/rest/v1/rpc/guardar_suscripcion_push'),
    );
    await boton(p, t.celular.si).click();
    expect((await guardado).ok()).toBe(true);
    await expect(texto(p, t.celular.activadas)).toBeVisible();
    await expect(boton(p, t.celular.si)).toHaveCount(0);
    // La clave VAPID pública del build, como la pide el navegador.
    expect(
      await p.evaluate(() => (window as Window & { __pedidoPush?: unknown }).__pedidoPush),
    ).toEqual({ userVisibleOnly: true, bytesDeLaClave: 65 });

    // Al volver al caso no pregunta de nuevo.
    await p.reload();
    await expect(titulo(p, textos.toby.nombre)).toBeVisible();
    await expect(texto(p, t.celular.pregunta)).toHaveCount(0);

    // En Perfil, el interruptor prendido; apagarlo la borra de la base y prenderlo la vuelve a guardar.
    await p.goto('/perfil');
    const interruptor = p.getByRole('switch', { name: t.celular.interruptor });
    await expect(interruptor).toBeChecked();
    await expect(texto(p, t.celular.ayuda)).toBeVisible();
    const borrado = p.waitForResponse(
      (r) => r.url().includes('/rest/v1/suscripciones_push') && r.request().method() === 'DELETE',
    );
    await interruptor.click();
    expect((await borrado).ok()).toBe(true);
    await expect(texto(p, t.celular.desactivadas)).toBeVisible();
    await expect(interruptor).not.toBeChecked();
    const deNuevo = p.waitForResponse((r) =>
      r.url().includes('/rest/v1/rpc/guardar_suscripcion_push'),
    );
    await interruptor.click();
    expect((await deNuevo).ok()).toBe(true);
    await expect(interruptor).toBeChecked();
  });

  test('la vecina publica un animal encontrado, con foto y ubicación', async () => {
    const p = vecina.pagina;
    const { tipos } = t.publicar;
    await p.goto('/publicar');
    await boton(p, `${tipos.encontrado.titulo}. ${tipos.encontrado.detalle}`).click();
    // Nombre y contacto son solo de los perdidos.
    await expect(campo(p, t.publicar.nombre)).toHaveCount(0);
    await expect(campo(p, t.publicar.contactoFamilia)).toHaveCount(0);

    await elegirFoto(p, boton(p, t.publicar.elegirGaleria));
    await expect(p.getByRole('img', { name: t.publicar.foto, exact: true })).toBeVisible();
    await opcion(p, t.especie.perro).click();
    await campo(p, t.publicar.color).fill(textos.encontrado.color);
    await opcion(p, t.publicar.cuandoOpciones.hace1h).click();
    await usarMiUbicacion(p);
    await boton(p, t.publicar.publicar).click();

    ids.encontrado = await idDelCasoNuevo(p);
    const tituloEncontrado = t.animal.tituloCaso(null, 'perro', textos.encontrado.color, null);
    await expect(titulo(p, tituloEncontrado)).toBeVisible();
    await expect(texto(p, t.estado.avistado)).toBeVisible();
    await expect(texto(p, empiezaCon(t.animal.publicado('')))).toBeVisible();
    await expect(texto(p, t.animal.queHizo('encontrado', vecina.cuenta.nombre))).toBeVisible();
    await expect(texto(p, t.animal.loBuscan)).toHaveCount(0);
    await esperarFoto(p.getByRole('img', { name: tituloEncontrado, exact: true }).first());
  });

  test('compartir: la hoja del sistema y, sin ella, copiar el link o mandarlo por WhatsApp', async () => {
    const p = familia.pagina;
    await p.goto(urlToby());
    await expect(titulo(p, textos.toby.nombre)).toBeVisible();
    // linkDelCaso (src/lib/compartir.ts) con el sitio del build (EXPO_PUBLIC_SITE_URL).
    const link = `${SITIO}/animal/${ids.toby}`;
    // Lo que arma datosParaCompartir con Toby: el color no tiene números, así que va.
    const datos: DatosCompartir = {
      tipo: 'perdido',
      estado: 'avistado',
      nombre: textos.toby.nombre,
      especie: 'perro',
      color: textos.toby.color,
      tamanio: 'mediano',
      tieneCollar: true,
    };

    // Con hoja del sistema (los celulares): recibe el título, el texto y el link aparte.
    // Chromium en Linux no tiene navigator.share: se simula y se anota lo que recibe.
    await p.evaluate(() => {
      const ventana = window as Window & { __compartido?: ShareData };
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (compartido: ShareData) => {
          ventana.__compartido = compartido;
        },
      });
    });
    await boton(p, t.compartir.boton).click();
    await expect
      .poll(() => p.evaluate(() => (window as Window & { __compartido?: ShareData }).__compartido))
      .toEqual({
        title: t.compartir.vistaPrevia.titulo(datos),
        text: t.compartir.texto(datos),
        url: link,
      });
    await expect(hoja(p, t.compartir.titulo)).toHaveCount(0);

    // Sin hoja (la mayoría de las computadoras): WhatsApp y copiar el link, con el link a la vista.
    await p.evaluate(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    });
    await boton(p, t.compartir.boton).click();
    const compartir = hoja(p, t.compartir.titulo);
    await expect(texto(compartir, link)).toBeVisible();
    await boton(compartir, t.compartir.copiar).click();
    await expect(texto(compartir, t.compartir.copiado)).toBeVisible();
    expect(await p.evaluate(() => navigator.clipboard.readText())).toBe(link);

    // WhatsApp se abre en otra pestaña. No se va a wa.me de verdad: alcanza con la dirección.
    const contexto = p.context();
    await contexto.route('https://wa.me/**', (ruta) =>
      ruta.fulfill({ contentType: 'text/html', body: '<!doctype html><title>WhatsApp</title>' }),
    );
    const pestania = contexto.waitForEvent('page');
    await boton(compartir, t.compartir.whatsapp).click();
    const whatsapp = await pestania;
    await whatsapp.waitForURL(/^https:\/\/wa\.me\//);
    expect(new URL(whatsapp.url()).searchParams.get('text')).toBe(
      `${t.compartir.texto(datos)} ${link}`,
    );
    await whatsapp.close();
    await contexto.unroute('https://wa.me/**');

    await boton(compartir, t.comunes.cancelar).click();
    await expect(compartir).toHaveCount(0);
  });

  test('compartir en historias: la imagen de 1080 × 1920 con contraste, el archivo y el link copiado', async () => {
    const p = familia.pagina;
    await p.goto(urlToby());
    await expect(titulo(p, textos.toby.nombre)).toBeVisible();
    const link = `${SITIO}/animal/${ids.toby}`;
    // Con hoja del sistema que acepta archivos (los celulares): se simula y se anota el archivo.
    await p.evaluate(() => {
      const ventana = window as Window & { __archivos?: File[] };
      Object.defineProperty(navigator, 'canShare', {
        configurable: true,
        value: (datos: ShareData) => Array.isArray(datos.files),
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (datos: ShareData) => {
          ventana.__archivos = datos.files;
        },
      });
    });
    await boton(p, t.historia.boton).click();
    const historia = hoja(p, t.historia.titulo);
    await expect(
      historia.getByRole('img', { name: t.historia.vistaPrevia(textos.toby.nombre) }),
    ).toBeVisible();
    await expect(texto(historia, t.historia.pistaAntes)).toBeVisible();
    await boton(historia, t.historia.compartir).click();
    await expect(texto(historia, t.historia.pista)).toBeVisible();
    expect(await p.evaluate(() => navigator.clipboard.readText())).toBe(link);

    // El archivo: un JPEG de 1080 × 1920. El contraste se mide en la imagen: el
    // fondo contra el píxel más distinto de la franja del nombre (sus letras).
    const imagen = await p.evaluate(async () => {
      const [archivo] = (window as Window & { __archivos?: File[] }).__archivos ?? [];
      const mapa = await createImageBitmap(archivo);
      const lienzo = new OffscreenCanvas(mapa.width, mapa.height);
      const ctx = lienzo.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(mapa, 0, 0);
      const aHex = (d: Uint8ClampedArray, i: number) =>
        `#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      const fondo = aHex(ctx.getImageData(30, 30, 1, 1).data, 0);
      const franja = ctx.getImageData(80, 1210, 920, 110).data;
      const letras: string[] = [];
      for (let i = 0; i < franja.length; i += 4 * 7) letras.push(aHex(franja, i));
      return {
        nombre: archivo.name,
        tipo: archivo.type,
        ancho: mapa.width,
        alto: mapa.height,
        fondo,
        letras,
      };
    });
    expect([imagen.nombre, imagen.tipo, imagen.ancho, imagen.alto]).toEqual([
      t.historia.nombreArchivo,
      'image/jpeg',
      1080,
      1920,
    ]);
    const mejor = Math.max(...imagen.letras.map((color) => contraste(color, imagen.fondo)));
    expect(mejor).toBeGreaterThanOrEqual(4.5);
    await boton(historia, t.comunes.cancelar).click();
    await expect(historia).toHaveCount(0);

    // Sin poder mandar archivos (el navegador de WhatsApp): la descarga, con la misma pista.
    await p.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    });
    await boton(p, t.historia.boton).click();
    await expect(
      texto(historia, `${t.historia.sinCompartirArchivos} ${t.historia.pistaAntes}`),
    ).toBeVisible();
    const descarga = p.waitForEvent('download');
    await boton(historia, t.historia.descargar).click();
    expect((await descarga).suggestedFilename()).toBe(t.historia.nombreArchivo);
    await expect(texto(historia, t.historia.pista)).toBeVisible();
    await boton(historia, t.comunes.cancelar).click();
    await expect(historia).toHaveCount(0);
  });

  test('la vecina avisa que lo vio, con foto, ubicación y una nota', async () => {
    const p = vecina.pagina;
    await p.goto(urlToby());
    await expect(titulo(p, textos.toby.nombre)).toBeVisible();
    await boton(p, t.animal.acciones.loVi).click();
    const loVi = hoja(p, t.animal.modalAvistamiento.titulo);

    // Sin foto ni ubicación no deja registrarlo.
    await boton(loVi, t.animal.modalAvistamiento.enviar).click();
    await expect(texto(loVi, t.publicar.fotoObligatoria)).toBeVisible();
    await expect(texto(loVi, t.publicar.ubicacionFaltante)).toBeVisible();

    await elegirFoto(p, boton(loVi, t.publicar.elegirGaleria));
    await expect(loVi.getByRole('img', { name: t.publicar.foto, exact: true })).toBeVisible();
    await expect(opcion(loVi, t.publicar.cuandoOpciones.ahora)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await usarMiUbicacion(loVi);
    await campo(loVi, t.animal.modalAvistamiento.nota).fill(textos.notaLoVi);
    await boton(loVi, t.animal.modalAvistamiento.enviar).click();

    await expect(loVi).toHaveCount(0, { timeout: 45_000 });
    await expect(texto(p, t.animal.modalAvistamiento.exito)).toBeVisible();
    await expect(texto(p, t.animal.queHizo('visto', vecina.cuenta.nombre))).toBeVisible();
    // La nota va en el historial y en "Visto por última vez" (es el aviso más reciente).
    await expect(texto(p, textos.notaLoVi)).toHaveCount(2);
  });

  test('la familia le escribe a la vecina desde el historial y conversan', async () => {
    const f = familia.pagina;
    const v = vecina.pagina;
    await f.goto(urlToby());
    await expect(texto(f, t.animal.queHizo('visto', vecina.cuenta.nombre))).toBeVisible();
    // "Escribirle" solo en los avisos de otras personas (aQuienesLoVieron).
    await boton(f, t.mensajes.escribirleA(vecina.cuenta.nombre)).click();
    ids.conversacion = await idDeLaConversacion(f);
    await expect(texto(f, t.mensajes.vacio)).toBeVisible();
    await expect(texto(f, t.mensajes.aviso)).toBeVisible();
    await mandarMensaje(f, textos.mensajeFamilia);
    await expect(texto(f, textos.mensajeFamilia)).toBeVisible();

    // A la vecina le llega en Actividad › Mensajes.
    await v.goto('/actividad');
    await opcion(v, t.actividad.mensajes).click();
    await expect(opcion(v, t.actividad.mensajes)).toHaveAttribute('aria-checked', 'true');
    await v.getByRole('button').filter({ hasText: familia.cuenta.nombre }).click();
    await expect(v).toHaveURL(new RegExp(`/conversacion/${ids.conversacion}$`));
    await expect(texto(v, textos.mensajeFamilia)).toBeVisible();
    await mandarMensaje(v, textos.respuestaVecina);
    await expect(texto(v, textos.respuestaVecina)).toBeVisible();

    // La conversación abierta pide lo nuevo cada 4 s (src/features/mensajes/incremental.ts),
    // sin perder lo anterior.
    await expect(texto(f, textos.respuestaVecina)).toBeVisible({
      timeout: 20_000,
    });
    await expect(texto(f, textos.mensajeFamilia)).toBeVisible();
  });

  test('la familia bloquea a la vecina, que ya no puede escribirle, y la desbloquea', async () => {
    const f = familia.pagina;
    const v = vecina.pagina;
    const nombreVecina = vecina.cuenta.nombre;
    await expect(f).toHaveURL(new RegExp(`/conversacion/${ids.conversacion}$`));

    await boton(f, t.mensajes.masOpciones).click();
    await boton(hoja(f, t.mensajes.masOpciones), t.bloqueos.bloquear(nombreVecina)).click();
    const confirmar = hoja(f, t.bloqueos.confirmarTitulo(nombreVecina));
    await expect(texto(confirmar, t.bloqueos.confirmarDetalle)).toBeVisible();
    await boton(confirmar, t.bloqueos.confirmar).click();
    await expect(confirmar).toHaveCount(0);
    await expect(texto(f, t.bloqueos.bloqueaste(nombreVecina))).toBeVisible();

    // La vecina sigue leyendo la conversación, pero no puede escribir.
    await v.reload();
    await expect(texto(v, t.bloqueos.noPodes)).toBeVisible();
    await expect(campo(v, t.mensajes.placeholder)).toHaveCount(0);
    await expect(texto(v, textos.mensajeFamilia)).toBeVisible();

    // Perfil › Personas bloqueadas › Desbloquear.
    await f.goto('/perfil');
    await boton(f, t.bloqueos.desbloquear(nombreVecina)).click();
    await expect(texto(f, t.perfil.sinBloqueados)).toBeVisible();

    await v.reload();
    await expect(campo(v, t.mensajes.placeholder)).toBeVisible();
    await expect(texto(v, t.bloqueos.noPodes)).toHaveCount(0);
  });

  test('la vecina lo resguarda con una foto actual: la familia ve su contacto y sin cuenta no', async ({
    navegador,
  }) => {
    const v = vecina.pagina;
    await v.goto(urlToby());
    await boton(v, t.animal.acciones.resguardar).click();
    const resguardo = hoja(v, t.animal.modalResguardo.titulo);
    await expect(texto(resguardo, t.animal.modalResguardo.introPerdido)).toBeVisible();

    // Sin una foto actual no deja.
    await boton(resguardo, t.animal.modalResguardo.enviar).click();
    await expect(texto(resguardo, t.animal.modalResguardo.fotoObligatoria)).toBeVisible();

    await elegirFoto(v, boton(resguardo, t.publicar.elegirGaleria));
    await expect(
      resguardo.getByRole('img', { name: t.animal.modalResguardo.foto, exact: true }),
    ).toBeVisible();
    await campo(resguardo, t.animal.modalResguardo.contacto).fill(textos.contactoResguardo);
    await expect(texto(resguardo, t.animal.modalResguardo.ubicacionAyuda)).toBeVisible();
    await usarMiUbicacion(resguardo);
    await boton(resguardo, t.animal.modalResguardo.enviar).click();

    await expect(resguardo).toHaveCount(0, { timeout: 45_000 });
    await expect(texto(v, t.estado.resguardado)).toBeVisible();
    // Quien lo resguarda ve su propio contacto.
    await expect(texto(v, textos.contactoResguardo)).toBeVisible();

    const f = familia.pagina;
    await f.goto(urlToby());
    await expect(texto(f, t.estado.resguardado)).toBeVisible();
    await expect(texto(f, t.animal.contacto)).toBeVisible();
    await expect(texto(f, textos.contactoResguardo)).toBeVisible();

    // Sin cuenta: que alguien lo tiene, sin el contacto.
    const anonima = await navegador.nuevaPagina('sin-cuenta');
    await anonima.goto(urlToby());
    await expect(titulo(anonima, textos.toby.nombre)).toBeVisible();
    await expect(texto(anonima, t.animal.contactoPrivado)).toBeVisible();
    await expect(anonima.getByText(textos.contactoResguardo)).toHaveCount(0);
    await navegador.cerrar(anonima);
  });

  test('la familia lo marca como reunido y el caso se cierra', async () => {
    const f = familia.pagina;
    await expect(f).toHaveURL(new RegExp(`${urlToby()}$`));
    await boton(f, t.animal.acciones.reunido).click();
    const reunido = hoja(f, t.animal.modalReunido.titulo);
    await campo(reunido, t.animal.modalReunido.nota).fill(textos.notaReunido);
    await boton(reunido, t.animal.modalReunido.enviar).click();

    await expect(reunido).toHaveCount(0);
    await expect(texto(f, t.animal.casoCerrado)).toBeVisible();
    await expect(texto(f, t.estado.reunido)).toBeVisible();
    // Cerrado: ni el contacto de la familia ni "Lo vi".
    await expect(texto(f, t.animal.loBuscan)).toHaveCount(0);
    await expect(boton(f, t.animal.acciones.loVi)).toHaveCount(0);
    // Un perdido lo reabre solo su familia.
    await expect(boton(f, t.animal.acciones.reabrir)).toBeVisible();

    const v = vecina.pagina;
    await v.goto(urlToby());
    await expect(texto(v, t.animal.casoCerrado)).toBeVisible();
    await expect(boton(v, t.animal.acciones.reabrir)).toHaveCount(0);
  });

  test('la vecina lo denuncia y la familia, moderadora, lo oculta, lo vuelve a mostrar y la marca revisada', async ({
    navegador,
  }) => {
    const v = vecina.pagina;
    const f = familia.pagina;
    await v.goto(urlToby());
    await boton(v, t.animal.masOpciones).click();
    const opciones = hoja(v, t.animal.masOpciones);
    // Quien no lo publicó no lo edita ni lo borra: solo lo denuncia.
    await expect(boton(opciones, t.animal.acciones.editar)).toHaveCount(0);
    await expect(boton(opciones, t.animal.acciones.borrar)).toHaveCount(0);
    await boton(opciones, t.animal.acciones.denunciar).click();

    const denuncia = hoja(v, t.animal.modalDenuncia.titulo);
    await opcion(denuncia, t.motivoDenuncia.spam).click();
    await campo(denuncia, t.animal.modalDenuncia.detalle).fill(textos.denuncia);
    await boton(denuncia, t.animal.modalDenuncia.enviar).click();
    await expect(denuncia).toHaveCount(0);
    await expect(texto(v, t.animal.modalDenuncia.exito)).toBeVisible();
    await boton(v, t.animal.masOpciones).click();
    await expect(boton(hoja(v, t.animal.masOpciones), t.animal.acciones.denunciado)).toBeDisabled();
    await boton(hoja(v, t.animal.masOpciones), t.comunes.cancelar).click();

    // Perfil › Panel de moderación › Denuncias.
    await f.goto('/perfil');
    await boton(f, t.moderacion.abrirPanel).click();
    await expect(f).toHaveURL(/\/moderacion$/);
    await expect(opcion(f, t.errores.moderacion.denuncias)).toHaveAttribute('aria-checked', 'true');
    const laDenuncia = tarjeta(f, textos.denuncia, boton(f, t.mapa.verDetalle));
    await expect(texto(laDenuncia, t.motivoDenuncia.spam)).toBeVisible();
    await expect(texto(laDenuncia, empiezaCon(`${vecina.cuenta.nombre} · `))).toBeVisible();
    await boton(laDenuncia, t.moderacion.ocultar).click();
    await expect(boton(laDenuncia, t.moderacion.mostrar)).toBeVisible();
    await expect(texto(laDenuncia, t.moderacion.oculta)).toBeVisible();

    // Oculto: para los demás es como si no existiera.
    const anonima = await navegador.nuevaPagina('sin-cuenta');
    await anonima.goto(urlToby());
    await expect(texto(anonima, t.animal.noDisponible)).toBeVisible();
    await expect(boton(anonima, t.comunes.volverAlMapa)).toBeVisible();
    await v.goto(urlToby());
    await expect(texto(v, t.animal.noDisponible)).toBeVisible();

    // La familia lo sigue viendo, con el aviso y sin compartir.
    await f.goto(urlToby());
    await expect(titulo(f, textos.toby.nombre)).toBeVisible();
    await expect(texto(f, t.animal.oculto)).toBeVisible();
    await expect(boton(f, t.compartir.boton)).toHaveCount(0);

    // Volver a mostrar y marcar la denuncia revisada.
    await f.goto('/moderacion');
    await boton(laDenuncia, t.moderacion.mostrar).click();
    await expect(boton(laDenuncia, t.moderacion.ocultar)).toBeVisible();
    await boton(laDenuncia, t.moderacion.marcarRevisada).click();
    await expect(texto(laDenuncia, t.estadoDenuncia.revisada)).toBeVisible();
    await expect(boton(laDenuncia, t.moderacion.marcarRevisada)).toHaveCount(0);

    await anonima.reload();
    await expect(titulo(anonima, textos.toby.nombre)).toBeVisible();
    await navegador.cerrar(anonima);
  });

  test('la familia cambia su nombre público', async () => {
    const f = familia.pagina;
    await f.goto('/perfil');
    await boton(f, t.perfil.editar).click();
    await expect(f).toHaveURL(/\/cuenta\/editar$/);
    const nombre = campo(f, t.auth.nombre);
    await expect(nombre).toHaveValue(familia.cuenta.nombre);

    // Con una letra no deja guardar.
    await nombre.fill('F');
    await boton(f, t.cuenta.editar.guardar).click();
    await expect(texto(f, t.cuenta.editar.nombreInvalido)).toBeVisible();

    await nombre.fill(textos.nombreNuevo);
    await boton(f, t.cuenta.editar.guardar).click();
    await expect(f).toHaveURL(/\/perfil$/);
    await expect(texto(f, t.perfil.hola(textos.nombreNuevo))).toBeVisible();
    familia.cuenta.nombre = textos.nombreNuevo;
  });

  test('la vecina reporta un error con una captura y moderación lo resuelve', async () => {
    const v = vecina.pagina;
    const f = familia.pagina;
    const { formulario } = t.errores;
    await v.goto('/perfil');
    await boton(v, t.errores.boton).click();
    const reporte = hoja(v, formulario.titulo);

    // Vacío no se manda.
    await boton(reporte, formulario.enviar).click();
    await expect(
      texto(reporte, formulario.quePasoCorto(LIMITES_REPORTE.quePasoMinimo)),
    ).toBeVisible();

    await campo(reporte, formulario.quePaso).fill(textos.quePaso);
    await campo(reporte, formulario.queHacias).fill(textos.queHacias);
    // Con cuenta se elige una captura; el contacto es solo sin cuenta.
    await expect(campo(reporte, formulario.contacto)).toHaveCount(0);
    await elegirFoto(v, boton(reporte, formulario.elegirCaptura));
    await expect(boton(reporte, formulario.cambiarCaptura)).toBeVisible();
    await expect(texto(reporte, formulario.seSuma)).toBeVisible();
    await boton(reporte, formulario.enviar).click();

    await expect(reporte).toHaveCount(0, { timeout: 45_000 });
    await expect(texto(v, t.errores.enviadoConCuenta)).toBeVisible();

    // Moderación › Errores: el reporte, su captura (bucket privado, link firmado) y resolverlo.
    await f.goto('/moderacion');
    await opcion(f, t.errores.moderacion.errores).click();
    const elReporte = tarjeta(f, textos.quePaso, textos.queHacias);
    await expect(texto(elReporte, empiezaCon(`${vecina.cuenta.nombre} · `))).toBeVisible();
    await boton(elReporte, t.errores.moderacion.verCaptura).click();
    await esperarFoto(
      elReporte.getByRole('img', { name: t.errores.moderacion.captura, exact: true }),
    );
    await campo(elReporte, t.errores.moderacion.nota).fill(textos.notaResolucion);
    await boton(elReporte, t.errores.moderacion.marcarResuelto).click();

    await opcion(f, empiezaCon(`${t.errores.moderacion.resueltos} (`)).click();
    await expect(
      texto(elReporte, empiezaCon(t.errores.moderacion.resuelto(familia.cuenta.nombre, ''))),
    ).toBeVisible();
    await expect(
      texto(elReporte, `${t.errores.moderacion.notaGuardada}: ${textos.notaResolucion}`),
    ).toBeVisible();
  });

  test('la vecina edita y borra su encontrado; la familia no puede', async () => {
    const f = familia.pagina;
    const v = vecina.pagina;
    await f.goto(urlEncontrado());
    await boton(f, t.animal.masOpciones).click();
    const opcionesFamilia = hoja(f, t.animal.masOpciones);
    await expect(boton(opcionesFamilia, t.animal.acciones.denunciar)).toBeVisible();
    await expect(boton(opcionesFamilia, t.animal.acciones.editar)).toHaveCount(0);
    await expect(boton(opcionesFamilia, t.animal.acciones.borrar)).toHaveCount(0);
    await boton(opcionesFamilia, t.comunes.cancelar).click();

    // Editar: cambia el color; la foto, la ubicación y el tipo no se editan.
    await v.goto(urlEncontrado());
    await boton(v, t.animal.masOpciones).click();
    await boton(hoja(v, t.animal.masOpciones), t.animal.acciones.editar).click();
    await expect(v).toHaveURL(new RegExp(`${urlEncontrado()}/editar$`));
    await expect(texto(v, t.editarReporte.intro)).toBeVisible();
    await expect(boton(v, t.publicar.elegirGaleria)).toHaveCount(0);
    const color = campo(v, t.publicar.color);
    await expect(color).toHaveValue(textos.encontrado.color);
    await color.fill(textos.encontrado.colorNuevo);
    await boton(v, t.editarReporte.guardar).click();
    await expect(v).toHaveURL(new RegExp(`${urlEncontrado()}$`));
    await expect(
      titulo(v, t.animal.tituloCaso(null, 'perro', textos.encontrado.colorNuevo, null)),
    ).toBeVisible();

    // Borrar: la confirmación dice qué se pierde (ningún aviso de otra persona).
    await boton(v, t.animal.masOpciones).click();
    await boton(hoja(v, t.animal.masOpciones), t.animal.acciones.borrar).click();
    const borrar = hoja(v, t.borrarReporte.titulo);
    await expect(texto(borrar, t.borrarReporte.detalle(0))).toBeVisible();
    await boton(borrar, t.borrarReporte.boton).click();
    await v.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
    await v.goto(urlEncontrado());
    await expect(texto(v, t.animal.noDisponible)).toBeVisible();
  });

  test('las dos borran su cuenta: la sesión se cierra y no pueden volver a ingresar', async ({
    navegador,
  }) => {
    const v = vecina.pagina;
    const f = familia.pagina;

    await borrarMiCuenta(v);
    // Lo de la vecina: la conversación con la familia ya no está, ni su aviso en el caso cerrado.
    await f.goto('/actividad');
    await opcion(f, t.actividad.mensajes).click();
    await expect(texto(f, t.actividad.sinMensajes)).toBeVisible();
    await f.goto(urlToby());
    await expect(titulo(f, textos.toby.nombre)).toBeVisible();
    await expect(texto(f, t.animal.queHizo('visto', vecina.cuenta.nombre))).toHaveCount(0);
    // Su reporte de error sigue, sin autor y sin la captura.
    await f.goto('/moderacion');
    await opcion(f, t.errores.moderacion.errores).click();
    await opcion(f, empiezaCon(`${t.errores.moderacion.resueltos} (`)).click();
    const elReporte = tarjeta(f, textos.quePaso, textos.queHacias);
    await expect(texto(elReporte, empiezaCon(`${t.comunes.cuentaEliminada} · `))).toBeVisible();
    await expect(boton(elReporte, t.errores.moderacion.verCaptura)).toHaveCount(0);

    await borrarMiCuenta(f);
    // Con la cuenta se borran sus perdidos, también los cerrados.
    const anonima = await navegador.nuevaPagina('sin-cuenta');
    await anonima.goto(urlToby());
    await expect(texto(anonima, t.animal.noDisponible)).toBeVisible();
    await navegador.cerrar(anonima);

    // La cuenta ya no existe: Auth responde 400 (invalid_credentials) y el navegador lo anota.
    navegador.vigilancia.esperar({
      texto: /status of 400/,
      url: /\/auth\/v1\/token\?grant_type=password/,
      motivo: 'ingresar con una cuenta borrada',
    });
    await abrirIngresar(v);
    await completarIngreso(v, vecina.cuenta);
    await expect(texto(v, t.auth.errores.credenciales)).toBeVisible();
  });
});

/** Perfil › Borrar mi cuenta, con la opción que viene marcada (dejar publicado lo abierto). */
async function borrarMiCuenta(p: Persona['pagina']): Promise<void> {
  const { borrar } = t.cuenta;
  await p.goto('/perfil');
  await boton(p, t.perfil.borrarCuenta).click();
  await expect(p).toHaveURL(/\/cuenta\/borrar$/);
  const conservar = `${borrar.opciones.conservar.titulo}. ${borrar.opciones.conservar.detalle}`;
  await expect(opcion(p, conservar)).toHaveAttribute('aria-checked', 'true');

  // Sin marcar que entiende, no la borra.
  await boton(p, borrar.boton).click();
  await expect(texto(p, t.legal.aceptar.falta)).toBeVisible();
  const entiendo = p.getByRole('checkbox', { name: borrar.confirmo, exact: true });
  await entiendo.click();
  await expect(entiendo).toHaveAttribute('aria-checked', 'true');
  await boton(p, borrar.boton).click();

  // Vuelve al mapa sin sesión: Perfil ofrece ingresar y no queda la sesión guardada.
  await p.waitForURL((url) => url.pathname === '/', { timeout: 45_000 });
  await p.goto('/perfil');
  await expect(boton(p, t.auth.ingresar)).toBeVisible();
  await expect(texto(p, t.perfil.sinCuenta)).toBeVisible();
  expect(
    await p.evaluate(() =>
      Object.keys(localStorage).filter((clave) => clave.includes('auth-token')),
    ),
  ).toEqual([]);
}
