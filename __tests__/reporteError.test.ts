import {
  datosDelDispositivo,
  type Dispositivo,
  LIMITES_REPORTE,
  tamanioDePantalla,
  validarReporte,
  versionDeLaApp,
} from '@/features/errores/reporte';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';

const vacio = { quePaso: '', queHacias: '', contacto: '' };

describe('límites del reporte (los mismos que reportar_error y la tabla)', () => {
  test('qué pasó: de 10 a 1000 caracteres, sin contar los espacios de las puntas', () => {
    expect(LIMITES_REPORTE.quePasoMinimo).toBe(10);
    expect(LIMITES_REPORTE.quePasoMaximo).toBe(1000);
    expect(validarReporte(vacio, false).quePaso).toBe(t.errores.formulario.quePasoCorto(10));
    expect(validarReporte({ ...vacio, quePaso: '   123456789   ' }, false).quePaso).toBeDefined();
    expect(validarReporte({ ...vacio, quePaso: '1234567890' }, false)).toEqual({});
    expect(validarReporte({ ...vacio, quePaso: 'x'.repeat(1000) }, false)).toEqual({});
    expect(validarReporte({ ...vacio, quePaso: 'x'.repeat(1001) }, false).quePaso).toBe(
      t.errores.formulario.demasiadoLargo(1000),
    );
  });

  test('qué estabas haciendo: opcional, hasta 1000', () => {
    const base = { ...vacio, quePaso: 'No carga el mapa' };
    expect(validarReporte(base, true)).toEqual({});
    expect(validarReporte({ ...base, queHacias: 'x'.repeat(1001) }, true).queHacias).toBeDefined();
  });

  test('el contacto: solo sin cuenta y hasta 200', () => {
    const base = { ...vacio, quePaso: 'No puedo ingresar' };
    expect(validarReporte({ ...base, contacto: 'ana@ejemplo.com' }, false)).toEqual({});
    expect(validarReporte({ ...base, contacto: 'x'.repeat(201) }, false).contacto).toBe(
      t.errores.formulario.demasiadoLargo(200),
    );
    expect(validarReporte({ ...base, contacto: 'ana@ejemplo.com' }, true).contacto).toBe(
      t.errores.formulario.contactoConCuenta,
    );
    expect(validarReporte({ ...base, contacto: '   ' }, true)).toEqual({});
  });

  test('el límite por hora lo pone la base: su aviso se muestra tal cual, en español', () => {
    const error = {
      code: 'P0001',
      message: 'Ya mandaste 5 reportes en la última hora. Probá de nuevo más tarde.',
    };
    expect(mensajeDeError(error)).toBe(error.message);
    const sinCuenta = {
      code: 'P0001',
      message:
        'Recibimos muchos reportes sin cuenta en la última hora. Probá más tarde o ingresá con tu cuenta.',
    };
    expect(mensajeDeError(sinCuenta)).toBe(sinCuenta.message);
  });
});

describe('lo que suma la app', () => {
  const dispositivo: Dispositivo = {
    pantallaAnterior: '/animal/123',
    userAgent: 'Mozilla/5.0 (iPhone)',
    ancho: 390,
    alto: 844,
    escala: 3,
    plataforma: 'web',
    version: '0.1.0 (abc1234)',
  };

  test('tal cual cuando entra en la base', () => {
    expect(datosDelDispositivo(dispositivo)).toEqual({
      pantallaAnterior: '/animal/123',
      navegador: 'Mozilla/5.0 (iPhone)',
      tamanioPantalla: '390×844 @3x',
      plataforma: 'web',
      version: '0.1.0 (abc1234)',
    });
  });

  test('recortado a lo que guarda la base, y sin plataformas desconocidas', () => {
    const datos = datosDelDispositivo({
      ...dispositivo,
      pantallaAnterior: null,
      userAgent: 'x'.repeat(600),
      plataforma: 'windows',
      version: 'v'.repeat(100),
    });
    expect(datos.pantallaAnterior).toBeNull();
    expect(datos.navegador).toHaveLength(LIMITES_REPORTE.navegador);
    expect(datos.plataforma).toBeNull();
    expect(datos.version).toHaveLength(LIMITES_REPORTE.version);
  });

  test('el tamaño de pantalla, con la densidad con coma', () => {
    expect(tamanioDePantalla(412.4, 915, 2.625)).toBe('412×915 @2,63x');
    expect(tamanioDePantalla(1440, 900, 1)).toBe('1440×900 @1x');
  });

  test('la versión: el commit del deploy o, si no, la fecha del build', () => {
    expect(versionDeLaApp('0.1.0', '9213c55711c87a11643f3beeda3539eb2c947463', '2026-10-20')).toBe(
      '0.1.0 (9213c55)',
    );
    expect(versionDeLaApp('0.1.0', '', '2026-10-20T15:00Z')).toBe(
      '0.1.0 (build 2026-10-20T15:00Z)',
    );
    expect(versionDeLaApp('0.1.0', undefined, undefined)).toBe('0.1.0');
  });
});
