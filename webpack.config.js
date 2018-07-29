const webpack = require('webpack'); //to access built-in plugins
const path = require('path');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

const config = {
  entry: './opus.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'opus.min.js',
    libraryTarget: 'umd'
  },
  plugins: [
    // new UglifyJSPlugin()
  ],
  resolve: {
    modules: [path.resolve(__dirname, "src"), "node_modules"]
  }
};

module.exports = config;