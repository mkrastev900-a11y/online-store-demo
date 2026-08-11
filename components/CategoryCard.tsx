import Image from "next/image";
type CategoryCardProps = { title: string; subtitle: string; image: string; anchor?: string };

export function CategoryCard({ title, subtitle, image, anchor }: CategoryCardProps) {
  return (
    <a id={anchor} className="category-card" href="#products">
      <Image src={image} alt={title} width={900} height={1100} sizes="(max-width: 700px) 100vw, 33vw" />
      <div className="category-overlay" />
      <div className="category-content">
        <span>{subtitle}</span>
        <h3>{title}</h3>
        <strong>Разгледай →</strong>
      </div>
    </a>
  );
}
