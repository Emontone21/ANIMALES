/** Pedidos a las funciones del panel (api/). Nunca a otro origen. */

export class ErrorDeApi extends Error {
  /** `sesion` (401), `denegado` (403), `red` o `servidor`. */
  constructor(codigo) {
    super(codigo);
    this.codigo = codigo;
  }
}

async function pedir(ruta, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let respuesta;
  try {
    respuesta = await fetch(ruta, { headers, cache: 'no-store', credentials: 'omit' });
  } catch {
    throw new ErrorDeApi('red');
  }
  if (respuesta.status === 401) throw new ErrorDeApi('sesion');
  if (respuesta.status === 403) throw new ErrorDeApi('denegado');
  if (!respuesta.ok) throw new ErrorDeApi('servidor');
  try {
    return await respuesta.json();
  } catch {
    throw new ErrorDeApi('servidor');
  }
}

/** Sin token: lo necesario para entrar. Con token: también los datos de los links. */
export const leerConfig = (token) => pedir('/api/config', token);

export const leerEstado = (token) => pedir('/api/estado', token);
