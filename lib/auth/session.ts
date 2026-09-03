import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
export type Session = { id:number; role:string };
const secret = process.env.SESSION_SECRET || "dev-secret";
function sign(payload:string){ return createHmac("sha256",secret).update(payload).digest("hex"); }
export function makeSession(data:Session){ const p=Buffer.from(JSON.stringify(data)).toString("base64url"); return `${p}.${sign(p)}`; }
export function readSessionValue(value?:string):Session|null { try { if(!value) return null; const [p,s]=value.split("."); const expected=sign(p); if(!s || !timingSafeEqual(Buffer.from(s),Buffer.from(expected))) return null; return JSON.parse(Buffer.from(p,"base64url").toString()); } catch{return null;} }
export async function getSession(){ return readSessionValue((await cookies()).get("sozamen_session")?.value); }
export async function getUser(){ const s=await getSession(); return s ? db.user.findUnique({where:{id:s.id}}) : null; }
export async function requireAdmin(){ const user=await getUser(); if(!user || user.role!=="admin") throw new Error("دسترسی غیرمجاز"); return user; }
