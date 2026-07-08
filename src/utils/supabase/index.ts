import { supabaseClient } from './client'

export const supabase = supabaseClient

export type SupabaseClient = typeof supabaseClient