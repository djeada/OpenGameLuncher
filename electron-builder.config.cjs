const { readFileSync } = require('node:fs')
const path = require('node:path')

const ogl = JSON.parse(readFileSync(path.join(__dirname, 'ogl.config.json'), 'utf8'))
const placeholder = ogl.repository.owner === 'your-github-user'

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'dev.ogl.launcher',
  productName: 'OGL',
  copyright: 'Copyright (c) 2026 OGL contributors',
  directories: {
    output: 'release',
    buildResources: 'build'
  },
  files: ['out/**/*', 'package.json'],
  extraResources: [
    { from: 'catalog', to: 'catalog' },
    { from: 'ogl.config.json', to: 'ogl.config.json' }
  ],
  publish: placeholder
    ? undefined
    : {
        provider: 'github',
        owner: ogl.repository.owner,
        repo: ogl.repository.name,
        releaseType: 'draft'
      },
  mac: {
    category: 'public.app-category.games',
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] }
    ],
    icon: 'build/icon.png',
    identity: process.env.CSC_LINK ? undefined : null,
    notarize: Boolean(process.env.CSC_LINK && process.env.APPLE_ID)
  },
  win: {
    target: ['nsis'],
    icon: 'build/icon.png'
  },
  linux: {
    target: ['AppImage'],
    category: 'Game',
    icon: 'build/icon.png'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  }
}
