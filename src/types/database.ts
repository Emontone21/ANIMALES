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
    };
    Views: {
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
      especie: 'perro' | 'gato' | 'otro';
      tamanio: 'chico' | 'mediano' | 'grande';
      estado_animal: 'avistado' | 'resguardado' | 'reunido' | 'vinculado';
      tipo_avistamiento: 'encontrado' | 'visto' | 'resguardado';
    };
    CompositeTypes: Record<string, never>;
  };
};
