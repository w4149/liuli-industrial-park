import { Component } from 'react'
import './app.scss'

;(window as any).__ENV__ = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  AMAP_WEB_KEY: process.env.AMAP_WEB_KEY || '320106c641e5603dcde8b521a58ee0c0',
  AMAP_SECRET_KEY: process.env.AMAP_SECRET_KEY || '',
}

class App extends Component {
  componentDidMount() {}

  componentWillUnmount() {}

  render() {
    return this.props.children
  }
}

export default App
