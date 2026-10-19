import { conVariantes } from '@/lib/fotos';
import { esUrlExterna, rutaMiniatura, urlFoto, urlMiniatura } from '@/lib/imagenes';

// fotos.ts usa el cliente de Supabase para subir y borrar; acá no hace falta.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const UID = '00000000-0000-4000-8000-0000000000f1';
const BASE = 'https://ejemplo.supabase.co/storage/v1/object/public/fotos';

describe('rutas de fotos y miniaturas', () => {
  test('la miniatura va al lado de la original', () => {
    expect(rutaMiniatura(`${UID}/abc.jpg`)).toBe(`${UID}/abc.miniatura.jpg`);
  });

  test('comparte la raíz hasta el primer punto del nombre (como raiz_foto en la base)', () => {
    expect(rutaMiniatura(`${UID}/abc.miniatura.jpg`)).toBe(`${UID}/abc.miniatura.jpg`);
    expect(rutaMiniatura(`${UID}/sin-extension`)).toBe(`${UID}/sin-extension.miniatura.jpg`);
  });

  test('las URLs de demo no tienen miniatura y se usan tal cual', () => {
    const demo = 'https://cataas.com/cat?width=800';
    expect(esUrlExterna(demo)).toBe(true);
    expect(rutaMiniatura(demo)).toBeNull();
    expect(urlFoto(demo)).toBe(demo);
    expect(urlMiniatura(demo)).toBe(demo);
  });

  test('URL pública del bucket, como la arma supabase-js', () => {
    expect(urlFoto(`${UID}/abc.jpg`)).toBe(`${BASE}/${UID}/abc.jpg`);
    expect(urlMiniatura(`${UID}/abc.jpg`)).toBe(`${BASE}/${UID}/abc.miniatura.jpg`);
    expect(urlFoto(`/${UID}/con espacio.jpg`)).toBe(`${BASE}/${UID}/con%20espacio.jpg`);
  });

  test('para borrar: cada foto con su miniatura; las externas no se tocan', () => {
    expect(conVariantes([`${UID}/a.jpg`, 'https://cataas.com/cat'])).toEqual([
      `${UID}/a.jpg`,
      `${UID}/a.miniatura.jpg`,
    ]);
  });
});
