/**
 * Tipos de la base de datos.
 *
 * Escritos a mano siguiendo el formato de `supabase gen types`. Con el proyecto
 * enlazado (`npx supabase link`) y las migraciones aplicadas, regeneralos con:
 *
 *   npm run db:types
 *
 * y este archivo se sobreescribe con la versión generada.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string;
          nombre_publico: string;
          avatar_path: string | null;
          es_moderador: boolean;
          /** Solo los lee su dueño, con mis_terminos(): la API no expone estas columnas. */
          terminos_version: string | null;
          terminos_aceptados_en: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nombre_publico: string;
          avatar_path?: string | null;
          es_moderador?: boolean;
          terminos_version?: string | null;
          terminos_aceptados_en?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre_publico?: string;
          avatar_path?: string | null;
          es_moderador?: boolean;
          terminos_version?: string | null;
          terminos_aceptados_en?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      animales: {
        Row: {
          id: string;
          especie: Database['public']['Enums']['especie'];
          tamanio: Database['public']['Enums']['tamanio'] | null;
          color: string | null;
          tiene_collar: boolean;
          descripcion: string | null;
          estado: Database['public']['Enums']['estado_animal'];
          vinculado_a: string | null;
          foto_principal_path: string;
          /** null: quien lo publicó borró su cuenta y lo dejó publicado sin su nombre. */
          creado_por: string | null;
          ultimo_avistamiento_en: string | null;
          oculto: boolean;
          tipo_reporte: Database['public']['Enums']['tipo_reporte'];
          nombre: string | null;
          contacto_familia: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          especie: Database['public']['Enums']['especie'];
          tamanio?: Database['public']['Enums']['tamanio'] | null;
          color?: string | null;
          tiene_collar?: boolean;
          descripcion?: string | null;
          estado?: Database['public']['Enums']['estado_animal'];
          vinculado_a?: string | null;
          foto_principal_path: string;
          creado_por?: string | null;
          ultimo_avistamiento_en?: string | null;
          oculto?: boolean;
          tipo_reporte?: Database['public']['Enums']['tipo_reporte'];
          nombre?: string | null;
          contacto_familia?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          especie?: Database['public']['Enums']['especie'];
          tamanio?: Database['public']['Enums']['tamanio'] | null;
          color?: string | null;
          tiene_collar?: boolean;
          descripcion?: string | null;
          estado?: Database['public']['Enums']['estado_animal'];
          vinculado_a?: string | null;
          foto_principal_path?: string;
          creado_por?: string | null;
          ultimo_avistamiento_en?: string | null;
          oculto?: boolean;
          tipo_reporte?: Database['public']['Enums']['tipo_reporte'];
          nombre?: string | null;
          contacto_familia?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      avistamientos: {
        Row: {
          id: string;
          animal_id: string;
          usuario_id: string | null;
          tipo: Database['public']['Enums']['tipo_avistamiento'];
          foto_path: string | null;
          ubicacion: unknown;
          visto_en: string;
          nota: string | null;
          embedding: string | null;
          bbox_recorte: Json | null;
          procesado_en: string | null;
          error_procesamiento: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          animal_id: string;
          usuario_id?: string | null;
          tipo?: Database['public']['Enums']['tipo_avistamiento'];
          foto_path?: string | null;
          ubicacion: unknown;
          visto_en?: string;
          nota?: string | null;
          embedding?: string | null;
          bbox_recorte?: Json | null;
          procesado_en?: string | null;
          error_procesamiento?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          animal_id?: string;
          usuario_id?: string | null;
          tipo?: Database['public']['Enums']['tipo_avistamiento'];
          foto_path?: string | null;
          ubicacion?: unknown;
          visto_en?: string;
          nota?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      cambios_estado: {
        Row: {
          id: string;
          animal_id: string;
          usuario_id: string | null;
          estado_anterior: Database['public']['Enums']['estado_animal'];
          estado_nuevo: Database['public']['Enums']['estado_animal'];
          nota: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          animal_id: string;
          usuario_id?: string | null;
          estado_anterior: Database['public']['Enums']['estado_animal'];
          estado_nuevo: Database['public']['Enums']['estado_animal'];
          nota?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          animal_id?: string;
          usuario_id?: string | null;
          estado_anterior?: Database['public']['Enums']['estado_animal'];
          estado_nuevo?: Database['public']['Enums']['estado_animal'];
          nota?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contactos_resguardo: {
        Row: {
          cambio_id: string;
          animal_id: string;
          usuario_id: string | null;
          contacto: string;
          created_at: string;
        };
        Insert: {
          cambio_id: string;
          animal_id: string;
          usuario_id?: string | null;
          contacto: string;
          created_at?: string;
        };
        Update: {
          cambio_id?: string;
          animal_id?: string;
          usuario_id?: string | null;
          contacto?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      bloqueos: {
        Row: {
          bloqueador_id: string;
          bloqueado_id: string;
          created_at: string;
        };
        Insert: {
          bloqueador_id: string;
          bloqueado_id: string;
          created_at?: string;
        };
        Update: {
          bloqueador_id?: string;
          bloqueado_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      seguimientos: {
        Row: {
          usuario_id: string;
          animal_id: string;
          created_at: string;
        };
        Insert: {
          usuario_id: string;
          animal_id: string;
          created_at?: string;
        };
        Update: {
          usuario_id?: string;
          animal_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      denuncias: {
        Row: {
          id: string;
          animal_id: string;
          avistamiento_id: string | null;
          usuario_id: string;
          motivo: Database['public']['Enums']['motivo_denuncia'];
          detalle: string | null;
          estado: Database['public']['Enums']['estado_denuncia'];
          created_at: string;
        };
        Insert: {
          id?: string;
          animal_id: string;
          avistamiento_id?: string | null;
          usuario_id: string;
          motivo: Database['public']['Enums']['motivo_denuncia'];
          detalle?: string | null;
          estado?: Database['public']['Enums']['estado_denuncia'];
          created_at?: string;
        };
        Update: {
          id?: string;
          animal_id?: string;
          avistamiento_id?: string | null;
          usuario_id?: string;
          motivo?: Database['public']['Enums']['motivo_denuncia'];
          detalle?: string | null;
          estado?: Database['public']['Enums']['estado_denuncia'];
          created_at?: string;
        };
        Relationships: [];
      };
      coincidencias: {
        Row: {
          id: string;
          animal_origen: string;
          animal_candidato: string;
          avistamiento_origen: string | null;
          avistamiento_candidato: string | null;
          similitud: number;
          distancia_m: number | null;
          horas_diferencia: number | null;
          estado: Database['public']['Enums']['estado_coincidencia'];
          resuelta_por: string | null;
          resuelta_en: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          animal_origen: string;
          animal_candidato: string;
          avistamiento_origen?: string | null;
          avistamiento_candidato?: string | null;
          similitud: number;
          distancia_m?: number | null;
          horas_diferencia?: number | null;
          estado?: Database['public']['Enums']['estado_coincidencia'];
          resuelta_por?: string | null;
          resuelta_en?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          animal_origen?: string;
          animal_candidato?: string;
          avistamiento_origen?: string | null;
          avistamiento_candidato?: string | null;
          similitud?: number;
          distancia_m?: number | null;
          horas_diferencia?: number | null;
          estado?: Database['public']['Enums']['estado_coincidencia'];
          resuelta_por?: string | null;
          resuelta_en?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          token: string;
          usuario_id: string;
          plataforma: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          token: string;
          usuario_id: string;
          plataforma: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          token?: string;
          usuario_id?: string;
          plataforma?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notificaciones: {
        Row: {
          id: string;
          usuario_id: string;
          tipo: Database['public']['Enums']['tipo_notificacion'];
          titulo: string;
          cuerpo: string;
          datos: Json;
          leida_en: string | null;
          /** Quién causó el aviso; null si lo generó el sistema. */
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tipo: Database['public']['Enums']['tipo_notificacion'];
          titulo: string;
          cuerpo: string;
          datos?: Json;
          leida_en?: string | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          tipo?: Database['public']['Enums']['tipo_notificacion'];
          titulo?: string;
          cuerpo?: string;
          datos?: Json;
          leida_en?: string | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      conversaciones: {
        Row: {
          id: string;
          animal_id: string;
          participante_a: string;
          participante_b: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          animal_id: string;
          participante_a: string;
          participante_b: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          animal_id?: string;
          participante_a?: string;
          participante_b?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mensajes: {
        Row: {
          id: string;
          conversacion_id: string;
          emisor_id: string;
          cuerpo: string;
          leido_en: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversacion_id: string;
          emisor_id: string;
          cuerpo: string;
          leido_en?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversacion_id?: string;
          emisor_id?: string;
          cuerpo?: string;
          leido_en?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      conversaciones_detalle: {
        Row: {
          id: string;
          animal_id: string;
          animal_foto_path: string;
          animal_especie: Database['public']['Enums']['especie'];
          otro_id: string;
          otro_nombre: string;
          ultimo_mensaje: string | null;
          ultimo_mensaje_en: string | null;
          no_leidos: number;
          updated_at: string;
          /** Hay un bloqueo entre las dos personas, en cualquier sentido. */
          bloqueada: boolean;
          /** Vos bloqueaste a la otra persona. */
          bloqueaste: boolean;
        };
        Relationships: [];
      };
      mensajes_detalle: {
        Row: {
          id: string;
          conversacion_id: string;
          emisor_id: string;
          emisor_nombre: string;
          cuerpo: string;
          leido_en: string | null;
          created_at: string;
        };
        Relationships: [];
      };
      denuncias_detalle: {
        Row: {
          id: string;
          animal_id: string;
          avistamiento_id: string | null;
          usuario_id: string;
          denunciante_nombre: string;
          motivo: Database['public']['Enums']['motivo_denuncia'];
          detalle: string | null;
          estado: Database['public']['Enums']['estado_denuncia'];
          created_at: string;
          animal_foto_path: string;
          animal_especie: Database['public']['Enums']['especie'];
          animal_descripcion: string | null;
          animal_oculto: boolean;
          animal_estado: Database['public']['Enums']['estado_animal'];
          /** La cuenta tenía menos de 7 días al denunciar: no cuenta para ocultar. */
          cuenta_nueva: boolean;
        };
        Relationships: [];
      };
      coincidencias_detalle: {
        Row: {
          id: string;
          animal_origen: string;
          animal_candidato: string;
          similitud: number;
          distancia_m: number | null;
          horas_diferencia: number | null;
          estado: Database['public']['Enums']['estado_coincidencia'];
          resuelta_por: string | null;
          resuelta_en: string | null;
          created_at: string;
          origen_foto_path: string;
          origen_especie: Database['public']['Enums']['especie'];
          origen_estado: Database['public']['Enums']['estado_animal'];
          origen_descripcion: string | null;
          candidato_foto_path: string;
          candidato_especie: Database['public']['Enums']['especie'];
          candidato_estado: Database['public']['Enums']['estado_animal'];
          candidato_descripcion: string | null;
          origen_tipo_reporte: Database['public']['Enums']['tipo_reporte'];
          origen_nombre: string | null;
          origen_creado_por: string | null;
          candidato_tipo_reporte: Database['public']['Enums']['tipo_reporte'];
          candidato_nombre: string | null;
          candidato_creado_por: string | null;
        };
        Relationships: [];
      };
      animales_detalle: {
        Row: {
          id: string;
          especie: Database['public']['Enums']['especie'];
          tamanio: Database['public']['Enums']['tamanio'] | null;
          color: string | null;
          tiene_collar: boolean;
          descripcion: string | null;
          estado: Database['public']['Enums']['estado_animal'];
          vinculado_a: string | null;
          foto_principal_path: string;
          creado_por: string | null;
          creador_nombre: string | null;
          created_at: string;
          ultimo_avistamiento_en: string | null;
          lat: number | null;
          lng: number | null;
          ultimo_visto_en: string | null;
          cantidad_avistamientos: number;
          oculto: boolean;
          tipo_reporte: Database['public']['Enums']['tipo_reporte'];
          nombre: string | null;
          contacto_familia: string | null;
          /** Cuándo se perdió (avistamiento de tipo perdido); null en los encontrados. */
          perdido_desde: string | null;
        };
        Relationships: [];
      };
      cambios_estado_detalle: {
        Row: {
          id: string;
          animal_id: string;
          usuario_id: string | null;
          usuario_nombre: string | null;
          estado_anterior: Database['public']['Enums']['estado_animal'];
          estado_nuevo: Database['public']['Enums']['estado_animal'];
          /** Lo filtra RLS: en un perdido solo lo ven su familia y quien lo resguarda. */
          contacto_compartido: string | null;
          nota: string | null;
          created_at: string;
        };
        Relationships: [];
      };
      bloqueos_detalle: {
        Row: {
          bloqueado_id: string;
          bloqueado_nombre: string;
          bloqueado_avatar_path: string | null;
          created_at: string;
        };
        Relationships: [];
      };
      animales_mapa: {
        Row: {
          id: string;
          especie: Database['public']['Enums']['especie'];
          tamanio: Database['public']['Enums']['tamanio'] | null;
          color: string | null;
          tiene_collar: boolean;
          descripcion: string | null;
          estado: Database['public']['Enums']['estado_animal'];
          foto_principal_path: string;
          creado_por: string | null;
          created_at: string;
          ultimo_avistamiento_en: string | null;
          lat: number;
          lng: number;
          ultimo_visto_en: string;
          cantidad_avistamientos: number;
          tipo_reporte: Database['public']['Enums']['tipo_reporte'];
          nombre: string | null;
          contacto_familia: string | null;
        };
        Relationships: [];
      };
      avistamientos_detalle: {
        Row: {
          id: string;
          animal_id: string;
          usuario_id: string | null;
          usuario_nombre: string | null;
          tipo: Database['public']['Enums']['tipo_avistamiento'];
          foto_path: string | null;
          lat: number;
          lng: number;
          visto_en: string;
          nota: string | null;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      abrir_conversacion: {
        Args: { p_animal_id: string; p_otro_usuario: string };
        Returns: string;
      };
      aceptar_terminos: {
        Args: { p_version: string };
        Returns: undefined;
      };
      mis_terminos: {
        Args: Record<string, never>;
        Returns: { version: string | null; aceptados_en: string | null; vigente: string | null }[];
      };
      fotos_para_borrar: {
        Args: { p_conservar_abiertos?: boolean };
        Returns: string[];
      };
      borrar_mi_cuenta: {
        Args: { p_conservar_abiertos?: boolean };
        Returns: undefined;
      };
      hay_bloqueo_con: {
        Args: { p_otro: string };
        Returns: boolean;
      };
      es_moderador: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      moderar_animal: {
        Args: { p_animal_id: string; p_oculto: boolean };
        Returns: undefined;
      };
      resolver_coincidencia: {
        Args: { p_id: string; p_confirmada: boolean };
        Returns: string | null;
      };
      registrar_avistamiento: {
        Args: {
          p_animal_id: string;
          p_foto_path: string;
          p_lat: number;
          p_lng: number;
          p_visto_en?: string;
          p_nota?: string | null;
        };
        Returns: string;
      };
      cambiar_estado_animal: {
        Args: {
          p_animal_id: string;
          p_estado_nuevo: Database['public']['Enums']['estado_animal'];
          p_contacto_compartido?: string | null;
          p_nota?: string | null;
          p_lat?: number | null;
          p_lng?: number | null;
          p_foto_path?: string | null;
        };
        Returns: undefined;
      };
      publicar_animal: {
        Args: {
          p_especie: Database['public']['Enums']['especie'];
          p_foto_path: string;
          p_lat: number;
          p_lng: number;
          p_visto_en?: string;
          p_tamanio?: Database['public']['Enums']['tamanio'] | null;
          p_color?: string | null;
          p_tiene_collar?: boolean;
          p_descripcion?: string | null;
          p_tipo?: Database['public']['Enums']['tipo_reporte'];
          p_nombre?: string | null;
          p_contacto_familia?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      tipo_notificacion: 'coincidencia' | 'avistamiento' | 'estado' | 'mensaje';
      estado_coincidencia: 'pendiente' | 'confirmada' | 'rechazada';
      estado_cola: 'pendiente' | 'procesando' | 'hecho' | 'error';
      motivo_denuncia: 'spam' | 'contenido_inapropiado' | 'informacion_falsa' | 'maltrato' | 'otro';
      estado_denuncia: 'pendiente' | 'revisada' | 'descartada';
      especie: 'perro' | 'gato' | 'otro';
      tamanio: 'chico' | 'mediano' | 'grande';
      estado_animal: 'avistado' | 'resguardado' | 'reunido' | 'vinculado';
      tipo_avistamiento: 'encontrado' | 'visto' | 'resguardado' | 'perdido';
      tipo_reporte: 'perdido' | 'encontrado';
    };
    CompositeTypes: Record<string, never>;
  };
};
