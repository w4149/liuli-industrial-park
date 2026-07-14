import { defineConfig } from '@tarojs/cli'
import path from 'path'
import webpack from 'webpack'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export default defineConfig({
  projectName: 'liuli-park',
  framework: 'react',
  tsconfig: './tsconfig.json',
  sourceRoot: 'src',
  outputRoot: 'dist',
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kogepquzrobmrnfywotk.supabase.co',
    SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_u3SIM3wcgSmUF8FknrTYlA_SarIxaF8',
    AMAP_WEB_KEY: process.env.AMAP_WEB_KEY || '320106c641e5603dcde8b521a58ee0c0',
    AMAP_SECRET_KEY: process.env.AMAP_SECRET_KEY || 'dde3ac3456c911b38951e739a85f1d93',
  },
  defineConstants: {
    'process.env.SUPABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kogepquzrobmrnfywotk.supabase.co'),
    'process.env.SUPABASE_KEY': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_u3SIM3wcgSmUF8FknrTYlA_SarIxaF8'),
    'process.env.AMAP_WEB_KEY': JSON.stringify(process.env.AMAP_WEB_KEY || '320106c641e5603dcde8b521a58ee0c0'),
    'process.env.AMAP_SECRET_KEY': JSON.stringify(process.env.AMAP_SECRET_KEY || 'dde3ac3456c911b38951e739a85f1d93'),
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
    },
  },
})
