/**
 * El script de Google Identity Services: se baja solo cuando Ingresar o
 * Registrarse muestran el botón, una vez. Si no carga, tarda demasiado o no
 * trae la API, la promesa falla y la pantalla muestra el botón de siempre
 * (respaldo). Sin React: lo prueba __tests__/google.test.ts con un documento
 * de mentira.
 */

/** Lo que usamos de google.accounts.id. */
export type IdentidadGoogle = {
  initialize: (opciones: {
    client_id: string;
    callback: (respuesta: { credential: string }) => void;
    /** El hash SHA-256 del nonce: Google lo pone en el token. */
    nonce: string;
    use_fedcm_for_prompt: boolean;
  }) => void;
  renderButton: (
    contenedor: HTMLElement,
    opciones: {
      type: 'standard';
      theme: 'outline' | 'filled_black';
      size: 'large';
      text: 'continue_with';
      shape: 'pill';
      logo_alignment: 'left';
      locale: string;
      width: number;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: IdentidadGoogle } };
  }
}

export const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client';
/** Más que esto sin cargar: el botón de siempre. */
export const ESPERA_GOOGLE_MS = 10_000;

/** Lo que se usa del elemento <script>. */
export type ScriptGoogle = {
  src: string;
  async: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  remove: () => void;
};

/** Lo que el cargador necesita del navegador (en las pruebas, uno de mentira). */
export type EntornoGoogle = {
  crearScript: () => ScriptGoogle;
  agregar: (script: ScriptGoogle) => void;
  identidad: () => IdentidadGoogle | undefined;
};

/** Un cargador con su propia carga en curso: la reusa y, si falló, deja intentar de nuevo. */
export function crearCargadorGoogle(entorno: EntornoGoogle, espera = ESPERA_GOOGLE_MS) {
  let carga: Promise<IdentidadGoogle> | null = null;
  return function cargar(): Promise<IdentidadGoogle> {
    const lista = entorno.identidad();
    if (lista) return Promise.resolve(lista);
    carga ??= new Promise<IdentidadGoogle>((resolver, rechazar) => {
      const script = entorno.crearScript();
      let terminada = false;
      const fallar = () => {
        if (terminada) return;
        terminada = true;
        clearTimeout(reloj);
        carga = null;
        script.remove();
        rechazar(new Error('google'));
      };
      const reloj = setTimeout(fallar, espera);
      script.src = SCRIPT_GOOGLE;
      script.async = true;
      script.onload = () => {
        const identidad = entorno.identidad();
        if (!identidad) return fallar();
        terminada = true;
        clearTimeout(reloj);
        resolver(identidad);
      };
      script.onerror = fallar;
      entorno.agregar(script);
    });
    return carga;
  };
}

/** El cargador del navegador. */
export const cargarGoogle = crearCargadorGoogle({
  crearScript: () => document.createElement('script') as unknown as ScriptGoogle,
  agregar: (script) => document.head.appendChild(script as unknown as HTMLScriptElement),
  identidad: () => window.google?.accounts?.id,
});
