// Types for the public schema in supabase/migrations/0001_init.sql.
// Regenerate with the Supabase MCP generate_typescript_types (or
// `supabase gen types typescript --project-id <ref>`) once the project exists.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      courses: {
        Row: {
          id: string; code: string; slug: string; title: string; category: string; instructor: string | null;
          schedule: string; color: string; tone: string; calendar_event_series_ids: string[];
          aliases: string[]; term: string; generation_notes: string | null; created_at: string;
        };
        Insert: {
          id?: string; code: string; slug: string; title: string; category: string; instructor?: string | null;
          schedule: string; color: string; tone?: string; calendar_event_series_ids?: string[];
          aliases?: string[]; term: string; generation_notes?: string | null; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>;
        Relationships: [];
      };
      lectures: {
        Row: {
          id: string; course_id: string | null; wispr_meeting_id: string; calendar_event_id: string | null;
          starts_at: string | null; ends_at: string | null; transcript: string | null;
          wispr_share_link: string | null; status: string; created_at: string;
        };
        Insert: {
          id?: string; course_id?: string | null; wispr_meeting_id: string; calendar_event_id?: string | null;
          starts_at?: string | null; ends_at?: string | null; transcript?: string | null;
          wispr_share_link?: string | null; status?: string; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lectures"]["Insert"]>;
        Relationships: [];
      };
      lessons: {
        Row: {
          id: string; slug: string; lecture_id: string; title: string; summary: string | null;
          est_minutes: number | null; spec: Json; schema_version: number; status: string; created_at: string;
        };
        Insert: {
          id?: string; slug: string; lecture_id: string; title: string; summary?: string | null;
          est_minutes?: number | null; spec: Json; schema_version?: number; status?: string; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lessons"]["Insert"]>;
        Relationships: [];
      };
      concepts: {
        Row: { id: string; course_id: string; name: string; first_lesson_id: string | null; created_at: string };
        Insert: { id?: string; course_id: string; name: string; first_lesson_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["concepts"]["Insert"]>;
        Relationships: [];
      };
      attempts: {
        Row: { id: string; lesson_id: string; block_id: string; answer: Json | null; correct: boolean; created_at: string };
        Insert: { id?: string; lesson_id: string; block_id: string; answer?: Json | null; correct: boolean; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["attempts"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
