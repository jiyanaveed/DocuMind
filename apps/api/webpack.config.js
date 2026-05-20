const nodeExternals = require('webpack-node-externals');

module.exports = (options) => ({
  ...options,
  externals: [
    nodeExternals({
      // Bundle workspace packages inline instead of leaving them as require() calls
      allowlist: [/@repo\//],
    }),
  ],
});
