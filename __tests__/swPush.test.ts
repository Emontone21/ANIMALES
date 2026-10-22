import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * public/sw.js en un entorno de service worker simulado: lo que muestra al
 * llegar un push y adónde lleva al tocar la notificación.
 */

type Manejador = (evento: Record<string, unknown>) => void;

const codigo = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');

function cargar(ventanas: { url: string; navegar?: jest.Mock }[] = []) {
  const manejadores: Record<string, Manejador> = {};
  const mostradas: { titulo: string; opciones: Record<string, unknown> }[] = [];
  const abiertas: string[] = [];
  const clientes = ventanas.map((v) => ({
    url: v.url,
    focus: jest.fn().mockResolvedValue(undefined),
    navigate: v.navegar ?? jest.fn().mockResolvedValue(undefined),
  }));
  const self = {
    location: { origin: 'https://spot.example' },
    addEventListener: (tipo: string, fn: Manejador) => {
      manejadores[tipo] = fn;
    },
    skipWaiting: jest.fn(),
    registration: {
      showNotification: jest.fn((titulo: string, opciones: Record<string, unknown>) => {
        mostradas.push({ titulo, opciones });
        return Promise.resolve();
      }),
    },
    clients: {
      matchAll: jest.fn().mockResolvedValue(clientes),
      openWindow: jest.fn((url: string) => {
        abiertas.push(url);
        return Promise.resolve();
      }),
      claim: jest.fn(),
    },
  };
  vm.runInNewContext(codigo, { self, URL, fetch: jest.fn() });

  async function push(datos: unknown) {
    let espera: Promise<unknown> = Promise.resolve();
    manejadores.push({
      data:
        datos === undefined
          ? null
          : {
              json: () => {
                if (typeof datos === 'string') return JSON.parse(datos);
                return datos;
              },
            },
      waitUntil: (p: Promise<unknown>) => {
        espera = p;
      },
    });
    await espera;
  }

  async function tocar(url: unknown) {
    let espera: Promise<unknown> = Promise.resolve();
    const cerrar = jest.fn();
    manejadores.notificationclick({
      notification: { close: cerrar, data: { url } },
      waitUntil: (p: Promise<unknown>) => {
        espera = p;
      },
    });
    await espera;
    expect(cerrar).toHaveBeenCalled();
  }

  return { mostradas, abiertas, clientes, push, tocar };
}

describe('public/sw.js: notificaciones', () => {
  test('muestra el título y el cuerpo del aviso, agrupado por su tag', async () => {
    const sw = cargar();
    await sw.push({
      titulo: 'Alguien vio a Toby',
      cuerpo: 'Tocá para ver dónde lo vieron.',
      url: '/animal/11111111-2222-4333-8444-555555555555',
      tag: 'caso-11111111-2222-4333-8444-555555555555',
    });
    expect(sw.mostradas).toEqual([
      {
        titulo: 'Alguien vio a Toby',
        opciones: {
          body: 'Tocá para ver dónde lo vieron.',
          tag: 'caso-11111111-2222-4333-8444-555555555555',
          icon: '/iconos/icono-192.png',
          lang: 'es-UY',
          data: { url: '/animal/11111111-2222-4333-8444-555555555555' },
        },
      },
    ]);
  });

  test('un push vacío o roto muestra igual algo genérico (el navegador lo exige)', async () => {
    const sw = cargar();
    await sw.push(undefined);
    await sw.push('{no es json');
    expect(sw.mostradas.map((m) => [m.titulo, m.opciones.tag, m.opciones.data])).toEqual([
      ['Spot', 'spot', { url: '/actividad' }],
      ['Spot', 'spot', { url: '/actividad' }],
    ]);
  });

  test('solo lleva a rutas de la app: otro sitio va a Actividad', async () => {
    const sw = cargar();
    for (const url of [
      'https://otro.example/x',
      '//otro.example/x',
      '/\\otro.example',
      'javascript:alert(1)',
      42,
    ]) {
      await sw.push({ titulo: 'x', cuerpo: 'y', url, tag: 't' });
    }
    expect(
      sw.mostradas.every((m) => (m.opciones.data as { url: string }).url === '/actividad'),
    ).toBe(true);
  });

  test('al tocarla, la app abierta va a esa pantalla', async () => {
    const sw = cargar([{ url: 'https://otro.example/' }, { url: 'https://spot.example/mapa' }]);
    await sw.tocar('/conversacion/99999999-8888-4777-8666-555555555555');
    expect(sw.clientes[1].focus).toHaveBeenCalled();
    expect(sw.clientes[1].navigate).toHaveBeenCalledWith(
      'https://spot.example/conversacion/99999999-8888-4777-8666-555555555555',
    );
    expect(sw.clientes[0].navigate).not.toHaveBeenCalled();
    expect(sw.abiertas).toEqual([]);
  });

  test('sin la app abierta (o si no se deja llevar), abre una ventana nueva', async () => {
    const sinVentanas = cargar();
    await sinVentanas.tocar('/animal/11111111-2222-4333-8444-555555555555');
    expect(sinVentanas.abiertas).toEqual([
      'https://spot.example/animal/11111111-2222-4333-8444-555555555555',
    ]);

    const noSeDeja = cargar([
      { url: 'https://spot.example/', navegar: jest.fn().mockRejectedValue(new Error('no')) },
    ]);
    await noSeDeja.tocar('https://otro.example/');
    expect(noSeDeja.abiertas).toEqual(['https://spot.example/actividad']);
  });
});
