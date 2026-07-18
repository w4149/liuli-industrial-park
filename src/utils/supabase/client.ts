const getEnv = () => {
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__
  }
  return {}
}

const getSupabaseUrl = () => {
  const env = getEnv()
  return env.SUPABASE_URL || process.env.SUPABASE_URL || ''
}

const getSupabaseKey = () => {
  const env = getEnv()
  return env.SUPABASE_KEY || process.env.SUPABASE_KEY || ''
}

const getHeaders = () => {
  const supabaseKey = getSupabaseKey()
  return {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  }
}

export const supabaseClient = {
  from: (table: string) => ({
    select: async (columns: string = '*') => {
      const supabaseUrl = getSupabaseUrl()
      const headers = getHeaders()
      const url = `${supabaseUrl}/rest/v1/${table}?${columns === '*' ? '' : `select=${encodeURIComponent(columns)}`}`
      const response = await fetch(url, { headers })
      if (!response.ok) {
        let error = { message: 'Request failed' }
        try {
          const text = await response.text()
          if (text) {
            try {
              error = JSON.parse(text)
            } catch (e) {
              error = { message: text }
            }
          }
        } catch (e) {
          error = { message: response.statusText }
        }
        throw new Error(error.message || 'Select failed')
      }
      let data: any[] = []
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.warn('Failed to parse response JSON:', e)
      }
      return { data, error: null }
    },

    selectSingle: async (columns: string = '*') => {
      const supabaseUrl = getSupabaseUrl()
      const headers = getHeaders()
      const url = `${supabaseUrl}/rest/v1/${table}?${columns === '*' ? '' : `select=${encodeURIComponent(columns)}`}&limit=1`
      const response = await fetch(url, { headers })
      if (!response.ok) {
        let error = { message: 'Request failed' }
        try {
          const text = await response.text()
          if (text) {
            try {
              error = JSON.parse(text)
            } catch (e) {
              error = { message: text }
            }
          }
        } catch (e) {
          error = { message: response.statusText }
        }
        throw new Error(error.message || 'Select failed')
      }
      let data: any[] = []
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.warn('Failed to parse response JSON:', e)
      }
      return { data: data[0] || null, error: null }
    },

    eq: async (column: string, value: string | number, columns: string = '*') => {
      const supabaseUrl = getSupabaseUrl()
      const headers = getHeaders()
      const url = `${supabaseUrl}/rest/v1/${table}?${columns === '*' ? '' : `select=${encodeURIComponent(columns)}`}&${column}=eq.${value}`
      const response = await fetch(url, { headers })
      if (!response.ok) {
        let error = { message: 'Request failed' }
        try {
          const text = await response.text()
          if (text) {
            try {
              error = JSON.parse(text)
            } catch (e) {
              error = { message: text }
            }
          }
        } catch (e) {
          error = { message: response.statusText }
        }
        throw new Error(error.message || 'Query failed')
      }
      let data: any[] = []
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.warn('Failed to parse response JSON:', e)
      }
      return { data, error: null }
    },

    eqSingle: async (column: string, value: string | number, columns: string = '*') => {
      const supabaseUrl = getSupabaseUrl()
      const headers = getHeaders()
      const url = `${supabaseUrl}/rest/v1/${table}?${columns === '*' ? '' : `select=${encodeURIComponent(columns)}`}&${column}=eq.${value}&limit=1`
      const response = await fetch(url, { headers })
      if (!response.ok) {
        let error = { message: 'Request failed' }
        try {
          const text = await response.text()
          if (text) {
            try {
              error = JSON.parse(text)
            } catch (e) {
              error = { message: text }
            }
          }
        } catch (e) {
          error = { message: response.statusText }
        }
        throw new Error(error.message || 'Query failed')
      }
      let data: any[] = []
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.warn('Failed to parse response JSON:', e)
      }
      return { data: data[0] || null, error: null }
    },

    insert: async (values: any[]) => {
      const supabaseUrl = getSupabaseUrl()
      const supabaseKey = getSupabaseKey()
      const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation',
      }
      const url = `${supabaseUrl}/rest/v1/${table}?select=*`
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(values),
      })
      if (!response.ok) {
        let error = { message: 'Insert failed' }
        try {
          const text = await response.text()
          if (text) {
            try {
              error = JSON.parse(text)
            } catch (e) {
              error = { message: text }
            }
          }
        } catch (e) {
          error = { message: response.statusText }
        }
        throw new Error(error.message || 'Insert failed')
      }
      let data: any[] = []
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.warn('Failed to parse response JSON:', e)
      }
      return { data, error: null }
    },

    update: async (values: any, column: string, value: string | number) => {
      const supabaseUrl = getSupabaseUrl()
      const supabaseKey = getSupabaseKey()
      const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation',
      }
      const url = `${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(values),
      })
      if (!response.ok) {
        let error = { message: 'Update failed' }
        try {
          const text = await response.text()
          if (text) {
            try {
              error = JSON.parse(text)
            } catch (e) {
              error = { message: text }
            }
          }
        } catch (e) {
          error = { message: response.statusText }
        }
        throw new Error(error.message || 'Update failed')
      }
      let data: any[] = []
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.warn('Failed to parse response JSON:', e)
      }
      return { data, error: null }
    },

    delete: async (column: string, value: string | number) => {
      const supabaseUrl = getSupabaseUrl()
      const headers = getHeaders()
      const url = `${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) {
        let error = { message: 'Delete failed' }
        try {
          const text = await response.text()
          if (text) {
            try {
              error = JSON.parse(text)
            } catch (e) {
              error = { message: text }
            }
          }
        } catch (e) {
          error = { message: response.statusText }
        }
        throw new Error(error.message || 'Delete failed')
      }
      let data: any[] = []
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.warn('Failed to parse response JSON:', e)
      }
      return { data, error: null }
    },
  }),
}