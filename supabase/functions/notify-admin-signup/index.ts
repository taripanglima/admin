import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;
const RESEND = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('NOTIFY_FROM_EMAIL');
const OWNER_EMAIL = Deno.env.get('OWNER_ALERT_EMAIL');

webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);

async function rpc(name:string, body:Record<string,unknown>={}) {
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok) throw new Error(await r.text()); return await r.json();
}
async function sendEmail(subject:string,html:string){
  if(!RESEND||!FROM||!OWNER_EMAIL)return;
  await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND}`,'Content-Type':'application/json'},body:JSON.stringify({from:FROM,to:[OWNER_EMAIL],subject,html})});
}
Deno.serve(async req=>{
  try{
    const payload=await req.json();
    const record=payload.record||payload;
    if(record.role!=='pending')return new Response(JSON.stringify({ignored:true}),{headers:{'Content-Type':'application/json'}});
    const targets=await rpc('get_push_targets');
    let email='';
    try{const ar=await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${record.id}`,{headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`}}); if(ar.ok){const au=await ar.json(); email=au.email||'';}}catch{}
    const title='Permohonan Admin Baru';
    const body=`${record.full_name||record.username||'Pengguna'} telah mendaftar sebagai pengguna dan menunggu kelulusan.`;
    const data={title:'Permohonan Admin Baru — Roda Impian PGPM',body,url:'https://adminpgpm.pages.dev/',tag:`pending-${record.id}`};
    const results=[];
    for(const s of (targets||[])){
      try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(data));results.push({endpoint:s.endpoint,ok:true})}
      catch(e){results.push({endpoint:s.endpoint,ok:false});}
    }
    await sendEmail('Permohonan Admin Baru — Roda Impian PGPM',`<p><b>${body}</b></p><p>Username: ${record.username||'—'}<br>Email: ${email||'—'}</p><p>Buka PGPM Admin Control untuk semakan.</p>`);
    return new Response(JSON.stringify({ok:true,results}),{headers:{'Content-Type':'application/json'}});
  }catch(e){return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{'Content-Type':'application/json'}})}
});
