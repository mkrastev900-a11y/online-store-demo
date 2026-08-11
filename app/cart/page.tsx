export const dynamic = "force-dynamic";
export const revalidate = 0;
import CartClient from "@/components/cart/CartClient";import styles from "./cart.module.css";import{getSiteDesign}from"@/lib/site-design";import{pageContent}from"@/lib/page-content";export default async function Page(){const c=pageContent(await getSiteDesign(),"cart");return <main className={styles.main}>{c.eyebrow&&<span>{c.eyebrow}</span>}<h1>{c.title}</h1>{c.description&&<p>{c.description}</p>}<CartClient/></main>}
