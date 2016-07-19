"use strict";

const util   = require('util');
const runner = require('../index');

const run = runner();

run.start(error => {
  console.log('--> startup');
  if (error) {
    console.error(error.stack);
    return;
  }

  const report = title =>
    (error, result) => {
      console.log(title);
      if (error) {
        console.error(error.stack);
      } else {
        console.log(util.inspect(result, { colors: true }));
      }
    };

  run.status(
    { level: 'SIMPLE_OPTIMIZATIONS' },
    report('--> status'));

  run.compile(
    { optimizations: { level: "SIMPLE_OPTIMIZATIONS" },
      sources: [
        { fileName: 'bar.js',
          code: '(console.log(function(){return 42-9;}));' } ] },
    report('--> compile'));
});
