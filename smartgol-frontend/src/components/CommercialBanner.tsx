import { useEffect, useRef, useState } from 'react';
import { Text } from '@mantine/core';
import { fetchActiveCommercials } from '../api/commercials';
import type { CommercialPublic } from '../types';
import classes from './CommercialBanner.module.css';

const ROTATE_MS = 8_000;

export function CommercialBanner() {
  const [items, setItems] = useState<CommercialPublic[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    let alive = true;
    fetchActiveCommercials()
      .then((data) => {
        if (!alive) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      const list = itemsRef.current;
      if (list.length <= 1) return;
      setIndex((i) => (i + 1) % list.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [items.length]);

  useEffect(() => {
    if (items.length === 0) {
      setIndex(0);
      return;
    }
    setIndex((i) => (i >= items.length ? 0 : i));
  }, [items]);

  if (!loaded || items.length === 0) return null;

  const cur = items[Math.min(index, items.length - 1)];
  const alt = cur.title?.trim() || 'Parceiro';

  return (
    <aside className={classes.wrap}>
      <div className={classes.inner}>
        <a
          className={classes.link}
          href={cur.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={alt}
        >
          <img
            className={classes.img}
            src={cur.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </a>
      </div>
      {items.length > 1 && (
        <>
          <div className={classes.meta}>
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                className={`${classes.dot} ${i === index ? classes.dotActive : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`Comercial ${i + 1} de ${items.length}`}
              />
            ))}
          </div>
          <Text className={classes.label} component="p">
            Publicidade · {index + 1}/{items.length}
          </Text>
        </>
      )}
    </aside>
  );
}
