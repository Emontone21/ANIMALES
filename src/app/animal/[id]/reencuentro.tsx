import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { RequiereCuenta } from '@/components/auth/RequiereCuenta';
import { RequiereTerminos } from '@/components/legal/RequiereTerminos';
import { SelectorFoto } from '@/components/reportes/SelectorFoto';
import { Avatar } from '@/components/ui/Avatar';
import { Boton } from '@/components/ui/Boton';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Cargando } from '@/components/ui/Cargando';
import { Interruptor } from '@/components/ui/Interruptor';
import { estaActivo } from '@/components/ui/interaccion';
import { Mensaje } from '@/components/ui/Mensaje';
import { MenuOpciones } from '@/components/ui/MenuOpciones';
import { Pantalla } from '@/components/ui/Pantalla';
import { Texto } from '@/components/ui/Texto';
import { AnchoMaximo, Espacio, Medida, Radio } from '@/constants/tema';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  type FotoDeLaHistoria,
  type MiHistoria,
  type Participante,
  useBorrarHistoria,
  useGuardarReencuentro,
  useMiHistoria,
  useParticipantes,
} from '@/features/reencuentros/contar';
import {
  accionDelFormulario,
  comoParticipo,
  errorDelFormulario,
  LARGO_MAXIMO,
  largo,
} from '@/features/reencuentros/reglas';
import { useAnimal } from '@/features/reportes/api';
import { crearEstilos, useEstilos, useTema } from '@/hooks/useTema';
import { t } from '@/i18n/es-UY';
import { mensajeDeError } from '@/lib/errores';
import { ErrorFotos } from '@/lib/fotos';
import { urlMediana } from '@/lib/imagenes';
import type { AnimalDetalle } from '@/types/dominio';

/**
 * "Contá cómo volvió" (docs/DISENO.md, 6.20): la familia de un perdido que
 * volvió a casa cuenta su historia (foto opcional, una frase y si se muestra el
 * nombre) y le agradece a quien participó. Todo es opcional. La base vuelve a
 * validar todo: solo la familia, solo con el caso reunido.
 */
export default function PantallaContarReencuentro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario, cargando } = useAuth();
  const animal = useAnimal(id);

  if (cargando || animal.isPending) {
    return (
      <Pantalla bordes={['left', 'right', 'bottom']}>
        <Cargando />
      </Pantalla>
    );
  }
  if (!usuario) {
    return (
      <Pantalla bordes={['left', 'right', 'bottom']}>
        <RequiereCuenta mensaje={t.reencuentros.contar.soloFamilia} />
      </Pantalla>
    );
  }
  if (animal.isError || !animal.data) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.formulario}>
        <Mensaje
          texto={mensajeDeError(animal.error, t.animal.noDisponible)}
          tipo={animal.isError ? 'error' : 'info'}
        />
      </Pantalla>
    );
  }
  const a = animal.data;
  if (
    a.tipo_reporte !== 'perdido' ||
    a.creado_por !== usuario.id ||
    a.estado !== 'reunido' ||
    a.oculto
  ) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.formulario}>
        <Mensaje texto={t.reencuentros.contar.soloFamilia} />
      </Pantalla>
    );
  }

  return (
    <RequiereTerminos usuarioId={usuario.id} titulo={t.reencuentros.contar.titulo}>
      <CargarFormulario animal={a} usuarioId={usuario.id} />
    </RequiereTerminos>
  );
}

function CargarFormulario({ animal, usuarioId }: { animal: AnimalDetalle; usuarioId: string }) {
  const mia = useMiHistoria(animal.id, usuarioId);
  if (mia.isPending) {
    return (
      <Pantalla bordes={['left', 'right', 'bottom']}>
        <Cargando />
      </Pantalla>
    );
  }
  if (mia.isError) {
    return (
      <Pantalla scroll bordes={['left', 'right', 'bottom']} ancho={AnchoMaximo.formulario}>
        <Mensaje
          texto={mensajeDeError(mia.error)}
          tipo="error"
          onReintentar={() => void mia.refetch()}
        />
      </Pantalla>
    );
  }
  return <Formulario animal={animal} usuarioId={usuarioId} historia={mia.data} />;
}

function Formulario({
  animal,
  usuarioId,
  historia,
}: {
  animal: AnimalDetalle;
  usuarioId: string;
  historia: MiHistoria | null;
}) {
  const router = useRouter();
  const estilos = useEstilos(crear);
  const textos = t.reencuentros.contar;
  const participantes = useParticipantes(animal.id, true);
  const guardar = useGuardarReencuentro(animal.id, usuarioId);
  const borrar = useBorrarHistoria(animal.id);
  const [frase, setFrase] = useState(historia?.frase ?? '');
  const [mostrarNombre, setMostrarNombre] = useState(historia?.mostrar_nombre ?? true);
  const [foto, setFoto] = useState<FotoDeLaHistoria>(
    historia?.foto_path ? { tipo: 'actual', ruta: historia.foto_path } : { tipo: 'delCaso' },
  );
  const [marcados, setMarcados] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [exito, setExito] = useState<string | null>(null);

  const formulario = { frase, mensaje, hayHistoria: !!historia, marcados: marcados.length };
  const accion = accionDelFormulario(formulario);
  const error = intentado ? errorDelFormulario(formulario) : null;
  const vistaPrevia =
    foto.tipo === 'actual' ? urlMediana(foto.ruta) : urlMediana(animal.foto_principal_path);

  const alternar = (id: string) =>
    setMarcados((actuales) =>
      actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id],
    );

  const enviar = () => {
    setIntentado(true);
    setExito(null);
    if (errorDelFormulario(formulario)) return;
    guardar.mutate(
      { frase, mostrarNombre, foto, agradecer: marcados, mensaje },
      {
        onSuccess: (resultado) => {
          // Con la historia publicada, se ve en el muro; si solo agradeció, sigue acá.
          if (resultado.historia) {
            router.replace({ pathname: '/reencuentros/[id]', params: { id: animal.id } });
            return;
          }
          setMarcados([]);
          setMensaje('');
          setIntentado(false);
          setExito(textos.exitoAgradecer);
        },
      },
    );
  };

  const borrarHistoria = () =>
    borrar.mutate(undefined, {
      onSuccess: () => {
        setConfirmarBorrado(false);
        router.replace({ pathname: '/animal/[id]', params: { id: animal.id } });
      },
    });

  const errorGuardar = guardar.isError ? mensajeDeError(guardar.error) : null;

  return (
    <Pantalla
      scroll
      bordes={['left', 'right']}
      ancho={AnchoMaximo.formulario}
      pie={
        <View style={estilos.pie}>
          {error ? <Mensaje texto={error} tipo="error" /> : null}
          {errorGuardar ? <Mensaje texto={errorGuardar} tipo="error" /> : null}
          {exito ? <Mensaje texto={exito} tipo="exito" /> : null}
          <Boton
            titulo={
              accion === 'agradecer'
                ? textos.soloAgradecer
                : historia
                  ? textos.guardar
                  : textos.publicar
            }
            icono={accion === 'agradecer' ? 'heart-circle-outline' : 'checkmark-outline'}
            cargando={guardar.isPending}
            onPress={enviar}
          />
        </View>
      }>
      <Texto variante="secundario">{textos.intro}</Texto>

      <View style={estilos.seccion}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {textos.historia}
        </Texto>
        {historia?.oculta ? <Mensaje texto={t.reencuentros.oculta} tipo="error" /> : null}
        <SelectorFoto
          etiqueta={textos.foto}
          foto={foto.tipo === 'nueva' ? foto.foto : null}
          vistaPrevia={vistaPrevia}
          onCambio={(nueva) => setFoto({ tipo: 'nueva', foto: nueva })}
        />
        {foto.tipo === 'delCaso' ? (
          <Texto variante="secundario">{textos.fotoAyuda}</Texto>
        ) : (
          <Boton
            titulo={textos.usarFotoDelCaso}
            icono="image-outline"
            variante="fantasma"
            onPress={() => setFoto({ tipo: 'delCaso' })}
          />
        )}
        <Mensaje texto={textos.avisoPersonas} />
        <CampoTexto
          etiqueta={textos.frase}
          placeholder={textos.frasePlaceholder}
          value={frase}
          onChangeText={setFrase}
          multiline
          maxLength={LARGO_MAXIMO + 20}
        />
        <Texto
          variante="pequeno"
          color={largo(frase.trim()) > LARGO_MAXIMO ? 'peligro' : undefined}>
          {`${textos.caracteres(largo(frase.trim()))} · ${textos.fraseAyuda}`}
        </Texto>
        {animal.nombre ? (
          <>
            <Interruptor
              etiqueta={textos.mostrarNombre(animal.nombre)}
              valor={mostrarNombre}
              onCambio={setMostrarNombre}
            />
            <Texto variante="secundario">{textos.mostrarNombreAyuda}</Texto>
          </>
        ) : null}
      </View>

      <View style={estilos.seccion}>
        <Texto variante="subtitulo" accessibilityRole="header">
          {textos.agradecer}
        </Texto>
        <Texto variante="secundario">{textos.agradecerIntro}</Texto>
        {participantes.isPending ? (
          <Cargando />
        ) : participantes.isError ? (
          <Mensaje
            texto={mensajeDeError(participantes.error)}
            tipo="error"
            onReintentar={() => void participantes.refetch()}
          />
        ) : participantes.data.length === 0 ? (
          <Texto variante="secundario">{textos.sinParticipantes}</Texto>
        ) : (
          <>
            <View style={estilos.filas}>
              {participantes.data.map((p) => (
                <FilaParticipante
                  key={p.usuario_id}
                  participante={p}
                  marcado={p.agradecido || marcados.includes(p.usuario_id)}
                  onAlternar={() => alternar(p.usuario_id)}
                />
              ))}
            </View>
            {participantes.data.some((p) => !p.agradecido) ? (
              <>
                <CampoTexto
                  etiqueta={textos.mensaje}
                  placeholder={textos.mensajePlaceholder}
                  value={mensaje}
                  onChangeText={setMensaje}
                  multiline
                  maxLength={LARGO_MAXIMO + 20}
                />
                <Texto variante="pequeno">{textos.mensajeAyuda}</Texto>
              </>
            ) : null}
          </>
        )}
      </View>

      {historia ? (
        <Boton
          titulo={textos.borrar}
          icono="trash-outline"
          variante="peligro"
          onPress={() => {
            borrar.reset();
            setConfirmarBorrado(true);
          }}
        />
      ) : null}

      <MenuOpciones
        visible={confirmarBorrado}
        titulo={textos.borrarTitulo}
        descripcion={textos.borrarDetalle}
        error={
          borrar.isError
            ? borrar.error instanceof ErrorFotos
              ? textos.errorBorrarFotos
              : mensajeDeError(borrar.error)
            : null
        }
        onCerrar={() => setConfirmarBorrado(false)}
        opciones={[
          {
            titulo: textos.borrarBoton,
            icono: 'trash-outline',
            variante: 'peligro',
            cargando: borrar.isPending,
            onPress: borrarHistoria,
          },
        ]}
      />
    </Pantalla>
  );
}

/** Una persona que participó: casilla, avatar, nombre y cómo ayudó. A quien ya se agradeció, sin casilla. */
function FilaParticipante({
  participante: p,
  marcado,
  onAlternar,
}: {
  participante: Participante;
  marcado: boolean;
  onAlternar: () => void;
}) {
  const { c } = useTema();
  const estilos = useEstilos(crear);
  const detalle = p.agradecido ? t.reencuentros.contar.yaAgradeciste : comoParticipo(p);
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={marcado}
      aria-disabled={p.agradecido}
      accessibilityLabel={`${p.nombre_publico}. ${detalle}`}
      disabled={p.agradecido}
      onPress={onAlternar}
      style={(estado) => [estilos.fila, !p.agradecido && estaActivo(estado) && estilos.filaActiva]}>
      <View style={[estilos.casilla, marcado && estilos.casillaMarcada]}>
        {marcado ? <Ionicons name="checkmark" size={18} color={c.textoSobrePrimario} /> : null}
      </View>
      <Avatar nombre={p.nombre_publico} fotoPath={p.avatar_path} tamanio={40} />
      <View style={estilos.cuerpoFila}>
        <Texto variante="cuerpoFuerte" numberOfLines={1}>
          {p.nombre_publico}
        </Texto>
        <Texto variante="secundario">{detalle}</Texto>
      </View>
    </Pressable>
  );
}

const crear = crearEstilos((c) => ({
  pie: { gap: Espacio.s },
  seccion: { gap: Espacio.sm },
  filas: { borderTopWidth: 1, borderTopColor: c.borde },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.sm,
    minHeight: Medida.areaTactil + Espacio.m,
    paddingVertical: Espacio.s,
    paddingHorizontal: Espacio.xs,
    borderBottomWidth: 1,
    borderBottomColor: c.borde,
  },
  filaActiva: { backgroundColor: c.superficieSuave },
  casilla: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.s / 2,
    borderWidth: 2,
    borderColor: c.bordeCampo,
    backgroundColor: c.superficie,
  },
  casillaMarcada: { borderColor: c.primario, backgroundColor: c.primario },
  cuerpoFila: { flex: 1, minWidth: 0, gap: Espacio.xs },
}));
