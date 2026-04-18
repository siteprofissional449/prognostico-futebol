import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import classes from './Layout.module.css';

export function Layout() {
  return (
    <>
      <Header />
      <main className={classes.main}>
        <Outlet />
      </main>
      <MobileBottomNav />
    </>
  );
}
