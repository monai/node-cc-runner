# node-cc-runner

Client for [Closure Compiler web runner](https://github.com/monai/cc-web-runner).

## Install

`npm install cc-runner`

## Usage

```js
const runner = require('cc-runner');
const compiler = runner();

compiler.start(err => {
  if (err) {
    console.error(err.stack);
    return;
  }

  compiler.status((err, res) => {
    console.log(err || res);
  });

  compiler.compile({
    optimizations: { level: "SIMPLE_OPTIMIZATIONS" },
    sources: [ {
      fileName: 'bar.js',
      code: '(console.log(function(){return 42-9;}));'
    } ]
  }, (err, res) => {
    console.log(err || res);
  });
});
```


## Instantiation

Runner instance will automatically launch child process on first request (if `jar` option is not `false`) and kill after last response (after `timeout` period).

## Options

- `jar` - path to Closure Compiler web runner jar file (default: automatically downloaded `cc-web-runner-standalone-1.0.8.jar`).
- `url` - Closure Compiler web runner service URL to be used in API calls (default: `http://127.0.0.1:8081/`).
- `timeout` - timeout since last request after which web service is stopped (default: `100ms`). If `timeout` is `0`, then web service is not stopped automatically.

```js
const runner = require('cc-runner');

// Custom Closure Compiler web runner build
const customCCWJar = runner({
  jar: '/path/to/cc-web-runner.jar',
  url: 'http://localhost:9080/'
});

customCCWJar.status((err, res) => {
  console.log('Status response from custom build');
  console.log(res);
});

// If Closure Compiler web runner is not already listening on 8080 port, start and stop methods will fail on this instance.
// `jar: false` option is useful when Closure Compiler web runner service is managed from outside of Node.js process, e.g. is running on servlet container.
const clientOnly = runner({
  jar: false,
  url: 'http://localhost:8080/'
});

clientOnly.start(err => {
  console.error(err.stack);
});

const httpService = runner({
  timeout: 0, // Don't try to stop service automatically
});

httpService.start();
```

## start([callback])

Start Closure Compiler web runner service. Callback is called after the service started to listen for requests.

Callback arguments:

- `error`

## stop([callback])

Stop Closure Compiler web runner service.

## status([options,] callback)

Options:

- `level` String - is of type [CompilationLevel](https://github.com/google/closure-compiler/blob/29bbd198f0bf4967e4f406674b3eaf302a1f16a4/src/com/google/javascript/jscomp/CompilationLevel.java), compilation level
- `debug` Boolean - whether to call `setDebugOptionsForCompilationLevel`
- `typeBased` Boolean - whether to call `setTypeBasedOptimizationOptions`
- `wrappedOutput` Boolean - whether to call `setWrappedOutputOptimizations`

Callback arguments:

- `error`
- `object`
  - `options` Object - is of type [CompilerOptions](https://github.com/google/closure-compiler/blob/v20160208/src/com/google/javascript/jscomp/CompilerOptions.java), compiler options
  - `compilerVersions` String - Closure Compiler version

## externs(callback)

Callback arguments:

- `error`
- `object`
  - `externs` Array - is of type List&lt;[SourceFile](https://github.com/google/closure-compiler/blob/master/src/com/google/javascript/jscomp/SourceFile.java)&gt;, array of extern files

## compile(data, callback)

Data:

- `externs` Array - `[{ fileName: String, code: String }]`, array of extern files
- `sources` Array - `[{ fileName: String, code: String }]`, array of source files to compile
- `optimizations`
  - `level` String - is of type [CompilationLevel](https://github.com/google/closure-compiler/blob/29bbd198f0bf4967e4f406674b3eaf302a1f16a4/src/com/google/javascript/jscomp/CompilationLevel.java), compilation level
  - `debug` Boolean - whether to call `setDebugOptionsForCompilationLevel`
  - `typeBased` Boolean - whether to call `setTypeBasedOptimizationOptions`
  - `wrappedOutput` Boolean - whether to call `setWrappedOutputOptimizations`
- `options` Object - is of type [CompilerOptions](https://github.com/google/closure-compiler/blob/v20160208/src/com/google/javascript/jscomp/CompilerOptions.java), compiler options

Callback arguments:

- `error`
- `object`
  - `result` Object - is of type [Result](https://github.com/google/closure-compiler/blob/v20160208/src/com/google/javascript/jscomp/Result.java), compilations results
  - `source` String - compiled source
  - `status` String - SUCCESS|ERROR
  - `message` String - error message if status is 'ERROR'
  - `exception` Object - is of type Throwable, occurred exception

## License

ISC
