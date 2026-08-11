"use client";
import { SIZE_GUIDE_TYPE_GROUPS, SIZE_GUIDE_TYPES } from "@/lib/size-guide-types";

export default function SizeGuideTypeSelect({value,onChange,className}:{value:string;onChange:(value:string)=>void;className?:string}) {
  return <select value={value} onChange={(event)=>onChange(event.target.value)} className={className}>
    {SIZE_GUIDE_TYPE_GROUPS.map((group)=><optgroup key={group} label={group}>
      {SIZE_GUIDE_TYPES.filter((item)=>item.group===group).map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}
    </optgroup>)}
  </select>;
}
