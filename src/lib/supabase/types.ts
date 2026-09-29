export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; full_name: string | null; avatar_url: string | null };
        Insert: { id: string; email: string; full_name?: string | null; avatar_url?: string | null };
        Update: Partial<{ email: string; full_name: string | null; avatar_url: string | null }>;
        Relationships: [];
      };
      pages: {
        Row: {
          id: string;
          slug: string;
          organization_name: string;
          title: string;
          owner_id: string;
          is_private: boolean;
          voting_starts_at: string;
          voting_ends_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          organization_name: string;
          title: string;
          owner_id: string;
          is_private?: boolean;
          voting_starts_at: string;
          voting_ends_at: string;
        };
        Update: Partial<{
          organization_name: string;
          title: string;
          is_private: boolean;
          voting_starts_at: string;
          voting_ends_at: string;
        }>;
        Relationships: [];
      };
      allowed_domains: {
        Row: { page_id: string; domain: string };
        Insert: { page_id: string; domain: string };
        Update: Partial<{ domain: string }>;
        Relationships: [];
      };
      positions: {
        Row: { id: string; page_id: string; title: string; display_order: number };
        Insert: { id?: string; page_id: string; title: string; display_order: number };
        Update: Partial<{ title: string; display_order: number }>;
        Relationships: [];
      };
      candidates: {
        Row: { id: string; position_id: string; name: string; bio: string; photo_url: string | null };
        Insert: { id?: string; position_id: string; name: string; bio: string; photo_url?: string | null };
        Update: Partial<{ name: string; bio: string; photo_url: string | null }>;
        Relationships: [];
      };
      votes: {
        Row: { id: string; voter_id: string; position_id: string; candidate_id: string; updated_at: string };
        Insert: { id?: string; voter_id: string; position_id: string; candidate_id: string };
        Update: Partial<{ candidate_id: string }>;
        Relationships: [];
      };
      vote_tallies: {
        Row: { position_id: string; candidate_id: string; vote_count: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      voter_turnout: {
        Row: { page_id: string; position_id: string; voter_id: string; voted_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
