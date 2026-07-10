import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#F8F7F4', surface: '#FFFFFF', surfaceAlt: '#F1EFE8',
  border: '#E2E0D8', borderStrong: '#C8C5BB',
  text: '#1A1917', textSec: '#6B6960', textMuted: '#9B9890',
  accent: '#185FA5', accentBg: '#E6F1FB',
  success: '#0F6E56', successBg: '#E1F5EE',
  warning: '#854F0B', warningBg: '#FAEEDA',
  danger: '#A32D2D', dangerBg: '#FCEBEB',
  purple: '#534AB7', purpleBg: '#EEEDFE',
};

const css = (obj) => Object.entries(obj).map(([k,v]) => `${k.replace(/([A-Z])/g,'-$1').toLowerCase()}:${v}`).join(';');

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'cognitivo_v2';
const defaultProfile = (name) => ({
  id: Date.now().toString(), name,
  levels: { memoria:1, secuencias:1, calculo:1, palabras:1, stroop:1 },
  totalPoints: 0, sessions: 0, streak: 0, lastDate: null, history: [],
});
function loadState() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : { profiles:[], activeProfile:null }; }
  catch { return { profiles:[], activeProfile:null }; }
}
function saveState(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

// ─── GAME DATA ────────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 6;
const EMOJI_SETS = [
  ['🐶','🐱','🦊','🐻','🐼','🐨'],['🍎','🍊','🍋','🍇','🍓','🍒'],
  ['⚽','🏀','🎾','🏈','🎱','🏐'],['🌻','🌹','🌺','🌸','🌼','🌷'],
];
const WORD_BANK = [
  {word:'Alegre',options:['Triste','Contento','Enojado','Cansado'],ans:'Contento'},
  {word:'Rápido',options:['Lento','Veloz','Quieto','Pesado'],ans:'Veloz'},
  {word:'Grande',options:['Pequeño','Enorme','Delgado','Suave'],ans:'Enorme'},
  {word:'Oscuro',options:['Brillante','Sombrío','Colorido','Frío'],ans:'Sombrío'},
  {word:'Valiente',options:['Miedoso','Audaz','Tranquilo','Débil'],ans:'Audaz'},
  {word:'Sabio',options:['Tonto','Ignorante','Astuto','Descuidado'],ans:'Astuto'},
  {word:'Frágil',options:['Fuerte','Delicado','Duro','Resistente'],ans:'Delicado'},
  {word:'Silencioso',options:['Ruidoso','Callado','Activo','Brillante'],ans:'Callado'},
  {word:'Generoso',options:['Egoísta','Avaro','Dadivoso','Indiferente'],ans:'Dadivoso'},
  {word:'Melancólico',options:['Feliz','Nostálgico','Irritado','Sorprendido'],ans:'Nostálgico'},
  {word:'Efímero',options:['Eterno','Pasajero','Sólido','Constante'],ans:'Pasajero'},
  {word:'Tenaz',options:['Débil','Persistente','Perezoso','Olvidadizo'],ans:'Persistente'},
  {word:'Humilde',options:['Arrogante','Modesto','Orgulloso','Seguro'],ans:'Modesto'},
];
const STROOP_WORDS = [
  {word:'ROJO',color:'#E24B4A',name:'Rojo'},{word:'AZUL',color:'#378ADD',name:'Azul'},
  {word:'VERDE',color:'#1D9E75',name:'Verde'},{word:'AMARILLO',color:'#BA7517',name:'Amarillo'},
  {word:'MORADO',color:'#7F77DD',name:'Morado'},
];
const GAME_INFO = {
  memoria:    {label:'Memoria visual',  icon:'🃏', color:C.purple,  bg:C.purpleBg,  desc:'Encuentra todos los pares de cartas'},
  secuencias: {label:'Secuencias',      icon:'🔢', color:C.accent,  bg:C.accentBg,  desc:'Memoriza y repite el orden de números'},
  calculo:    {label:'Cálculo rápido',  icon:'🧮', color:C.success, bg:C.successBg, desc:'Resuelve operaciones rápidamente'},
  palabras:   {label:'Vocabulario',     icon:'📝', color:C.warning, bg:C.warningBg, desc:'Encuentra el sinónimo correcto'},
  stroop:     {label:'Test de Stroop',  icon:'🎨', color:C.danger,  bg:C.dangerBg,  desc:'¿De qué color está escrita la palabra?'},
};

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
const Btn = ({children, onClick, variant='primary', style={}}) => {
  const base = {
    width:'100%', padding:'12px 16px', borderRadius:'10px', fontSize:'15px',
    fontWeight:'500', cursor:'pointer', border:'0.5px solid', fontFamily:'inherit',
    transition:'opacity 0.15s',
  };
  const variants = {
    primary: {background:C.accentBg, borderColor:C.accent, color:C.accent},
    ghost:   {background:'transparent', borderColor:C.borderStrong, color:C.textSec},
    danger:  {background:C.dangerBg, borderColor:C.danger, color:C.danger},
  };
  return <button style={{...base,...variants[variant],...style}} onClick={onClick}>{children}</button>;
};

const ChoiceButton = ({label, state, onClick}) => {
  const bg = state==='correct'?C.successBg : state==='wrong'?C.dangerBg : C.surface;
  const bc = state==='correct'?C.success : state==='wrong'?C.danger : C.borderStrong;
  const tc = state==='correct'?C.success : state==='wrong'?C.danger : C.text;
  return (
    <button disabled={!!state} onClick={onClick} style={{
      flex:1, minWidth:'calc(50% - 5px)', padding:'13px 10px', borderRadius:'10px',
      border:`0.5px solid ${bc}`, background:bg, color:tc, fontSize:'16px',
      fontWeight:'500', cursor:state?'default':'pointer', fontFamily:'inherit',
      transition:'all 0.15s',
    }}>{label}</button>
  );
};

// ─── GAME COMPONENTS ─────────────────────────────────────────────────────────
function MemoriaGame({level, round, onComplete}) {
  const pairCount = Math.min(2+level, 6);
  const set = EMOJI_SETS[round % EMOJI_SETS.length];
  const [cards] = useState(() =>
    [...set.slice(0,pairCount),...set.slice(0,pairCount)]
      .sort(()=>Math.random()-0.5).map((em,i)=>({id:i,em,flipped:false,matched:false}))
  );
  const [cardState, setCardState] = useState(cards.map(c=>({...c})));
  const [flipped, setFlipped] = useState([]);
  const [waiting, setWaiting] = useState(false);
  const [done, setDone] = useState(false);
  const attempts = useRef(0);

  function flip(id) {
    if (waiting||done) return;
    const card = cardState.find(c=>c.id===id);
    if (card.flipped||card.matched) return;
    const next = cardState.map(c=>c.id===id?{...c,flipped:true}:c);
    setCardState(next);
    const nf = [...flipped, id];
    setFlipped(nf);
    if (nf.length===2) {
      setWaiting(true); attempts.current++;
      const [a,b] = nf;
      const ca=next.find(c=>c.id===a), cb=next.find(c=>c.id===b);
      if (ca.em===cb.em) {
        setTimeout(()=>{
          const matched = next.map(c=>c.id===a||c.id===b?{...c,matched:true}:c);
          setCardState(matched); setFlipped([]); setWaiting(false);
          if (matched.every(c=>c.matched)) {
            setDone(true);
            const pts = Math.max(10, 20+level*5-attempts.current*2);
            setTimeout(()=>onComplete(true,pts),400);
          }
        },400);
      } else {
        setTimeout(()=>{
          setCardState(next.map(c=>c.id===a||c.id===b?{...c,flipped:false}:c));
          setFlipped([]); setWaiting(false);
        },900);
      }
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'20px'}}>
      <p style={{color:C.textSec,fontSize:'15px',margin:0}}>Encuentra todos los pares</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:'10px',justifyContent:'center',maxWidth:'320px'}}>
        {cardState.map(card=>(
          <div key={card.id} onClick={()=>flip(card.id)} style={{
            width:'68px',height:'68px',borderRadius:'10px',border:`0.5px solid`,
            borderColor: card.matched?C.success : card.flipped?C.accent : C.border,
            background: card.matched?C.successBg : card.flipped?C.accentBg : C.surface,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:'30px',cursor:'pointer',transition:'all 0.2s',userSelect:'none',
          }}>{card.flipped||card.matched ? card.em : '?'}</div>
        ))}
      </div>
      <p style={{color:C.textMuted,fontSize:'12px',margin:0}}>Intentos: {attempts.current}</p>
    </div>
  );
}

function SecuenciasGame({level, onComplete}) {
  const nums = useRef(Array.from({length:3+level},()=>Math.floor(Math.random()*9)+1));
  const [phase, setPhase] = useState('show');
  const [activeIdx, setActiveIdx] = useState(-1);
  const [answer, setAnswer] = useState('');

  useEffect(()=>{
    const total = nums.current.length;
    nums.current.forEach((_, i) => {
      // Show each number
      setTimeout(() => setActiveIdx(i), 400 + i * 900);
      // Hide it (except last one gets more time)
      setTimeout(() => setActiveIdx(-1), 400 + i * 900 + 700);
    });
    // After all shown, switch to input
    setTimeout(() => setPhase('input'), 400 + total * 900 + 800);
  },[]);

  function check(){
    const clean=answer.trim().replace(/,/g,' ').replace(/\s+/g,' ');
    const correct = clean===nums.current.join(' ');
    onComplete(correct, correct?10+level*5:0);
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'24px',width:'100%'}}>
      <p style={{color:C.textSec,fontSize:'15px',margin:0,textAlign:'center'}}>
        {phase==='show'?'Observa la secuencia':'Escribe la secuencia en orden'}
      </p>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'center'}}>
        {phase==='show'
          ? nums.current.map((n,i)=>(
              <div key={i} style={{
                width:'48px',height:'48px',borderRadius:'10px',
                background:i===activeIdx?C.accentBg:C.surfaceAlt,
                border:`0.5px solid ${i===activeIdx?C.accent:C.border}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'20px',fontWeight:'500',
                color:i===activeIdx?C.accent:C.textMuted,
                transition:'all 0.15s',
              }}>{i<=activeIdx?n:'?'}</div>
            ))
          : nums.current.map((_,i)=>(
              <div key={i} style={{
                width:'48px',height:'48px',borderRadius:'10px',
                background:C.surfaceAlt, border:`0.5px solid ${C.border}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'20px',color:C.textMuted,
              }}>?</div>
            ))
        }
      </div>
      {phase==='input' && <>
        <input
          autoFocus value={answer} onChange={e=>setAnswer(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&check()}
          placeholder="Ej: 3 7 1 5"
          inputMode="numeric"
          style={{
            width:'100%',padding:'13px',borderRadius:'10px',
            border:`0.5px solid ${C.borderStrong}`,background:C.surface,
            fontSize:'22px',textAlign:'center',color:C.text,
            fontWeight:'500',letterSpacing:'6px',boxSizing:'border-box',
            fontFamily:'inherit',
          }}
        />
        <Btn onClick={check}>Verificar</Btn>
      </>}
    </div>
  );
}

function CalculoGame({level, onComplete}) {
  const [data] = useState(()=>{
    const ops=['+','-','×'];
    let a,b,op,ans;
    if(level<=2){a=Math.floor(Math.random()*15)+2;b=Math.floor(Math.random()*10)+1;op=ops[Math.floor(Math.random()*2)];}
    else if(level<=4){a=Math.floor(Math.random()*30)+10;b=Math.floor(Math.random()*20)+5;op=ops[Math.floor(Math.random()*3)];}
    else{a=Math.floor(Math.random()*50)+20;b=Math.floor(Math.random()*30)+10;op=ops[Math.floor(Math.random()*3)];}
    if(op==='+')ans=a+b; else if(op==='-')ans=a-b;
    else{if(level<=3){a=Math.floor(Math.random()*9)+2;b=Math.floor(Math.random()*9)+2;}ans=a*b;}
    const wrongs=new Set();
    while(wrongs.size<3){const w=ans+Math.floor(Math.random()*14)-7;if(w!==ans)wrongs.add(w);}
    return {a,b,op,ans,choices:[ans,...wrongs].sort(()=>Math.random()-0.5)};
  });
  const [states,setStates] = useState({});
  const [done,setDone] = useState(false);
  function pick(v){
    if(done)return; setDone(true);
    const ok=v===data.ans;
    const ns={};
    data.choices.forEach(c=>{ if(c===v)ns[c]=ok?'correct':'wrong'; else if(c===data.ans)ns[c]='correct'; });
    setStates(ns);
    setTimeout(()=>onComplete(ok,ok?10+level*5:0),1000);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'24px',width:'100%'}}>
      <p style={{color:C.textSec,fontSize:'15px',margin:0}}>¿Cuánto es?</p>
      <p style={{fontSize:'48px',fontWeight:'500',color:C.text,margin:0,letterSpacing:'2px'}}>{data.a} {data.op} {data.b}</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:'10px',width:'100%'}}>
        {data.choices.map((c,i)=><ChoiceButton key={i} label={String(c)} state={states[c]} onClick={()=>pick(c)}/>)}
      </div>
    </div>
  );
}

function PalabrasGame({round, level, onComplete}) {
  const [data] = useState(()=>WORD_BANK[(round*3+Math.floor(Math.random()*WORD_BANK.length))%WORD_BANK.length]);
  const [states,setStates] = useState({});
  const [done,setDone] = useState(false);
  function pick(o){
    if(done)return; setDone(true);
    const ok=o===data.ans;
    const ns={};
    data.options.forEach(x=>{ if(x===o)ns[x]=ok?'correct':'wrong'; else if(x===data.ans)ns[x]='correct'; });
    setStates(ns);
    setTimeout(()=>onComplete(ok,ok?10+level*5:0),1100);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'24px',width:'100%'}}>
      <p style={{color:C.textSec,fontSize:'15px',margin:0}}>Sinónimo de:</p>
      <p style={{fontSize:'34px',fontWeight:'500',color:C.text,margin:0}}>{data.word}</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:'10px',width:'100%'}}>
        {data.options.map((o,i)=><ChoiceButton key={i} label={o} state={states[o]} onClick={()=>pick(o)}/>)}
      </div>
    </div>
  );
}

function StroopGame({level, onComplete}) {
  const [data] = useState(()=>{
    const wIdx=Math.floor(Math.random()*STROOP_WORDS.length);
    let cIdx=wIdx;
    if(level>=2){do{cIdx=Math.floor(Math.random()*STROOP_WORDS.length);}while(cIdx===wIdx);}
    return {
      word:STROOP_WORDS[wIdx].word, color:STROOP_WORDS[cIdx].color,
      colorName:STROOP_WORDS[cIdx].name,
      options:STROOP_WORDS.map(s=>s.name).sort(()=>Math.random()-0.5),
    };
  });
  const [states,setStates]=useState({});
  const [done,setDone]=useState(false);
  function pick(n){
    if(done)return; setDone(true);
    const ok=n===data.colorName;
    const ns={};
    data.options.forEach(o=>{ if(o===n)ns[o]=ok?'correct':'wrong'; else if(o===data.colorName)ns[o]='correct'; });
    setStates(ns);
    setTimeout(()=>onComplete(ok,ok?15+level*8:0),1000);
  }
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'24px',width:'100%'}}>
      <p style={{color:C.textSec,fontSize:'15px',margin:0,textAlign:'center'}}>
        {level>=2?'¿De qué COLOR está escrita la palabra?':'¿Qué COLOR ves?'}
      </p>
      <p style={{fontSize:'42px',fontWeight:'700',color:data.color,margin:0,letterSpacing:'4px'}}>{data.word}</p>
      {level>=2&&<p style={{color:C.textMuted,fontSize:'12px',margin:0}}>Ignora lo que dice la palabra</p>}
      <div style={{display:'flex',flexWrap:'wrap',gap:'10px',width:'100%'}}>
        {data.options.map((o,i)=><ChoiceButton key={i} label={o} state={states[o]} onClick={()=>pick(o)}/>)}
      </div>
    </div>
  );
}

// ─── SCREENS ─────────────────────────────────────────────────────────────────
function HomeScreen({appState, setAppState, setScreen, setGameSession}) {
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newName, setNewName] = useState('');
  const profile = appState.profiles.find(p=>p.id===appState.activeProfile);

  function createProfile(){
    if(!newName.trim())return;
    const p=defaultProfile(newName.trim());
    const next={...appState,profiles:[...appState.profiles,p],activeProfile:p.id};
    saveState(next); setAppState(next); setShowNewProfile(false); setNewName('');
  }
  function switchProfile(id){
    const next={...appState,activeProfile:id}; saveState(next); setAppState(next);
  }
  function deleteProfile(id){
    if(!window.confirm('¿Eliminar este perfil y su progreso?'))return;
    const profiles=appState.profiles.filter(p=>p.id!==id);
    const next={profiles,activeProfile:profiles[0]?.id||null}; saveState(next); setAppState(next);
  }
  function startGame(gameId){
    if(!profile){alert('Selecciona un perfil primero'); return;}
    setGameSession({gameId, profileId:profile.id, level:profile.levels[gameId]});
    setScreen('game');
  }

  return (
    <div style={{padding:'16px',paddingBottom:'40px',maxWidth:'500px',margin:'0 auto'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'500',color:C.text,margin:0}}>Entrena tu mente</h1>
          <p style={{fontSize:'14px',color:C.textSec,margin:'2px 0 0'}}>5 minutos al día. Progreso real.</p>
        </div>
        <button onClick={()=>setScreen('profiles')} style={{
          width:'40px',height:'40px',borderRadius:'10px',border:`0.5px solid ${C.border}`,
          background:C.surface,cursor:'pointer',fontSize:'18px',
        }}>👥</button>
      </div>

      {/* Profile chips */}
      {appState.profiles.length>0 ? <>
        <div style={{display:'flex',gap:'8px',overflowX:'auto',marginBottom:'16px',paddingBottom:'4px'}}>
          {appState.profiles.map(p=>(
            <button key={p.id} onClick={()=>switchProfile(p.id)} style={{
              whiteSpace:'nowrap',padding:'7px 14px',borderRadius:'999px',
              border:`0.5px solid ${p.id===appState.activeProfile?C.accent:C.border}`,
              background:p.id===appState.activeProfile?C.accentBg:C.surface,
              color:p.id===appState.activeProfile?C.accent:C.textSec,
              fontWeight:p.id===appState.activeProfile?'500':'400',
              fontSize:'14px',cursor:'pointer',fontFamily:'inherit',
            }}>{p.name}</button>
          ))}
          <button onClick={()=>setShowNewProfile(true)} style={{
            padding:'7px 12px',borderRadius:'999px',border:`0.5px solid ${C.border}`,
            background:C.surface,cursor:'pointer',fontSize:'16px',color:C.textMuted,
          }}>+</button>
        </div>

        {/* Stats */}
        {profile && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'16px'}}>
            {[['🔥'+profile.streak,'días de racha'],['🎯'+profile.sessions,'sesiones'],[profile.totalPoints+'','puntos']].map(([n,l],i)=>(
              <div key={i} style={{background:C.surfaceAlt,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:'20px',fontWeight:'500',color:C.text}}>{n}</div>
                <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Games */}
        <p style={{fontSize:'11px',fontWeight:'500',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px'}}>Juegos</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
          {Object.entries(GAME_INFO).map(([id,g])=>(
            <div key={id} onClick={()=>startGame(id)} style={{
              background:C.surface,borderRadius:'12px',padding:'16px',
              border:`0.5px solid ${C.border}`,cursor:'pointer',
              gridColumn:id==='stroop'?'span 2':'auto',
              transition:'border-color 0.15s',
            }}>
              <div style={{
                width:'40px',height:'40px',borderRadius:'10px',background:g.bg,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'20px',marginBottom:'10px',
              }}>{g.icon}</div>
              <div style={{fontSize:'14px',fontWeight:'500',color:C.text,marginBottom:'4px'}}>{g.label}</div>
              <div style={{fontSize:'12px',color:C.textSec,lineHeight:'1.5',marginBottom:'10px'}}>{g.desc}</div>
              {profile && (
                <span style={{
                  fontSize:'11px',fontWeight:'500',padding:'3px 8px',borderRadius:'999px',
                  background:g.bg,color:g.color,
                }}>Nivel {profile.levels[id]}</span>
              )}
            </div>
          ))}
        </div>
      </> : (
        <div style={{textAlign:'center',paddingTop:'60px'}}>
          <div style={{fontSize:'52px',marginBottom:'16px'}}>🧠</div>
          <h2 style={{fontSize:'20px',fontWeight:'500',color:C.text,marginBottom:'8px'}}>Bienvenido</h2>
          <p style={{fontSize:'14px',color:C.textSec,lineHeight:'1.6',marginBottom:'24px',padding:'0 20px'}}>
            Crea un perfil para empezar a entrenar tu mente cada día.
          </p>
          <Btn onClick={()=>setShowNewProfile(true)}>Crear primer perfil</Btn>
        </div>
      )}

      {/* New profile modal */}
      {showNewProfile && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'flex-end',zIndex:100}}>
          <div style={{background:C.surface,borderRadius:'20px 20px 0 0',padding:'24px',paddingBottom:'40px',width:'100%',boxSizing:'border-box'}}>
            <h3 style={{fontSize:'18px',fontWeight:'500',color:C.text,marginBottom:'16px'}}>Nuevo perfil</h3>
            <input
              autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&createProfile()}
              placeholder="Nombre (ej. Papá, Abuelo, Yo)"
              style={{
                width:'100%',padding:'12px',borderRadius:'10px',
                border:`0.5px solid ${C.borderStrong}`,background:C.bg,
                fontSize:'16px',color:C.text,marginBottom:'12px',boxSizing:'border-box',fontFamily:'inherit',
              }}
            />
            <Btn onClick={createProfile}>Crear</Btn>
            <Btn variant="ghost" onClick={()=>{setShowNewProfile(false);setNewName('')}} style={{marginTop:'8px'}}>Cancelar</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function GameScreen({session, appState, setAppState, setScreen, setResult}) {
  const {gameId, profileId} = session;
  const profile = appState.profiles.find(p=>p.id===profileId);
  const level = profile?.levels[gameId]||1;
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [points, setPoints] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [key, setKey] = useState(0);
  const startTime = useRef(Date.now());
  const info = GAME_INFO[gameId];

  function onRoundComplete(wasCorrect, pts) {
    setFeedback({ok:wasCorrect, msg:wasCorrect?`+${pts} puntos`:'Incorrecto'});
    if(wasCorrect){setCorrect(c=>c+1); setPoints(p=>p+pts);}
    setTimeout(()=>{
      setFeedback(null);
      const next=round+1;
      if(next>=TOTAL_ROUNDS) finishGame(wasCorrect?correct+1:correct, wasCorrect?points+pts:points);
      else { setRound(next); setKey(k=>k+1); }
    },1200);
  }

  function finishGame(finalCorrect, finalPoints) {
    const elapsed=Math.round((Date.now()-startTime.current)/1000);
    const pct=finalCorrect/TOTAL_ROUNDS;
    const s={...appState};
    const pIdx=s.profiles.findIndex(x=>x.id===profileId);
    if(pIdx===-1){setScreen('home');return;}
    const p={...s.profiles[pIdx]};
    p.totalPoints+=finalPoints; p.sessions+=1;
    const today=new Date().toDateString();
    if(p.lastDate!==today){
      const yesterday=new Date(Date.now()-86400000).toDateString();
      p.streak=p.lastDate===yesterday?p.streak+1:1; p.lastDate=today;
    }
    const leveled=pct>=0.8&&p.levels[gameId]<10;
    if(leveled)p.levels[gameId]++;
    p.history=[{gameId,date:today,score:finalPoints,correct:finalCorrect,level},...(p.history||[]).slice(0,49)];
    s.profiles[pIdx]=p; saveState(s); setAppState(s);
    setResult({gameId,score:finalPoints,correct:finalCorrect,total:TOTAL_ROUNDS,elapsed,leveled,newLevel:p.levels[gameId],profileName:p.name,profileId});
    setScreen('result');
  }

  const progress = round/TOTAL_ROUNDS;

  return (
    <div style={{padding:'16px',maxWidth:'500px',margin:'0 auto'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
        <button onClick={()=>setScreen('home')} style={{
          width:'36px',height:'36px',borderRadius:'10px',border:`0.5px solid ${C.border}`,
          background:C.surface,cursor:'pointer',fontSize:'16px',
        }}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:'16px',fontWeight:'500',color:C.text}}>{info.label}</div>
          <div style={{fontSize:'12px',color:C.textMuted}}>Nivel {level} · Ronda {round+1} de {TOTAL_ROUNDS}</div>
        </div>
        <span style={{background:C.accentBg,color:C.accent,fontSize:'13px',fontWeight:'500',padding:'5px 10px',borderRadius:'999px'}}>{points} pts</span>
      </div>

      {/* Progress */}
      <div style={{height:'4px',background:C.surfaceAlt,borderRadius:'20px',overflow:'hidden',marginBottom:'16px'}}>
        <div style={{height:'100%',background:C.accent,borderRadius:'20px',width:`${progress*100}%`,transition:'width 0.4s'}}/>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderRadius:'10px',marginBottom:'16px',
          background:feedback.ok?C.successBg:C.dangerBg,
        }}>
          <span>{feedback.ok?'✅':'❌'}</span>
          <span style={{fontSize:'14px',fontWeight:'500',color:feedback.ok?C.success:C.danger}}>{feedback.msg}</span>
        </div>
      )}

      {/* Game */}
      <div key={key} style={{paddingTop:'8px'}}>
        {gameId==='memoria'    && <MemoriaGame level={level} round={round} onComplete={onRoundComplete}/>}
        {gameId==='secuencias' && <SecuenciasGame level={level} onComplete={onRoundComplete}/>}
        {gameId==='calculo'    && <CalculoGame level={level} onComplete={onRoundComplete}/>}
        {gameId==='palabras'   && <PalabrasGame round={round} level={level} onComplete={onRoundComplete}/>}
        {gameId==='stroop'     && <StroopGame level={level} onComplete={onRoundComplete}/>}
      </div>
    </div>
  );
}

function ResultScreen({result, setScreen, setGameSession}) {
  const {gameId,score,correct,total,elapsed,leveled,newLevel,profileName,profileId} = result;
  const pct=correct/total;
  const emoji=pct>=0.8?'🎉':pct>=0.5?'👍':'💪';
  const title=pct>=0.8?'¡Excelente!':pct>=0.5?'Buen trabajo':'Sigue practicando';
  return (
    <div style={{padding:'16px',maxWidth:'500px',margin:'0 auto',textAlign:'center',paddingTop:'48px'}}>
      <div style={{fontSize:'52px',marginBottom:'12px'}}>{emoji}</div>
      {leveled && (
        <div style={{display:'inline-flex',alignItems:'center',gap:'6px',background:C.successBg,padding:'6px 14px',borderRadius:'999px',marginBottom:'12px'}}>
          <span style={{fontSize:'13px',color:C.success,fontWeight:'500'}}>⬆ ¡Subiste al nivel {newLevel}!</span>
        </div>
      )}
      <h2 style={{fontSize:'22px',fontWeight:'500',color:C.text,marginBottom:'4px'}}>{title}</h2>
      <p style={{fontSize:'14px',color:C.textSec,marginBottom:'24px'}}>{profileName}</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'24px'}}>
        {[[score,'puntos'],[`${correct}/${total}`,'correctas'],[`${elapsed}s`,'tiempo']].map(([n,l],i)=>(
          <div key={i} style={{background:C.surface,borderRadius:'10px',border:`0.5px solid ${C.border}`,padding:'14px'}}>
            <div style={{fontSize:'22px',fontWeight:'500',color:C.text}}>{n}</div>
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{l}</div>
          </div>
        ))}
      </div>
      {pct<0.8 && (
        <div style={{background:C.accentBg,border:`0.5px solid ${C.accent}`,borderRadius:'10px',padding:'14px',marginBottom:'24px',textAlign:'left'}}>
          <p style={{fontSize:'13px',color:C.accent,lineHeight:'1.6',margin:0}}>
            💡 La constancia diaria genera más beneficio cognitivo que sesiones largas esporádicas. Unos minutos cada día es suficiente.
          </p>
        </div>
      )}
      <Btn onClick={()=>{setGameSession(r=>({...r})); setScreen('game');}}>Jugar otra vez</Btn>
      <Btn variant="ghost" onClick={()=>setScreen('home')} style={{marginTop:'8px'}}>Volver al inicio</Btn>
    </div>
  );
}

function ProfilesScreen({appState, setAppState, setScreen}) {
  const [showNew,setShowNew]=useState(false);
  const [newName,setNewName]=useState('');
  const LABELS={memoria:'Memoria',secuencias:'Secuencias',calculo:'Cálculo',palabras:'Vocabulario',stroop:'Stroop'};

  function create(){
    if(!newName.trim())return;
    const p=defaultProfile(newName.trim());
    const next={...appState,profiles:[...appState.profiles,p],activeProfile:p.id};
    saveState(next);setAppState(next);setShowNew(false);setNewName('');
  }
  function del(id){
    if(!window.confirm('¿Eliminar este perfil?'))return;
    const profiles=appState.profiles.filter(p=>p.id!==id);
    const next={profiles,activeProfile:profiles[0]?.id||null};
    saveState(next);setAppState(next);
  }

  return (
    <div style={{padding:'16px',maxWidth:'500px',margin:'0 auto',paddingBottom:'40px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
        <button onClick={()=>setScreen('home')} style={{width:'36px',height:'36px',borderRadius:'10px',border:`0.5px solid ${C.border}`,background:C.surface,cursor:'pointer',fontSize:'16px'}}>←</button>
        <h2 style={{flex:1,fontSize:'18px',fontWeight:'500',color:C.text,margin:0}}>Perfiles</h2>
        <button onClick={()=>setShowNew(true)} style={{width:'36px',height:'36px',borderRadius:'10px',border:`0.5px solid ${C.accent}`,background:C.accentBg,cursor:'pointer',fontSize:'18px',color:C.accent}}>+</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {appState.profiles.map(p=>(
          <div key={p.id} style={{background:C.surface,borderRadius:'12px',border:`0.5px solid ${C.border}`,padding:'16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
              <div style={{width:'44px',height:'44px',borderRadius:'22px',background:C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:'500',color:C.accent}}>
                {p.name[0].toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:'16px',fontWeight:'500',color:C.text}}>{p.name}</div>
                <div style={{fontSize:'12px',color:C.textMuted,marginTop:'2px'}}>{p.sessions} sesiones · {p.totalPoints} pts · racha {p.streak}</div>
              </div>
              <button onClick={()=>del(p.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'16px',color:C.textMuted,padding:'8px'}}>🗑</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:p.history?.length?'12px':0}}>
              {Object.entries(p.levels).map(([g,lv])=>(
                <span key={g} style={{fontSize:'11px',padding:'3px 8px',borderRadius:'999px',background:C.surfaceAlt,color:C.textSec}}>
                  {LABELS[g]} Nv{lv}
                </span>
              ))}
            </div>
            {p.history?.length>0 && (
              <div style={{borderTop:`0.5px solid ${C.border}`,paddingTop:'10px'}}>
                <p style={{fontSize:'11px',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>Últimas sesiones</p>
                {p.history.slice(0,4).map((h,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'4px 0',fontSize:'13px'}}>
                    <span style={{color:C.text,width:'80px'}}>{LABELS[h.gameId]}</span>
                    <span style={{flex:1,color:C.textSec}}>{h.correct}/6 · {h.score}pts</span>
                    <span style={{color:C.textMuted,fontSize:'11px'}}>{h.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {showNew && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'flex-end',zIndex:100}}>
          <div style={{background:C.surface,borderRadius:'20px 20px 0 0',padding:'24px',paddingBottom:'40px',width:'100%',boxSizing:'border-box'}}>
            <h3 style={{fontSize:'18px',fontWeight:'500',color:C.text,marginBottom:'16px'}}>Nuevo perfil</h3>
            <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&create()}
              placeholder="Nombre (ej. Papá, Abuelo, Yo)"
              style={{width:'100%',padding:'12px',borderRadius:'10px',border:`0.5px solid ${C.borderStrong}`,background:C.bg,fontSize:'16px',color:C.text,marginBottom:'12px',boxSizing:'border-box',fontFamily:'inherit'}}
            />
            <Btn onClick={create}>Crear</Btn>
            <Btn variant="ghost" onClick={()=>{setShowNew(false);setNewName('')}} style={{marginTop:'8px'}}>Cancelar</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [appState, setAppState] = useState(()=>loadState());
  const [screen, setScreen] = useState('home');
  const [gameSession, setGameSession] = useState(null);
  const [result, setResult] = useState(null);

  return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      {screen==='home'    && <HomeScreen appState={appState} setAppState={setAppState} setScreen={setScreen} setGameSession={setGameSession}/>}
      {screen==='game'    && <GameScreen session={gameSession} appState={appState} setAppState={setAppState} setScreen={setScreen} setResult={setResult}/>}
      {screen==='result'  && <ResultScreen result={result} setScreen={setScreen} setGameSession={setGameSession}/>}
      {screen==='profiles'&& <ProfilesScreen appState={appState} setAppState={setAppState} setScreen={setScreen}/>}
    </div>
  );
}
