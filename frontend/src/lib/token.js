// Token management - in-memory store for access token
let _memToken = null;

export function getMemToken() { return _memToken; }
export function setMemToken(t) { _memToken = t; }
export function clearMemToken() { _memToken = null; }