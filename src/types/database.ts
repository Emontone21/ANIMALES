/**
 * Tipos de la base de datos.
 *
 * Escritos a mano siguiendo el formato de `supabase gen types` para que la app
 * compile sin Docker. Cuando tengas Supabase local corriendo, regeneralos con:
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nombre_publico: string;
          avatar_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre_publico?: string;
          avatar_path?: string | null;
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
          creado_por: string;
          ultimo_avistamiento_en: string | null;
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
          creado_por: string;
          ultimo_avistamiento_en?: string | null;
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
          creado_por?: string;
          ultimo_avistamiento_en?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      avistamientos: {
        Row: {
          id: string;
          animal_id: string;
          usuario_id: string;
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
          usuario_id: string;
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
          usuario_id?: string;
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
          usuario_id: string;
          estado_anterior: Database['public']['Enums']['estado_animal'];
          estado_nuevo: Database['public']['Enums']['estado_animal'];
          contacto_compartido: string | null;
          nota: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          animal_id: string;
          usuario_id: string;
          estado_anterior: Database['public']['Enums']['estado_animal'];
          estado_nuevo: Database['public']['Enums']['estado_animal'];
          contacto_compartido?: string | null;
          nota?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          animal_id?: string;
          usuario_id?: string;
          estado_anterior?: Database['public']['Enums']['estado_animal'];
          estado_nuevo?: Database['public']['Enums']['estado_animal'];
          contacto_compartido?: string | null;
          nota?: string | null;
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
    };
    Views: {
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
          creado_por: string;
          creador_nombre: string;
          created_at: string;
          ultimo_avistamiento_en: string | null;
          lat: number;
          lng: number;
          ultimo_visto_en: string;
          cantidad_avistamientos: number;
        };
        Relationships: [];
      };
      cambios_estado_detalle: {
        Row: {
          id: string;
          animal_id: string;
          usuario_id: string;
          usuario_nombre: string;
          estado_anterior: Database['public']['Enums']['estado_animal'];
          estado_nuevo: Database['public']['Enums']['estado_animal'];
          contacto_compartido: string | null;
          nota: string | null;
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
          creado_por: string;
          created_at: string;
          ultimo_avistamiento_en: string | null;
          lat: number;
          lng: number;
          ultimo_visto_en: string;
          cantidad_avistamientos: number;
        };
        Relationships: [];
      };
      avistamientos_detalle: {
        Row: {
          id: string;
          animal_id: string;
          usuario_id: string;
          usuario_nombre: string;
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
        };
        Returns: string;
      };
    };
    Enums: {
      estado_coincidencia: 'pendiente' | 'confirmada' | 'rechazada';
      estado_cola: 'pendiente' | 'procesando' | 'hecho' | 'error';
      motivo_denuncia: 'spam' | 'contenido_inapropiado' | 'informacion_falsa' | 'maltrato' | 'otro';
      estado_denuncia: 'pendiente' | 'revisada' | 'descartada';
      especie: 'perro' | 'gato' | 'otro';
      tamanio: 'chico' | 'mediano' | 'grande';
      estado_animal: 'avistado' | 'resguardado' | 'reunido' | 'vinculado';
      tipo_avistamiento: 'encontrado' | 'visto' | 'resguardado';
    };
    CompositeTypes: Record<string, never>;
  };
};
