export type Json = string | number | boolean | null | {
  [key: string]: Json | undefined
} | Json[]

export type Database = {
  "graphql_public": {
    Tables: { [_ in never]: never }
    Views: { [_ in never]: never }
    Functions: {
      "graphql": {
        Args: {
          "extensions"?: Json
          "operationName"?: string
          "query"?: string
          "variables"?: Json
        }
        Returns: Json
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
  "public": {
    Tables: {
      "allowed_domains": {
        Row: {
          "domain": string
          "page_id": string
        }
        Insert: {
          "domain": string
          "page_id": string
        }
        Update: {
          "domain"?: string
          "page_id"?: string
        }
        Relationships: [{
          foreignKeyName: "allowed_domains_page_id_fkey"
          columns: ["page_id"]
          isOneToOne: false
          referencedRelation: "pages"
          referencedColumns: ["id"]
        }]
      }
      "candidates": {
        Row: {
          "bio": string
          "id": string
          "name": string
          "photo_url": string | null
          "position_id": string
        }
        Insert: {
          "bio"?: string
          "id"?: string
          "name": string
          "photo_url"?: string | null
          "position_id": string
        }
        Update: {
          "bio"?: string
          "id"?: string
          "name"?: string
          "photo_url"?: string | null
          "position_id"?: string
        }
        Relationships: [{
          foreignKeyName: "candidates_position_id_fkey"
          columns: ["position_id"]
          isOneToOne: false
          referencedRelation: "positions"
          referencedColumns: ["id"]
        }]
      }
      "pages": {
        Row: {
          "created_at": string
          "id": string
          "is_private": boolean
          "organization_name": string
          "owner_id": string
          "slug": string
          "title": string
          "voting_ends_at": string
          "voting_starts_at": string
        }
        Insert: {
          "created_at"?: string
          "id"?: string
          "is_private"?: boolean
          "organization_name": string
          "owner_id": string
          "slug": string
          "title": string
          "voting_ends_at": string
          "voting_starts_at": string
        }
        Update: {
          "created_at"?: string
          "id"?: string
          "is_private"?: boolean
          "organization_name"?: string
          "owner_id"?: string
          "slug"?: string
          "title"?: string
          "voting_ends_at"?: string
          "voting_starts_at"?: string
        }
        Relationships: [{
          foreignKeyName: "pages_owner_id_fkey"
          columns: ["owner_id"]
          isOneToOne: false
          referencedRelation: "profiles"
          referencedColumns: ["id"]
        }]
      }
      "positions": {
        Row: {
          "display_order": number
          "id": string
          "page_id": string
          "title": string
        }
        Insert: {
          "display_order"?: number
          "id"?: string
          "page_id": string
          "title": string
        }
        Update: {
          "display_order"?: number
          "id"?: string
          "page_id"?: string
          "title"?: string
        }
        Relationships: [{
          foreignKeyName: "positions_page_id_fkey"
          columns: ["page_id"]
          isOneToOne: false
          referencedRelation: "pages"
          referencedColumns: ["id"]
        }]
      }
      "profiles": {
        Row: {
          "avatar_url": string | null
          "email": string
          "full_name": string | null
          "id": string
        }
        Insert: {
          "avatar_url"?: string | null
          "email": string
          "full_name"?: string | null
          "id": string
        }
        Update: {
          "avatar_url"?: string | null
          "email"?: string
          "full_name"?: string | null
          "id"?: string
        }
        Relationships: []
      }
      "vote_tallies": {
        Row: {
          "candidate_id": string
          "position_id": string
          "vote_count": number
        }
        Insert: {
          "candidate_id": string
          "position_id": string
          "vote_count"?: number
        }
        Update: {
          "candidate_id"?: string
          "position_id"?: string
          "vote_count"?: number
        }
        Relationships: [{
          foreignKeyName: "vote_tallies_candidate_id_fkey"
          columns: ["candidate_id"]
          isOneToOne: false
          referencedRelation: "candidates"
          referencedColumns: ["id"]
        }, {
          foreignKeyName: "vote_tallies_position_id_fkey"
          columns: ["position_id"]
          isOneToOne: false
          referencedRelation: "positions"
          referencedColumns: ["id"]
        }]
      }
      "voter_turnout": {
        Row: {
          "page_id": string
          "position_id": string
          "voted_at": string
          "voter_id": string
        }
        Insert: {
          "page_id": string
          "position_id": string
          "voted_at"?: string
          "voter_id": string
        }
        Update: {
          "page_id"?: string
          "position_id"?: string
          "voted_at"?: string
          "voter_id"?: string
        }
        Relationships: [{
          foreignKeyName: "voter_turnout_page_id_fkey"
          columns: ["page_id"]
          isOneToOne: false
          referencedRelation: "pages"
          referencedColumns: ["id"]
        }, {
          foreignKeyName: "voter_turnout_position_id_fkey"
          columns: ["position_id"]
          isOneToOne: false
          referencedRelation: "positions"
          referencedColumns: ["id"]
        }, {
          foreignKeyName: "voter_turnout_voter_id_fkey"
          columns: ["voter_id"]
          isOneToOne: false
          referencedRelation: "profiles"
          referencedColumns: ["id"]
        }]
      }
      "votes": {
        Row: {
          "candidate_id": string
          "id": string
          "position_id": string
          "updated_at": string
          "voter_id": string
        }
        Insert: {
          "candidate_id": string
          "id"?: string
          "position_id": string
          "updated_at"?: string
          "voter_id": string
        }
        Update: {
          "candidate_id"?: string
          "id"?: string
          "position_id"?: string
          "updated_at"?: string
          "voter_id"?: string
        }
        Relationships: [{
          foreignKeyName: "votes_candidate_id_fkey"
          columns: ["candidate_id"]
          isOneToOne: false
          referencedRelation: "candidates"
          referencedColumns: ["id"]
        }, {
          foreignKeyName: "votes_candidate_matches_position"
          columns: ["candidate_id", "position_id"]
          isOneToOne: false
          referencedRelation: "candidates"
          referencedColumns: ["id", "position_id"]
        }, {
          foreignKeyName: "votes_position_id_fkey"
          columns: ["position_id"]
          isOneToOne: false
          referencedRelation: "positions"
          referencedColumns: ["id"]
        }, {
          foreignKeyName: "votes_voter_id_fkey"
          columns: ["voter_id"]
          isOneToOne: false
          referencedRelation: "profiles"
          referencedColumns: ["id"]
        }]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      "find_page_by_owner_slug": {
        Args: { "p_owner_id": string; "p_slug": string }
        Returns: {
          "is_private": boolean
          "page_id": string
        }[]
      }
      "get_page_privacy": { Args: { "p_page_id": string }; Returns: boolean }
      "is_domain_allowed": {
        Args: { "p_email": string; "p_page_id": string }
        Returns: boolean
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
