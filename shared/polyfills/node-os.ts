export function tmpdir() {
  return "/tmp";
}
export function platform() {
  return "linux";
}
export function hostname() {
  return "worker";
}
export function homedir() {
  return "/";
}
export function type() {
  return "Linux";
}
export function release() {
  return "0.0.0";
}
export function arch() {
  return "x64";
}
export function cpus() {
  return [];
}
export function totalmem() {
  return 0;
}
export function freemem() {
  return 0;
}
export function uptime() {
  return 0;
}
export function loadavg() {
  return [0, 0, 0];
}
export function networkInterfaces() {
  return {};
}
export function userInfo() {
  return { username: "worker", uid: 0, gid: 0, shell: "", homedir: "/" };
}
export function EOL() {
  return "\n";
}
const os = {
  tmpdir,
  platform,
  hostname,
  homedir,
  type,
  release,
  arch,
  cpus,
  totalmem,
  freemem,
  uptime,
  loadavg,
  networkInterfaces,
  userInfo,
  EOL,
};
export default os;
