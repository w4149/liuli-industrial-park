const env = (typeof window !== 'undefined' && (window as any).__ENV__) || {}
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

const headers = {
  'Content-Type': 'application/json',
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
}

export const supabaseClient = {
  from: (table: string) => ({
    select: async (columns: string = '*') => {
      const url = `${supabaseUrl}/rest/v1/${table}?${columns === '*' ? '' : `select=${encodeURIComponent(columns)}`}`
      const response = await fetch(url, { headers })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }))
        throw new Error(error.message || 'Select failed')
      }
      return { data: await response.json(), error: null }
    },

    selectSingle: async (columns: string = '*') => {
      const url = `${supabaseUrl}/rest/v1/${table}?${columns === '*' ? '' : `select=${encodeURIComponent(columns)}`}&limit=1`
      const response = await fetch(url, { headers })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }))
        throw new Error(error.message || 'Select failed')
      }
      const data = await response.json()
      return { data: data[0] || null, error: null }
    },

    eq: async (column: string, value: string | number, columns: string = '*') => {
      const url = `${supabaseUrl}/rest/v1/${table}?${columns === '*' ? '' : `select=${encodeURIComponent(columns)}`}&${column}=eq.${value}`
      const response = await fetch(url, { headers })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }))
        throw new Error(error.message || 'Query failed')
      }
      return { data: await response.json(), error: null }
    },

    eqSingle: async (column: string, value: string | number, columns: string = '*') => {
      const url = `${supabaseUrl}/rest/v1/${table}?${columns === '*' ? '' : `select=${encodeURIComponent(columns)}`}&${column}=eq.${value}&limit=1`
      const response = await fetch(url, { headers })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }))
        throw new Error(error.message || 'Query failed')
      }
      const data = await response.json()
      return { data: data[0] || null, error: null }
    },

    insert: async (values: any[]) => {
      const url = `${supabaseUrl}/rest/v1/${table}?select=*`
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(values),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Insert failed' }))
        throw new Error(error.message || 'Insert failed')
      }
      return { data: await response.json(), error: null }
    },

    update: async (values: any, column: string, value: string | number) => {
      const url = `${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(values),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Update failed' }))
        throw new Error(error.message || 'Update failed')
      }
      return { data: await response.json(), error: null }
    },

    delete: async (column: string, value: string | number) => {
      const url = `${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Delete failed' }))
        throw new Error(error.message || 'Delete failed')
      }
      return { data: await response.json(), error: null }
    },
  }),
}