import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Mensaje } from '@/components/ui/Mensaje';
import { MenuOpciones, type OpcionMenu } from '@/components/ui/MenuOpciones';
import { Texto } from '@/components/ui/Texto';
import { Espacio, Radio } from '@/constants/tema';
import {
  datosDeHistoria,
  datosDeReencuentro,
  type FuenteHistoria,
} from '@/features/historias/disenio';
import { generarHistoria } from '@/features/historias/generarHistoria';
import type { HistoriaMuro } from '@/features/reencuentros/historia';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { linkDeHistoria, linkDelCaso } from '@/lib/compartir';
import { copiarLink } from '@/lib/hojaCompartir';
import { urlFoto } from '@/lib/imagenes';
import type { AnimalDetalle } from '@/types/dominio';

/** Lo que se comparte: un caso abierto o la historia de un reencuentro (6.18 y 6.18.1). */
export type DeQueHistoria =
  | {
      tipo: 'caso';
      animal: AnimalDetalle;
      /** Un encontrado: cuándo lo vio quien lo encontró (la fecha de la historia). */
      encontradoEn: string | null;
    }
  | { tipo: 'reencuentro'; historia: HistoriaMuro };

type Props = { de: DeQueHistoria; onCerrar: () => void };

/** Qué se dibuja, con qué foto, a dónde lleva el link y cómo se nombra. */
function armar(de: DeQueHistoria) {
  if (de.tipo === 'caso') {
    const a = de.animal;
    return {
      fuente: { tipo: 'caso', datos: datosDeHistoria(a, de.encontradoEn) } satisfies FuenteHistoria,
      foto: a.foto_principal_path ? urlFoto(a.foto_principal_path) : null,
      link: linkDelCaso(a.id),
      titulo: t.animal.tituloCaso(a.nombre, a.especie, a.color, a.tamanio),
      intro: t.historia.intro,
      pistaAntes: t.historia.pistaAntes,
    };
  }
  const h = de.historia;
  return {
    fuente: { tipo: 'reencuentro', datos: datosDeReencuentro(h) } satisfies FuenteHistoria,
    foto: urlFoto(h.foto_path),
    link: linkDeHistoria(h.animal_id),
    titulo: t.reencuentros.tituloHistoria(h.nombre, h.especie),
    intro: t.historia.reencuentro.intro,
    pistaAntes: t.historia.reencuentro.pistaAntes,
  };
}

type Estado =
  { fase: 'generando' } | { fase: 'lista'; archivo: File; vista: string } | { fase: 'error' };

type Aviso = { texto: string; tipo: 'exito' | 'error' | 'info' };

/** Si el navegador puede mandar el archivo a otra app (no el de WhatsApp, por ejemplo). */
function puedeCompartirArchivo(archivo: File): boolean {
  return (
    typeof navigator.share === 'function' && navigator.canShare?.({ files: [archivo] }) === true
  );
}

/**
 * "Compartir en historias" (solo web): arma la imagen en el celular, la
 * muestra y la manda con la hoja del sistema (o la descarga, si el navegador
 * no puede mandar archivos). A la vez copia el link del caso (o de la historia
 * del reencuentro), para sumarlo con el sticker de enlace de Instagram. Va en
 * un bloque aparte con el generador: se carga al tocar el botón.
 */
export default function HojaHistoria({ de, onCerrar }: Props) {
  const { esquema } = useTema();
  const estilos = useEstilos(crear);
  const [estado, setEstado] = useState<Estado>({ fase: 'generando' });
  const [intento, setIntento] = useState(0);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // La hoja se monta al abrirla: lo que se comparte es lo de ese momento (quien
  // la abre arma `de` en cada render, y la imagen no se tiene que rehacer por eso).
  const [inicial] = useState(() => armar(de));
  const { link, titulo, intro, pistaAntes } = inicial;

  useEffect(() => {
    let activo = true;
    let vista: string | null = null;
    generarHistoria(inicial.fuente, inicial.foto, esquema)
      .then(({ archivo }) => {
        if (!activo) return;
        vista = URL.createObjectURL(archivo);
        const imagen = new File([archivo], t.historia.nombreArchivo, { type: archivo.type });
        setEstado({ fase: 'lista', archivo: imagen, vista });
      })
      .catch(() => {
        if (activo) setEstado({ fase: 'error' });
      });
    return () => {
      activo = false;
      if (vista) URL.revokeObjectURL(vista);
    };
  }, [inicial, esquema, intento]);

  /** El link se copia en el mismo toque que comparte o descarga (el portapapeles lo pide). */
  const copiar = () =>
    void copiarLink(link).then((ok) =>
      setAviso(
        ok
          ? { texto: t.historia.pista, tipo: 'exito' }
          : { texto: t.compartir.errorCopiar, tipo: 'error' },
      ),
    );

  const compartir = (archivo: File) => {
    copiar();
    navigator.share({ files: [archivo] }).catch((error: unknown) => {
      // Cerró la hoja sin elegir nada: no es un error.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setAviso({ texto: t.historia.errorCompartir, tipo: 'error' });
    });
  };

  const descargar = (archivo: File, vista: string) => {
    const enlace = document.createElement('a');
    enlace.href = vista;
    enlace.download = archivo.name;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    copiar();
  };

  let opciones: OpcionMenu[] = [];
  let contenido;
  if (estado.fase === 'lista') {
    const conHoja = puedeCompartirArchivo(estado.archivo);
    opciones = [
      conHoja
        ? {
            titulo: t.historia.compartir,
            icono: 'share-outline',
            variante: 'primario',
            onPress: () => compartir(estado.archivo),
          }
        : {
            titulo: t.historia.descargar,
            icono: 'download-outline',
            variante: 'primario',
            onPress: () => descargar(estado.archivo, estado.vista),
          },
    ];
    contenido = (
      <View style={estilos.contenido}>
        <Image
          source={{ uri: estado.vista }}
          style={estilos.vista}
          contentFit="contain"
          accessible
          accessibilityLabel={t.historia.vistaPrevia(titulo)}
        />
        {aviso ? (
          <Mensaje texto={aviso.texto} tipo={aviso.tipo} />
        ) : (
          <Mensaje
            texto={conHoja ? pistaAntes : `${t.historia.sinCompartirArchivos} ${pistaAntes}`}
          />
        )}
      </View>
    );
  } else if (estado.fase === 'error') {
    opciones = [
      {
        titulo: t.historia.reintentar,
        icono: 'refresh-outline',
        variante: 'primario',
        onPress: () => {
          setEstado({ fase: 'generando' });
          setIntento((n) => n + 1);
        },
      },
    ];
    contenido = <Mensaje texto={t.historia.errorGenerar} tipo="error" />;
  } else {
    contenido = (
      <View style={[estilos.vista, estilos.cargando]} aria-busy>
        <ActivityIndicator />
        <Texto variante="secundario">{t.historia.generando}</Texto>
      </View>
    );
  }

  return (
    <MenuOpciones
      visible
      titulo={t.historia.titulo}
      descripcion={intro}
      contenido={contenido}
      opciones={opciones}
      onCerrar={onCerrar}
    />
  );
}

const crear = crearEstilos((c) => ({
  contenido: { gap: Espacio.sm, alignItems: 'stretch' },
  // 9:16, como la historia. Alcanza para ver cómo queda sin tapar los botones.
  vista: {
    alignSelf: 'center',
    height: 320,
    aspectRatio: 9 / 16,
    borderRadius: Radio.m,
    backgroundColor: c.superficieSuave,
    overflow: 'hidden',
  },
  cargando: { alignItems: 'center', justifyContent: 'center', gap: Espacio.s, padding: Espacio.s },
}));
