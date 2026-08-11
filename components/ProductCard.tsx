import Image from "next/image";
type ProductCardProps = {
  name: string;
  category: string;
  price: string;
  oldPrice?: string;
  badge?: string;
  image: string;
  hoverImage?: string;
  colors?: string[];
};

export function ProductCard({ name, category, price, oldPrice, badge, image, hoverImage, colors = [] }: ProductCardProps) {
  return (
    <article className="product-card">
      <a className="product-image" href="#">
        <Image className="product-main-image" src={image} alt={name} width={640} height={800} sizes="(max-width: 600px) 50vw, 25vw" />
        {hoverImage ? <Image className="product-hover-image" src={hoverImage} alt="" width={640} height={800} sizes="(max-width: 600px) 50vw, 25vw" /> : null}
        {badge ? <span className="product-badge">{badge}</span> : null}
        <button className="favorite-button" aria-label={`Добави ${name} в любими`}>♡</button>
        <span className="quick-view">Бърз преглед</span>
      </a>
      <div className="product-info">
        <span className="product-category">{category}</span>
        <h3>{name}</h3>
        <div className="product-meta">
          <div className="product-price">
            <strong>{price}</strong>
            {oldPrice ? <del>{oldPrice}</del> : null}
          </div>
          <div className="color-dots" aria-label="Налични цветове">
            {colors.map((color) => <span key={color} style={{ background: color }} />)}
          </div>
        </div>
      </div>
    </article>
  );
}
