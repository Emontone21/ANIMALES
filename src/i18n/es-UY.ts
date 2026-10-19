/**
 * Todos los textos de la interfaz, en español rioplatense (voseo).
 * Ningún componente escribe texto visible inline: lo importa de acá.
 */

import type {
  Especie,
  EstadoAnimal,
  EstadoDenuncia,
  MotivoDenuncia,
  Tamanio,
  TipoAvistamiento,
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
      activos: 'Activos',
      ultimas24h: 'Últimas 24 h',
      ultimos7d: '7 días',
      ultimos30d: '30 días',
    },
  },
  especie: {
    perro: 'Perro',
    gato: 'Gato',
    otro: 'Otro',
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
  tipoAvistamiento: {
    encontrado: 'Lo encontró',
    visto: 'Lo vio',
    resguardado: 'Lo resguardó',
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
    publicado: (hace: string) => `Publicado ${hace}`,
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
    },
    contacto: 'Contacto para recuperarlo',
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
      contacto: 'Contacto que querés compartir',
      contactoPlaceholder: 'Ej: WhatsApp 099 123 456 o "escribime por la app"',
      nota: 'Nota (opcional)',
      notaPlaceholder: 'Dónde está, cómo está…',
      ubicacion: '¿Dónde está ahora? (opcional)',
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
    requiereCuenta: 'Para confirmar o rechazar una coincidencia necesitás una cuenta.',
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
    /** "Un perro encontrado a 1,2 km se parece en un 86 %." */
    resumen: (especie: Especie, km: number | null, porcentaje: number): string =>
      km === null
        ? `${t.especieConArticulo[especie]} encontrado se parece en un ${porcentaje} %.`
        : `${t.especieConArticulo[especie]} encontrado ${t.mapa.distancia(km).toLowerCase()} se parece en un ${porcentaje} %.`,
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
  mensajes: {
    titulo: 'Mensajes',
    requiereCuenta: 'Para enviar mensajes necesitás una cuenta.',
    escribir: 'Escribir',
    elegirDestinatario: '¿A quién le querés escribir?',
    escribirAPublicador: 'Escribirle a quien publicó',
    escribirAResguardo: 'Escribirle a quien lo resguarda',
    aviso:
      'Hablás dentro de la app: tu email y tu teléfono no se comparten. Compartí solo lo que quieras.',
    vacio: 'Todavía no hay mensajes. Escribí el primero.',
    placeholder: 'Escribí un mensaje…',
    enviar: 'Enviar',
    verReporte: 'Ver el reporte',
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
    titulo: 'Publicar un animal encontrado',
    intro:
      'Subí una foto y marcá dónde lo viste. Cuanto más detalle, más fácil es que lo reconozcan.',
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
      googleCancelado: 'Se canceló el ingreso con Google.',
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
  },
  fechas: {
    ahora: 'recién',
    haceMinutos: (n: number) => (n === 1 ? 'hace 1 minuto' : `hace ${n} minutos`),
    haceHoras: (n: number) => (n === 1 ? 'hace 1 hora' : `hace ${n} horas`),
    haceDias: (n: number) => (n === 1 ? 'ayer' : `hace ${n} días`),
    haceSemanas: (n: number) => (n === 1 ? 'hace 1 semana' : `hace ${n} semanas`),
    hoyALas: (hora: string) => `Hoy a las ${hora}`,
    ayerALas: (hora: string) => `Ayer a las ${hora}`,
    diaALas: (dia: string, hora: string) => `${dia} a las ${hora}`,
  },
} as const;
