import type { SiteDesign } from "@/lib/site-design";

export type EditablePageKey = "home"|"women"|"men"|"kids"|"new"|"sale"|"about"|"contact"|"cart"|"checkout"|"login"|"register"|"account"|"favorites"|"history"|"search";
export type EditablePageContent = { eyebrow:string; title:string; description:string; buttonText:string; buttonHref:string; imageUrl:string; imageVisible:boolean };

export const DEFAULT_PAGE_CONTENT: Record<EditablePageKey, EditablePageContent> = {
  home:{eyebrow:"НОВА КОЛЕКЦИЯ",title:"Елегантност, която подчертава теб",description:"Подбрани модели с внимание към детайла и качество.",buttonText:"Разгледай колекцията",buttonHref:"/new",imageUrl:"",imageVisible:true},
  women:{eyebrow:"ДАМСКА МОДА",title:"Дамски",description:"Елегантни и ежедневни модели.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  men:{eyebrow:"МЪЖКА МОДА",title:"Мъжки",description:"Изчистени и удобни мъжки модели.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  kids:{eyebrow:"ДЕТСКА МОДА",title:"Детско",description:"Практични предложения за деца.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  new:{eyebrow:"ПОСЛЕДНИ ПОПЪЛНЕНИЯ",title:"Ново",description:"Най-новите модели.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  sale:{eyebrow:"СПЕЦИАЛНИ ЦЕНИ",title:"Намаления",description:"Избрани модели с намалени цени.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  about:{eyebrow:"СЕМЕЕН БЪЛГАРСКИ БРАНД",title:"Цял живот в модата. Днес — наша собствена посока.",description:"Семеен бизнес, роден от споделен занаят, дългогодишен опит и една обща мечта.",buttonText:"Разгледай новите предложения",buttonHref:"/new",imageUrl:"",imageVisible:true},
  contact:{eyebrow:"СВЪРЖИ СЕ С НАС",title:"Как можем да помогнем?",description:"Пиши ни за продукт, поръчка, доставка или връщане.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  cart:{eyebrow:"",title:"Количка",description:"",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  checkout:{eyebrow:"ФИНАЛИЗИРАНЕ",title:"Данни за поръчката",description:"",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  login:{eyebrow:"",title:"Вход",description:"Влез в своя профил.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  register:{eyebrow:"",title:"Регистрация",description:"Създай своя профил.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  account:{eyebrow:"МОЯТ ПРОФИЛ",title:"Моят профил",description:"Управлявай данните и поръчките си.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  favorites:{eyebrow:"ЗАПАЗЕНО ЗА ПО-КЪСНО",title:"Любими",description:"Артикулите могат да бъдат преместени директно в количката.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  history:{eyebrow:"ПОСЛЕДНО РАЗГЛЕЖДАНИ",title:"Хронология",description:"Последните 50 различни артикула, които си разглеждал.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true},
  search:{eyebrow:"ТЪРСЕНЕ",title:"Търси продукти",description:"Въведи име, марка или категория в полето за търсене.",buttonText:"",buttonHref:"",imageUrl:"",imageVisible:true}
};

export function parsePageContent(value:string|null|undefined){
  try {
    const parsed = JSON.parse(value || "{}") as Partial<Record<EditablePageKey, Partial<EditablePageContent>>>;
    return Object.fromEntries(
      (Object.keys(DEFAULT_PAGE_CONTENT) as EditablePageKey[]).map((key) => [
        key,
        { ...DEFAULT_PAGE_CONTENT[key], ...(parsed[key] || {}) },
      ]),
    ) as Record<EditablePageKey, EditablePageContent>;
  }
  catch { return structuredClone(DEFAULT_PAGE_CONTENT); }
}
export function pageContent(design:SiteDesign,key:EditablePageKey){ return parsePageContent(design.pageContentJson)[key] || DEFAULT_PAGE_CONTENT[key]; }
