"use client";

import styles from "./DashboardCharts.module.css";

type Point = { label: string; revenue: number; orders: number };

export default function DashboardCharts({ points }: { points: Point[] }) {
  const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
  const maxOrders = Math.max(...points.map((point) => point.orders), 1);

  return (
    <div className={styles.grid}>
      <section className={styles.card}>
        <div className={styles.heading}><div><span>ПОСЛЕДНИ 14 ДНИ</span><h2>Продажби</h2></div><strong>{points.reduce((sum, p) => sum + p.revenue, 0).toFixed(2)} €</strong></div>
        <div className={styles.chart} aria-label="Продажби по дни">
          {points.map((point) => <div className={styles.column} key={point.label} title={`${point.label}: ${point.revenue.toFixed(2)} €`}><div className={styles.barTrack}><div className={styles.revenueBar} style={{ height: `${Math.max(4, (point.revenue / maxRevenue) * 100)}%` }} /></div><small>{point.label}</small></div>)}
        </div>
      </section>
      <section className={styles.card}>
        <div className={styles.heading}><div><span>ПОСЛЕДНИ 14 ДНИ</span><h2>Поръчки</h2></div><strong>{points.reduce((sum, p) => sum + p.orders, 0)}</strong></div>
        <div className={styles.chart} aria-label="Поръчки по дни">
          {points.map((point) => <div className={styles.column} key={point.label} title={`${point.label}: ${point.orders} поръчки`}><div className={styles.barTrack}><div className={styles.orderBar} style={{ height: `${Math.max(4, (point.orders / maxOrders) * 100)}%` }} /></div><small>{point.label}</small></div>)}
        </div>
      </section>
    </div>
  );
}
