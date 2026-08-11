/* eslint-disable @typescript-eslint/no-explicit-any -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SizeGuideManager.module.css";
import SizeGuideTypeSelect from "./SizeGuideTypeSelect";
import SizeGuideDiagram, { type DiagramMeasurement } from "@/components/SizeGuideDiagram";
import { getSizeGuideType, resolveSizeGuideType } from "@/lib/size-guide-types";

type M = Omit<DiagramMeasurement, "id" | "label" | "startX" | "startY" | "endX" | "endY"> & { id?: string | number; key?: string; label: string; marker: string; startX: number; startY: number; endX: number; endY: number };
type Row={id?:number;label:string;values:string[]};

const initialType = "TSHIRT";
const positioned = (items:Array<{label:string;marker:string}>) => items.map((item,index)=>{
  const isUpper=item.label.startsWith("Горнище");
  const isLower=item.label.startsWith("Долнище");
  if(isUpper){const i=index;return {...item,startX:10,startY:28+i*10,endX:44,endY:28+i*10};}
  if(isLower){const i=index-4;return {...item,startX:57,startY:32+i*11,endX:90,endY:32+i*11};}
  return {...item,startX:index%2===0?24:38,startY:25+index*8,endX:index%2===0?76:62,endY:25+index*8};
});
const initialMeasurements = () => positioned(getSizeGuideType(initialType).measurements);
const SET_TYPES = new Set(["SUIT","TWO_PIECE_SET","THREE_PIECE_SET","TRACKSUIT","PAJAMA_SET","SKIRT_SET","SHORTS_SET","GENERIC_SET"]);
const isSetType = (value:string) => SET_TYPES.has(value);
const stripPartPrefix = (label:string) => label.replace(/^Горнище · |^Долнище · /, "");
const measurementPart = (item:M) => item.label.startsWith("Долнище") ? "lower" : "upper";
const partLabel = (part:"upper"|"lower", label:string) => `${part === "upper" ? "Горнище" : "Долнище"} · ${stripPartPrefix(label)}`;

function buildEmptyRows(measurements:M[]): Row[] {
  return [{ label: "EU 36", values: measurements.map(() => "") }];
}

function normalizeGuideRows(guide:any, measurements:M[]): Row[] {
  const sizes = Array.isArray(guide?.sizes) ? guide.sizes : [];
  if (!sizes.length) return buildEmptyRows(measurements);
  return sizes
    .slice()
    .sort((a:any,b:any)=>(Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((size:any) => ({
      id: Number(size.id),
      label: String(size.label ?? ""),
      values: measurements.map((measurement) => {
        const values = Array.isArray(size.values) ? size.values : [];
        const value = values.find((v:any) => Number(v.measurementId) === Number(measurement.id))
          ?? values.find((v:any) => String(v.measurementKey ?? "") === String((measurement as any).key ?? ""));
        return value?.value == null ? "" : String(value.value);
      }),
    }));
}

export default function SizeGuideManager(){
 const [guides,setGuides]=useState<any[]>([]);
 const [name,setName]=useState("");
 const [type,setType]=useState(initialType);
 const [description,setDescription]=useState("");
 const [instructions,setInstructions]=useState("Измервайте артикула поставен на равна повърхност. Всички стойности са в сантиметри.");
 const [showDiagram,setShowDiagram]=useState(true);
 const [m,setM]=useState<M[]>(initialMeasurements);
 const [rows,setRows]=useState<Row[]>(buildEmptyRows(initialMeasurements()));
 const [selected,setSelected]=useState(0);
 const [editingId,setEditingId]=useState<number|null>(null);
 const [query,setQuery]=useState("");
 const [typeFilter,setTypeFilter]=useState("ALL");
 const [diagramFilter,setDiagramFilter]=useState("ALL");
 const [msg,setMsg]=useState("");
 const [busy,setBusy]=useState(false);
 const saveLock=useRef(false);
 const load=()=>fetch('/api/admin/size-guides',{cache:'no-store'}).then(r=>r.json()).then(d=>setGuides(d.guides||[]));
 useEffect(()=>{load()},[]);
 const filteredGuides=useMemo(()=>{
   const q=query.trim().toLowerCase();
   return guides.filter((g:any)=>{
     const resolved=resolveSizeGuideType(g.garmentType,g.name);
     const typeInfo=getSizeGuideType(resolved);
     const haystack=[g.name,g.description,g.instructions,g.garmentType,typeInfo.label].join(" ").toLowerCase();
     if(q && !haystack.includes(q))return false;
     if(typeFilter!=="ALL" && resolved!==typeFilter)return false;
     if(diagramFilter==="WITH" && !g.showDiagram)return false;
     if(diagramFilter==="WITHOUT" && g.showDiagram)return false;
     return true;
   });
 },[guides,query,typeFilter,diagramFilter]);
 const uniqueTypes=useMemo(()=>Array.from(new Set(guides.map((g:any)=>resolveSizeGuideType(g.garmentType,g.name)))),[guides]);
 function resetForm(){
   const measurements=initialMeasurements();
   setEditingId(null);setName("");setType(initialType);setDescription("");
   setInstructions("Измервайте артикула поставен на равна повърхност. Всички стойности са в сантиметри.");
   setShowDiagram(true);setM(measurements);setRows(buildEmptyRows(measurements));setSelected(0);
 }
 function changeType(v:string){
   setType(v);
   const measurements=positioned(getSizeGuideType(v).measurements);
   setM(measurements); setSelected(0);
   setRows(buildEmptyRows(measurements));
 }
 function addMeasurement(){
   const index=m.length;
   const selectedPart = isSetType(type) && m[selected] ? measurementPart(m[selected]) : "upper";
   const partIndex = m.filter(item => measurementPart(item) === selectedPart).length;
   const next:M = isSetType(type)
     ? selectedPart === "upper"
       ? {marker:String.fromCharCode(65+index),label:partLabel("upper", "Ново измерване"),startX:10,startY:28+partIndex*10,endX:44,endY:28+partIndex*10}
       : {marker:String.fromCharCode(65+index),label:partLabel("lower", "Ново измерване"),startX:57,startY:32+partIndex*11,endX:90,endY:32+partIndex*11}
     : {marker:String.fromCharCode(65+index),label:"Ново измерване",startX:28,startY:25+index*7,endX:72,endY:25+index*7};
   setM([...m,next]); setSelected(index); setRows(rows.map(r=>({...r,values:[...r.values,""]})));
 }
 function changeMeasurementFromDiagram(index:number,patch:Partial<DiagramMeasurement>){
   setM(current=>current.map((item,i)=>{
     if(i!==index)return item;
     const next={...item,...patch};
     if(!isSetType(type))return next;
     const midpoint=((next.startX??0)+(next.endX??0))/2;
     const part: "upper"|"lower" = midpoint < 50 ? "upper" : "lower";
     return {...next,label:partLabel(part,next.label)};
   }));
 }
 function removeMeasurement(index:number){
   setM(m.filter((_,i)=>i!==index));
   setRows(rows.map(r=>({...r,values:r.values.filter((_,i)=>i!==index)})));
   setSelected(Math.max(0,Math.min(selected,m.length-2)));
 }
 function addSize(){setRows(current=>[...current,{label:"",values:m.map(()=>"")}])}
 async function save(){
   if(busy || saveLock.current)return;
   const cleanName=name.trim();
   const normalizeLabel=(value:string)=>value.normalize("NFKC").replace(/\s+/g," ").trim();
   const activeMeasurements=m.map((item,index)=>({item,index})).filter(({item})=>item.label.trim());
   const nonEmptyRows=rows.filter(row=>normalizeLabel(row.label) || row.values.some(value=>String(value).trim()!==""));
   const normalizedLabels=nonEmptyRows.map(row=>normalizeLabel(row.label).toLocaleLowerCase("bg-BG"));
   if(!cleanName){setMsg("Въведи име на размерната таблица.");return;}
   if(!activeMeasurements.length){setMsg("Добави поне едно измерване.");return;}
   if(!nonEmptyRows.length){setMsg("Добави поне един EU размер.");return;}
   if(nonEmptyRows.some(row=>!row.label.trim())){setMsg("Всеки попълнен ред трябва да има EU размер.");return;}
   if(new Set(normalizedLabels).size!==normalizedLabels.length){setMsg("Всеки EU размер трябва да бъде уникален. Има добавен дублиран размер.");return;}
   const textValues=nonEmptyRows.flatMap(row=>activeMeasurements.map(({index})=>String(row.values[index]??"").normalize("NFKC").trim()).filter(Boolean));
   if(textValues.some(value=>value.length>80)){setMsg("Стойностите могат да съдържат до 80 символа.");return;}
   saveLock.current=true;setBusy(true);setMsg("");
   try{
     const payload={
       id:editingId,name:cleanName,garmentType:type,description,instructions,showDiagram,
       measurements:activeMeasurements.map(({item})=>item),
       sizes:nonEmptyRows.map(row=>({
         id:row.id,
         label:normalizeLabel(row.label),
         values:activeMeasurements.map(({item,index})=>({
           measurementId:Number.isInteger(Number((item as any)?.id))?Number((item as any).id):undefined,
           measurementKey:String((item as any)?.key??""),
           value:row.values[index] ?? "",
         })),
       })),
     };
     const r=await fetch('/api/admin/size-guides',{method:editingId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
     const d=await r.json().catch(()=>({error:'Размерната таблица не беше запазена.'}));
     if(!r.ok){setMsg(d.error||'Размерната таблица не беше запазена.');return;}
     const successMessage=editingId?'Размерната таблица е обновена и стойностите са прочетени обратно от базата.':'Размерната таблица е създадена и стойностите са прочетени обратно от базата.';
     if(d.guide){
       setGuides(current=>{const rest=current.filter((g:any)=>Number(g.id)!==Number(d.guide.id));return [...rest,d.guide].sort((a:any,b:any)=>(Number(a.sortOrder)||100)-(Number(b.sortOrder)||100)||String(a.name).localeCompare(String(b.name),'bg'));});
       editGuide(d.guide);
       setMsg(successMessage);
     }else{
       await load();
       setMsg(successMessage);
     }
   }finally{saveLock.current=false;setBusy(false)}
 }
 function editGuide(g:any){
   const resolvedType=resolveSizeGuideType(g.garmentType,g.name);
   const measurements=(Array.isArray(g.measurements)?g.measurements:[])
     .slice()
     .sort((a:any,b:any)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0))
     .map((item:any,index:number)=>({
       id:Number(item.id),key:String(item.key||""),marker:String(item.marker||String.fromCharCode(65+index)),label:String(item.label||""),
       startX:Number.isFinite(Number(item.startX))?Number(item.startX):24,
       startY:Number.isFinite(Number(item.startY))?Number(item.startY):30+index*7,
       endX:Number.isFinite(Number(item.endX))?Number(item.endX):76,
       endY:Number.isFinite(Number(item.endY))?Number(item.endY):30+index*7,
     }));
   const nextMeasurements=measurements.length?measurements:positioned(getSizeGuideType(resolvedType).measurements);
   setEditingId(Number(g.id));setName(String(g.name||""));setType(resolvedType);setDescription(String(g.description||""));
   setInstructions(String(g.instructions||""));setShowDiagram(g.showDiagram!==false);setM(nextMeasurements);setRows(normalizeGuideRows(g,nextMeasurements));setSelected(0);setMsg(`Редактираш: ${g.name}`);
   window.scrollTo({top:0,behavior:'smooth'});
 }
 async function toggleDiagram(id:number,showDiagram:boolean){const r=await fetch('/api/admin/size-guides',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,showDiagram})});const d=await r.json();setMsg(r.ok?(showDiagram?'Визуалната схема е включена.':'Визуалната схема е скрита.'):d.error);if(r.ok)load()}
 async function remove(id:number){if(!confirm('Да изтрия ли размерната таблица?'))return;const r=await fetch(`/api/admin/size-guides?id=${id}`,{method:'DELETE'});const d=await r.json();setMsg(r.ok?'Изтрита.':d.error);if(r.ok){if(editingId===id)resetForm();load()}}
 return <div className={styles.wrap}><section className={styles.editor}><div className={styles.formTitle}><div><h2>{editingId?"Редакция на размерна таблица":"Нов европейски стандарт"}</h2>{editingId&&<p>Промените ще обновят избраната таблица, без да създават дубликат.</p>}</div>{editingId&&<button type="button" className={styles.cancelEdit} onClick={resetForm}>Откажи редакцията</button>}</div><div className={styles.grid}><label>Име<input value={name} onChange={e=>setName(e.target.value)} placeholder="Дамски тениски – стандарт 1"/></label><label>Точен тип на артикула<SizeGuideTypeSelect value={type} onChange={changeType}/></label></div><label>Описание<input value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Как се измерва<textarea rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
 <label className={styles.diagramToggle}><input type="checkbox" checked={showDiagram} onChange={e=>setShowDiagram(e.target.checked)}/><span><strong>Показвай визуална схема</strong><small>Изключи, когато таблицата е достатъчна или артикулът не се нуждае от схема.</small></span></label>
 {showDiagram && <div className={styles.diagramSection}><div><h3>Визуална схема за клиента</h3><p>При комплект се показват две отделни схеми — горнище и долнище. Всяко измерване има собствена буква и линия.</p><SizeGuideDiagram garmentType={type} measurements={m} editable selectedIndex={selected} onSelect={setSelected} onChange={changeMeasurementFromDiagram}/></div><div><div className={styles.measureHead}><h3>Измервания</h3><button type="button" onClick={addMeasurement}>+ Добави измерване</button></div><div className={styles.measurements}>{m.map((x,i)=><div className={selected===i?styles.selectedMeasurement:""} key={i} onClick={()=>setSelected(i)}><input className={styles.marker} value={x.marker} onChange={e=>setM(m.map((q,j)=>j===i?{...q,marker:e.target.value}:q))}/><input value={x.label} onChange={e=>setM(m.map((q,j)=>j===i?{...q,label:e.target.value}:q))}/><span>cm</span><button type="button" onClick={(e)=>{e.stopPropagation();removeMeasurement(i)}}>×</button></div>)}</div></div></div>}
 <div className={styles.sizeTables}>{(() => {
   const indexed=m.map((item,index)=>({item,index}));
   const groups=isSetType(type)
     ? [
         {key:"upper",title:"Горнище",items:indexed.filter(({item})=>measurementPart(item)==="upper")},
         {key:"lower",title:"Долнище",items:indexed.filter(({item})=>measurementPart(item)==="lower")},
       ].filter(group=>group.items.length)
     : [{key:"all",title:"Размери",items:indexed}];
   return groups.map(group=><div className={styles.sizeTableCard} key={group.key}>
     <div className={styles.sizeTableTitle}><strong>{group.title}</strong><span>{group.items.map(({item})=>item.marker).join(" · ")}</span></div>
     <div className={styles.tableRows}>{Array.from({length:Math.ceil(group.items.length/4)},(_,chunkIndex)=>{
       const measurements=group.items.slice(chunkIndex*4,chunkIndex*4+4);
       return <div className={`${styles.tableWrap} ${chunkIndex>0?styles.continuationTable:""}`} key={chunkIndex}><table><thead><tr><th>{chunkIndex===0?"EU размер":"Към размера"}</th>{measurements.map(({item,index})=><th key={index}><span className={styles.columnMarker}>{item.marker}</span><span className={styles.columnLabel}>{stripPartPrefix(item.label)}</span></th>)}{group.key==="upper"&&chunkIndex===0&&<th className={styles.removeColumn}/>}</tr></thead><tbody>{rows.map((r,rowIndex)=><tr key={rowIndex}><td>{chunkIndex===0?<input value={r.label} onChange={e=>setRows(current=>current.map((q,j)=>j===rowIndex?{...q,label:e.target.value}:q))} placeholder="EU 38"/>:<span className={styles.linkedSizeLabel}>{r.label||"Без име"}<small>същият размер</small></span>}</td>{measurements.map(({index:valueIndex})=><td key={valueIndex}><input type="text" inputMode="text" maxLength={80} value={r.values[valueIndex]??''} onChange={e=>setRows(current=>current.map((q,k)=>k===rowIndex?{...q,values:q.values.map((v,z)=>z===valueIndex?e.target.value:v)}:q))}/></td>)}{group.key==="upper"&&chunkIndex===0&&<td><button type="button" aria-label="Премахни размера" onClick={()=>setRows(current=>current.filter((_,j)=>j!==rowIndex))}>×</button></td>}</tr>)}</tbody></table></div>
     })}</div>
   </div>);
 })()}</div><button type="button" className={styles.secondary} onClick={addSize}>+ Добави EU размер</button><button type="button" className={styles.save} onClick={save} disabled={busy}>{busy?"Запазване…":editingId?"Запази корекциите":"Запази размерната таблица"}</button>{msg&&<p className={styles.msg}>{msg}</p>}</section>
 <section className={styles.list}><div className={styles.listHeader}><div><h2>Създадени таблици</h2><p>Търси, филтрирай и коригирай вече създадени размерни стандарти.</p></div><span>{filteredGuides.length} / {guides.length}</span></div><div className={styles.filters}><label>Търсене<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Име, тип, описание..."/></label><label>Тип<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="ALL">Всички типове</option>{uniqueTypes.map(typeId=><option key={typeId} value={typeId}>{getSizeGuideType(typeId).label}</option>)}</select></label><label>Схема<select value={diagramFilter} onChange={e=>setDiagramFilter(e.target.value)}><option value="ALL">Всички</option><option value="WITH">Със схема</option><option value="WITHOUT">Без схема</option></select></label></div>{guides.length===0?<p>Все още няма създадени таблици.</p>:filteredGuides.length===0?<p>Няма таблици по избраните филтри.</p>:filteredGuides.map(g=><article key={g.id} className={editingId===g.id?styles.editingGuide:""}><div><strong>{g.name}</strong><span>{getSizeGuideType(resolveSizeGuideType(g.garmentType, g.name)).label} · {g.sizes.length} размера · {g.measurements.length} измервания · {g.showDiagram ? "с визуална схема" : "без визуална схема"} · {g._count.products} продукта</span></div><div className={styles.listActions}><button className={styles.editAction} onClick={()=>editGuide(g)}>Коригирай</button><button className={styles.diagramAction} onClick={()=>toggleDiagram(g.id,!g.showDiagram)}>{g.showDiagram ? "Скрий схемата" : "Покажи схемата"}</button><button onClick={()=>remove(g.id)}>Изтрий</button></div></article>)}</section></div>
}
