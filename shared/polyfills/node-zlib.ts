export function gzip(input: any, options?: any, callback?: any) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  const data = input instanceof Uint8Array || Buffer.isBuffer?.(input) ? input : new TextEncoder().encode(String(input));
  if (typeof callback === "function") {
    callback(null, data);
    return;
  }
  return Promise.resolve(data);
}
export function gunzip() {
  throw new Error("gunzip not implemented in polyfill");
}
export function deflate() {
  throw new Error("deflate not implemented in polyfill");
}
export function inflate() {
  throw new Error("inflate not implemented in polyfill");
}
export function createGzip() {
  throw new Error("createGzip not implemented in polyfill");
}
const zlib = { gzip, gunzip, deflate, inflate, createGzip };
export default zlib;
