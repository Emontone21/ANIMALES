import {
  appConNavegador,
  type DatosNavegador,
  esIos,
  formaDeInstalar,
} from '@/features/instalar/formaDeInstalar';

const UA = {
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  chromeComputadora:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
  // iPadOS 13 o más se presenta como una Mac; se distingue porque tiene pantalla táctil.
  ipadComoMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  instagram:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 312.0.0.32.112 Android',
  instagramIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 312.0.0.32.112 (iPhone14,5; iOS 17_5)',
  facebook:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.40.109;]',
  facebookIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.40.109;FBBV/1;FBDV/iPhone14,5]',
  messenger:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.40.109]',
  whatsapp:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.21.80',
};

const web = (userAgent: string, cambios: Partial<DatosNavegador> = {}): DatosNavegador => ({
  plataforma: 'web',
  userAgent,
  puntosDeToque: 0,
  abiertaComoApp: false,
  recienInstalada: false,
  hayAviso: false,
  ...cambios,
});

describe('qué botón de "Instalar la app" se muestra', () => {
  test('Chrome o Edge con el aviso: la ventana del navegador', () => {
    expect(formaDeInstalar(web(UA.chromeAndroid, { hayAviso: true, puntosDeToque: 5 }))).toBe(
      'aviso',
    );
    expect(formaDeInstalar(web(UA.chromeComputadora, { hayAviso: true }))).toBe('aviso');
    expect(formaDeInstalar(web(UA.edge, { hayAviso: true }))).toBe('aviso');
  });

  test('Chrome todavía sin aviso, Firefox o Safari de computadora: no se muestra', () => {
    expect(formaDeInstalar(web(UA.chromeAndroid, { puntosDeToque: 5 }))).toBe('ninguna');
    expect(formaDeInstalar(web(UA.chromeComputadora))).toBe('ninguna');
    expect(formaDeInstalar(web(UA.firefox))).toBe('ninguna');
    expect(formaDeInstalar(web(UA.ipadComoMac, { puntosDeToque: 0 }))).toBe('ninguna');
  });

  test('iPhone y iPad (también el iPad que dice ser una Mac): los pasos de Compartir', () => {
    expect(formaDeInstalar(web(UA.safariIphone, { puntosDeToque: 5 }))).toBe('pasosIos');
    expect(formaDeInstalar(web(UA.chromeIphone, { puntosDeToque: 5 }))).toBe('pasosIos');
    expect(formaDeInstalar(web(UA.ipadComoMac, { puntosDeToque: 5 }))).toBe('pasosIos');
  });

  test('navegadores de WhatsApp, Instagram y Facebook: abrir el link en Chrome o Safari', () => {
    for (const ua of [
      UA.whatsapp,
      UA.instagram,
      UA.instagramIphone,
      UA.facebook,
      UA.facebookIphone,
      UA.messenger,
    ]) {
      expect(formaDeInstalar(web(ua, { puntosDeToque: 5 }))).toBe('abrirEnNavegador');
    }
    // Aunque el navegador de la app mandara el aviso, ahí no se instala.
    expect(formaDeInstalar(web(UA.instagram, { hayAviso: true }))).toBe('abrirEnNavegador');
  });

  test('ya instalada (abierta como app o recién instalada) o en la app nativa: no se muestra', () => {
    expect(formaDeInstalar(web(UA.chromeAndroid, { hayAviso: true, abiertaComoApp: true }))).toBe(
      'ninguna',
    );
    expect(formaDeInstalar(web(UA.safariIphone, { abiertaComoApp: true }))).toBe('ninguna');
    expect(formaDeInstalar(web(UA.chromeComputadora, { recienInstalada: true }))).toBe('ninguna');
    expect(formaDeInstalar(web(UA.safariIphone, { plataforma: 'ios' }))).toBe('ninguna');
    expect(formaDeInstalar(web(UA.chromeAndroid, { plataforma: 'android', hayAviso: true }))).toBe(
      'ninguna',
    );
  });
});

describe('reconocer el navegador', () => {
  test('la app de cada navegador interno', () => {
    expect(appConNavegador(UA.whatsapp)).toBe('WhatsApp');
    expect(appConNavegador(UA.instagram)).toBe('Instagram');
    expect(appConNavegador(UA.instagramIphone)).toBe('Instagram');
    expect(appConNavegador(UA.facebook)).toBe('Facebook');
    expect(appConNavegador(UA.messenger)).toBe('Facebook');
    expect(appConNavegador(UA.safariIphone)).toBeNull();
    expect(appConNavegador(UA.chromeAndroid)).toBeNull();
  });

  test('iOS', () => {
    expect(esIos(UA.safariIphone, 5)).toBe(true);
    expect(esIos(UA.ipadComoMac, 5)).toBe(true);
    expect(esIos(UA.ipadComoMac, 0)).toBe(false);
    expect(esIos(UA.chromeAndroid, 5)).toBe(false);
  });
});
