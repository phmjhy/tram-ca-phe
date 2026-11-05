import pg from 'pg';
// pg emits errors from idle clients after a restart/failover. Without a listener,
// EventEmitter terminates the worker before the next request can reconnect.
export function createManagedPool(options,onIdleError=event=>console.error(JSON.stringify(event))){
 const pool=new pg.Pool(options);
 pool.on('error',error=>onIdleError({event:'database_idle_connection_error',code:/^[A-Z0-9_]{1,32}$/.test(error.code||'')?error.code:'DATABASE_CONNECTION_ERROR'}));
 return pool;
}
