/**
 * Todos los textos de la interfaz, en español rioplatense (voseo).
 * Ningún componente escribe texto visible inline: lo importa de acá.
 */

import type {
  DatosCompartir,
  Especie,
  EstadoAnimal,
  EstadoDenuncia,
  MotivoDenuncia,
  Tamanio,
  TipoAvistamiento,
  TipoReporte,
} from '@/types/dominio';

export const t = {
  app: {
    nombre: 'Encontrados',
    lema: 'Animales encontrados en Montevideo',
    /** Título de la pestaña del navegador. */
    tituloWeb: 'Encontrados · Animales encontrados en Montevideo',
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
    atribucion: '© OpenFreeMap · © OpenMapTiles · Datos de OpenStreetMap',
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
    novedades: 'Novedades del caso',
    masOpciones: 'Más opciones',
    avisoEstafa:
      'Nunca pagues para recuperar a un animal. Si alguien te pide plata o datos de tu tarjeta, denuncialo.',
    noEncontrado: 'No encontramos este reporte. Puede que lo hayan cerrado.',
    conCollar: 'Con collar',
    sinCollar: 'Sin collar',
    historial: 'Historial',
    avistamientos: (n: number) => (n === 1 ? '1 avistamiento' : `${n} avistamientos`),
    vinculadoAviso: 'Este reporte se unió a otro del mismo animal. Te llevamos al caso principal.',
    casoCerrado: 'Este caso está cerrado: el animal volvió con su familia.',
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
              ? 'Si lo viste, avisá en Encontrados.'
              : 'Si sabés de quién es, avisá en Encontrados.';
        return `${datos}. ${pedido}`;
      },
      tituloGenerico: 'Encontrados',
      descripcionGenerica:
        'Animales perdidos y encontrados en Montevideo. Si viste uno, avisá: así vuelve a casa.',
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
    olvidaste: '¿Olvidaste tu contraseña?',
    aceptoTerminos: 'Leí y acepto los términos de uso y la política de privacidad.',
    recuperar: {
      titulo: 'Recuperar tu contraseña',
      intro:
        'Escribí el email de tu cuenta y te mandamos un link para elegir una contraseña nueva.',
      enviar: 'Mandar el link',
      // Neutro: no dice si el email tiene cuenta.
      enviado:
        'Si hay una cuenta con ese email, te mandamos un link. Revisá tu casilla y el correo no deseado. El link sirve una sola vez y vence en una hora.',
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
      exito: 'Listo: tu contraseña cambió y ya ingresaste.',
      noCoinciden: 'Las dos contraseñas no coinciden.',
      igualAnterior: 'Elegí una contraseña distinta de la anterior.',
      linkVencido: 'Este link ya no sirve: venció o ya se usó. Pedí uno nuevo.',
      pedirOtro: 'Pedir otro link',
      irAlMapa: 'Ir al mapa',
    },
    o: 'o',
    sinCuenta: '¿No tenés cuenta?',
    conCuenta: '¿Ya tenés cuenta?',
    registroExito: 'Cuenta creada. Si te pedimos confirmar el email, revisá tu casilla.',
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
      intro:
        'Encontrados ayuda a que los animales perdidos vuelvan con sus familias en Montevideo. Al usar la app aceptás estas reglas.',
      secciones: [
        {
          titulo: 'Qué es Encontrados',
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
            'Encontrados pone en contacto a personas, pero no verifica cada publicación ni participa en los encuentros. Encontrate en lugares públicos y, si podés, acompañado.',
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
            'El responsable de la base de datos de Encontrados es [nombre o razón social, documento y domicilio, a completar]. Por cualquier consulta sobre tus datos, escribinos a [email de contacto, a completar].',
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
            'Las fotos de los animales se procesan con un servicio de reconocimiento de imágenes para sugerir casos parecidos. Solo se analiza al animal, y las sugerencias las confirma siempre una persona.',
          ],
        },
        {
          titulo: 'Con quién compartimos datos',
          parrafos: [
            'No vendemos tus datos. Los guardan los servicios que usamos para que la app funcione: Supabase (datos y fotos), Vercel (la web), Hugging Face (reconocimiento de imágenes) y Expo (notificaciones en el celular). Algunos de sus servidores están fuera de Uruguay.',
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
