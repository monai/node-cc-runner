'use strict';

const url = require('url');
const http = require('http');
const path = require('path');
const util = require('util');

const async = require('async');
const javaHome = require('locate-java-home');
const child_process = require('child_process');

const apply = async.apply;
const asyncify = async.asyncify;
const waterfall = async.waterfall;
const spawn = child_process.spawn;
const assign = Object.assign;
const now = Date.now;
const debug = util.debuglog('cc-runner');

const serviceDefaults = {
  jar     : path.resolve(__dirname, 'cc-web-runner-standalone-1.0.8.jar'),
  url     : 'http://127.0.0.1:8081',
  timeout : 100
};

const services = {};

module.exports = create;

function create(options) {
  const instance = service(options);

  const request = (path, data, callback) => {
    if (instance.args && ! instance.started) {
      service_start(instance);
    }

    service_request(instance, path, callback ? data : null, callback || data);
  };

  const status = (query, callback) => {
    request(
      'status'+ (callback ? queryString(query) : ''),
      callback || query);
  };

  http.globalAgent.keepAlive = true;

  return {
    start: apply(service_start, instance),
    stop: apply(service_stop, instance, Error('User initiated exit')),
    request: request,
    compile: apply(request, 'compile'),
    externs: apply(request, 'externs'),
    status: status
  };
}

function service(options) {
  options = options || {};

  const opt = assign(
    url.parse(serviceDefaults.url),
    serviceDefaults,
    options.url && url.parse(options.url),
    options);

  const args = opt.jar && [ '-Dport='+ opt.port, '-jar', opt.jar ];
  const base = url.format(opt);

  if ( ! services[base]) {
    const service = {
      args: args,
      base: base,
      pending: 0,
      lastRequest: 0,
      timeout: opt.timeout
    };

    if (args) {
      debug('created for "%s" with arguments "%s"', base, args.join(' '));
    } else {
      debug('created for "%s"', base);
    }

    services[base] = service;
  }

  return services[base];
}

function service_start(service, callback) {
  const listen = e => callback && callback(e);

  if (service.started) {
    debug('service already started');
    if (service.listen) {
      service.listen.push(listen);
    } else {
      process.nextTick(listen);
    }
  } else if (service.args) {
    debug('start service');
    service.started = true;
    service.listen = [ listen ];

    const abortTest = (result, callback) => {
      if (service.started) {
        callback(null, result);
      } else {
        callback(Error('User aborted Java execution'));
      }
    };

    waterfall([
      apply(javaHome, { version: '>=1.8' }),
      abortTest,
      asyncify(javaResolve),
      abortTest,
      apply(service_execute, service) ],
      error => service_release(service, error));
  } else {
    process.nextTick(() => listen(Error('Nothing to start')));
  }
}

function service_execute(service, java, callback) {
  debug('execute runner: %s %s', java, service.args.join(' '));

  const proc = spawn(java, service.args).once('error', callback);
  proc.stdout.on('data', read('stdout')).setEncoding('utf8');
  proc.stderr.on('data', read('stderr')).setEncoding('utf8');

  service.process = proc;

  function read(title) {
    return function read_(data) {
      data = data.trim();
      if (data) {
        data.split('\n').forEach(readLine);
      }
    };

    function readLine(data) {
      debug('%s: %s', title, data);

      if (data.match(/Started @\d+ms$/)) {
        if (service.timeout) {
          debug('service started with timeout %dms', service.timeout);
          service.lastRequest = now();
          setTimeout(timeout, service.timeout);
        } else {
          debug('service started');
        }

        callback();
      }

      if (data.indexOf('Exception in thread "main"') >= 0) {
        debug('service exception: stopping');
        const error = Error('Unexpected service exception');
        service_stop(service, error);
        callback(error);
      }
    }
  }

  function timeout() {
    if (service.process) {
      const diff = service.pending ? 0 : (now() - service.lastRequest);
      if (diff >= service.timeout) {
        debug('service stopped after timeout %dms >= %dms', diff, service.timeout);
        service_stop(service);
      } else {
        setTimeout(timeout, service.timeout - diff);
      }
    }
  }
}

function service_release(service, error) {
  if (service.listen) {
    const listen = service.listen;
    delete service.listen;
    listen.forEach(listen => listen(error, service));
  }
}

function service_stop(service, error, callback) {
  if (service.started) {
    service.started = false;
    debug('stop service');
    service_release(service, error);
    if (service.process) {
      service.process.kill();
      service.process = null;
    }
  } else {
    debug('service not started');
  }

  if (callback) {
    process.nextTick(callback);
  }
}

function service_request(service, path, data, callback) {
  const url = service.base + path;

  if (service.listen) {
    debug('boot mode: post-pone "%s" request', url);
    service.listen.push(e => e ? callback(e) : request_(callback));
  } else {
    request_(callback);
  }

  function request_(callback) {
    debug('request "%s"', url);

    service.pending++;
    http_request(url, data, (error, result) => {
      if (error) {
        debug('response for "%s" with error', url);
      } else {
        debug('response for "%s"', url);
      }

      service.pending--;
      service.lastRequest = now();
      callback(error, result);
    });
  }
}

function http_request(options, data, callback) {
  if (typeof options === 'string') {
    options = url.parse(options);
  } else {
    options = assign({}, options);
  }

  if ( ! callback) {
    callback = data;
    data = null;
  }

  options.method = data ? 'POST' : 'GET';

  try {
    const request = http
      .request(options)
      .once('error', callback);

    request.on('response', response => {
      if (response.statusCode !== 200) {
        const error = Error('HTTP '+ response.statusCode +' '+ response.statusMessage);
        error.serviceResponse = true;
        callback(error);
      } else {
        const data = [];
        response
          .once('error', callback)
          .on('data', chunk => data.push(chunk))
          .on('end', apply(asyncify(() => JSON.parse(data.join(''))), callback))
          .setEncoding('utf8');
      }
    });

    if (data) {
      request.setHeader('content-type', 'application/json');
      request.write(JSON.stringify(data));
    }

    request.end();
  } catch (error) {
    callback(error);
  }
}

function queryString(query) {
  if (query) {
    if (typeof query === 'string') {
      query = '?'+ query.replce(/^[&?]+/, '');
    } else {
      query = url.format({ query });
    }
  }

  return query || '';
}

function javaResolve(result) {
  try {
    return result[0].executables.java.slice(0);
  } catch (ex) {
    throw Error('Java not found');
  }
}
