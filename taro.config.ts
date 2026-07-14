import { defineConfig } from '@tarojs/cli'
import path from 'path'
import webpack from 'webpack'

export default defineConfig({
  projectName: 'liuli-park',
  framework: 'react',
  tsconfig: './tsconfig.json',
  sourceRoot: 'src',
  outputRoot: 'dist',
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    AMAP_WEB_KEY: process.env.AMAP_WEB_KEY || '320106c641e5603dcde8b521a58ee0c0',
    AMAP_SECRET_KEY: process.env.AMAP_SECRET_KEY || '',
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      url: {
        enable: true,
        config: {
          limit: 1024,
        },
      },
      cssModules: {
        enable: true,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
    webpackChain(chain) {
      chain.resolve.alias.set('@', path.resolve(__dirname, 'src'))
    },
  },
  h5: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      url: {
        enable: true,
        config: {
          limit: 1024,
        },
      },
      cssModules: {
        enable: true,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
    webpackChain(chain) {
      chain.resolve.alias.set('@', path.resolve(__dirname, 'src'))
      chain.plugin('define').use(webpack.DefinePlugin, [
        {
          'process.env': JSON.stringify({
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
            AMAP_WEB_KEY: process.env.AMAP_WEB_KEY || '320106c641e5603dcde8b521a58ee0c0',
            AMAP_SECRET_KEY: process.env.AMAP_SECRET_KEY || '',
          }),
        },
      ])
    },
  },
})
