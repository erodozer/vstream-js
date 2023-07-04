# vstream-server

This is simple server that calls some VStream data endpoints to  get the information needed to connect to the correct websocket room.

Right now VStream's API does not support CORS, so it can not be called from the browser from local domains.  This inhibits vstream-js's ability to have a frictionless user experience.  To work around that, this process can be run to perform server-server calls to VStream, which is more permissive.

VStream-js is currently set up to call an instance of this integration existing on [erodozer.moe].  You may run your own instance of this exchanger and connect to it with minimal modification to the lib.  Hopefully in the future when the API is public, this integration will not be necessary, or there will be cleaner ways to connect to the WSS.
