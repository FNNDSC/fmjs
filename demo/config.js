require.config({
  baseUrl: '../bower_components',

  // use packages to be able to use relative paths
  packages: [
    {
      name: 'fmjs', // used for mapping...
      location: './', // relative to base url
      main: 'fmjs/src/js/fmjs'
    }
  ]
});
