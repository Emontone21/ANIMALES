/**
 * Textos del Panel de SPOT, en español rioplatense con voseo. Todo texto que
 * se ve sale de acá (salvo el <title> y el aviso sin JavaScript de
 * index.html, que dicen lo mismo que `t.documento.titulo` y
 * `t.general.sinJavascript`). No es el es-UY.ts de la app: el panel tiene el
 * suyo.
 */

export const NOMBRE = 'SPOT';

const plural = (n, uno, varios) => (n === 1 ? uno : varios);

export const t = {
  documento: {
    titulo: `Panel de ${NOMBRE}`,
    tituloVista: (vista) => `${vista} · Panel de ${NOMBRE}`,
  },

  marca: {
    nombre: NOMBRE,
    subtitulo: 'Panel de administración',
  },

  general: {
    cargando: 'Cargando el panel…',
    reintentar: 'Reintentar',
    saltar: 'Saltar al contenido',
    otraPestana: '(se abre en otra pestaña)',
    sinJavascript: 'El panel necesita JavaScript. Activalo y recargá la página.',
  },

  ingreso: {
    titulo: `Panel de ${NOMBRE}`,
    bajada: 'Entrá con tu cuenta de administración',
    email: 'Email',
    contrasena: 'Contraseña',
    entrar: 'Entrar',
    entrando: 'Entrando…',
    nota: 'Solo entran las cuentas habilitadas. Si la tuya no lo está, vas a ver un aviso de acceso denegado.',
    sesionVencida: 'Tu sesión venció. Entrá de nuevo.',
    faltanDatos: 'Completá el email y la contraseña.',
    errores: {
      credenciales: 'El email o la contraseña no coinciden.',
      emailSinConfirmar: 'Esa cuenta todavía no confirmó su email. Confirmalo y probá de nuevo.',
      muchosIntentos: 'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.',
      captcha:
        'El proyecto de Supabase pide un captcha para entrar y el panel todavía no lo tiene. Está en DISEÑO.md, "Decisiones abiertas".',
      red: 'No se pudo conectar. Revisá la conexión y probá de nuevo.',
      biblioteca: 'No se pudo cargar lo necesario para entrar. Recargá la página.',
      otro: 'No se pudo entrar. Probá de nuevo en un rato.',
    },
    sinConfigurar: {
      titulo: 'El panel todavía no está listo para entrar',
      faltan: (n) =>
        plural(
          n,
          'Falta esta variable en el proyecto del panel en Vercel:',
          'Faltan estas variables en el proyecto del panel en Vercel:',
        ),
      invalidas: (n) =>
        plural(
          n,
          'Esta variable tiene un valor que no sirve:',
          'Estas variables tienen un valor que no sirve:',
        ),
      ayuda: 'Cada una está explicada en .env.example. Después de cargarlas, hacé Redeploy.',
    },
  },

  denegado: {
    titulo: 'Acceso denegado',
    detalle: 'Esta cuenta no está habilitada para el panel. Cerramos la sesión por seguridad.',
    volver: 'Volver a ingresar',
  },

  error: {
    titulo: 'No se pudo cargar el panel',
    detalle: 'El servidor del panel no respondió. Probá de nuevo en un rato.',
  },

  cabecera: {
    actualizar: 'Actualizar',
    actualizando: 'Actualizando…',
    salir: 'Salir',
    menu: 'Secciones del panel',
  },

  tiempo: {
    actualizado: (cuando) => `Actualizado ${cuando}`,
    recien: 'recién',
    minutos: (n) => `hace ${n} min`,
    horas: (n) => `hace ${n} h`,
    dias: (n) => `hace ${n} ${plural(n, 'día', 'días')}`,
  },

  vistas: {
    inicio: 'Inicio',
    app: 'La app',
    infraestructura: 'Infraestructura',
    redes: 'Redes',
    tokens: 'Tokens',
  },

  estados: {
    ok: 'Funciona',
    alDia: 'Al día',
    atencion: 'Atención',
    falla: 'Falla',
    pendiente: 'Pendiente',
    sinConfigurar: 'Sin configurar',
  },

  atencion: {
    titulo: 'Necesita atención',
    vacio: 'Nada necesita atención por ahora.',
    resumen: (fallas, avisos) => {
      if (fallas === 0 && avisos === 0) return 'Nada para revisar';
      const partes = [];
      if (fallas > 0) partes.push(`${fallas} ${plural(fallas, 'falla', 'fallas')}`);
      if (avisos > 0) partes.push(`${avisos} ${plural(avisos, 'aviso', 'avisos')}`);
      return partes.join(' · ');
    },
    sinEstado: {
      titulo: 'No se pudo leer el estado del panel',
      detalle:
        'Puede ser la conexión o el servidor del panel. Lo que ves puede estar desactualizado.',
    },
    sinEstadoItem: 'No llegó su estado desde el servidor del panel.',
    verConfiguracion: 'Ver la configuración',
    variableDelToken: 'Variable:',
    adminInvalidos: 'tiene valores que no son ids de usuario: esos no entran.',
  },

  configuracion: {
    titulo: 'Configuración del panel',
    bajada: 'Lo que falta para que cada parte muestre datos.',
    listo: 'Configurado.',
    partes: {
      ingreso: 'Ingreso y permisos',
      enlaces: 'Links a los servicios',
      datosInternos: 'Datos de la app',
      vercel: 'Vercel',
      meta: 'Facebook e Instagram',
      linkedin: 'LinkedIn',
      alertas: 'Alertas',
    },
  },

  falta: {
    variables: (n) => plural(n, 'Falta la variable', 'Faltan las variables'),
    invalidas: (n) => plural(n, 'tiene un valor que no sirve.', 'tienen un valor que no sirve.'),
    prompt: (nombre) => `Llega con el prompt "${nombre}".`,
    soloEnlace: (n) => plural(n, 'Para el link, falta', 'Para los links, faltan'),
  },

  prompts: {
    meta: 'Facebook e Instagram',
    linkedin: 'LinkedIn',
    alertas: 'Alertas',
  },

  secciones: {
    app: 'La app',
    infraestructura: 'Infraestructura',
    redes: 'Redes',
    tokens: 'Tokens',
  },

  tarjetas: {
    'app.casosNuevos': {
      titulo: 'Casos nuevos',
      descripcion: 'Publicados en las últimas 24 horas y en 7 días, con la gráfica por día.',
    },
    'app.reunidos': {
      titulo: 'Casos reunidos',
      descripcion: 'Animales que volvieron a casa: en total y en los últimos 30 días.',
    },
    'app.coincidencias': {
      titulo: 'Coincidencias pendientes',
      descripcion: 'Posibles coincidencias que nadie confirmó ni descartó todavía.',
    },
    'app.moderacion': {
      titulo: 'Denuncias y ocultos',
      descripcion: 'Denuncias sin revisar y publicaciones ocultas por moderación.',
    },
    'app.usuarios': {
      titulo: 'Usuarios nuevos',
      descripcion: 'Cuentas creadas en las últimas 24 horas y en 7 días.',
    },
    'app.fotosTrabadas': {
      titulo: 'Fotos trabadas',
      descripcion: 'Fotos de la cola de reconocimiento que esperan hace más de 30 minutos.',
    },
    'infra.vercel': {
      titulo: 'Vercel',
      corto: 'Último deploy de la app',
      descripcion:
        'Estado, commit y hora del último deploy de producción de la app (sin contar los cancelados).',
    },
    'infra.supabase': {
      titulo: 'Supabase',
      corto: 'Base y Storage',
      descripcion:
        'Si el proyecto responde y cuánto ocupan la base (de 500 MB) y Storage (de 1 GB) del plan gratuito.',
    },
    'infra.vision': {
      titulo: 'Servicio de visión',
      corto: 'Reconocimiento con IA',
      descripcion:
        'El reconocimiento de fotos con IA (función reconocer): fotos en espera y llamadas a la IA de las últimas 24 horas.',
    },
    'redes.facebook': {
      titulo: 'Facebook',
      corto: 'Página',
      descripcion: 'Seguidores, alcance y últimas publicaciones de la página.',
    },
    'redes.instagram': {
      titulo: 'Instagram',
      corto: 'Cuenta profesional',
      descripcion: 'Seguidores, alcance y últimas publicaciones de la cuenta.',
    },
    'redes.linkedin': {
      titulo: 'LinkedIn',
      corto: 'Página de la organización',
      descripcion:
        'Seguidores y últimas publicaciones, si LinkedIn aprueba el acceso. Si no, queda solo el link.',
    },
    'tokens.vercel': {
      titulo: 'Token de Vercel',
      descripcion: 'El que usa el panel para leer los deploys. Cuándo vence.',
    },
    'tokens.meta': {
      titulo: 'Token de Meta',
      descripcion:
        'Facebook e Instagram. Va a mostrar cuándo vence el token y su acceso a los datos.',
    },
    'tokens.linkedin': {
      titulo: 'Token de LinkedIn',
      descripcion: 'Va a mostrar cuándo vence: LinkedIn lo da por 60 días.',
    },
  },

  enlaces: {
    supabase: 'Abrir en Supabase',
    vercel: 'Abrir en Vercel',
    app: 'Abrir en la app',
    logVercel: 'Ver log en Vercel',
    facebook: 'Abrir en Facebook',
    instagram: 'Abrir en Instagram',
    linkedin: 'Abrir en LinkedIn',
    metaDesarrolladores: 'Abrir en Meta for Developers',
    linkedinDesarrolladores: 'Abrir en LinkedIn Developers',
  },

  /** Por qué una parte o tarjeta está en Atención, Falla o Pendiente. */
  motivos: {
    sinMigracion:
      'Falta aplicar en Supabase la migración 0028 (administradores y resumen del panel).',
    noAdministrador:
      'Tu cuenta no está en la tabla administradores de la base. Sumala desde el editor SQL de Supabase.',
    supabaseNoResponde:
      'Supabase no respondió en 5 segundos. Puede estar caído o pausado por inactividad.',
    datosIncompletos: 'La base respondió, pero sin los datos de esta tarjeta.',
    tokenInvalido: 'Vercel no acepta el token de VERCEL_API_TOKEN: venció, se revocó o no sirve.',
    tokenVencido: 'El token de Vercel venció. Creá otro y cargalo en VERCEL_API_TOKEN.',
    tokenPorVencer:
      'El token de Vercel vence en 14 días o menos. Creá otro y reemplazalo en VERCEL_API_TOKEN.',
    limiteVercel: 'Vercel frenó los pedidos por un rato. Probá de nuevo en unos minutos.',
    vercelNoResponde: 'Vercel no respondió en 5 segundos.',
    proyectoNoEncontrado:
      'Vercel no encuentra el proyecto de LINK_VERCEL_PROJECT en el equipo de LINK_VERCEL_TEAM.',
    sinAccesoAlProyecto: 'El token de Vercel no tiene acceso al equipo o al proyecto de la app.',
    sinDeploys: 'No hay ningún deploy de producción de la app.',
    deployFallo: 'El último deploy de producción de la app falló.',
    deployTrabado: 'Hay un deploy de producción en curso hace más de 15 minutos.',
    sinCasos7d: 'Ningún caso nuevo en 7 días: revisá que publicar funcione.',
    coincidenciasViejas: 'Hay coincidencias que esperan hace más de 3 días.',
    denunciasPendientes: 'Hay denuncias sin revisar.',
    erroresSinResolver: 'Hay reportes de error sin resolver.',
    fotosTrabadas: 'Hay fotos que esperan hace más de 30 minutos.',
    fotosSinReintentos: 'Hay fotos que se quedaron sin reintentos: no se van a procesar solas.',
    colaDetenida:
      'La foto más vieja espera hace más de 2 horas: el reconocimiento puede estar detenido.',
    usoAlto: 'La base o Storage pasan el 80 % del plan gratuito.',
    usoCasiLleno: 'La base o Storage pasan el 95 % del plan gratuito.',
    iaSinCredito:
      'La IA se quedó sin crédito y el reconocimiento está en pausa. Cargá crédito y reactivalo desde Moderación, en la app.',
    iaApagada: 'El reconocimiento con IA está apagado (ia_activa en config_app).',
    erroresIa: 'Alguna llamada a la IA falló en las últimas 24 horas.',
  },

  /** Lo que muestran las tarjetas con datos. */
  datos: {
    en24h: 'en 24 horas',
    en7d: (n) => `${n} en 7 días`,
    en7dYTotal: (n, total) => `${n} en 7 días · ${total} en total`,
    casosPorDia: (dias) => `Casos nuevos por día, de hace 6 días a hoy: ${dias}.`,
    enTotal: 'en total',
    en30d: (n) => `${n} en los últimos 30 días`,
    sinRevisar: 'sin revisar',
    laMasVieja: (cuando) => `La más vieja, ${cuando}.`,
    denunciasSinRevisar: (n) => plural(n, 'denuncia sin revisar', 'denuncias sin revisar'),
    ocultos: (casos, historias) =>
      `${casos} ${plural(casos, 'caso oculto', 'casos ocultos')} · ${historias} ${plural(historias, 'historia oculta', 'historias ocultas')}`,
    erroresSinResolver: (n) =>
      `${n} ${plural(n, 'reporte de error sin resolver', 'reportes de error sin resolver')}`,
    esperanMasDe30: (n) => plural(n, 'espera hace más de 30 min', 'esperan hace más de 30 min'),
    sinReintentos: (n) => `${n} sin reintentos`,
    laMasViejaEspera: (cuando) => `La más vieja llegó ${cuando}.`,
    deploy: {
      READY: 'Listo',
      ERROR: 'Con error',
      BLOCKED: 'Bloqueado',
      BUILDING: 'En curso',
      INITIALIZING: 'En curso',
      QUEUED: 'En cola',
    },
    commit: 'Commit',
    creado: (fecha, cuando) => `${fecha} (${cuando})`,
    base: 'Base de datos',
    storage: 'Storage',
    deLimite: (usado, limite, porcentaje) => `${usado} de ${limite} · ${porcentaje}`,
    usoCorto: (base, storage) => `Base ${base} · Storage ${storage}`,
    fotosEnEspera: (n) => plural(n, 'foto en espera', 'fotos en espera'),
    llamadas: (n, errores) =>
      `${n} ${plural(n, 'llamada', 'llamadas')} a la IA en 24 h · ${errores} con error`,
    ultimaProcesada: (cuando) => `Última foto procesada ${cuando}.`,
    iaApagada: 'La IA está apagada.',
    vence: (fecha, dias) =>
      dias === 0
        ? `Vence el ${fecha}: hoy.`
        : `Vence el ${fecha}, en ${dias} ${plural(dias, 'día', 'días')}.`,
    noVence: 'No vence.',
  },
};
