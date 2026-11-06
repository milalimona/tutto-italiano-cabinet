(function(root){
  'use strict';
  const configuredBaseUrl='';
  const localHost=typeof location!=='undefined'&&['127.0.0.1','localhost'].includes(location.hostname);
  const localOverride=localHost?new URLSearchParams(location.search).get('api')||'':'';
  root.TUTTO_API_BASE_URL=String(root.TUTTO_API_BASE_URL||localOverride||configuredBaseUrl).replace(/\/+$/,'');
})(typeof globalThis!=='undefined'?globalThis:this);
