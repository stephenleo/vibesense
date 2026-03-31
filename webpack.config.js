// webpack.config.js — dual-target export
// Target 1: Node.js extension host bundle
// Target 2: Browser Webview bundle
'use strict'

const path = require('path')

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  entry: './src/extension/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
    'node-hid': 'commonjs node-hid',
    'dualsense-ts': 'commonjs dualsense-ts',
  },
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: { configFile: 'tsconfig.node.json' },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: { level: 'log' },
}

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: 'web',
  entry: {
    'radial-wheel': './src/webview/radial-wheel/index.tsx',
    session: './src/webview/session/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist/webview'),
    filename: '[name].js',
  },
  resolve: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: { configFile: 'tsconfig.webview.json' },
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  devtool: 'nosources-source-map',
}

module.exports = [extensionConfig, webviewConfig]
