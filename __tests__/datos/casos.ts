import type { AnimalDetalle, AnimalEnMapa } from '@/types/dominio';

/** Datos de ejemplo. Los ids son de prueba, no existen en la base. */
export const FAMILIA = '00000000-0000-4000-8000-0000000000f1';
export const VECINA = '00000000-0000-4000-8000-0000000000a2';
export const OTRA = '00000000-0000-4000-8000-0000000000c3';

export function casoEnMapa(cambios: Partial<AnimalEnMapa> = {}): AnimalEnMapa {
  return {
    id: 'b0000000-0000-4000-8000-000000000001',
    especie: 'perro',
    tamanio: 'mediano',
    color: 'Marrón',
    tiene_collar: true,
    descripcion: 'Llamar al 099 123 456',
    estado: 'avistado',
    foto_principal_path: `${FAMILIA}/abc.jpg`,
    creado_por: FAMILIA,
    created_at: '2026-10-18T12:00:00Z',
    ultimo_avistamiento_en: '2026-10-19T10:00:00Z',
    lat: -34.9011,
    lng: -56.1645,
    ultimo_visto_en: '2026-10-19T10:00:00Z',
    cantidad_avistamientos: 1,
    tipo_reporte: 'perdido',
    nombre: 'Toby',
    contacto_familia: 'WhatsApp 099 000 000',
    ...cambios,
  };
}

export function casoDetalle(cambios: Partial<AnimalDetalle> = {}): AnimalDetalle {
  const { cantidad_avistamientos, ...base } = casoEnMapa();
  return {
    ...base,
    cantidad_avistamientos,
    vinculado_a: null,
    creador_nombre: 'Familia',
    oculto: false,
    perdido_desde: '2026-10-18T12:00:00Z',
    ...cambios,
  } as AnimalDetalle;
}
