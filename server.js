import express from "express";
import http from "http";
import path from "path";
import {fileURLToPath} from "url";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import {WebSocketServer} from "ws";

const dir=path.dirname(fileURLToPath(import.meta.url));
const app=express(),server=http.createServer(app),wss=new WebSocketServer({server});
const db=new Database(path.join(dir,"abuja-boys.db"));
const SECRET=process.env.JWT_SECRET||"CHANGE_THIS_SECRET";
const START=1000000;
db.pragma("journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS users(
id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL COLLATE NOCASE,email TEXT UNIQUE NOT NULL COLLATE NOCASE,
password_hash TEXT NOT NULL,cash INTEGER NOT NULL DEFAULT 1000000,level INTEGER NOT NULL DEFAULT 1,
reputation INTEGER NOT NULL DEFAULT 100,location TEXT NOT NULL DEFAULT 'Wuse',
created_at TEXT NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS messages(
id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT,username TEXT,body TEXT,created_at TEXT)`);

app.use(express.json({limit:"32kb"})); app.use(express.static(path.join(dir,"public")));
const now=()=>new Date().toISOString();
const getUser=id=>db.prepare("SELECT * FROM users WHERE id=?").get(id);
const safe=u=>({id:u.id,username:u.username,cash:u.cash,level:u.level,reputation:u.reputation,location:u.location});
const issue=u=>jwt.sign({sub:u.id},SECRET,{expiresIn:"7d"});
function auth(req,res,next){try{const t=String(req.headers.authorization||"").replace(/^Bearer /i,"");req.auth=jwt.verify(t,SECRET);next()}catch{res.status(401).json({error:"Please log in again."})}}

app.post("/api/register",async(req,res)=>{
 const username=String(req.body.username||"").trim(),email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||"");
 if(!/^[A-Za-z0-9_]{3,20}$/.test(username))return res.status(400).json({error:"Username must be 3–20 letters, numbers or underscores."});
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return res.status(400).json({error:"Enter a valid email."});
 if(password.length<8)return res.status(400).json({error:"Password must be at least 8 characters."});
 if(db.prepare("SELECT id FROM users WHERE username=? OR email=?").get(username,email))return res.status(409).json({error:"Username or email already exists."});
 const id=crypto.randomUUID(),hash=await bcrypt.hash(password,12);
 db.prepare("INSERT INTO users(id,username,email,password_hash,cash,created_at) VALUES(?,?,?,?,?,?)").run(id,username,email,hash,START,now());
 const u=getUser(id);res.status(201).json({token:issue(u),user:safe(u)});
});
app.post("/api/login",async(req,res)=>{
 const email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||"");
 const u=db.prepare("SELECT * FROM users WHERE email=?").get(email);
 if(!u||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({error:"Email or password is incorrect."});
 res.json({token:issue(u),user:safe(u)});
});
app.get("/api/me",auth,(req,res)=>{const u=getUser(req.auth.sub);if(!u)return res.status(401).json({error:"Account not found."});res.json({user:safe(u)})});

const locations=["Wuse","Maitama","Jabi","Garki","Gwarinpa","Asokoro","Kubwa","Area 1","Airport"];
app.post("/api/location",auth,(req,res)=>{const loc=String(req.body.location||"");if(!locations.includes(loc))return res.status(400).json({error:"Unknown location."});db.prepare("UPDATE users SET location=? WHERE id=?").run(loc,req.auth.sub);presence();res.json({location:loc})});
const jobs={"Delivery Driver":50000,"Freelancer":45000,"Barber":32000,"Restaurant":22000,"Construction":55000};
app.post("/api/work",auth,(req,res)=>{const job=String(req.body.job||""),reward=jobs[job];if(!reward)return res.status(400).json({error:"Unknown job."});db.prepare("UPDATE users SET cash=cash+?,reputation=reputation+1 WHERE id=?").run(reward,req.auth.sub);res.json({user:safe(getUser(req.auth.sub)),earned:reward})});
app.get("/api/messages",auth,(req,res)=>res.json({messages:db.prepare("SELECT username,body,created_at FROM messages ORDER BY id DESC LIMIT 50").all().reverse()}));
app.get("/api/time",(req,res)=>{const d=new Date(),hour=Number(new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",hour:"2-digit",hour12:false}).format(d));res.json({iso:d.toISOString(),timezone:"Africa/Lagos",period:hour>=6&&hour<18?"day":"night"})});

const sockets=new Map();
function broadcast(x){const s=JSON.stringify(x);for(const c of wss.clients)if(c.readyState===1)c.send(s)}
function presence(){broadcast({type:"presence",players:[...sockets.values()].map(p=>p.public)})}
wss.on("connection",(ws,req)=>{
 try{
  const u=new URL(req.url,"http://localhost"),p=jwt.verify(u.searchParams.get("token"),SECRET),me=getUser(p.sub);if(!me)throw Error();
  const player={x:0,z:0,rotation:0,public:{id:me.id,username:me.username,level:me.level,location:me.location,x:0,z:0,rotation:0}};
  sockets.set(me.id,{ws,public:player.public});
  ws.send(JSON.stringify({type:"ready",self:player.public}));presence();
  ws.on("message",raw=>{try{
    const m=JSON.parse(raw);
    if(m.type==="move"){
      const x=Math.max(-90,Math.min(90,Number(m.x)||0)),z=Math.max(-90,Math.min(90,Number(m.z)||0)),r=Number(m.rotation)||0;
      const p=sockets.get(me.id);if(!p)return;p.public.x=x;p.public.z=z;p.public.rotation=r;broadcast({type:"move",player:p.public});
    }
    if(m.type==="chat"){
      const body=String(m.body||"").trim().slice(0,300);if(!body)return;
      const t=now();db.prepare("INSERT INTO messages(user_id,username,body,created_at) VALUES(?,?,?,?)").run(me.id,me.username,body,t);
      broadcast({type:"chat",username:me.username,body,created_at:t});
    }
  }catch{}});
  ws.on("close",()=>{sockets.delete(me.id);presence()});
 }catch{ws.close(1008,"Authentication required")}
});
app.get("*",(req,res)=>res.sendFile(path.join(dir,"public","index.html")));
server.listen(process.env.PORT||3000,()=>console.log("Abuja Boys 3D server started"));
