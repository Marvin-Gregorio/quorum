import type { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Page = Database['public']['Tables']['pages']['Row'];
export type AllowedDomain = Database['public']['Tables']['allowed_domains']['Row'];
export type Position = Database['public']['Tables']['positions']['Row'];
export type Candidate = Database['public']['Tables']['candidates']['Row'];
export type Vote = Database['public']['Tables']['votes']['Row'];
export type VoteTally = Database['public']['Tables']['vote_tallies']['Row'];
export type VoterTurnout = Database['public']['Tables']['voter_turnout']['Row'];
