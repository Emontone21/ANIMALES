/**
 * Todos los textos de la interfaz, en español rioplatense (voseo).
 * Ningún componente escribe texto visible inline: lo importa de acá.
 */

import type {
  DatosCompartir,
  ErrorLlamadaIa,
  Especie,
  EstadoAnimal,
  EstadoDenuncia,
  MotivoDenuncia,
  Plataforma,
  Tamanio,
  TipoAvistamiento,
  TipoLlamadaIa,
  TipoReporte,
} from '@/types/dominio';

/**
 * El nombre de la app. Fuera de este archivo lo repiten public/index.html,
 * public/manifest.webmanifest, app.json y las plantillas de supabase/templates/
 * (las pruebas de __tests__/ comprueban que coincidan).
 */
const NOMBRE = 'Spot';

export const t = {
  app: {
    nombre: NOMBRE,
    lema: 'Animales perdidos y encontrados en Montevideo',
    /** Título de la pestaña del navegador. */
    tituloWeb: `${NOMBRE} · Animales perdidos y encontrados en Montevideo`,
  },
  comunes: {
    cargando: 'Cargando…',
    reintentar: 'Reintentar',
    cancelar: 'Cancelar',
    listo: 'Listo',
    guardar: 'Guardar',
    volver: 'Volver',
    volverAlMapa: 'Volver al mapa',
    cerrar: 'Cerrar',
    errorGenerico: 'Algo salió mal. Probá de nuevo.',
    sinConexion: 'No hay conexión. Fijate la red y probá de nuevo.',
    /** Quien hizo algo y después borró su cuenta: "Lo vio una cuenta eliminada". */
    cuentaEliminada: 'una cuenta eliminada',
  },
  tabs: {
    mapa: 'Mapa',
    publicar: 'Publicar',
    actividad: 'Actividad',
    perfil: 'Perfil',
    /** Lectores de pantalla: pestaña con el punto de novedades sin leer. */
    conNovedades: (titulo: string) => `${titulo}, con novedades sin leer`,
  },
  mapa: {
    titulo: 'Mapa',
    cercaTuyo: 'Cerca tuyo',
    /** El botón de la barra de la hoja "Cerca tuyo" (celular). */
    ocultarCasos: 'Ocultar casos',
    mostrarCasos: 'Mostrar casos',
    /** Debajo de "Cerca tuyo": "12 casos". */
    cantidadCasos: (n: number) =>
      n === 0 ? 'Ningún caso con estos filtros' : n === 1 ? '1 caso' : `${n} casos`,
    masFiltros: 'Más filtros',
    /** "A 600 m" / "A 1,2 km". */
    distancia: (km: number) =>
      km < 1
        ? `A ${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`
        : `A ${km.toFixed(1).replace('.', ',')} km`,
    /** "A 600 m, hace 40 minutos". */
    distanciaYTiempo: (distancia: string, hace: string) => `${distancia}, ${hace}`,
    sinReportes: 'No hay reportes con estos filtros.',
    verDetalle: 'Ver detalle',
    miUbicacion: 'Ir a mi ubicación',
    /** El último pedazo es un link a openstreetmap.org/copyright, como piden sus guías. */
    atribucion: '© OpenFreeMap · © OpenMapTiles · ',
    atribucionOsm: '© colaboradores de OpenStreetMap',
    /** Mapa en grande del recorrido (docs/DISENO.md, 6.9.1). */
    recorrido: {
      verEnGrande: 'Ver el mapa en grande',
      titulo: 'Recorrido',
      anterior: 'Anterior',
      siguiente: 'Siguiente',
      /** "2 de 5": el punto elegido y cuántos hay. */
      posicion: (n: number, total: number) => `${n} de ${total}`,
      /** Donde se perdió y el resguardo: la base los guarda redondeados. */
      aproximada: 'Ubicación aproximada, unos 100 m a la redonda.',
    },
    filtros: {
      especie: 'Especie',
      estado: 'Estado',
      antiguedad: 'Antigüedad',
      todos: 'Todos',
      tipo: 'Tipo de reporte',
      perdidos: 'Perdidos',
      encontrados: 'Encontrados',
      activos: 'Activos',
      ultimas24h: 'Últimas 24 h',
      ultimos7d: '7 días',
      ultimos30d: '30 días',
    },
    verLista: 'Ver lista',
    lista: {
      titulo: 'Casos cerca',
      /** "12 casos, del más cercano al más lejano". */
      resumen: (n: number) => (n === 1 ? '1 caso.' : `${n} casos, del más cercano al más lejano.`),
    },
  },
  especie: {
    perro: 'Perro',
    gato: 'Gato',
    otro: 'Otro',
  } satisfies Record<Especie, string>,
  /** Título de la vista previa de un encontrado: "Perro encontrado". */
  especieEncontrada: {
    perro: 'Perro',
    gato: 'Gato',
    otro: 'Animal',
  } satisfies Record<Especie, string>,
  /** Para oraciones: "Un perro encontrado…". */
  especieConArticulo: {
    perro: 'Un perro',
    gato: 'Un gato',
    otro: 'Un animal',
  } satisfies Record<Especie, string>,
  especiePlural: {
    perro: 'Perros',
    gato: 'Gatos',
    otro: 'Otros',
  } satisfies Record<Especie, string>,
  tamanio: {
    chico: 'Chico',
    mediano: 'Mediano',
    grande: 'Grande',
  } satisfies Record<Tamanio, string>,
  estado: {
    avistado: 'Avistado',
    resguardado: 'Resguardado',
    reunido: 'Reunido con su familia',
    vinculado: 'Vinculado a otro reporte',
  } satisfies Record<EstadoAnimal, string>,
  tipoReporte: {
    perdido: 'Perdido',
    encontrado: 'Encontrado',
  } satisfies Record<TipoReporte, string>,
  /** Etiqueta del caso: un perdido que todavía nadie tiene se ve como "Perdido". */
  etiquetaEstado: (estado: EstadoAnimal, tipo: TipoReporte): string =>
    tipo === 'perdido' && estado === 'avistado' ? t.tipoReporte.perdido : t.estado[estado],
  tipoAvistamiento: {
    encontrado: 'Lo encontró',
    visto: 'Lo vio',
    resguardado: 'Lo resguardó',
    // El primer avistamiento de un perdido: el historial no agrega quién.
    perdido: 'Se perdió acá',
  } satisfies Record<TipoAvistamiento, string>,
  animal: {
    titulo: 'Detalle del animal',
    /** Título de tarjetas y del detalle: "Gato gris atigrado" o "Perro mediano". */
    tituloCorto: (especie: Especie, color: string | null, tamanio: Tamanio | null): string =>
      color
        ? `${t.especie[especie]} ${color}`
        : tamanio
          ? `${t.especie[especie]} ${t.tamanio[tamanio].toLowerCase()}`
          : t.especie[especie],
    /** Título de un caso: el nombre si lo tiene ("Toby"); si no, "Gato gris atigrado". */
    tituloCaso: (
      nombre: string | null,
      especie: Especie,
      color: string | null,
      tamanio: Tamanio | null,
    ): string => nombre ?? t.animal.tituloCorto(especie, color, tamanio),
    publicado: (hace: string) => `Publicado ${hace}`,
    /** "Perdido desde el sábado 17", "Perdido desde ayer". */
    perdidoDesde: (cuando: string) => `Perdido desde ${cuando}`,
    loBuscan: 'Lo buscan',
    contactoFamiliaAyuda: 'Es el dato que eligió mostrar su familia.',
    ultimaVez: 'Visto por última vez',
    /**
     * Un avistamiento en el Historial y en el mapa en grande: "Lo vio Carla"; el
     * primero de un perdido es "Se perdió acá". Sin nombre: quien lo hizo borró
     * su cuenta y lo dejó publicado.
     */
    queHizo: (tipo: TipoAvistamiento, nombre: string | null): string =>
      tipo === 'perdido'
        ? t.tipoAvistamiento.perdido
        : `${t.tipoAvistamiento[tipo]} ${nombre ?? t.comunes.cuentaEliminada}`,
    novedades: 'Novedades del caso',
    masOpciones: 'Más opciones',
    avisoEstafa:
      'Nunca pagues para recuperar a un animal. Si alguien te pide plata o datos de tu tarjeta, denuncialo.',
    noEncontrado: 'No encontramos este reporte. Puede que lo hayan cerrado.',
    /** Oculto por moderación o inexistente: el mismo texto, a propósito. */
    noDisponible: 'Esta publicación no está disponible.',
    conCollar: 'Con collar',
    sinCollar: 'Sin collar',
    historial: 'Historial',
    avistamientos: (n: number) => (n === 1 ? '1 avistamiento' : `${n} avistamientos`),
    vinculadoAviso: 'Este reporte se unió a otro del mismo animal. Te llevamos al caso principal.',
    casoCerrado: 'Este caso está cerrado: el animal volvió con su familia.',
    /** Un caso reunido, para quien no participó: solo lo básico (lo decide la base, 0027). */
    reservado: {
      volvio: 'Volvió a casa',
      aviso:
        'Para cuidar a su familia, el mapa, la zona y el historial de un caso que terminó los ven solo quienes ayudaron a buscarlo.',
    },
    oculto: 'Esta publicación fue ocultada por moderación y no aparece en el mapa.',
    requiereCuentaAcciones: 'Para avisar que lo viste o cambiar el estado necesitás una cuenta.',
    acciones: {
      loVi: 'Lo vi',
      resguardar: 'Me lo llevé / está resguardado',
      reunido: 'Se reunió con su familia',
      reabrir: 'Se volvió a escapar',
      seguir: 'Seguir',
      siguiendo: 'Siguiendo',
      denunciar: 'Denunciar',
      denunciado: 'Denuncia enviada',
      editar: 'Editar el reporte',
      borrar: 'Borrar el reporte',
    },
    contacto: 'Contacto para recuperarlo',
    /** Perdido resguardado visto por alguien que no es su familia. */
    contactoPrivado: 'Alguien avisó que lo tiene. Su contacto lo ve solo la familia.',
    cambioEstado: {
      titulo: (estado: string) => `Cambio de estado: ${estado}`,
      por: (nombre: string) => `por ${nombre}`,
    },
    modalAvistamiento: {
      titulo: '¿Dónde y cuándo lo viste?',
      nota: 'Nota (opcional)',
      notaPlaceholder: 'Cómo estaba, hacia dónde iba…',
      enviar: 'Registrar avistamiento',
      exito: '¡Gracias! Avistamiento registrado.',
    },
    modalResguardo: {
      titulo: 'Lo tenés a salvo',
      intro:
        'Contanos cómo contactarte si aparece la familia. Es opcional y lo ve cualquiera que abra el reporte.',
      introPerdido:
        'Sacale una foto ahora, así su familia puede reconocerlo. El contacto que dejes lo ven solo su familia y vos.',
      foto: 'Foto actual del animal',
      fotoObligatoria: 'Para avisar que lo tenés, sacale una foto actual.',
      contacto: 'Contacto que querés compartir',
      contactoPlaceholder: 'Ej: WhatsApp 099 123 456 o "escribime por la app"',
      contactoAyudaPerdido: 'Lo ven solo su familia y vos. También te pueden escribir por la app.',
      nota: 'Nota (opcional)',
      notaPlaceholder: 'Dónde está, cómo está…',
      notaAyudaPerdido: 'La nota la ve cualquiera: no pongas tu contacto acá.',
      ubicacion: '¿Dónde está ahora? (opcional)',
      ubicacionAyuda: 'Se muestra aproximada, a unos 100 metros, para no marcar tu casa.',
      enviar: 'Marcar como resguardado',
    },
    modalReunido: {
      titulo: '¿Se reunió con su familia?',
      intro:
        'El caso se cierra y deja de aparecer entre los activos. Lo podés reabrir si se vuelve a escapar.',
      nota: 'Nota (opcional)',
      notaPlaceholder: 'Cómo lo encontraron…',
      enviar: 'Confirmar',
    },
    modalReabrir: {
      titulo: '¿Se volvió a escapar?',
      intro: 'El caso vuelve a estar activo en el mapa.',
      enviar: 'Reabrir el caso',
    },
    modalDenuncia: {
      titulo: 'Denunciar esta publicación',
      intro: 'Contanos qué pasa. Solo lo ve el equipo de moderación.',
      motivo: 'Motivo',
      detalle: 'Detalle (opcional)',
      detallePlaceholder: 'Qué viste…',
      enviar: 'Enviar denuncia',
      exito: 'Gracias. Vamos a revisarla.',
    },
  },
  coincidencias: {
    titulo: 'Posibles coincidencias',
    intro:
      'El reconocimiento de imágenes encontró reportes parecidos. Mirá las fotos y decidí vos: nada se une solo.',
    vacio:
      'Todavía no hay coincidencias. Las fotos se comparan automáticamente; si aparece algo, lo vas a ver acá.',
    /** Quien no puede decidir ve por qué espera. */
    esperaFamilia: 'Su familia está mirando las fotos para confirmar si es el mismo animal.',
    esperaPublicadores:
      'Quien publicó alguno de los dos reportes va a confirmar si es el mismo animal.',
    sinFamilia:
      'La familia de este animal borró su cuenta: nadie puede confirmar esta coincidencia.',
    tiempo: (horas: number) =>
      horas < 1
        ? 'con menos de 1 h de diferencia'
        : horas < 48
          ? `con ${Math.round(horas)} h de diferencia`
          : `con ${Math.round(horas / 24)} días de diferencia`,
    /** "Con 3 h de diferencia.", para cerrar el resumen de una coincidencia. */
    tiempoOracion: (horas: number): string => {
      const texto = t.coincidencias.tiempo(horas);
      return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`;
    },
    esElMismo: 'Es el mismo animal',
    noEsElMismo: 'No es el mismo',
    verOtro: 'Ver el otro reporte',
    /**
     * "Un perro encontrado a 1,2 km se parece en un 86 %." o, con nombre,
     * "Toby, perdido a 1,2 km, se parece en un 86 %."
     */
    resumen: (
      especie: Especie,
      tipo: TipoReporte,
      nombre: string | null,
      km: number | null,
      porcentaje: number,
    ): string => {
      const tipoTexto = t.tipoReporte[tipo].toLowerCase();
      const donde = km === null ? '' : ` ${t.mapa.distancia(km).toLowerCase()}`;
      return nombre
        ? `${nombre}, ${tipoTexto}${donde}, se parece en un ${porcentaje} %.`
        : `${t.especieConArticulo[especie]} ${tipoTexto}${donde} se parece en un ${porcentaje} %.`;
    },
    /**
     * Las del reconocimiento con IA muestran el motivo en vez del porcentaje:
     * "Un perro encontrado a 1,2 km." o "Toby, perdido a 1,2 km."
     */
    quienYDonde: (
      especie: Especie,
      tipo: TipoReporte,
      nombre: string | null,
      km: number | null,
    ): string => {
      const tipoTexto = t.tipoReporte[tipo].toLowerCase();
      const donde = km === null ? '' : ` ${t.mapa.distancia(km).toLowerCase()}`;
      return nombre
        ? `${nombre}, ${tipoTexto}${donde}.`
        : `${t.especieConArticulo[especie]} ${tipoTexto}${donde}.`;
    },
    confirmada: 'Listo: los reportes quedaron unidos.',
    rechazada: 'Gracias. Lo anotamos para afinar el reconocimiento.',
    resueltas: (n: number) =>
      n === 1 ? '1 coincidencia ya resuelta' : `${n} coincidencias ya resueltas`,
  },
  actividad: {
    titulo: 'Actividad',
    requiereCuenta:
      'Con una cuenta vas a ver acá las novedades de los casos que seguís y tus mensajes.',
    novedades: 'Novedades',
    mensajes: 'Mensajes',
    sinNovedades: 'Todavía no hay novedades. Seguí un caso o publicá uno y te avisamos acá.',
    sinMensajes: 'No tenés conversaciones. Desde un reporte podés escribirle a quien lo publicó.',
    sinMensajesAun: 'Sin mensajes todavía',
    marcarTodasLeidas: 'Marcar todas como leídas',
  },
  /**
   * Las notificaciones del celular (Web Push). Se ven en la pantalla bloqueada:
   * nunca nombres de personas, el texto de un mensaje, contactos ni lugares.
   * Del caso, solo su nombre o la especie. La función avisar tiene una copia
   * (supabase/functions/avisar/textos.ts, la compara __tests__/avisosPush.test.ts).
   */
  avisosPush: {
    animalA: { perro: 'al perro', gato: 'al gato', otro: 'al animal' } satisfies Record<
      Especie,
      string
    >,
    animalEl: { perro: 'el perro', gato: 'el gato', otro: 'el animal' } satisfies Record<
      Especie,
      string
    >,
    /** Para "La familia del perro te agradeció". */
    animalDe: { perro: 'del perro', gato: 'del gato', otro: 'del animal' } satisfies Record<
      Especie,
      string
    >,
    /** "Alguien vio a Toby" / "Alguien vio al perro". */
    visto: {
      titulo: (aAnimal: string) => `Alguien vio ${aAnimal}`,
      cuerpo: 'Tocá para ver dónde lo vieron.',
    },
    resguardado: {
      titulo: (aAnimal: string) => `Alguien tiene ${aAnimal} a salvo`,
      cuerpo: 'Tocá para ver el caso.',
    },
    reunido: {
      titulo: (animal: string) => `¡${mayuscula(animal)} volvió con su familia!`,
      cuerpo: 'Un caso que seguías se cerró con final feliz.',
    },
    reabierto: {
      titulo: (animal: string) => `${mayuscula(animal)} se volvió a escapar`,
      cuerpo: 'Atento al mapa: tocá para ver el caso.',
    },
    coincidenciaFamilia: {
      titulo: (nombre: string | null) =>
        nombre
          ? `Encontraron un animal parecido a ${nombre}`
          : 'Encontraron un animal parecido al tuyo',
      cuerpo: 'Mirá las fotos y decidí si es o no.',
    },
    coincidencia: {
      titulo: (elAnimal: string) => `Posible coincidencia con ${elAnimal}`,
      cuerpo: 'Tocá para ver las fotos.',
    },
    mensaje: {
      titulo: (elAnimal: string | null) =>
        elAnimal ? `Tenés un mensaje nuevo sobre ${elAnimal}` : 'Tenés un mensaje nuevo',
      cuerpo: 'Tocá para leerlo.',
    },
    /** "La familia de Toby te agradeció". Nunca el mensaje ni quién lo mandó. */
    agradecimiento: {
      titulo: (deAnimal: string) => `La familia ${deAnimal} te agradeció`,
      cuerpo: 'Gracias por ayudar a que volviera a casa.',
    },
    errorNuevo: {
      titulo: 'Llegó un reporte de un error',
      cuerpo: 'Tocá para verlo en moderación.',
    },
    errorResuelto: {
      titulo: 'Resolvimos el error que reportaste',
      cuerpo: 'Tocá para ver la respuesta.',
    },
    otro: { titulo: `Tenés una novedad en ${NOMBRE}`, cuerpo: 'Tocá para verla.' },
  },
  /** Activar las notificaciones del celular: en Perfil y después de publicar. */
  celular: {
    interruptor: 'Notificaciones en este celular',
    ayuda:
      'Te avisamos cuando alguien vea un caso tuyo o que seguís, cuando te escriban y si aparece una posible coincidencia. En la pantalla bloqueada no se ven nombres de personas, mensajes ni direcciones.',
    activadas: 'Listo: te vamos a avisar en este celular.',
    desactivadas: 'Listo: ya no te avisamos en este celular.',
    error: 'No pudimos activar las notificaciones. Probá de nuevo.',
    errorDesactivar: 'No pudimos apagar las notificaciones. Probá de nuevo.',
    /** Después de publicar un caso. */
    pregunta: '¿Querés que te avisemos al celular cuando alguien lo vea?',
    si: 'Sí, avisame',
    ahoraNo: 'Ahora no',
    iphone: `En el iPhone, las notificaciones llegan con ${NOMBRE} instalada en la pantalla de inicio. Instalala y activalas desde Perfil.`,
    navegadorInterno: (app: string) =>
      `El navegador de ${app} no muestra notificaciones. Abrí ${NOMBRE} en Chrome o Safari para activarlas.`,
    abrirEnNavegador: 'Abrir en Chrome o Safari',
    bloqueadas: `Las notificaciones están bloqueadas para ${NOMBRE} en este navegador.`,
    /** Cómo volver a permitirlas, según dónde está abierta. */
    comoDesbloquear: {
      iphone: `Para activarlas, entrá a Ajustes › Notificaciones › ${NOMBRE} y prendé "Permitir notificaciones". Después volvé acá.`,
      androidApp: `Para activarlas, mantené apretado el ícono de ${NOMBRE}, tocá "Información de la app" › Notificaciones y permitilas. Después volvé acá.`,
      android:
        'Para activarlas, tocá el ícono que está a la izquierda de la dirección, entrá a Permisos y elegí Permitir en Notificaciones. Después volvé acá.',
      computadora:
        'Para activarlas, tocá el ícono que está a la izquierda de la dirección y permití las notificaciones. Después volvé acá.',
    },
    noSoportado: 'Este navegador no puede mostrar notificaciones. Probá con Chrome o Safari.',
  },
  editarReporte: {
    titulo: 'Editar reporte',
    intro:
      'Corregí los datos del animal. La foto, la ubicación y si es perdido o encontrado no se cambian.',
    guardar: 'Guardar cambios',
    guardando: 'Guardando…',
    soloQuienPublico: 'Solo quien publicó el reporte lo puede editar.',
    unido: 'Este reporte se unió a otro caso: ya no se edita por separado.',
  },
  borrarReporte: {
    titulo: '¿Borrar este reporte?',
    /** Qué se pierde, con los avisos de otras personas que lo vieron. */
    detalle: (avisosDeOtros: number) =>
      [
        'Se borra para siempre, con su historial, sus fotos, las coincidencias, las conversaciones sobre el caso y los reportes de otras personas que se unieron a este.',
        avisosDeOtros === 1
          ? 'También se borra el aviso de otra persona que lo vio.'
          : avisosDeOtros > 1
            ? `También se borran los ${avisosDeOtros} avisos de otras personas que lo vieron.`
            : null,
        'No se puede deshacer.',
      ]
        .filter(Boolean)
        .join(' '),
    boton: 'Borrar para siempre',
    errorFotos:
      'No pudimos borrar algunas fotos. El reporte sigue publicado: probá de nuevo en un rato.',
  },
  compartir: {
    boton: 'Compartir',
    titulo: 'Compartir el caso',
    intro: 'Mandalo por WhatsApp o copiá el link para pegarlo donde quieras.',
    whatsapp: 'Mandar por WhatsApp',
    copiar: 'Copiar el link',
    copiado: 'Listo, copiamos el link.',
    errorCopiar: 'No pudimos copiar el link. Seleccionalo arriba y copialo.',
    /** El texto que acompaña al link: "Se perdió Toby, perro marrón. Si lo viste, avisá acá:". */
    texto: (caso: DatosCompartir): string => {
      const unAnimal = `un ${animalEnFrase(caso)}`;
      if (caso.estado === 'reunido') {
        return `${caso.nombre ?? mayuscula(unAnimal)} ya volvió con su familia. Mirá el caso:`;
      }
      if (caso.tipo === 'perdido') {
        return caso.nombre
          ? `Se perdió ${caso.nombre}, ${animalEnFrase(caso)}. Si lo viste, avisá acá:`
          : `Se perdió ${unAnimal}. Si lo viste, avisá acá:`;
      }
      if (caso.estado === 'resguardado') {
        return `${mayuscula(unAnimal)} está a salvo y busca a su familia. Si sabés de quién es, avisá acá:`;
      }
      return `Encontraron ${unAnimal}. Si sabés de quién es, avisá acá:`;
    },
    /**
     * Vista previa del link en WhatsApp, Facebook o Telegram (api/vista-previa.ts).
     * Sin datos personales: ni el contacto, ni quién publicó, ni dónde.
     */
    vistaPrevia: {
      titulo: (caso: DatosCompartir): string => {
        const especie = t.especieEncontrada[caso.especie];
        if (caso.estado === 'reunido') {
          return caso.nombre
            ? `${caso.nombre} volvió con su familia`
            : `${especie}, de vuelta en casa`;
        }
        if (caso.tipo === 'perdido') {
          return `Se perdió ${caso.nombre ?? `un ${animalEnFrase(caso)}`}`;
        }
        return caso.estado === 'resguardado'
          ? `${especie} encontrado, a salvo`
          : `${especie} encontrado`;
      },
      descripcion: (caso: DatosCompartir): string => {
        const datos = [
          mayuscula(
            caso.color
              ? `${nombreEspecie[caso.especie]} ${caso.color.toLowerCase()}`
              : nombreEspecie[caso.especie],
          ),
          caso.tamanio ? t.tamanio[caso.tamanio].toLowerCase() : null,
          caso.tieneCollar ? 'con collar' : null,
        ]
          .filter(Boolean)
          .join(', ');
        const pedido =
          caso.estado === 'reunido'
            ? 'Gracias a todos los que ayudaron a buscarlo.'
            : caso.tipo === 'perdido'
              ? `Si lo viste, avisá en ${NOMBRE}.`
              : `Si sabés de quién es, avisá en ${NOMBRE}.`;
        return `${datos}. ${pedido}`;
      },
      tituloGenerico: NOMBRE,
      descripcionGenerica:
        'Animales perdidos y encontrados en Montevideo. Si viste uno, avisá: así vuelve a casa.',
    },
  },
  /**
   * "Compartir en historias": la imagen de 1080 × 1920 que se arma en el
   * celular (src/features/historias/). Sin contactos, quién publicó ni dónde.
   */
  historia: {
    boton: 'Compartir en historias',
    titulo: 'Compartir en historias',
    intro:
      'Una imagen para tu historia de Instagram o tu estado de WhatsApp, sin datos de contacto ni la ubicación.',
    generando: 'Armando la imagen…',
    /** Texto alternativo de la vista previa. */
    vistaPrevia: (titulo: string) => `Vista previa de la historia de ${titulo}`,
    compartir: 'Compartir la imagen',
    descargar: 'Descargar la imagen',
    /** Antes de compartir. */
    pistaAntes:
      'Al compartirla copiamos el link del caso: en Instagram, sumalo con el sticker de enlace.',
    /** Después de copiar el link. */
    pista: 'Copiamos el link: sumalo con el sticker de enlace de Instagram.',
    sinCompartirArchivos:
      'Este navegador no puede mandar la imagen a otra app. Descargala y subila a tu historia.',
    descargada: 'Descargamos la imagen. Subila a tu historia desde la galería.',
    errorGenerar: 'No pudimos armar la imagen. Probá de nuevo.',
    errorCompartir: 'No pudimos compartir la imagen. Probá descargarla.',
    reintentar: 'Probar de nuevo',
    /** En la imagen: una etiqueta en mayúsculas, como un cartel (DISENO.md, 6.18). */
    etiqueta: { perdido: 'SE PERDIÓ', encontrado: 'ENCONTRADO' } satisfies Record<
      TipoReporte,
      string
    >,
    /** "Se perdió el 17 de octubre". */
    fecha: {
      perdido: (cuando: string) => `Se perdió ${cuando}`,
      encontrado: (cuando: string) => `Lo encontraron ${cuando}`,
    } satisfies Record<TipoReporte, (cuando: string) => string>,
    ayuda: {
      perdido: `Ayudá a encontrarlo en ${NOMBRE}`,
      encontrado: `Ayudá a encontrar a su familia en ${NOMBRE}`,
    } satisfies Record<TipoReporte, string>,
    nombreArchivo: 'spot-historia.jpg',
    /** La variante de un reencuentro (/reencuentros): "VOLVIÓ A CASA". */
    reencuentro: {
      etiqueta: 'VOLVIÓ A CASA',
      ayuda: `Conocé más reencuentros en ${NOMBRE}`,
      intro:
        'Una imagen para tu historia de Instagram o tu estado de WhatsApp, con la foto y la frase del reencuentro.',
      pistaAntes:
        'Al compartirla copiamos el link de la historia: en Instagram, sumalo con el sticker de enlace.',
    },
  },
  /**
   * El muro de reencuentros (/reencuentros) y contar cómo volvió
   * (/animal/<id>/reencuentro). El muro no nombra a nadie.
   */
  reencuentros: {
    titulo: 'Reencuentros',
    intro: 'Animales que volvieron a casa, contados por sus familias.',
    /** El contador grande del muro. Con menos de 5, sin número. */
    contadorPrimeros: `Los primeros reencuentros de ${NOMBRE}`,
    contadorDetalle: (n: number) =>
      n === 1 ? `animal volvió a casa con ${NOMBRE}` : `animales volvieron a casa con ${NOMBRE}`,
    contadorAccesible: (n: number) =>
      n === 1
        ? `1 animal volvió a casa con ${NOMBRE}`
        : `${n} animales volvieron a casa con ${NOMBRE}`,
    /** La tarjeta de "Cerca tuyo": "34 volvieron a casa · Ver historias". */
    tarjeta: (n: number | null) =>
      n === null ? `Los primeros reencuentros de ${NOMBRE}` : `${n} volvieron a casa`,
    verHistorias: 'Ver historias',
    /** "Toby" o, si la familia no quiso mostrar el nombre, "Un perro". */
    tituloHistoria: (nombre: string | null, especie: Especie) =>
      nombre ?? t.especieConArticulo[especie],
    dias: (dias: number) =>
      dias <= 0
        ? 'Volvió a casa el mismo día'
        : dias === 1
          ? 'Volvió a casa después de 1 día'
          : `Volvió a casa después de ${dias} días`,
    /** La fecha de la tarjeta: "El 21 de octubre". */
    fecha: (cuando: string) => mayuscula(cuando),
    /** Texto alternativo de la foto. */
    fotoDe: (titulo: string) => `Foto del reencuentro de ${titulo}`,
    vacio:
      'Todavía no hay historias. Cuando una familia cuente cómo volvió su animal, va a aparecer acá.',
    verMas: 'Ver más historias',
    verTodas: 'Ver todos los reencuentros',
    verCaso: 'Ver el caso',
    noDisponible: 'Esta historia no está disponible.',
    oculta: 'Esta historia fue ocultada por moderación: no se ve en el muro.',
    opciones: 'Más opciones',
    denunciar: 'Denunciar la historia',
    denunciada: 'Ya denunciaste esta historia',
    denunciaTitulo: 'Denunciar la historia',
    denunciaIntro: 'Contanos qué tiene de malo. Moderación la revisa y, si hace falta, la oculta.',
    denunciaExito: 'Gracias: moderación la va a revisar.',
    requiereCuenta: 'Para denunciar una historia necesitás una cuenta.',
    /** El texto que acompaña al link: "Toby volvió a casa con Spot. Mirá su historia:". */
    compartirTexto: (titulo: string) => `${titulo} volvió a casa con ${NOMBRE}. Mirá su historia:`,
    /** Vista previa del link (api/vista-previa.ts). Sin datos de nadie. */
    vistaPrevia: {
      titulo: (titulo: string) => `${titulo} volvió a casa`,
      descripcion: (dias: string) => `${dias}. Mirá más reencuentros en ${NOMBRE}.`,
      tituloGenerico: `Reencuentros en ${NOMBRE}`,
      descripcionGenerica:
        'Animales que volvieron a casa en Montevideo, contados por sus familias.',
    },
    /** En el detalle de un caso reunido. */
    enElCaso: {
      titulo: 'Cómo volvió',
      pregunta: '¿Querés contar cómo volvió?',
      ayuda: 'Tu historia sale en el muro de reencuentros, sin tus datos ni dónde fue.',
      contar: 'Contar cómo volvió',
      editar: 'Editar la historia',
      verEnElMuro: 'Ver en el muro',
      /** En lo básico de un caso reunido: el link a su historia. */
      leer: 'Leer cómo volvió',
    },
    /** La pregunta al marcar el caso como reunido. */
    alegria: {
      titulo: '¡Qué alegría!',
      pregunta: '¿Querés contar cómo volvió? También podés agradecerle a quien te ayudó.',
      contar: 'Contar cómo volvió',
      ahoraNo: 'Ahora no',
    },
    contar: {
      titulo: 'Contá cómo volvió',
      intro:
        'Tu historia sale en el muro de reencuentros, sin tus datos ni dónde fue. Es opcional y la podés editar o borrar cuando quieras.',
      historia: 'Tu historia (opcional)',
      foto: 'Foto del reencuentro (opcional)',
      fotoAyuda: 'Si no elegís una, usamos la foto del caso.',
      avisoPersonas: 'Si en la foto aparecen personas, que estén de acuerdo en que se publique.',
      usarFotoDelCaso: 'Usar la foto del caso',
      frase: '¿Cómo volvió?',
      frasePlaceholder: 'Una vecina lo vio en la plaza y nos escribió…',
      fraseAyuda: 'Hasta 280 caracteres. Los teléfonos, links y emails no se publican.',
      caracteres: (n: number) => `${n} de 280`,
      mostrarNombre: (nombre: string) => `Mostrar el nombre (${nombre})`,
      mostrarNombreAyuda: 'Si lo apagás, el muro dice la especie.',
      agradecer: 'Agradecer (opcional)',
      agradecerIntro:
        'Quienes participaron en el caso. Marcá a quién agradecerle: le llega a Actividad y nadie más lo ve.',
      sinParticipantes: 'Nadie más participó en el caso.',
      /** Cómo participó cada persona: "Avisó que lo vio · Te escribió". */
      comoAyudo: { vio: 'Avisó que lo vio', resguardo: 'Lo resguardó', escribio: 'Te escribió' },
      yaAgradeciste: 'Ya le agradeciste',
      mensaje: 'Mensaje (opcional)',
      mensajePlaceholder: '¡Gracias por avisar!',
      mensajeAyuda: 'Les llega a todos los que marques. Los teléfonos, links y emails se tapan.',
      publicar: 'Publicar la historia',
      guardar: 'Guardar los cambios',
      soloAgradecer: 'Agradecer',
      nadaQueGuardar: 'Escribí cómo volvió o marcá a quién agradecerle.',
      fraseVacia: 'Para sacar la historia del muro, tocá Borrar la historia.',
      fraseLarga: 'La historia puede tener hasta 280 caracteres.',
      mensajeLargo: 'El mensaje puede tener hasta 280 caracteres.',
      exitoHistoria: '¡Gracias por contarlo! Ya está en el muro.',
      exitoAgradecer: 'Listo: les llegó tu agradecimiento.',
      errorFoto: 'No pudimos subir la foto. Probá de nuevo.',
      borrar: 'Borrar la historia',
      borrarTitulo: '¿Borrar la historia?',
      borrarDetalle: 'Sale del muro y se borra su foto. Los agradecimientos que mandaste quedan.',
      borrarBoton: 'Borrar la historia',
      borrada: 'Listo: borramos la historia.',
      errorBorrarFotos: 'No pudimos borrar la foto. Probá de nuevo.',
      soloFamilia: 'Solo la familia puede contar cómo volvió, con el caso cerrado como reunido.',
    },
  },
  mensajes: {
    titulo: 'Mensajes',
    requiereCuenta: 'Para enviar mensajes necesitás una cuenta.',
    escribir: 'Escribir',
    elegirDestinatario: '¿A quién le querés escribir?',
    escribirAPublicador: 'Escribirle a quien publicó',
    escribirAFamilia: 'Escribirle a su familia',
    escribirAResguardo: 'Escribirle a quien lo resguarda',
    /** En el historial, junto al aviso de alguien que lo vio. */
    escribirle: 'Escribirle',
    escribirleA: (nombre: string) => `Escribirle a ${nombre}`,
    publicacionNoDisponible: 'Publicación no disponible',
    publicacionOcultada:
      'Esta publicación fue ocultada por moderación. Nunca pagues ni compartas datos de tu tarjeta.',
    aviso:
      'Hablás dentro de la app: tu email y tu teléfono no se comparten. Compartí solo lo que quieras.',
    vacio: 'Todavía no hay mensajes. Escribí el primero.',
    placeholder: 'Escribí un mensaje…',
    enviar: 'Enviar',
    verReporte: 'Ver el reporte',
    masOpciones: 'Más opciones',
    aceptarParaEscribir: 'Para escribir, aceptá los términos de uso y la política de privacidad.',
    verYAceptar: 'Ver y aceptar',
  },
  bloqueos: {
    bloquear: (nombre: string) => `Bloquear a ${nombre}`,
    desbloquear: (nombre: string) => `Desbloquear a ${nombre}`,
    confirmarTitulo: (nombre: string) => `¿Bloquear a ${nombre}?`,
    confirmarDetalle:
      'No va a poder escribirte ni abrir conversaciones con vos, y no te van a llegar sus avisos. No le avisamos. Lo podés deshacer cuando quieras, desde acá o desde Perfil.',
    confirmar: 'Bloquear',
    bloqueaste: (nombre: string) =>
      `Bloqueaste a ${nombre}. Para volver a escribirle, desbloqueá a esta persona.`,
    noPodes: 'No podés escribir en esta conversación.',
  },
  moderacion: {
    titulo: 'Moderación',
    intro: 'Denuncias recibidas. Ocultar una publicación la saca del mapa sin borrarla.',
    soloModeradores: 'Esta pantalla es solo para moderadores.',
    vacio: 'No hay denuncias.',
    oculta: 'Oculta',
    ocultar: 'Ocultar publicación',
    mostrar: 'Volver a mostrar',
    marcarRevisada: 'Marcar revisada',
    descartar: 'Descartar',
    abrirPanel: 'Panel de moderación',
    cuentaNueva: 'Cuenta nueva',
    cuentaNuevaAyuda:
      'La cuenta tenía menos de 7 días: no cuenta para ocultar sola la publicación.',
    /** Una denuncia de la historia de un reencuentro, no del caso. */
    historia: 'Historia del reencuentro',
    ocultarHistoria: 'Ocultar la historia',
    mostrarHistoria: 'Volver a mostrar la historia',
    verHistoria: 'Ver la historia',
  },
  /** Moderación › Reconocimiento (servicio de visión). */
  reconocimiento: {
    titulo: 'Reconocimiento',
    intro:
      'La inteligencia artificial describe cada foto nueva, la compara con los casos cercanos de la misma especie y sugiere posibles coincidencias. Siempre confirma una persona.',
    estado: 'Estado',
    configurado: 'Configurado',
    sinConfigurar: 'Sin configurar',
    apagado: 'Apagado',
    pausado: 'Pausado: sin crédito',
    sinConfigurarAyuda:
      'Falta conectar la función de reconocimiento: cargar su dirección y su secreto en Supabase (README, "Servicio de reconocimiento").',
    apagadoAyuda:
      'El reconocimiento está apagado (config_app.ia_activa). Ninguna foto se analiza hasta volver a prenderlo.',
    pausadoAyuda:
      'El servicio de IA se quedó sin crédito y el reconocimiento se pausó. Cargá crédito y tocá Reactivar: las fotos que esperan se procesan solas.',
    reactivar: 'Reactivar',
    reactivado:
      'Listo: el reconocimiento sigue. Las fotos que esperaban se procesan en unos minutos.',
    llamadasHoy: 'Llamadas a la IA hoy',
    /** "12 de 300" */
    deTope: (n: number, tope: number) => `${n} de ${tope}`,
    topeAlcanzado:
      'Llegó al tope de llamadas del día: las fotos nuevas esperan a mañana (hora de Montevideo).',
    costoMes: 'Costo estimado del mes',
    /** "US$ 0,42"; lo chico, "Menos de US$ 0,01". */
    costo: (usd: number): string => {
      if (usd <= 0) return 'US$ 0';
      if (usd < 0.01) return 'Menos de US$ 0,01';
      return `US$ ${usd.toFixed(2).replace('.', ',')}`;
    },
    costoAyuda: 'Estimado con los precios del servicio de IA; el valor exacto está en su cuenta.',
    erroresIa: 'Errores de la IA',
    erroresHoy: (n: number) => (n === 1 ? '1 hoy' : `${n} hoy`),
    sinErrores: 'Ninguno en la última semana.',
    tipoLlamada: {
      describir: 'Describir',
      comparar: 'Comparar',
    } satisfies Record<TipoLlamadaIa, string>,
    errorLlamada: {
      invalida: 'Respuesta que no se pudo usar',
      limite: 'Límite de pedidos',
      sobrecarga: 'El servicio de IA estaba sobrecargado',
      sin_credito: 'Sin crédito',
      error: 'Error del servicio de IA',
    } satisfies Record<ErrorLlamadaIa, string>,
    /** "Hoy a las 14:05 · Comparar · Sin crédito" */
    filaError: (cuando: string, tipo: string, error: string) => `${cuando} · ${tipo} · ${error}`,
    pendientes: 'Fotos pendientes',
    /** Debajo de las pendientes: las que fallaron y esperan su próximo intento. */
    reintentando: (n: number) =>
      n === 1 ? '1 espera un nuevo intento' : `${n} esperan un nuevo intento`,
    conError: 'Fotos con error',
    conErrorAyuda: 'Fallaron 8 veces y ya no se reintentan solas.',
    ultimaProcesada: 'Última foto procesada',
    ultimaCoincidencia: 'Última coincidencia',
    nunca: 'Todavía ninguna',
    procesar: 'Procesar pendientes ahora',
    enviado:
      'Le avisamos a la función de reconocimiento. Esta pantalla se actualiza sola mientras procesa.',
    sinPendientes: 'No hay fotos pendientes.',
  },
  estadoDenuncia: {
    pendiente: 'Pendiente',
    revisada: 'Revisada',
    descartada: 'Descartada',
  } satisfies Record<EstadoDenuncia, string>,
  motivoDenuncia: {
    spam: 'Spam o publicidad',
    contenido_inapropiado: 'Contenido inapropiado',
    informacion_falsa: 'Información falsa',
    maltrato: 'Maltrato animal',
    otro: 'Otro',
  } satisfies Record<MotivoDenuncia, string>,
  publicar: {
    titulo: 'Publicar',
    elegirTipo: '¿Qué te pasó?',
    tipos: {
      perdido: {
        titulo: 'Perdí a mi animal',
        detalle: 'Publicalo para que te avisen si lo ven o si alguien encuentra uno parecido.',
      },
      encontrado: {
        titulo: 'Encontré un animal',
        detalle: 'Ayudá a que vuelva con su familia.',
      },
    } satisfies Record<TipoReporte, { titulo: string; detalle: string }>,
    intro:
      'Subí una foto y marcá dónde lo viste. Cuanto más detalle, más fácil es que lo reconozcan.',
    introPerdido:
      'Subí una foto reciente y contá dónde lo vieron por última vez. Te avisamos si alguien lo ve o encuentra uno parecido.',
    nombre: 'Nombre',
    nombrePlaceholder: 'Cómo se llama (opcional)',
    senas: 'Señas particulares',
    senasPlaceholder: 'Manchas, cicatrices, si responde a su nombre…',
    cuandoPerdido: '¿Cuándo se perdió?',
    cuandoPerdidoOpciones: {
      hoy: 'Hoy',
      ayer: 'Ayer',
      hace2d: 'Hace 2 días',
      hace3d: 'Hace 3 días',
      semana: 'Hace una semana',
      dosSemanas: 'Hace dos semanas',
    },
    ubicacionPerdido: '¿Dónde lo vieron por última vez?',
    ubicacionPerdidoAyuda:
      'No hace falta marcar tu casa exacta: alcanza con la cuadra o la zona. Igual guardamos el punto aproximado, a unos 100 m.',
    contactoFamilia: 'Contacto que querés mostrar (opcional)',
    contactoFamiliaPlaceholder: 'Ej: WhatsApp 099 123 456 o "escribime por la app"',
    contactoFamiliaAyuda:
      'Lo ve cualquiera que abra el reporte. También te pueden escribir por la app sin que muestres nada.',
    foto: 'Foto',
    fotoObligatoria: 'La foto es obligatoria.',
    sacarFoto: 'Sacar foto',
    elegirGaleria: 'Elegir de la galería',
    cambiarFoto: 'Cambiar foto',
    permisoCamara: 'Necesitamos permiso para usar la cámara. Podés habilitarlo en Ajustes.',
    permisoGaleria: 'Necesitamos permiso para ver tus fotos. Podés habilitarlo en Ajustes.',
    especie: '¿Qué animal es?',
    tamanio: 'Tamaño',
    color: 'Color',
    colorPlaceholder: 'Ej: marrón con pecho blanco',
    collar: '¿Tiene collar o chapita?',
    descripcion: 'Descripción',
    descripcionPlaceholder: 'Cómo se comporta, dónde estaba, señas particulares…',
    cuando: '¿Cuándo lo viste?',
    cuandoOpciones: {
      ahora: 'Recién',
      hace1h: 'Hace 1 h',
      hace3h: 'Hace 3 h',
      hoy: 'Hoy temprano',
      ayer: 'Ayer',
    },
    ubicacion: '¿Dónde lo viste?',
    usarGps: 'Usar mi ubicación',
    elegirMapa: 'Elegir en el mapa',
    ubicacionMarcada: 'Ubicación marcada',
    ubicacionFaltante: 'Marcá dónde lo viste.',
    permisoUbicacion: 'No pudimos acceder a tu ubicación. Podés elegir el punto en el mapa.',
    publicar: 'Publicar',
    publicando: 'Publicando…',
    exito: '¡Publicado! Gracias por ayudar.',
    requiereCuenta: 'Para publicar necesitás una cuenta.',
    selectorMapa: {
      titulo: 'Mové el mapa hasta el punto exacto',
      confirmar: 'Confirmar ubicación',
    },
  },
  auth: {
    ingresar: 'Ingresar',
    registrarse: 'Crear cuenta',
    salir: 'Cerrar sesión',
    requiereCuentaTitulo: 'Necesitás una cuenta',
    email: 'Email',
    emailPlaceholder: 'vos@ejemplo.com',
    contrasena: 'Contraseña',
    contrasenaPlaceholder: 'Mínimo 8 caracteres',
    nombre: 'Nombre público',
    nombrePlaceholder: 'Cómo te van a ver los demás',
    nombreAyuda: 'No mostramos tu email ni tu teléfono a nadie.',
    conGoogle: 'Continuar con Google',
    /**
     * El botón de Google en Ingresar y Registrarse (web). El botón lo dibuja
     * Google, con su texto ("Continuar con Google", en español).
     */
    google: {
      /** En el navegador de WhatsApp, Instagram o Facebook, Google no deja ingresar. */
      navegadorInterno: (app: string) =>
        `Para entrar con Google, abrí este link en Chrome o Safari: Google no deja hacerlo desde el navegador de ${app}. Con email y contraseña podés seguir acá.`,
    },
    olvidaste: '¿Olvidaste tu contraseña?',
    aceptoTerminos: 'Leí y acepto los términos de uso y la política de privacidad.',
    recuperar: {
      titulo: 'Recuperar tu contraseña',
      intro:
        'Escribí el email de tu cuenta y te mandamos un link para elegir una contraseña nueva.',
      enviar: 'Mandar el link',
      // Neutro: no dice si el email tiene cuenta.
      enviado:
        'Si hay una cuenta con ese email, te mandamos un link. Revisá tu casilla y el correo no deseado. Sirve una sola vez y vence en una hora.',
      volver: 'Volver a ingresar',
      error: 'No pudimos mandar el link. Probá de nuevo.',
      muchosPedidos: 'Pediste varios links seguidos. Esperá unos minutos y probá de nuevo.',
    },
    nuevaContrasena: {
      titulo: 'Elegí una contraseña nueva',
      intro: 'Tiene que tener al menos 8 caracteres.',
      contrasena: 'Contraseña nueva',
      repetir: 'Repetí la contraseña',
      guardar: 'Guardar contraseña',
      /** El email enmascarado (e***@gmail.com) de la cuenta del link. */
      cuenta: (email: string) => `Es para la cuenta ${email}.`,
      noEsMiCuentaAyuda:
        'Si no la reconocés o no pediste este link, no elijas nada: tocá "No es mi cuenta".',
      noEsMiCuenta: 'No es mi cuenta',
      exito: 'Listo: tu contraseña cambió y ya ingresaste.',
      exitoSinSesion: 'Listo: tu contraseña cambió. Ingresá con la nueva.',
      noCoinciden: 'Las dos contraseñas no coinciden.',
      igualAnterior: 'Elegí una contraseña distinta de la anterior.',
      linkVencido: 'Este link ya no sirve: venció o ya se usó. Pedí uno nuevo.',
      pedirOtro: 'Pedir otro link',
      irAlMapa: 'Ir al mapa',
    },
    /** La comprobación de Cloudflare Turnstile al registrarse, ingresar y recuperar la contraseña. */
    captcha: {
      falta:
        'Esperá a que termine la comprobación de seguridad, arriba del botón, y probá de nuevo.',
      error: 'No pudimos cargar la comprobación de seguridad. Revisá la conexión y probá de nuevo.',
    },
    o: 'o',
    sinCuenta: '¿No tenés cuenta?',
    conCuenta: '¿Ya tenés cuenta?',
    registroExito: 'Cuenta creada. Si te pedimos confirmar el email, revisá tu casilla.',
    /** /auth/confirmar: el link de un mail (confirmar la cuenta, el email o recuperar la contraseña). */
    confirmar: {
      titulo: 'Tu cuenta',
      comprobando: 'Comprobando el link…',
      cuentaConfirmada: 'Tu cuenta está confirmada. Ingresá con tu email y tu contraseña.',
      emailCambiado: 'Listo: confirmaste el email nuevo. Desde ahora ingresás con ese.',
      faltaElOtroEmail:
        'Confirmado. Falta un paso: abrí también el link que te mandamos al otro email.',
      vencidoCuenta:
        'Este link ya no sirve: venció o ya se usó. Si ya confirmaste tu cuenta, ingresá. Si no, volvé a crearla con el mismo email y te mandamos otro.',
      vencidoEmail:
        'Este link ya no sirve: venció o ya se usó. Si todavía querés cambiar el email, pedilo de nuevo.',
      invalido: 'Este link no sirve. Abrí el último que te mandamos por mail.',
      errorServidor: 'No pudimos comprobar el link. Probá de nuevo en un rato.',
      reintentar: 'Probar de nuevo',
    },
    errores: {
      credenciales: 'Email o contraseña incorrectos.',
      emailNoConfirmado: 'Tenés que confirmar tu email antes de ingresar.',
      yaRegistrado: 'Ya hay una cuenta con ese email.',
      contrasenaCorta: 'La contraseña tiene que tener al menos 8 caracteres.',
      emailInvalido: 'Ese email no parece válido.',
      nombreCorto: 'Poné un nombre de al menos 2 caracteres.',
      debeAceptar:
        'Para crear la cuenta tenés que aceptar los términos de uso y la política de privacidad.',
      googleCancelado: 'Se canceló el ingreso con Google.',
      captcha: 'No pudimos comprobar que sos una persona. Probá de nuevo.',
      muchosIntentos: 'Hubo muchos intentos seguidos. Esperá unos minutos y probá de nuevo.',
      desconocido: 'No pudimos ingresar. Probá de nuevo.',
    },
  },
  perfil: {
    titulo: 'Perfil',
    hola: (nombre: string) => `Hola, ${nombre}`,
    sinCuenta: 'Con una cuenta podés publicar animales y avisar cuando ves uno.',
    privacidad: 'Tu email no se muestra a nadie. Solo se ve tu nombre público.',
    version: (v: string) => `Versión ${v}`,
    misReportes: 'Mis reportes',
    sinReportes: 'Todavía no publicaste ningún animal.',
    verCasoPrincipal: 'tocá para ver el caso principal',
    apariencia: 'Apariencia',
    aparienciaOpciones: {
      automatico: 'Automático',
      claro: 'Claro',
      oscuro: 'Oscuro',
    },
    aparienciaAyuda: 'Automático sigue la configuración de tu teléfono o computadora.',
    editar: 'Editar perfil',
    fotoDe: (nombre: string) => `Foto de ${nombre}`,
    bloqueados: 'Personas bloqueadas',
    bloqueadosAyuda:
      'No pueden escribirte ni abrir conversaciones con vos, y no te llegan sus avisos.',
    sinBloqueados: 'No bloqueaste a nadie.',
    desbloquear: 'Desbloquear',
    legal: 'Términos y privacidad',
    borrarCuenta: 'Borrar mi cuenta',
    /** Sección con "Instalar la app" y "Reportar un error". */
    laApp: 'La app',
    reencuentros: 'Reencuentros',
    verReencuentros: 'Ver las historias',
    /** Solo cuenta lo que una familia agradeció (familias_que_ayude). */
    ayudaste: (n: number) =>
      n === 1 ? 'Ayudaste a reunir a 1 familia.' : `Ayudaste a reunir a ${n} familias.`,
  },
  instalar: {
    boton: 'Instalar la app',
    ayuda: 'Queda en tu pantalla de inicio y se abre como cualquier app.',
    entendido: 'Entendido',
    ios: {
      titulo: 'Agregala a tu pantalla de inicio',
      compartir: 'Tocá Compartir. En el iPhone está abajo; en el iPad, arriba a la derecha.',
      agregarAInicio: 'Bajá y elegí "Agregar a inicio".',
      agregar: `Tocá "Agregar". ${NOMBRE} queda en tu pantalla de inicio.`,
    },
    navegadorInterno: {
      titulo: 'Abrila en Chrome o Safari',
      /** "El navegador de WhatsApp no deja instalar apps…". */
      explicacion: (app: string) =>
        `El navegador de ${app} no deja instalar apps. Tocá los tres puntos o Compartir y elegí "Abrir en el navegador", o copiá el link y pegalo en Chrome (Android) o Safari (iPhone).`,
      /** Si no se sabe cuál es la app. */
      estaApp: 'esta app',
    },
  },
  errores: {
    boton: 'Reportar un error',
    enviado: 'Gracias. Tu reporte le llegó a moderación.',
    enviadoConCuenta: 'Gracias. Te avisamos en Actividad cuando lo resolvamos.',
    formulario: {
      titulo: 'Reportar un error',
      intro: `Contanos qué anda mal. Lo leen las personas que moderan ${NOMBRE}.`,
      quePaso: '¿Qué pasó?',
      quePasoPlaceholder: 'Por ejemplo: toqué "Lo vi" y no pasó nada.',
      queHacias: '¿Qué estabas haciendo? (opcional)',
      queHaciasPlaceholder: 'Por ejemplo: quería avisar que vi un perro en la rambla.',
      captura: 'Captura de pantalla (opcional)',
      elegirCaptura: 'Elegir una captura',
      cambiarCaptura: 'Cambiar la captura',
      quitarCaptura: 'Quitar la captura',
      contacto: 'Tu contacto (opcional)',
      contactoPlaceholder: 'Email o teléfono, si querés que te respondamos',
      contactoAyuda: 'Solo lo ven los moderadores, para responderte. No aparece en la app.',
      seSuma: 'Además mandamos estos datos, para encontrar el error:',
      ninguna: 'ninguna',
      enviar: 'Mandar el reporte',
      quePasoCorto: (n: number) => `Contá qué pasó con al menos ${n} caracteres.`,
      demasiadoLargo: (n: number) => `Puede tener hasta ${n} caracteres.`,
      contactoConCuenta: 'Con tu cuenta te avisamos en Actividad: no hace falta un contacto.',
      errorCaptura: 'No pudimos subir la captura. Probá de nuevo o mandalo sin captura.',
    },
    /** Los datos que suma la app, en el formulario y en el panel. */
    datos: {
      pantallaAnterior: 'Pantalla anterior',
      navegador: 'Navegador y sistema',
      tamanioPantalla: 'Tamaño de pantalla',
      plataforma: 'Plataforma',
      version: 'Versión',
    },
    plataforma: {
      web: 'Web',
      ios: 'iPhone o iPad',
      android: 'Android',
    } satisfies Record<Plataforma, string>,
    moderacion: {
      denuncias: 'Denuncias',
      errores: 'Errores',
      pendientes: 'Pendientes',
      resueltos: 'Resueltos',
      /** La etiqueta de cada reporte. */
      pendiente: 'Pendiente',
      resueltoEtiqueta: 'Resuelto',
      sinPendientes: 'No hay errores pendientes.',
      sinResueltos: 'Todavía no se resolvió ningún error.',
      sinCuenta: 'Sin cuenta',
      queHacias: 'Qué estaba haciendo',
      contacto: 'Contacto',
      verCaptura: 'Ver la captura',
      captura: 'Captura de pantalla del reporte',
      errorCaptura: 'No pudimos mostrar la captura.',
      nota: 'Nota para quien lo reportó (opcional)',
      notaAyuda: 'Si lo mandó con su cuenta, le llega en Actividad.',
      marcarResuelto: 'Marcar como resuelto',
      /** "Resuelto por Valentina, 20/10 14:05". */
      resuelto: (quien: string, cuando: string) => `Resuelto por ${quien}, ${cuando}`,
      notaGuardada: 'Nota',
    },
  },
  cuenta: {
    editar: {
      titulo: 'Editar perfil',
      foto: 'Foto de perfil',
      fotoAyuda: 'Es opcional. La ve cualquiera que vea tu nombre.',
      quitarFoto: 'Quitar la foto',
      nombreAyuda: 'De 2 a 40 caracteres. Es lo que ven los demás.',
      nombreInvalido: 'El nombre tiene que tener entre 2 y 40 caracteres.',
      guardar: 'Guardar cambios',
      exito: 'Listo, guardamos tus cambios.',
    },
    borrar: {
      titulo: 'Borrar mi cuenta',
      intro: 'Tu cuenta se borra para siempre y no se puede recuperar.',
      seBorra: 'Se borra siempre',
      seBorraLista: [
        'Tu perfil: tu nombre público y tu foto.',
        'Tus animales perdidos, aunque sigan abiertos: sin vos nadie podría cerrarlos ni confirmar si alguien los encontró, y quedarían en el mapa para siempre.',
        'Tus casos cerrados y lo que aportaste a casos cerrados.',
        'Lo que seguís, tus notificaciones y tus mensajes.',
        'Las denuncias que hiciste y las personas que bloqueaste.',
        'Cualquier contacto que hayas compartido en un caso.',
      ],
      /** Si tiene perdidos abiertos, se lo decimos antes de que confirme. */
      perdidosAviso: (n: number) =>
        n === 1
          ? 'Tenés 1 animal perdido publicado: se va a borrar aunque elijas dejar publicado lo demás.'
          : `Tenés ${n} animales perdidos publicados: se van a borrar aunque elijas dejar publicado lo demás.`,
      abiertos: '¿Qué hacemos con tus encontrados abiertos y lo que aportaste a casos de otros?',
      abiertosCantidad: (n: number) =>
        n === 1
          ? 'Tenés 1 animal encontrado abierto.'
          : `Tenés ${n} animales encontrados abiertos.`,
      opciones: {
        conservar: {
          titulo: 'Dejarlo publicado sin mi nombre',
          detalle:
            'Recomendado: así no se pierde nada que pueda ayudar a una familia que busca. Se ve como de una cuenta eliminada y nadie te puede escribir.',
        },
        borrar: {
          titulo: 'Borrarlo',
          detalle:
            'Se borran tus encontrados abiertos, con todo lo que tienen, y tus avisos y fotos en casos de otros.',
        },
      },
      confirmo: 'Entiendo que no se puede deshacer.',
      boton: 'Borrar mi cuenta para siempre',
      borrandoFotos: 'Borrando tus fotos…',
      borrandoCuenta: 'Borrando tu cuenta…',
      errorFotos: 'No pudimos borrar todas tus fotos. Tu cuenta sigue igual: probá de nuevo.',
    },
  },
  /**
   * BORRADOR: términos de uso y política de privacidad para que los revise el
   * dueño del proyecto. No es asesoramiento legal. Los datos entre corchetes
   * hay que completarlos. Al cambiar estos textos, subí VERSION_TERMINOS en
   * src/features/legal/terminos.ts y config_app.terminos_version en una migración.
   */
  legal: {
    borrador: 'Borrador',
    borradorAviso:
      'Este texto es un borrador: todavía no fue revisado y puede cambiar antes de la versión final.',
    version: (fecha: string) => `Versión del ${fecha}`,
    leerTerminos: 'Leer los términos de uso',
    leerPrivacidad: 'Leer la política de privacidad',
    aceptar: {
      titulo: 'Antes de seguir',
      intro:
        'Para publicar, avisar que lo viste, escribir o denunciar, aceptá los términos de uso y la política de privacidad.',
      cambiaron:
        'Actualizamos los términos de uso y la política de privacidad. Leelos y aceptalos para seguir.',
      aceptar: 'Aceptar y seguir',
      falta: 'Marcá la casilla para seguir.',
    },
    terminos: {
      titulo: 'Términos de uso',
      intro: `${NOMBRE} ayuda a que los animales perdidos vuelvan con sus familias en Montevideo. Al usar la app aceptás estas reglas.`,
      secciones: [
        {
          titulo: `Qué es ${NOMBRE}`,
          parrafos: [
            'Una app gratuita donde cualquiera puede publicar un animal perdido o encontrado, avisar que lo vio y hablar con otras personas para que vuelva a su casa.',
            'No somos un refugio ni una veterinaria, y no podemos garantizar que un animal aparezca.',
          ],
        },
        {
          titulo: 'Tu cuenta',
          parrafos: [
            'Para publicar, avisar que viste un animal, escribir o denunciar necesitás una cuenta. Usá un nombre que no confunda, cuidá tu contraseña y no te hagas pasar por otra persona.',
            'Si sos menor de 18 años, usá la app con un adulto responsable.',
          ],
        },
        {
          titulo: 'Qué es público',
          parrafos: [
            'Lo que publicás en un caso lo ve cualquiera, con o sin cuenta: las fotos, la descripción, el lugar y la fecha, tu nombre público y el contacto que decidas mostrar.',
            'Tu email y tu teléfono no se muestran nunca. Ver la política de privacidad.',
          ],
        },
        {
          titulo: 'Qué no está permitido',
          parrafos: [
            'Pedir plata para devolver un animal, publicar datos falsos, vender animales, hacer spam, acosar o insultar, y publicar datos de otras personas sin su permiso.',
            'Nunca pagues para recuperar a un animal. Si alguien te pide plata o datos de tu tarjeta, denuncialo.',
          ],
        },
        {
          titulo: 'Denuncias, moderación y bloqueos',
          parrafos: [
            'Podés denunciar una publicación y bloquear a quien te moleste. El equipo de moderación puede ocultar lo que no cumpla estas reglas y suspender cuentas.',
            'Una publicación se oculta sola si la denuncian tres cuentas con más de una semana, hasta que alguien la revise.',
          ],
        },
        {
          titulo: 'Encuentros y coincidencias',
          parrafos: [
            `${NOMBRE} pone en contacto a personas, pero no verifica cada publicación ni participa en los encuentros. Encontrate en lugares públicos y, si podés, acompañado.`,
            'Las coincidencias que sugiere el reconocimiento de imágenes son solo sugerencias: siempre decide una persona.',
          ],
        },
        {
          titulo: 'Borrar tu cuenta',
          parrafos: [
            'La podés borrar cuando quieras desde Perfil. Qué se borra y qué puede quedar publicado sin tu nombre está en la política de privacidad.',
          ],
        },
        {
          titulo: 'Cambios y contacto',
          parrafos: [
            'Si cambiamos estas reglas, te vamos a pedir que las aceptes de nuevo antes de publicar, escribir o denunciar.',
            'Por consultas, escribinos a [email de contacto, a completar].',
          ],
        },
      ],
    },
    privacidad: {
      titulo: 'Política de privacidad',
      intro:
        'Esta política explica qué datos tuyos guardamos, para qué y cómo podés pedir que los corrijamos o los borremos, según la Ley 18.331 de Protección de Datos Personales de Uruguay.',
      secciones: [
        {
          titulo: 'Quién es responsable',
          parrafos: [
            `El responsable de la base de datos de ${NOMBRE} es [nombre o razón social, documento y domicilio, a completar]. Por cualquier consulta sobre tus datos, escribinos a [email de contacto, a completar].`,
          ],
        },
        {
          titulo: 'Qué datos guardamos y para qué',
          parrafos: [
            'Cuenta: tu email y tu contraseña (guardada cifrada), o los datos básicos que da Google si entrás con Google. Sirven para que entres y recuperes tu contraseña. No se muestran a nadie.',
            'Perfil: tu nombre público y, si la subís, tu foto de perfil. Sirven para que los demás sepan con quién hablan.',
            'Casos y avisos: las fotos, la descripción, el lugar y la fecha de cada animal que publicás o ves, y el contacto que elijas compartir. Sirven para buscar al animal y reunirlo con su familia.',
            'Mensajes: lo que escribís en las conversaciones. Solo lo ven las dos personas de la conversación.',
            'Actividad: los casos que seguís, tus avisos, tus denuncias, las personas que bloqueaste y, en el celular, el identificador para mandarte notificaciones.',
            'Términos: qué versión de los términos y de esta política aceptaste, y cuándo.',
          ],
        },
        {
          titulo: 'Qué es público',
          parrafos: [
            'Las fotos y las ubicaciones de los casos son públicas: las ve cualquiera, con o sin cuenta, y otras personas pueden guardarlas o compartirlas. Junto a cada publicación se ve tu nombre público.',
            'En los perdidos guardamos la ubicación redondeada a unos 100 metros, porque suele ser cerca de tu casa. El contacto de quien resguarda un animal perdido lo ven solo su familia y esa persona.',
          ],
        },
        {
          titulo: 'Reconocimiento de imágenes',
          parrafos: [
            'Las fotos de los casos se analizan con un servicio de inteligencia artificial de Anthropic, que describe al animal y lo compara con casos cercanos para sugerir posibles coincidencias. Las sugerencias las confirma siempre una persona: nada se une solo.',
            'A Anthropic le mandamos solo las fotos y los datos del animal (especie, tamaño, color y si tiene collar). Nunca tu nombre, tu email, tu contacto ni tus mensajes.',
          ],
        },
        {
          titulo: 'Con quién compartimos datos',
          parrafos: [
            'No vendemos tus datos. Los guardan los servicios que usamos para que la app funcione: Supabase (datos y fotos), Vercel (la web), Anthropic (el análisis de las fotos con inteligencia artificial) y Expo (notificaciones en el celular). Algunos de sus servidores están fuera de Uruguay.',
            'Solo entregamos datos a una autoridad cuando la ley lo exige.',
          ],
        },
        {
          titulo: 'Cómo borrar tu cuenta',
          parrafos: [
            'En Perfil, tocá «Borrar mi cuenta». Se borran tu perfil, tus animales perdidos (aunque sigan abiertos), tus casos cerrados, lo que seguís, tus notificaciones, tus mensajes, tus denuncias, tus bloqueos y cualquier contacto que hayas compartido.',
            'Con tus encontrados abiertos y lo que aportaste a casos de otros elegís: dejarlos publicados sin tu nombre, para no perjudicar a una familia que busca, o borrarlos. Las fotos de lo que se borra se borran también.',
            'Mientras tengas la cuenta, guardamos tus datos para que la app funcione.',
          ],
        },
        {
          titulo: 'Tus derechos',
          parrafos: [
            'Tenés derecho a saber qué datos tuyos tenemos (acceso), a corregirlos o completarlos (rectificación, actualización e inclusión) y a que los borremos (supresión).',
            'Muchos los podés usar desde la app: editar tu perfil o borrar tu cuenta. Para lo demás, escribinos desde el email de tu cuenta a [email de contacto, a completar] y te respondemos dentro de los plazos que fija la ley.',
            'Si no te respondemos, podés reclamar ante la Unidad Reguladora y de Control de Datos Personales (URCDP).',
          ],
        },
        {
          titulo: 'Seguridad y cambios',
          parrafos: [
            'Usamos conexiones cifradas y permisos en la base de datos para que cada persona vea solo lo que le corresponde. Ningún sistema es infalible: si notás algo raro, avisanos.',
            'Si cambia esta política, te vamos a pedir que la aceptes de nuevo.',
          ],
        },
      ],
    },
  },
  fechas: {
    ahora: 'recién',
    haceMinutos: (n: number) => (n === 1 ? 'hace 1 minuto' : `hace ${n} minutos`),
    haceHoras: (n: number) => (n === 1 ? 'hace 1 hora' : `hace ${n} horas`),
    haceDias: (n: number) => (n === 1 ? 'ayer' : `hace ${n} días`),
    haceSemanas: (n: number) => (n === 1 ? 'hace 1 semana' : `hace ${n} semanas`),
    hoy: 'hoy',
    ayer: 'ayer',
    /** "el sábado 17" */
    elDiaDeLaSemana: (dia: string, numero: string) => `el ${dia} ${numero}`,
    /** "el 3 de octubre" */
    elDiaDelMes: (numero: string, mes: string) => `el ${numero} de ${mes}`,
    hoyALas: (hora: string) => `Hoy a las ${hora}`,
    ayerALas: (hora: string) => `Ayer a las ${hora}`,
    diaALas: (dia: string, hora: string) => `${dia} a las ${hora}`,
    /** "19 de octubre de 2026" */
    fechaLarga: (numero: string, mes: string, anio: string) => `${numero} de ${mes} de ${anio}`,
  },
} as const;

/** "perro", "gato", "animal": la especie dentro de una oración. */
const nombreEspecie: Record<Especie, string> = { perro: 'perro', gato: 'gato', otro: 'animal' };

/** "perro marrón", "gato mediano", "animal": el animal dentro de una oración. */
function animalEnFrase(caso: Pick<DatosCompartir, 'especie' | 'color' | 'tamanio'>): string {
  const especie = nombreEspecie[caso.especie];
  if (caso.color) return `${especie} ${caso.color.toLowerCase()}`;
  if (caso.tamanio) return `${especie} ${t.tamanio[caso.tamanio].toLowerCase()}`;
  return especie;
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
