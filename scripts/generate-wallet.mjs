#!/usr/bin/env node
/**
 * generate-wallet.mjs — create a Casper Ed25519 testnet keypair.
 *
 * Pure Node (no external deps), so it runs before `npm install` and is immune
 * to casper-js-sdk version churn. Derives the account hash with BLAKE2b-256
 * exactly as Casper does: blake2b256( "ed25519" + 0x00 + publicKeyBytes ).
 *
 *   node scripts/generate-wallet.mjs
 */
import crypto from "node:crypto";

// ── BLAKE2b (dcposch/blakejs, MIT) ──────────────────────
const IV32 = new Uint32Array([
  0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372,
  0x5f1d36f1, 0xa54ff53a, 0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c,
  0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19,
]);
const SIGMA8 = [
  0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15, 14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3,
  11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4, 7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8,
  9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13, 2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9,
  12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11, 13,11,7,14,12,1,3,9,5,0,15,4,8,6,2,10,
  6,15,14,9,11,3,0,8,12,2,13,7,1,4,10,5, 10,2,8,4,7,6,1,5,15,11,9,14,3,12,13,0,
  0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15, 14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3,
];
const SIGMA82 = new Uint8Array(SIGMA8.map((x) => x * 2));
const v = new Uint32Array(32), m = new Uint32Array(32);
const ADDAA = (o,a,b)=>{const o0=o[a]+o[b];let o1=o[a+1]+o[b+1];if(o0>=0x100000000)o1++;o[a]=o0;o[a+1]=o1;};
const ADDAC = (o,a,b0,b1)=>{let o0=o[a]+b0;if(b0<0)o0+=0x100000000;let o1=o[a+1]+b1;if(o0>=0x100000000)o1++;o[a]=o0;o[a+1]=o1;};
const GET32 = (a,i)=>a[i]^(a[i+1]<<8)^(a[i+2]<<16)^(a[i+3]<<24);
function G(a,b,c,d,ix,iy){
  const x0=m[ix],x1=m[ix+1],y0=m[iy],y1=m[iy+1];
  ADDAA(v,a,b);ADDAC(v,a,x0,x1);
  let xo=v[d]^v[a],xi=v[d+1]^v[a+1];v[d]=xi;v[d+1]=xo;
  ADDAA(v,c,d);xo=v[b]^v[c];xi=v[b+1]^v[c+1];v[b]=(xo>>>24)^(xi<<8);v[b+1]=(xi>>>24)^(xo<<8);
  ADDAA(v,a,b);ADDAC(v,a,y0,y1);xo=v[d]^v[a];xi=v[d+1]^v[a+1];v[d]=(xo>>>16)^(xi<<16);v[d+1]=(xi>>>16)^(xo<<16);
  ADDAA(v,c,d);xo=v[b]^v[c];xi=v[b+1]^v[c+1];v[b]=(xi>>>31)^(xo<<1);v[b+1]=(xo>>>31)^(xi<<1);
}
function compress(ctx,last){
  for(let i=0;i<16;i++){v[i]=ctx.h[i];v[i+16]=IV32[i];}
  v[24]^=ctx.t;v[25]^=ctx.t/0x100000000;
  if(last){v[28]=~v[28];v[29]=~v[29];}
  for(let i=0;i<32;i++)m[i]=GET32(ctx.b,4*i);
  for(let i=0;i<12;i++){
    G(0,8,16,24,SIGMA82[i*16+0],SIGMA82[i*16+1]);G(2,10,18,26,SIGMA82[i*16+2],SIGMA82[i*16+3]);
    G(4,12,20,28,SIGMA82[i*16+4],SIGMA82[i*16+5]);G(6,14,22,30,SIGMA82[i*16+6],SIGMA82[i*16+7]);
    G(0,10,20,30,SIGMA82[i*16+8],SIGMA82[i*16+9]);G(2,12,22,24,SIGMA82[i*16+10],SIGMA82[i*16+11]);
    G(4,14,16,26,SIGMA82[i*16+12],SIGMA82[i*16+13]);G(6,8,18,28,SIGMA82[i*16+14],SIGMA82[i*16+15]);
  }
  for(let i=0;i<16;i++)ctx.h[i]^=v[i]^v[i+16];
}
function blake2b(input,outlen=32){
  const ctx={b:new Uint8Array(128),h:new Uint32Array(16),t:0,c:0,outlen};
  for(let i=0;i<16;i++)ctx.h[i]=IV32[i];
  ctx.h[0]^=0x01010000^outlen;
  for(let i=0;i<input.length;i++){if(ctx.c===128){ctx.t+=ctx.c;compress(ctx,false);ctx.c=0;}ctx.b[ctx.c++]=input[i];}
  ctx.t+=ctx.c;while(ctx.c<128)ctx.b[ctx.c++]=0;compress(ctx,true);
  const out=new Uint8Array(outlen);for(let i=0;i<outlen;i++)out[i]=ctx.h[i>>2]>>(8*(i&3));return out;
}
const hex=(u)=>Array.from(u).map((b)=>b.toString(16).padStart(2,"0")).join("");

// ── keypair + account hash ──────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
const seed = privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32);

const algo = new TextEncoder().encode("ed25519");
const pre = new Uint8Array(algo.length + 1 + 32);
pre.set(algo, 0); pre[algo.length] = 0; pre.set(pub, algo.length + 1);

const publicKeyHex = "01" + hex(pub);          // Casper Ed25519 prefix
const privateKeyHex = hex(seed);
const accountHash = "account-hash-" + hex(blake2b(pre, 32));

console.log("\n========================================");
console.log("  CASPER TESTNET WALLET GENERATED");
console.log("========================================");
console.log("Public Key:   ", publicKeyHex);
console.log("Private Key:  ", privateKeyHex);
console.log("Account Hash: ", accountHash);
console.log("========================================");
console.log("\nFund this wallet on TESTNET:");
console.log("  https://testnet.cspr.live/tools/faucet");
console.log("\nPaste into .env.local files:");
console.log(`PROVIDER_PRIVATE_KEY=${privateKeyHex}`);
console.log(`PROVIDER_ACCOUNT_HASH=${accountHash}`);
console.log(`CONSUMER_PRIVATE_KEY=${privateKeyHex}`);
console.log(`CONSUMER_ACCOUNT_HASH=${accountHash}`);
console.log("========================================\n");
